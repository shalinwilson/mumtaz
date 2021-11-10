"use strict";
odoo.define('pos_retail.screen_core', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var PaymentMethodWidget = require('pos_retail.payment_method');
    var PriceListWidget = require('pos_retail.pricelist_widget');
    var rpc = require('pos.rpc');

    screens.set_pricelist_button.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('open:pricelist', function () {
                this.show_pricelists()
            }, this);
        },
        show_pricelists: function () {
            $('.control-buttons-extend').empty();
            $('.control-buttons-extend').removeClass('oe_hidden');
            var pricelist_widget = new PriceListWidget(this, {
                widget: this,
            });
            pricelist_widget.appendTo($('.control-buttons-extend'));
        }
    });

    screens.NumpadWidget.include({
        clickChangeMode: function (event) {
            var self = this;
            var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
            var order = this.pos.get_order();
            if (!order) {
                return this._super(event);
            }
            var line_selected = order.get_selected_orderline();
            if (!line_selected) {
                return this._super(event);
            }
            var is_return = order['is_return'];
            if (newMode == 'quantity' && this.pos.config.validate_quantity_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(event);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('quantity')");
                    }
                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('quantity')");
                }
            }
            if (newMode == 'discount' && this.pos.config.validate_discount_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(val);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('discount')");
                    }
                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('discount')");
                }
            }
            if (newMode == 'price' && this.pos.config.validate_price_change) {
                if (is_return) {
                    if (!this.pos.config.apply_validate_return_mode) {
                        return this._super(val);
                    } else {
                        this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('price')");
                    }

                } else {
                    this.pos._validate_by_manager("this.chrome.screens['products'].numpad.state.changeMode('price')");
                }
            }
            return this._super(event);
        }
    });

    screens.ActionButtonWidget.include({
        highlight: function (highlight) {
            this._super(highlight);
            if (highlight) {
                this.$el.addClass('highlight');
            } else {
                this.$el.removeClass('highlight');
            }
        },
        altlight: function (altlight) {
            this._super(altlight);
            if (altlight) {
                this.alt_light = true;
                this.$el.addClass('btn-info');
            } else {
                this.$el.removeClass('btn-info');
                this.alt_light = false;
            }
        },
        invisible: function () {
            this.$el.addClass('oe_hidden');
        },
        display: function () {
            this.$el.removeClass('oe_hidden');
        },
        get_highlight: function () {
            if (this.high_light) {
                return true;
            } else {
                return false;
            }
        }
    });

    screens.ScreenWidget.include({
        _check_is_duplicate: function (field_value, field_string, id) {
            var partners = this.pos.db.get_partners_sorted(-1);
            if (id) {
                var old_partners = _.filter(partners, function (partner_check) {
                    return partner_check['id'] != id && partner_check[field_string] == field_value;
                });
                if (old_partners.length != 0) {
                    return true
                } else {
                    return false
                }
            } else {
                var old_partners = _.filter(partners, function (partner_check) {
                    return partner_check[field_string] == field_value;
                });
                if (old_partners.length != 0) {
                    return true
                } else {
                    return false
                }
            }
        },
        validate_date_field: function (value, $el) {
            if (value.match(/^\d{4}$/) !== null) {
                $el.val(value + '-');
            } else if (value.match(/^\d{4}\/\d{2}$/) !== null) {
                $el.val(value + '-');
            }
        },
        check_is_number: function (number) {
            var regex = /^[0-9]+$/;
            if (number.match(regex)) {
                return true
            } else {
                return false
            }
        },
        wrong_input: function (element, message) {
            if (message) {
                this.$("span[class='card-issue']").text(message);
            }
            this.$(element).css({
                'box-shadow': '0px 0px 0px 1px rgb(236, 5, 5) inset',
                'border': 'none !important',
                'border-bottom': '1px solid red !important'
            });
        },
        passed_input: function (element) {
            this.$(element).css({
                'box-shadow': '#3F51B5 0px 0px 0px 1px inset'
            })
        },
        show: function () {
            var self = this;
            this._super();
            var screen_name = this.pos.gui.get_current_screen();
            if (screen_name == 'products' && !this.back_screen_event_keyboard) {
                this.back_screen_event_keyboard = function (event) {
                    if (['products', 'receipt', 'payment'].indexOf(self.pos.gui.get_current_screen()) == -1) {
                        if (event.keyCode == 27) {
                            self.gui.back();
                            console.log('back');
                        }
                        if (event.keyCode == 13) {
                            var screen_name = self.gui.get_current_screen();
                            if (screen_name == 'clientlist') {
                                setTimeout(function () {
                                    self.gui.screen_instances["clientlist"].save_changes()
                                    self.gui.back();
                                    console.log('click next');
                                }, 200)
                            }

                        }
                    }

                };
                window.document.body.addEventListener('keydown', this.back_screen_event_keyboard);
            }
        },
        scan_booked_order: function (datas_code) {
            var sale = this.pos.db.sale_order_by_ean13[datas_code.code];
            if (sale && this.gui.screen_instances['sale_orders']) {
                this.gui.screen_instances['sale_orders'].display_sale_order(sale);
                return true
            } else {
                return false
            }
        },
        barcode_product_action: function (code) {
            var current_screen = this.pos.gui.get_current_screen();
            var scan_sussess = false;
            if (current_screen && current_screen == 'return_products') {
                this.scan_return_product(code);
                scan_sussess = this.scan_return_product(code);
            }
            if (current_screen == 'sale_orders') {
                scan_sussess = this.scan_booked_order(code)
            }
            if (current_screen != 'return_products' && current_screen != 'sale_orders' && !scan_sussess) {
                return this._super(code)
            }
        },
        // TODO:  if order exist on pos session, when cashier scan barcode, auto selected it and go to payment screen
        scan_order_and_paid: function (datas_code) {
            if (datas_code && datas_code['type']) {
                var code = datas_code['code'];
                console.log('{scanner} code: ' + code);
                var orders = this.pos.get('orders').models;
                var order = _.find(orders, function (order) {
                    return order.ean13 == code;
                });
                if (order) {
                    this.pos.set('selectedOrder', order);
                    this.pos.gui.show_screen('payment');
                    return true;
                } else {
                    return false
                }
            } else {
                return false;
            }
        },
        scan_order_and_return: function (datas_code) {
            if (datas_code && datas_code['type']) {
                console.log('{scanner} return order code: ' + datas_code.code);
            }
            var ean13 = datas_code['code'];
            if (ean13.length == 12)
                ean13 = "0" + ean13;
            var order = this.pos.db.order_by_ean13[ean13];
            if (!order || order.length > 1) {
                return false; // could not found order
            }
            var PosOrderScreen = this.pos.gui.screen_instances['PosOrderScreen']
            if (PosOrderScreen) {
                if (this.pos.config.return_products && this.pos.config.return_viva_scan_barcode) {
                    var order_lines = this.pos.db.lines_by_order_id[order['id']];
                    if (!order_lines) {
                        this.pos.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Order empty lines'),
                        });
                    } else {
                        this.pos.gui.show_popup('PopUpReturnPosOrderLines', {
                            order_lines: order_lines,
                            order: order
                        });
                    }
                } else {
                    this.pos.gui.show_screen('PosOrderScreen');
                    PosOrderScreen['order_selected'] = order
                    this.pos.trigger('reload:countOrders');
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Alert'),
                        body: _t('Scanner Found Order ' + order.name),
                        color: 'success'
                    })
                }
                return true
            } else {
                return false
            }

        },
        scan_booking_order: function (datas_code) {
            var self = this;
            if (datas_code && datas_code['type']) {
                console.log('{scanner} booking code: ' + datas_code.code);
            }
            var ean13 = datas_code['code'];
            var sale = this.pos.db.sale_order_by_ean13[ean13];
            if (sale) {
                this.pos.gui.show_screen('sale_orders');
                this.pos.gui.screen_instances["sale_orders"]['order_new'] = sale;
                this.pos.gui.screen_instances["sale_orders"].display_sale_order(self.pos.gui.screen_instances["sale_orders"]['order_new']);
                this.pos.gui.show_popup('dialog', {
                    title: _t('Scan Succeed Order: ' + sale.name),
                    body: _t('Found one Booked Order with code: ' + ean13),
                    color: 'success'
                });
                return true
            }
        },
        scan_voucher: function (code) {
            var self = this;
            rpc.query({
                model: 'pos.voucher',
                method: 'get_voucher_by_code',
                args: [code],
            }).then(function (voucher) {
                if (voucher != -1) {
                    var order = self.pos.get_order();
                    if (order) {
                        order.client_use_voucher(voucher)
                    }
                }
            }, function (err) {
                self.pos.query_backend_fail(err)
            })
        },
        barcode_error_action: function (datas_code_wrong) {
            // TODO: priority scanning code bellow
            // 1. scan order return
            // 2. auto select order
            // 3. scan booking order
            // 4. scan voucher
            var check_is_return_order = this.scan_order_and_return(datas_code_wrong);
            if (check_is_return_order) {
                return check_is_return_order;
            }
            var fast_selected_order = this.scan_order_and_paid(datas_code_wrong);
            if (fast_selected_order) {
                return fast_selected_order
            }
            var scan_booking_order = this.scan_booking_order(datas_code_wrong);
            if (scan_booking_order) {
                return scan_booking_order
            }
            this.scan_voucher(datas_code_wrong.code);
            return this._super(datas_code_wrong)
        }
    });

    screens.ScaleScreenWidget.include({
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var current_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                return this._super()
            } else {
                return current_pricelist
            }
        },
        _get_default_pricelist: function () {
            var current_pricelist = this.pos.default_pricelist;
            return current_pricelist
        }
    });
});
