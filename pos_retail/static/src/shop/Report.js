odoo.define('pos_retail.report', function (require) {
    "use strict";

    var gui = require('point_of_sale.gui');
    var screens = require('point_of_sale.screens');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var core = require('web.core');
    var _t = core._t;
    var Qweb = core.qweb;
    var chrome = require('point_of_sale.chrome');
    var field_utils = require('web.field_utils');
    var Printer = require('point_of_sale.Printer').Printer;
    var PosBaseWidget = require('point_of_sale.BaseWidget');

    var ButtonReport = screens.ActionButtonWidget.extend({
        template: 'ButtonReport',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('open:report', function () {
                self.button_click();
            });
        },
        button_click: function () {
            var self = this;
            var list_report = [];
            if (self.pos.config.report_product_summary) {
                list_report.push({
                    'label': 'Report Products Summary',
                    'item': 1
                })
            }
            if (self.pos.config.report_order_summary) {
                list_report.push({
                    'label': 'Report Orders Summary',
                    'item': 2
                })
            }
            if (self.pos.config.report_payment_summary) {
                list_report.push({
                    'label': 'Report Payment Summary',
                    'item': 3
                })
            }
            if (self.pos.config.report_sale_summary) {
                list_report.push({
                    'label': 'Z-Report (Your Session Sale Summary)',
                    'item': 4
                })
            }
            list_report.push({
                'label': 'Sale Summary Detail of your Session',
                'item': 5
            })
            return self.pos.gui.show_popup('selection', {
                title: _t('Please select one report need review'),
                list: list_report,
                confirm: function (report) {
                    if (report == 1) {
                        return self.gui.show_popup('popup_report_product_summary');
                    }
                    if (report == 2) {
                        return self.gui.show_popup('popup_report_order_summary');
                    }
                    if (report == 3) {
                        return self.gui.show_popup('popup_report_payment_summary');
                    }
                    if (report == 4) {
                        var params = {
                            model: 'pos.session',
                            method: 'build_sessions_report',
                            args: [[self.pos.pos_session.id]],
                        };
                        return rpc.query(params, {shadow: true}).then(function (values) {
                            var report = values[self.pos.pos_session.id];
                            var start_at = field_utils.parse.datetime(report.session.start_at);
                            start_at = field_utils.format.datetime(start_at);
                            report['start_at'] = start_at;
                            if (report['stop_at']) {
                                var stop_at = field_utils.parse.datetime(report.session.stop_at);
                                stop_at = field_utils.format.datetime(stop_at);
                                report['stop_at'] = stop_at;
                            }
                            self.pos.gui.popup_instances['confirm'].show_report('report_sale_summary_session_html', 'report_sale_summary_session_xml', {
                                widget: self,
                                pos: self.pos,
                                report: report,
                            });
                        }, function (err) {
                            self.pos.query_backend_fail(err);
                        })
                    }
                    if (report == 5) {
                        return rpc.query({
                            model: 'report.point_of_sale.report_saledetails',
                            method: 'get_sale_details',
                            args: [false, false, false, [self.pos.pos_session.id]],
                        }).then(function (result) {
                            var env = {
                                widget: new PosBaseWidget(self),
                                company: self.pos.company,
                                pos: self.pos,
                                products: result.products,
                                payments: result.payments,
                                taxes: result.taxes,
                                total_paid: result.total_paid,
                                date: (new Date()).toLocaleString(),
                            };
                            self.pos.gui.popup_instances['confirm'].show_report('SaleDetailsReport', 'SaleDetailsReport',  env);
                        });
                    }
                },
            });
        }
    });

    screens.define_action_button({
        'name': 'ButtonReport',
        'widget': ButtonReport,
        'condition': function () {
            return (this.pos.config.report_product_summary || this.pos.config.report_order_summary || this.pos.config.report_payment_summary || this.pos.config.report_sale_summary)
        }
    });

    var report = screens.ScreenWidget.extend({
        template: 'report',
        show: function (options) {
            this.pos.gui.close_popup();
            this.options = options || {};
            if (!this.options) {
                this.options = {};
                options = {};
            }
            this._super(options);
            this.render_receipt();
            this.handle_auto_print();
            this.$('.name').text("");
            this.$('.email').text("");
            this.$('.body').text("");
            this.$('.email_result').text("");
            this.$('.email_issue').text("");
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        print_web: function () {
            var self = this;
            this.pos.gui.close_popup();
            this.$('.email-receipt-container').addClass('oe_hidden');
            this.$('.pos-receipt-container').css({'width': '100%', 'float': 'unset'})
            window.print();
            setTimeout(function () {
                self.$('.email-receipt-container').removeClass('oe_hidden');
                self.$('.pos-receipt-container').css({'width': '50%', 'float': 'left'})
            }, 1000)
        },
        print_xml: function () {
            if (!this.pos.no_of_copies) {
                this.pos.no_of_copies = 1
            }
            if (this.pos.epson_printer_default && this.pos.report_xml && this.pos.gui) {
                var i = 0;
                while (i < this.pos.no_of_copies) {
                    this.pos.print_network(this.pos.report_html, this.pos.epson_printer_default['ip']);
                    i++;
                }
            } else {
                var i = 0;
                while (i < this.pos.no_of_copies) {
                    this.pos.proxy.printer.print_receipt(this.pos.report_html);
                    i++;
                }
            }
        },
        print: function () {
            var self = this;
            if (this.pos.proxy.printer && this.pos.report_xml) {
                this.print_xml();
                this.lock_screen(false);
            } else {
                this.lock_screen(true);
                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);
                this.print_web();
            }
        },
        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
                self.pos.trigger('back:order');
            });
            this.$('.next').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
                self.pos.trigger('back:order');
            });
            this.$('.button.print').click(function () {
                self.print();
            });
            this.$('.send_email').click(function () {
                var name = self.$('.name').val();
                var email = self.$('.email').val();
                var body = self.$('.body').val();
                if (!email || email == "" || !name || name == "") {
                    self.$('.email_issue').text("Please input Subject and Email !");
                    self.$('.email_result').text("");
                } else {
                    self.build_receipt(name, email, body).then(function () {
                        self.$('.email_issue').text("");
                        self.$('.email_result').text("Email send succeed !");
                    }, function (err) {
                        self.$('.email_issue').text("Could not send email, please check your internet or your odoo Email Setting !");
                        self.$('.email_result').text("");
                    });
                }
            });
        },
        build_receipt: function (name, email, body) {
            var printer = new Printer();
            var self = this;
            return new Promise(function (resolve, reject) {
                debugger
                printer.htmlToImg(self.pos.report_html).then(function (ticket) {
                    rpc.query({
                        model: 'pos.order',
                        method: 'action_send_email',
                        args: [name, ticket, email, body],
                    }).then(function () {
                        resolve();
                    }).catch(function () {
                        reject("There is no internet connection, impossible to send the email.");
                    });
                });
            });
        },
        render_receipt: function () {
            var contents;
            if (!this.pos.config.receipt_fullsize) {
                contents = this.$('.pos-receipt-container');
            } else {
                contents = this.$('.pos-receipt-container-fullsize');
            }
            contents.empty();
            if (this.pos.no_of_copies) {
                var i = 0;
                while (i < this.pos.no_of_copies) {
                    contents.append(this.pos.report_html);
                    i++;
                }
            } else {
                contents.html(this.pos.report_html);
            }

        }
    });

    gui.define_screen({name: 'report', widget: report});

    // TODO: Product Summary Report
    var popup_report_product_summary = PopupWidget.extend({
        template: 'popup_report_product_summary',
        show: function (options) {
            options = options || {};
            this._super(options);
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
            var self = this;
            this.pos.signature = false;
            var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date_of_month = firstDay.toISOString().split('T')[0];
            if (this.pos.config.signature) {
                self.pos.signature = true;
            }
            this.$('input#current_session_report').click(function () {
                if ($(this).prop("checked") == true) {
                    self.$(".date_input_container").hide();
                } else if ($(this).prop("checked") == false) {
                    self.$(".date_input_container").show();
                }
            });
            this.$('.popup_field').each(function (idx, el) {
                if (el.name == 'from_date' && self.pos.config.report_product_current_month_date) {
                    $(el).val(first_date_of_month);
                }
                if (el.name == 'to_date' && self.pos.config.report_product_current_month_date) {
                    $(el).val(today_date);
                }
                if (el.name == 'product_summary' && self.pos.config.report_product_summary_auto_check_product) {
                    $(el).click();
                }
                if (el.name == 'category_summary' && self.pos.config.report_product_summary_auto_check_category) {
                    $(el).click();
                }
                if (el.name == 'location_summary' && self.pos.config.report_product_summary_auto_check_location) {
                    $(el).click();
                }
                if (el.name == 'payment_summary' && self.pos.config.report_product_summary_auto_check_payment) {
                    $(el).click();
                }
                if (el.name == 'current_session_report' && self.pos.config.report_current_session_report) {
                    $(el).click();
                    self.$(".date_input_container").hide();
                }
            });
        },
        click_confirm: function () {
            var self = this;
            var summary = [];
            var fields = {};
            this.$('.popup_field').each(function (idx, el) {
                if (['current_session_report', 'product_summary', 'category_summary', 'location_summary', 'payment_summary'].indexOf(el.name) != -1) {
                    fields[el.name] = $(el).prop("checked");
                } else {
                    fields[el.name] = el.value
                }
            });
            if (fields.no_of_copies <= 0) {
                return this.wrong_input('input[name="no_of_copies"]', '(*) Field No of Copies required bigger than 0');
            }
            if (fields['product_summary']) {
                summary.push('product_summary')
            }
            if (fields['category_summary']) {
                summary.push('category_summary')
            }
            if (fields['location_summary']) {
                summary.push('location_summary')
            }
            if (fields['payment_summary']) {
                summary.push('payment_summary')
            }
            var from_date = fields.from_date;
            var to_date = fields.to_date;
            this.from_date = from_date;
            this.to_date = to_date;
            this.pos.no_of_copies = fields['no_of_copies'];
            if (fields.current_session_report) {
                var pos_session_id = self.pos.pos_session.id;
                var val = {
                    'from_date': null,
                    'to_date': null,
                    'summary': summary,
                    'session_id': pos_session_id
                };
                var params = {
                    model: 'pos.order',
                    method: 'product_summary_report',
                    args: [val],
                };
                this.from_date = null;
                this.to_date = null;
                return rpc.query(params, {shadow: false}).then(function (results) {
                    results.product_summary = Object.values(results.product_summary).sort(self.pos.sort_by('quantity', true, parseInt));
                    if (results) {
                        self.render_report(results)
                    }
                });
            } else {
                if (!from_date) {
                    return this.wrong_input('input[name="from_date"]', '(*) Start date required');
                } else {
                    this.passed_input('input[name="from_date"]');
                }
                if (!to_date) {
                    return this.wrong_input('input[name="to_date"]', '(*) To Date required');
                } else {
                    this.passed_input('input[name="to_date"]');
                }
                if (from_date > to_date) {
                    this.wrong_input('input[name="from_date"]');
                    return this.wrong_input('input[name="to_date"]', '(*) From Date could not bigger than To Date');
                } else {
                    this.passed_input('input[name="from_date"]');
                }
                var val = {
                    'from_date': from_date,
                    'to_date': to_date,
                    'summary': summary
                };
                var params = {
                    model: 'pos.order',
                    method: 'product_summary_report',
                    args: [val],
                };
                this.from_date = fields.from_date;
                this.to_date = fields.to_date;
                rpc.query(params, {shadow: false}).then(function (results) {
                    results['product_summary'] = Object.values(results.product_summary).sort(self.pos.sort_by('quantity', true, parseInt));
                    if (results) {
                        self.render_report(results)
                    }
                });
            }
        },
        render_report: function (results) {
            if (Object.keys(results['category_summary']).length == 0 && Object.keys(results['product_summary']).length == 0 &&
                Object.keys(results['location_summary']).length == 0 && Object.keys(results['payment_summary']).length == 0) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Data not found for report')
                })
            } else {
                var product_total_qty = 0.0;
                var category_total_qty = 0.0;
                var payment_summary_total = 0.0;
                if (results['product_summary']) {
                    _.each(results['product_summary'], function (value, key) {
                        product_total_qty += value;
                    });
                }
                if (results['category_summary']) {
                    _.each(results['category_summary'], function (value, key) {
                        category_total_qty += value;
                    });
                }
                if (results['payment_summary']) {
                    _.each(results['payment_summary'], function (value, key) {
                        payment_summary_total += value;
                    });
                }
                var product_summary;
                var category_summary;
                var payment_summary;
                var location_summary;
                if (Object.keys(results['product_summary']).length) {
                    product_summary = true;
                }
                if (Object.keys(results['category_summary']).length) {
                    category_summary = true;
                }
                if (Object.keys(results['payment_summary']).length) {
                    payment_summary = true;
                }
                if (Object.keys(results['location_summary']).length) {
                    location_summary = true;
                }
                var values = {
                    widget: this,
                    pos: this.pos,
                    from_date: this.from_date,
                    to_date: this.to_date,
                    product_total_qty: product_total_qty,
                    category_total_qty: category_total_qty,
                    payment_summary_total: payment_summary_total,
                    product_summary: product_summary,
                    category_summary: category_summary,
                    payment_summary: payment_summary,
                    location_summary: location_summary,
                    summary: results,
                };
                this.show_report('report_product_summary_html', 'report_product_summary_xml', values)
            }
        }
    });
    gui.define_popup({name: 'popup_report_product_summary', widget: popup_report_product_summary});

    // TODO: Order Summary Report
    var popup_report_order_summary = PopupWidget.extend({
        template: 'popup_report_order_summary',
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
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
            var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date = firstDay.toISOString().split('T')[0];
            this.$('input#current_session_report').click(function () {
                if ($(this).prop("checked") == true) {
                    self.$(".date_input_container").hide();
                } else if ($(this).prop("checked") == false) {
                    self.$(".date_input_container").show();
                }
            });
            this.$('.popup_field').each(function (idx, el) {
                if (el.name == 'from_date' && self.pos.config.report_product_current_month_date) {
                    $(el).val(first_date);
                }
                if (el.name == 'to_date' && self.pos.config.report_product_current_month_date) {
                    $(el).val(today_date);
                }
                if (el.name == 'order_summary_report' && self.pos.config.report_order_summary_auto_check_order) {
                    $(el).click();
                }
                if (el.name == 'category_summary_report' && self.pos.config.report_order_summary_auto_check_category) {
                    $(el).click();
                }
                if (el.name == 'payment_summary_report' && self.pos.config.report_order_summary_auto_check_payment) {
                    $(el).click();
                }
                if (el.name == 'current_session_report' && self.pos.config.report_current_session_report) {
                    $(el).click();
                    self.$(".date_input_container").hide();
                }
            });
        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.popup_field').each(function (idx, el) {
                if (['current_session_report', 'order_summary_report', 'category_summary_report', 'payment_summary_report'].indexOf(el.name) != -1) {
                    fields[el.name] = $(el).prop("checked");
                } else {
                    fields[el.name] = el.value
                }
            });
            var state = fields['state'];
            var report_list = [];
            if (fields['order_summary_report']) {
                report_list.push('order_summary_report')
            }
            if (fields['category_summary_report']) {
                report_list.push('category_summary_report')
            }
            if (fields['payment_summary_report']) {
                report_list.push('payment_summary_report')
            }
            if (fields.no_of_copies <= 0) {
                return this.wrong_input('input[name="no_of_copies"]', "(*) Missed No of Copies or smaller than or equal 0");
            }
            if (!fields['state']) {
                fields['state'] = '';
            }
            this.pos.no_of_copies = fields['no_of_copies'];
            if (fields['current_session_report'] == true) {
                var params = {
                    model: 'pos.order',
                    method: 'order_summary_report',
                    args: [
                        {
                            'from_date': fields['from_date'],
                            'to_date': fields['to_date'],
                            'state': state,
                            'summary': report_list,
                            'session_id': self.pos.pos_session.id
                        }
                    ],
                };
                return rpc.query(params).then(function (results) {
                    self.render_report(results)
                });
            } else {
                if (!fields['from_date']) {
                    return this.wrong_input('input[name="from_date"]', '(*) Start date required');
                } else {
                    this.passed_input('input[name="from_date"]');
                }
                if (!fields['to_date']) {
                    return this.wrong_input('input[name="to_date"]', '(*) To Date required');
                } else {
                    this.passed_input('input[name="to_date"]');
                }
                if (fields['from_date'] > fields['to_date']) {
                    this.wrong_input('input[name="from_date"]');
                    return this.wrong_input('input[name="to_date"]', '(*) From Date could not bigger than To Date');
                } else {
                    this.passed_input('input[name="from_date"]');
                }
                var params = {
                    model: 'pos.order',
                    method: 'order_summary_report',
                    args: [
                        {
                            'from_date': fields.from_date,
                            'to_date': fields.to_date,
                            'state': state,
                            'summary': report_list
                        }
                    ],
                };
                this.from_date = fields.from_date;
                this.to_date = fields.to_date;
                return rpc.query(params).then(function (results) {
                    self.render_report(results)
                });
            }
        },
        render_report: function (results) {
            var state = results['state'];
            if (results) {
                if (Object.keys(results['category_report']).length == 0 && Object.keys(results['order_report']).length == 0 &&
                    Object.keys(results['payment_report']).length == 0) {
                    this.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('No record found')
                    })
                } else {
                    var category_report;
                    var order_report;
                    var payment_report;
                    if (Object.keys(results.order_report).length == 0) {
                        order_report = false;
                    } else {
                        order_report = results['order_report']
                    }
                    if (Object.keys(results.category_report).length == 0) {
                        category_report = false;
                    } else {
                        category_report = results['category_report']
                    }
                    if (Object.keys(results.payment_report).length == 0) {
                        payment_report = false;
                    } else {
                        payment_report = results['payment_report']
                    }
                    var values = {
                        widget: this,
                        pos: this.pos,
                        state: state,
                        from_date: this.from_date,
                        to_date: this.to_date,
                        order_report: order_report,
                        category_report: category_report,
                        payment_report: payment_report,
                    };
                    this.show_report('report_order_summary_html', 'report_order_summary_xml', values)
                }
            }
        },
    });
    gui.define_popup({name: 'popup_report_order_summary', widget: popup_report_order_summary});

    // TODO: Payment Summary Report
    var popup_report_payment_summary = PopupWidget.extend({
        template: 'popup_report_payment_summary',
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
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
            var today_date = new Date().toISOString().split('T')[0];
            var date = new Date();
            var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            var first_date_of_month = firstDay.toISOString().split('T')[0];
            if (this.pos.config.report_payment_current_month_date) {
                this.$('input#from_date').val(first_date_of_month);
                this.$('input#to_date').val(today_date);
            }
            this.$('input#current_session_report').click(function () {
                if ($(this).prop("checked") == true) {
                    self.$(".date_input_container").hide();
                } else if ($(this).prop("checked") == false) {
                    self.$(".date_input_container").show();
                }
            });
        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            this.$('.popup_field').each(function (idx, el) {
                if (el.name == 'current_session_report') {
                    fields[el.name] = self.$('input#current_session_report').prop("checked")
                } else {
                    fields[el.name] = el.value || false;
                }
            });
            var from_date = fields['from_date'];
            var to_date = fields['to_date'];
            var summary = fields['summary'];
            if (fields['current_session_report'] == true) {
                var pos_session_id = self.pos.pos_session.id;
                var val = {
                    'summary': summary,
                    'session_id': pos_session_id
                };
                var params = {
                    model: 'pos.order',
                    method: 'payment_summary_report',
                    args: [val],
                };
                return rpc.query(params, {async: false}).then(function (res) {
                    if (res) {
                        if (Object.keys(res['journal_details']).length == 0 && Object.keys(res['salesmen_details']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            var journal_key = Object.keys(res['journal_details']);
                            if (journal_key.length > 0) {
                                var journal_details = res['journal_details'];
                            } else {
                                var journal_details = false;
                            }
                            var sales_key = Object.keys(res['salesmen_details']);
                            if (sales_key.length > 0) {
                                var salesmen_details = res['salesmen_details'];
                            } else {
                                var salesmen_details = false;
                            }
                            var total = Object.keys(res['summary_data']);
                            if (total.length > 0) {
                                var summary_data = res['summary_data'];
                            } else {
                                var summary_data = false;
                            }
                            var values = {
                                widget: self,
                                pos: self.pos,
                                journal_details: journal_details,
                                salesmen_details: salesmen_details,
                                summary_data: summary_data
                            };
                            self.show_report('report_payment_summary_receipt_html', 'report_payment_summary_receipt_xml', values)
                        }
                    }
                });
            } else {
                if (from_date == "" && to_date == "" || from_date != "" && to_date == "" || from_date == "" && to_date != "") {
                    if (!from_date) {
                        return this.wrong_input('input[name="from_date"]', "(*) From date is required");
                    } else {
                        this.passed_input('input[name="from_date"]');
                    }
                    if (!to_date) {
                        return this.wrong_input('input[name="to_date"]', "(*) To date is required");
                    } else {
                        this.passed_input('input[name="to_date"]');
                    }
                } else if (from_date > to_date) {
                    this.wrong_input('input[name="from_date"]', "(*) Start date required smaller than To date");
                    return this.wrong_input('input[name="to_date"]', "(*) Start date required smaller than To date");
                }
                var val = {
                    'from_date': from_date,
                    'to_date': to_date,
                    'summary': summary
                };
                var params = {
                    model: 'pos.order',
                    method: 'payment_summary_report',
                    args: [val],
                };
                this.from_date = fields['from_date'];
                this.to_date = fields['to_date'];
                return rpc.query(params, {async: false}).then(function (res) {
                    if (res) {
                        if (Object.keys(res['journal_details']).length == 0 && Object.keys(res['salesmen_details']).length == 0) {
                            self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'No record found'
                            })
                        } else {
                            var journal_key = Object.keys(res['journal_details']);
                            if (journal_key.length > 0) {
                                var journal_details = res['journal_details'];
                            } else {
                                var journal_details = false;
                            }
                            var sales_key = Object.keys(res['salesmen_details']);
                            if (sales_key.length > 0) {
                                var salesmen_details = res['salesmen_details'];
                            } else {
                                var salesmen_details = false;
                            }
                            var total = Object.keys(res['summary_data']);
                            if (total.length > 0) {
                                var summary_data = res['summary_data'];
                            } else {
                                var summary_data = false;
                            }
                            self.show_report('report_payment_summary_receipt_html', 'report_payment_summary_receipt_xml', {
                                widget: self,
                                pos: self.pos,
                                journal_details: journal_details,
                                salesmen_details: salesmen_details,
                                summary_data: summary_data
                            })
                        }
                    }
                });
            }
        },
    });
    gui.define_popup({name: 'popup_report_payment_summary', widget: popup_report_payment_summary});

    // TODO : Z-Report
    var popup_sale_summary_session_report = PopupWidget.extend({
        template: 'popup_sale_summary_session_report',
        show: function (options) {
            var self = this;
            options = options || {};
            this.session_id = options.session_id;
            if (!this.session_id) {
                this.session_id = this.pos.pos_session.id
            }
            this._super(options);
        },
        click_confirm: function () {
            var self = this;
            var params = {
                model: 'pos.session',
                method: 'build_sessions_report',
                args: [[this.session_id]],
            };
            return rpc.query(params, {shadow: true}).then(function (values) {
                var values = {
                    widget: self,
                    pos: self.pos,
                    report: values[self.session_id],
                };
                self.show_report('report_sale_summary_session_html', 'report_sale_summary_session_xml', values)
            }, function (err) {
                self.pos.query_backend_fail(err);
            })
        },
    });
    gui.define_popup({name: 'popup_sale_summary_session_report', widget: popup_sale_summary_session_report});
});
