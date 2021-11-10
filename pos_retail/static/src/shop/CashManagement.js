"use strict";
odoo.define('pos_retail.cash_management', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var rpc = require('pos.rpc');
    var PopupWidget = require('point_of_sale.popups');

    var button_cash_management = screens.ActionButtonWidget.extend({
        template: 'button_cash_management',
        init: function (parent, options) {
            this._super(parent, options);
            this.pos.bind('open:cash-control', function () {
                this.button_click()
            }, this);
        },
        button_click: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'pos.session',
                    method: 'search_read',
                    args: [[['id', '=', self.pos.pos_session.id]]]
                }).then(function (sessions) {
                    if (sessions) {
                        self.pos.gui.show_popup('popup_session', {
                            session: sessions[0]
                        })
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Have something wrong, could not find your session')
                        })
                    }
                    resolve()
                }, function (err) {
                    self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Your session offline mode, could not calling odoo server')
                    });
                    reject(err)
                });
            })
        }
    });
    screens.define_action_button({
        'name': 'button_cash_management',
        'widget': button_cash_management,
        'condition': function () {
            var active_button = this.pos.config.management_session && this.pos.config.default_cashbox_id && this.pos.config.cash_control;
            if (active_button) {
                var self = this;
                return rpc.query({
                    model: 'product.product',
                    method: 'search_read',
                    domain: [['id', 'in', this.pos.config.cash_inout_reason_ids]],
                    fields: []
                }).then(function (cash_inout_products_reason) {
                    self.pos.cash_inout_products_reason = cash_inout_products_reason;
                }, function (err) {
                    self.pos.query_backend_fail(err);
                });
            }
            return active_button;
        }
    });

    var popup_balance = PopupWidget.extend({
        template: 'popup_balance',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .cashbox-add': 'onclick_cashboxadd',
            'click .cashbox-delete': 'onclick_cashboxdelete',
            'blur .cashbox-edit': 'onchange_text'
        }),

        onclick_cashboxadd: function (e) {
            var self = this;
            var table = document.getElementById('cashbox-grid');
            var rowCount = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr").length;

            var newRow = table.insertRow(rowCount);
            var row = rowCount - 1;
            newRow.id = row;

            var col1html = "";
            var col2html = "<input id='cashbox_" + row + "_coin_value' value='0' name='coin_value' class='cashbox-edit'/>";
            var col3html = "<input id='cashbox_" + row + "_number' value='0' name='number' class='cashbox-edit' onkeypress='return (event.charCode &gt;= 48 &amp;&amp; event.charCode &lt;= 57) || (event.charCode == 0 || event.charCode == 08 || event.charCode == 127)'/>";
            var col4html = "";
            var col5html = "<span class='cashbox-delete fa fa-trash-o' name='delete'/>";

            var col1 = newRow.insertCell(0);
            col1.style = "display:none";
            col1.innerHTML = col1html;
            var col2 = newRow.insertCell(1);
            col2.innerHTML = col2html;
            var col3 = newRow.insertCell(2);
            col3.innerHTML = col3html;
            var col4 = newRow.insertCell(3);
            col4.id = "cashbox_" + row + "_subtotal";
            col4.innerHTML = col4html;
            var col5 = newRow.insertCell(4);
            if (self.options.pos_cashbox_line[0]['is_delete']) {
                col5.innerHTML = col5html;
            }
        },
        onclick_cashboxdelete: function (e) {
            var self = this;
            var tr = $(e.currentTarget).closest('tr');
            var record_id = tr.find('td:first-child').text();
            if (parseInt(record_id))
                tr.find("td:not(:first)").remove();
            else
                tr.find("td").remove();
            tr.hide();
            var tr_id = tr.attr('id');
            var tbl = document.getElementById("cashbox-grid");
            var row = tbl.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
            var total = 0;
            for (var i = 0; i < row.length - 1; i++) {
                var cell_count = row[i].cells.length;
                if (cell_count > 1) {
                    var subtotal = document.getElementById("cashbox_" + i + "_subtotal").innerHTML;
                    if (subtotal)
                        total += parseFloat(subtotal);
                }
            }
            document.getElementById("cashbox_total").innerHTML = total;
        },
        onchange_text: function (e) {
            var self = this;
            var tr = $(e.currentTarget).closest('tr');
            var tr_id = tr.attr('id');
            var number = document.getElementById("cashbox_" + tr_id + "_number").value;
            var coin_value = document.getElementById("cashbox_" + tr_id + "_coin_value").value;
            document.getElementById("cashbox_" + tr_id + "_subtotal").innerHTML = number * coin_value;
            var tbl = document.getElementById("cashbox-grid");
            var row = tbl.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
            var total = 0;
            for (var i = 0; i < row.length - 1; i++) {
                var cell_count = row[i].cells.length;
                if (cell_count > 1) {
                    var subtotal = document.getElementById("cashbox_" + i + "_subtotal").innerHTML;
                    if (subtotal)
                        total += parseFloat(subtotal);
                }
            }
            document.getElementById("cashbox_total").innerHTML = total;
        }
    });
    gui.define_popup({name: 'popup_balance', widget: popup_balance});

    var popup_money_control = PopupWidget.extend({
        template: 'popup_money_control',
        show: function (options) {
            this.options = options;
            this._super(options);
        },
        click_confirm: function () {
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['reason']) {
                return this.wrong_input('input[name="reason"]', '(*) Reason is required');
            } else {
                this.passed_input('input[name="reason"]')
            }
            if (!fields['amount']) {
                return this.wrong_input('input[name="amount"]', '(*) Amount is required');
            } else {
                fields.amount = parseFloat(fields.amount);
                this.passed_input('input[name="amount"]');
            }
            if (fields['amount'] <= 0) {
                return this.wrong_input('input[name="amount"]', '(*) Amount could not smaller than 0');
            } else {
                this.passed_input('input[name="amount"]')
            }
            if (!fields['product_id'] && this.pos.cash_inout_products_reason) {
                return this.wrong_input('input[name="product_id"]', 'Reason is required');
            } else {
                this.passed_input('input[name="product_id"]');
                fields['product_id'] = parseInt(fields.product_id)
            }
            fields['session_id'] = this.pos.pos_session.id;
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, fields);
            }
        }
    });
    gui.define_popup({name: 'popup_money_control', widget: popup_money_control});

    var popup_session = PopupWidget.extend({
        template: 'popup_session',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .PutMoneyIn': 'put_money_in',
            'click .TakeMoneyOut': 'take_money_out',
            'click .SetClosingBalance': 'closing_balance',
            'click .EndOfSession': 'end_of_session',
            'click .ValidateClosingControl': 'onclick_vcpentries',
            'click .printstatement': 'print_pos_session_report'
        }),
        show: function (options) {
            var self = this;
            var session = options.session;
            this.session = session;
            this._super(options);
            if (this.session.state == 'closed') {
                this.pos.gui.close_popup();
                this.pos.gui.show_popup('popup_sale_summary_session_report', {
                    title: 'Your Pos Session is Closed',
                    body: 'Are you want print Z-Report (Your Session Sale Summary) click Print button, else Click Close Button color red for leave POS',
                    session_id: this.session.id,
                    cancel: function () {
                        self.pos.gui.close()
                    }
                })
            }
            $('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
        },
        put_money_in: function () {
            var self = this;
            self.pos.gui.show_popup('popup_money_control', {
                'title': 'Put Money In',
                'body': 'Fill in this form if you put money in the cash register: ',
                confirm: function (values) {
                    rpc.query({
                        model: 'cash.box.out',
                        method: 'cash_input_from_pos',
                        args: [0, values],
                    }).then(function (result) {
                        if (result) {
                            self.pos.gui.show_popup('dialog', {
                                'title': _t('Put Money In'),
                                'body': JSON.stringify(result),
                                'color': 'success'
                            });
                        }
                        return self.pos.trigger('open:cash-control');
                    }, function (err) {
                        self.pos.query_backend_fail(err);
                    });
                },
                cancel: function () {
                    self.pos.trigger('open:cash-control');
                }
            });
        },
        take_money_out: function () {
            var self = this;
            self.pos.gui.show_popup('popup_money_control', {
                'title': 'Take Money Out',
                'body': 'Describe why you take money from the cash register: ',
                confirm: function (values) {
                    values['amount'] =  -values.amount;
                    return rpc.query({
                        model: 'cash.box.out',
                        method: 'cash_input_from_pos',
                        args: [0, values],
                    }).then(function (result) {
                        if (result) {
                            self.pos.gui.show_popup('dialog', {
                                'title': _t('Take Money Out'),
                                'body': JSON.stringify(result),
                                'color': 'success'
                            });
                        }
                        return self.pos.trigger('open:cash-control');

                    }, function (err) {
                        self.pos.query_backend_fail(err);
                    });
                },
                cancel: function () {
                    self.pos.trigger('open:cash-control');
                }
            });
        },
        closing_balance: function (e) {
            var self = this;
            var tr = $(e.currentTarget);
            var balance = tr.attr('value');
            rpc.query({
                model: 'pos.session',
                method: 'get_cashbox',
                args: [0, self.pos.pos_session.id, balance],
            }).then(function (result) {
                self.pos.gui.show_popup('popup_balance', {
                    'title': _t('Cash Control'),
                    'pos_cashbox_line': result,
                    confirm: function () {
                        var values = [];
                        var tbl = document.getElementById("cashbox-grid");
                        var row = tbl.getElementsByTagName("tbody")[0].getElementsByTagName("tr");
                        if (tbl != null) {
                            for (var i = 0; i < row.length - 1; i++) {
                                var id = null, number = null, coin_value = null;
                                var cell_count = row[i].cells.length;
                                for (var j = 0; j < cell_count ? 3 : 0; j++) {
                                    if (j == 0)
                                        id = row[i].cells[j].innerHTML;
                                    var children = row[i].cells[j].childNodes;
                                    for (var k = 0; k < children.length; k++) {
                                        if (children[k].value) {
                                            if (j == 1)
                                                coin_value = children[k].value;
                                            if (j == 2)
                                                number = children[k].value;
                                        }
                                    }
                                }
                                if (cell_count > 0)
                                    values.push({'id': parseInt(id)});
                            }
                        }
                        return rpc.query({
                            model: 'account.bank.statement.cashbox',
                            method: 'validate_from_ui',
                            args: [0, self.pos.pos_session.id, balance, values],
                        }).then(function (result) {
                            if (result)
                                self.pos.gui.show_popup('confirm', {
                                    'title': _t('Cash Control'),
                                    'body': JSON.stringify(result),
                                    'cancel': function () {
                                        self.pos.trigger('open:cash-control');
                                    }
                                });
                            else
                                self.pos.trigger('open:cash-control');
                        }, function (err) {
                            return self.pos.query_backend_fail(err)
                        });
                    },
                    cancel: function () {
                        self.pos.trigger('open:cash-control');
                    }
                });
            });
        },
        onclick_vcpentries: function () {
            var self = this;
            var id = self.pos.pos_session.id;
            this.gui.close_popup();
            rpc.query({
                model: 'pos.session',
                method: 'action_pos_session_validate',
                args: [id],
            }, {shadow: true}).then(function (result) {
                return self.pos.gui.show_popup('popup_sale_summary_session_report', {
                    title: 'Print Z-Report, Session Sale Summary',
                    body: 'Are you want print Z-Report (Your Session Sale Summary',
                    session_id: self.pos.pos_session.id,
                    cancel: function () {
                        self.pos.gui.close()
                    }
                })
            }, function (err) {
                self.pos.query_backend_fail(err)
            })
        },
        end_of_session: function () {
            var self = this;
            var id = self.pos.pos_session.id;
            var method = 'close_session_and_validate';
            this.gui.close_popup();
            rpc.query({
                model: 'pos.session',
                method: method,
                args: [id]
            }).then(function (result) {
                self.pos.trigger('open:cash-control');
            }, function (err) {
                self.pos.query_backend_fail(err)
            })
        },
        print_pos_session_report: function () {
            var self = this;
            var id = self.pos.pos_session.id;
            self.chrome.do_action('pos_retail.pos_session_report',
                {
                    additional_context: {active_ids: [id],}
                });
        }

    });
    gui.define_popup({name: 'popup_session', widget: popup_session});

});
