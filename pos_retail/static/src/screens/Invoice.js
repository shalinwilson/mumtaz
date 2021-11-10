"use strict";
odoo.define('pos_retail.screen_invoices', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var chrome = require('point_of_sale.chrome');
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('web.rpc');

    var popup_invoice_register_payment = PopupWidget.extend({
        template: 'popup_invoice_register_payment',
        show: function (options) {
            options = options || {};
            options.cashregisters = this.pos.cashregisters;
            options.payment_methods = this.pos.payment_methods;
            options.invoice = options.invoice;
            this.options = options;
            this._super(options);

        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            var invoice = this.options.invoice;
            if (!fields['residual'] || fields['residual'] <= 0) {
                return self.wrong_input('input[name="residual"]', "(*) Residual is required and bigger than 0");
            } else {
                self.passed_input('input[name="residual"]');
            }
            if (!fields['journal_id']) {
                return self.wrong_input('input[name="journal_id"]', "(*) Journal is required");
            }
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, this.options.invoice.id, parseInt(fields['journal_id']), parseFloat(fields['residual']));
            }
        }
    });
    gui.define_popup({name: 'popup_invoice_register_payment', widget: popup_invoice_register_payment});

    var popup_account_invoice_refund = PopupWidget.extend({
        template: 'popup_account_invoice_refund',
        show: function (options) {
            options = options || {};
            this.options = options;
            this._super(options);
            this.$('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD H:mm:00',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }

            });
            this.$('.datepicker').datetimepicker({
                format: 'YYYY-MM-DD',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            this.$('.timepicker').datetimepicker({
                //          format: 'H:mm',    // use this format if you want the 24hours timepicker
                format: 'H:mm:00', //use this format if you want the 12hours timpiecker with AM/PM toggle
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
        },
        click_confirm: function () {
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['refund_method']) {
                return this.wrong_input('input[name="refund_method"]', '(*) Credit Method is required');
            } else {
                this.passed_input('input[name="filter_refund"]')
            }
            if (!fields['reason']) {
                return this.wrong_input('input[name="reason"]', '(*) Reason is required');
            } else {
                this.passed_input('input[name="description"]');
            }
            if (!fields['date']) {
                return this.wrong_input('input[name="date"]', '(*) Refund Date is required');
            } else {
                this.passed_input('input[name="date_invoice"]')
            }
            this.pos.gui.close_popup();
            fields['move_id'] = this.options.invoice['id'];
            if (this.options.confirm) {
                this.options.confirm.call(this, fields);
            }
        }
    });
    gui.define_popup({name: 'popup_account_invoice_refund', widget: popup_account_invoice_refund});

    var ButtonInvoicesScreen = screens.ActionButtonWidget.extend({
        template: 'ButtonInvoicesScreen',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('reload:countOrders', function () {
                self.renderElement();
            }, this);
        },
        button_click: function () {
            this.pos.gui.show_screen('invoices');
        },
        get_count_invoices: function () {
            var invoices = this.pos.db.get_invoices();
            return invoices.length;
        }
    });

    screens.define_action_button({
        'name': 'ButtonInvoicesScreen',
        'widget': ButtonInvoicesScreen,
        'condition': function () {
            return this.pos.config.management_invoice
        }
    });

    var InvoiceScreen = screens.ScreenWidget.extend({
        template: 'InvoiceScreen',
        start: function () {
            var self = this;
            this._super();
            this.MAP_INVOICE_TYPE_PARTNER_TYPE = {
                'out_invoice': 'customer',
                'out_refund': 'customer',
                'out_receipt': 'customer',
                'in_invoice': 'supplier',
                'in_refund': 'supplier',
                'in_receipt': 'supplier',
            };
            this.apply_sort_invoice();
            this.pos.bind('reload:countOrders', function () {
                self.render_invoice_list(self.pos.db.get_invoices(1000));
                if (self.invoice_selected) {
                    var invoice = self.pos.db.invoice_by_id[self.invoice_selected['id']];
                    if (invoice) {
                        self.display_invoice_details(invoice)
                    } else {
                        self.hide_invoice_selected()
                    }
                }
            })
        },
        get_draft_invoices: function () {
            var invoices = _.filter(this.pos.db.get_invoices(), function (invoice) {
                return invoice.state == 'draft';
            });
            return invoices.length
        },
        renderElement: function () {
            var self = this;
            this.search_handler = function (event) {
                if (event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8) {
                    var searchbox = this;
                    setTimeout(function () {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 70);
                }
            };
            this._super();
            this.$('.invoice-list').delegate('.invoice-line', 'click', function (event) {
                self.invoice_select(event, $(this), parseInt($(this).data('id')));
            });
            this.$('.invoices_draft').click(function () {
                var invoices = _.filter(self.pos.db.get_invoices(), function (invoice) {
                    return invoice.state == 'draft';
                });
                var contents = self.$('.invoice-details-contents');
                contents.empty();
                if (invoices) {
                    return self.render_invoice_list(invoices);
                }
            });
            this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);
            this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
        },
        show: function () {
            this.render_screen();
            this._super();
            this.$el.find('input').focus();
            if (this.invoice_selected) {
                this.display_invoice_details(this.invoice_selected);
            }
        },
        apply_sort_invoice: function () {
            var self = this;
            this.$('.sort_by_invoice_id').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('id', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_create_date').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('create_date', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_name').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_origin').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('invoice_origin', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_partner_name').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('partner_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_payment_term_id').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('payment_term', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_date_invoice').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('date_invoice', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_date_due').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('date_due', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_user_id').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('user', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_amount_tax').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('amount_tax', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_amount_total').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('amount_total', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_residual').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('residual', self.reverse, parseInt));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_invoice_state').click(function () {
                var invoices = self.pos.db.get_invoices().sort(self.pos.sort_by('state', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_invoice_list(invoices);
                self.reverse = !self.reverse;
            });
        },
        invoice_select: function (event, $invoice, id) {
            var invoice = this.pos.db.get_invoice_by_id(id);
            this.$('.invoice-line').removeClass('highlight');
            $invoice.addClass('highlight');
            this.display_invoice_details(invoice);
        },
        display_invoice_details: function (invoice) {
            var self = this;
            this.invoice_selected = invoice;
            setTimeout(function () {
                self.$('.searchbox input')[0].value = '';
                self.$('.searchbox input').focus();
            }, 1000);
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            var $row_selected = this.$("[data-id='" + invoice['id'] + "']");
            $row_selected.addClass('highlight');
            invoice.link = window.location.origin + "/web#id=" + invoice.id + "&view_type=form&model=account.move";
            contents.append($(qweb.render('InvoiceForm', {widget: this, invoice: invoice})));
            var account_invoice_lines = this.pos.db.lines_invoice_by_id[invoice['id']];
            if (account_invoice_lines) {
                var line_contents = this.$('.invoice_lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('AccountMoveLines', {
                    widget: this,
                    account_invoice_lines: account_invoice_lines
                })));
            }
            this.$('.inv-print-invoice').click(function () { // print invoice
                self.chrome.do_action('account.account_invoices', {
                    additional_context: {
                        active_ids: [self.invoice_selected['id']]
                    }
                })
            });
            this.$('.inv-print-invoice-without-payment').click(function () { // print invoice without payment
                self.chrome.do_action('account.account_invoices_without_payment', {
                    additional_context: {
                        active_ids: [self.invoice_selected['id']]
                    }
                })
            });
            this.$('.post').click(function () {
                self.gui.show_popup('confirm', {
                    title: _t('Alert'),
                    body: _t('Are you want post invoice ?'),
                    confirm: function () {
                        return rpc.query({
                            model: 'account.move',
                            method: 'action_post',
                            args: [[self.invoice_selected.id]]
                        }).then(function (status) {
                            self.pos.reloadAccountMove();
                            self.pos.gui.show_popup('dialog', {
                                title: _t('Alert'),
                                body: _t('Posted invoice ' + self.invoice_selected.name),
                                color: 'success'
                            })
                        }, function (err) {
                            return self.pos.query_backend_fail(err);
                        })
                    }
                });
            });
            this.$('.register_payment').click(function () {
                self.gui.show_popup('popup_invoice_register_payment', {
                    title: _t('Register Payment: ' + self.invoice_selected.name),
                    invoice: self.invoice_selected,
                    confirm: function (invoice_id, journal_id, amount) {
                        var payment_type = 'outbound';
                        if (amount > 0) {
                            payment_type = 'inbound';
                        }
                        var journal = self.pos.journal_by_id[journal_id];
                        var payment_method_id = null;
                        if (payment_type == 'outbound') {
                            payment_method_id = journal.outbound_payment_method_ids[0]
                        }
                        if (payment_type == 'inbound') {
                            payment_method_id = journal.inbound_payment_method_ids[0]
                        }
                        if (!payment_method_id) {
                            return self.pos.gui.show_popup('confirm', {
                                title: _t('Warning'),
                                body: _t('Register Payment with Journal ' + journal.name + ', not set Inbound and OutBound Payment Method')
                            })
                        }
                        var payment = {
                            partner_type: self.MAP_INVOICE_TYPE_PARTNER_TYPE[self.invoice_selected.type],
                            payment_type: payment_type,
                            partner_id: self.invoice_selected.partner_id[0],
                            amount: amount,
                            currency_id: self.invoice_selected.currency_id[0],
                            payment_date: new Date(),
                            journal_id: journal_id,
                            payment_method_id: payment_method_id,
                            invoice_ids: [[6, false, [self.invoice_selected.id]]]
                        };
                        self.amount_register_paid = amount;
                        rpc.query({
                            model: 'account.payment',
                            method: 'create',
                            args:
                                [payment]
                        }).then(function (payment_id) {
                            return rpc.query({
                                model: 'account.payment',
                                method: 'post',
                                args: [[payment_id]],
                            }).then(function (result) {
                                self.pos.reloadAccountMove();
                                self.pos.gui.show_popup('dialog', {
                                    title: _t('Alert'),
                                    body: _t('Register Payment Amount:  ' + self.amount_register_paid + ' for invoice: ' + self.invoice_selected.name + ' succeed.'),
                                    color: 'success'
                                })
                            }, function (err) {
                                self.pos.query_backend_fail(err);
                            })
                        }, function (err) {
                            self.pos.query_backend_fail(err);
                        })
                    }
                })
            });
            this.$('.add_credit_note').click(function () {
                self.gui.show_popup('popup_account_invoice_refund', {
                    title: _t('Credit Note: ' + self.invoice_selected.name),
                    invoice: self.invoice_selected,
                    confirm: function (values) {
                        rpc.query({
                            model: 'account.move.reversal',
                            method: 'create',
                            args: [values]
                        }).then(function (reversal_id) {
                            return rpc.query({
                                model: 'account.move.reversal',
                                method: 'reverse_moves',
                                args: [[reversal_id]],
                            }).then(function (results) {
                                self.pos.reloadAccountMove();
                                self.pos.gui.show_popup('dialog', {
                                    title: _t('Alert'),
                                    body: _t('Add Credit Note for invoice: ' + self.invoice_selected.name + ' succeed.'),
                                    color: 'success'
                                })
                            }, function (err) {
                                self.pos.query_backend_fail(err);
                            })
                        }, function (err) {
                            self.pos.query_backend_fail(err);
                        })
                    }
                })
            });
        },
        hide_invoice_selected: function () { // hide when re-print receipt
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            this.invoice_selected = null;

        },
        render_screen: function () {
            this.pos.invoice_selected = null;
            var self = this;
            if (this.pos.db.get_invoices().length) {
                this.render_invoice_list(this.pos.db.get_invoices(1000));
            }
            this.$('.back').click(function () {
                self.clear_search();
                self.gui.show_screen('products');
            });
        },
        perform_search: function (query, associate_result) {
            if (query) {
                var invoices = this.pos.db.search_invoice(query);
                this.render_invoice_list(invoices);
            } else {
                var invoices = this.pos.db.get_invoices(1000);
                this.render_invoice_list(invoices);
            }
        },
        clear_search: function () {
            var contents = this.$('.invoice-details-contents');
            contents.empty();
            var invoices = this.pos.db.get_invoices(1000);
            this.render_invoice_list(invoices);
            this.hide_invoice_selected();
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_128';
        },
        render_invoice_list: function (invoices) {
            var contents = this.$el[0].querySelector('.invoice-list');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(invoices.length, 1000); i < len; i++) {
                var invoice = invoices[i];
                var invoice_html = qweb.render('InvoiceRow', {
                    widget: this,
                    invoice: invoice
                });
                invoice = document.createElement('tbody');
                invoice.innerHTML = invoice_html;
                invoice = invoice.childNodes[1];
                contents.appendChild(invoice);
            }
        }
    });

    gui.define_screen({name: 'invoices', widget: InvoiceScreen});

    return InvoiceScreen
});
