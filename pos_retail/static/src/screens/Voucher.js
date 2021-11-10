"use strict";
odoo.define('pos_retail.screen_voucher', function (require) {
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _get_voucher_env: function (voucher) {
            var cashier = this.get_cashier();
            var company = this.company;
            return {
                widget: this,
                pos: this,
                cashier: cashier,
                company: company,
                voucher: voucher
            };
        },
        _render_vouchers: function (vouchers_created) {
            var el_pos_receipt = $('.pos-receipt-container');
            var url_location = window.location.origin + '/report/barcode/EAN13/';
            for (var i = 0; i < vouchers_created.length; i++) {
                var voucher = vouchers_created[i];
                voucher['url_barcode'] = url_location + voucher['code'];
                el_pos_receipt.append(
                    qweb.render('VoucherCard', this._get_voucher_env(voucher))
                );
            }
        },
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        init_from_JSON: function (json) {
            var res = _super_Order.init_from_JSON.apply(this, arguments);
            if (json.voucher) {
                this.voucher = json.voucher
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.voucher_id) {
                json.voucher_id = parseInt(this.voucher_id);
            }
            if (this.voucher) {
                json.voucher = this.voucher;
            }
            return json;
        },
        show_popup_create_voucher: function () {
            var self = this;
            var selected_line = this.selected_orderline;
            if (selected_line) {
                return this.pos._get_voucher_number().then(function (number) {
                    var selected_line = self.selected_orderline;
                    self.pos.gui.show_popup('PopUpPrintVoucher', {
                        number: number,
                        selected_line: selected_line,
                        title: _t('Please Input Information of Voucher will Create'),
                        confirm: function (voucher) {
                            selected_line.voucher = voucher;
                            selected_line.trigger('change', selected_line);
                        },
                        cancel: function () {
                            selected_line.voucher = null;
                            selected_line.trigger('change', selected_line);
                        }
                    });
                })
            } else {
                this.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('Nothing line selected or Line selected is not Product Voucher')
                })
            }
        },
        add_product: function (product, options) {
            _super_Order.add_product.apply(this, arguments);
            if (product.is_voucher && this.pos.config.print_voucher) {
                this.show_popup_create_voucher();
            }
        },
        client_use_voucher: function (voucher) {
            this.voucher_id = voucher.id;
            var method = _.find(this.pos.payment_methods, function (method) {
                return method.pos_method_type == 'voucher';
            });
            if (method) {
                var due = this.get_due();
                if (voucher['customer_id'] && voucher['customer_id'][0]) {
                    var client = this.pos.db.get_partner_by_id(voucher['customer_id'][0]);
                    if (client) {
                        this.set_client(client)
                    }
                }
                var amount = 0;
                if (voucher['apply_type'] == 'fixed_amount') {
                    amount = voucher.value;
                } else {
                    amount = this.get_total_with_tax() / 100 * voucher.value;
                }
                if (amount <= 0) {
                    return this.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Voucher Used Full Amount, please use another Voucher',
                    });
                }
                var voucher_paymentline = _.find(this.paymentlines.models, function (payment) {
                    return payment.payment_method.journal && payment.payment_method.journal.pos_method_type == 'voucher';
                });
                if (!voucher_paymentline) {
                    this.add_paymentline(method);
                }
                var voucher_paymentline = this.selected_paymentline;
                voucher_paymentline['voucher_id'] = voucher['id'];
                voucher_paymentline['voucher_code'] = voucher['code'];
                var voucher_amount = 0;
                if (amount >= due) {
                    voucher_amount = due;
                } else {
                    voucher_amount = amount;
                }
                if (voucher_amount > 0) {
                    voucher_paymentline.set_amount(voucher_amount);
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Success'),
                        body: _t('Set ' + this.pos.gui.chrome.format_currency(voucher_amount)) + ' to Payment Amount of Order ',
                        color: 'success'
                    });
                } else {
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Selected Order Paid Full, Could not adding more Voucher Value'),
                    });
                }
                this.pos.gui.screen_instances['payment'].reset_input();
                this.pos.gui.screen_instances['payment'].render_paymentlines();
            } else {
                this.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('Your POS Payment Voucher removed, we could not add voucher to your Order'),
                });
            }
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function (attributes, options) {
            var res = _super_Orderline.initialize.apply(this, arguments);
            return res;
        },
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.voucher) {
                this.voucher = json.voucher
            }
            return res
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.voucher) {
                json.voucher = this.voucher;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            if (this.voucher) {
                receipt_line['voucher'] = this.voucher;
            }
            return receipt_line
        }
    });

    var _super_Paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        init_from_JSON: function (json) {
            var res = _super_Paymentline.init_from_JSON.apply(this, arguments);
            if (json.voucher_id) {
                this.voucher_id = json.voucher_id
            }
            if (json.voucher_code) {
                this.voucher_code = json.voucher_code
            }
            return res
        },
        export_as_JSON: function () {
            var json = _super_Paymentline.export_as_JSON.apply(this, arguments);
            if (this.voucher_id) {
                json['voucher_id'] = this.voucher_id;
            }
            if (this.voucher_code) {
                json['voucher_code'] = this.voucher_code;
            }
            return json
        },
        export_for_printing: function () {
            var datas = _super_Paymentline.export_for_printing.apply(this, arguments);
            if (this.voucher_code) {
                datas['voucher_code'] = this.voucher_code
            }
            return datas
        }
    });

    screens.PaymentScreenWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.input_voucher').click(function () { // input manual voucher
                self.hide();
                return self.pos.gui.show_popup('alert_input', {
                    title: _t('Voucher'),
                    body: _t('Please input code or number of voucher.'),
                    confirm: function (code) {
                        self.show();
                        self.renderElement();
                        if (!code) {
                            return false;
                        } else {
                            return rpc.query({
                                model: 'pos.voucher',
                                method: 'get_voucher_by_code',
                                args: [code],
                            }).then(function (voucher) {
                                if (voucher == -1) {
                                    return self.gui.show_popup('confirm', {
                                        title: 'Error',
                                        body: 'Voucher used full volume or does not exist',
                                    });
                                } else {
                                    var order = self.pos.get_order();
                                    if (order) {
                                        order.client_use_voucher(voucher)
                                    }
                                }
                            }, function (err) {
                                return self.pos.query_backend_fail(error);
                            })
                        }
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                });
            });
        },
    });

    var PopUpPrintVoucher = PopupWidget.extend({
        template: 'PopUpPrintVoucher',
        show: function (options) {
            this.selected_line = options.selected_line;
            this.options = options;
            this._super(options);
        },
        click_confirm: function () {
            var order = this.pos.get_order();
            var fields = {};
            this.$('.field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (fields['method'] == 'special_customer' && !order.get_client()) {
                this.gui.close_popup();
                this.gui.show_screen('clientlist');
                return this.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('You wanted create voucher for Special Customer. Please add Client first')
                });
            }
            if (!fields['number']) {
                return this.wrong_input('input[name="number"]', _t("(*) Card Number is Required"));
            } else {
                this.passed_input('input[name="number"]');
            }
            if (!fields['period_days']) {
                return this.wrong_input('input[name="period_days"]', _t("(*) Period days expired voucher is required, and not smaller than 0"));
            } else {
                this.passed_input('input[name="period_days"]');
            }
            if (!fields['value'] || fields['value'] <= 0) {
                return this.wrong_input('input[name="value"]', _t("(*) Voucher Amount required bigger than 0"));
            } else {
                this.passed_input('input[name="value"]');
            }
            if (!fields['apply_type']) {
                return this.wrong_input('input[name="apply_type"]', _t("(*) Type of Voucher is required"));
            } else {
                this.passed_input('input[name="apply_type"]');
            }
            if (fields['apply_type'] == 'percent' && fields['value'] > 100) {
                return this.wrong_input('input[name="value"]', _t("(*) Type of Voucher %, Amount required bigger than 0 and smaller than or equal 100"));
            } else {
                this.passed_input('input[name="value"]');
            }
            if (order.get_client() && fields['method'] == 'special_customer') {
                fields['customer_id'] = order.get_client().id;
            }
            if (this.options.confirm) {
                this.options.confirm.call(this, fields);
                this.pos.gui.close_popup();
            }
        },
        click_cancel: function () {
            this.gui.close_popup();
            if (this.options.cancel) {
                this.options.cancel.call(this);
            }
        },
    });
    gui.define_popup({
        name: 'PopUpPrintVoucher',
        widget: PopUpPrintVoucher
    });

    var ButtonPrintVoucher = screens.ActionButtonWidget.extend({
        template: 'ButtonPrintVoucher',
        button_click: function () {
            var self = this;
            var order = this.pos.get_order();
            order.create_voucher()
        }
    });

    screens.define_action_button({
        'name': 'ButtonPrintVoucher',
        'widget': ButtonPrintVoucher,
        'condition': function () {
            return this.pos.config.print_voucher;
        }
    });
});
