"use strict";
odoo.define('pos_retail.ActionpadWidget', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var PaymentMethodWidget = require('pos_retail.payment_method');
    var PriceListWidget = require('pos_retail.pricelist_widget');
    var rpc = require('pos.rpc');
    var ServiceChargeWidget = require('pos_retail.service_charge');

    screens.ActionpadWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('reload.ActionPad', function () {
                self.renderElement();
                if (!self.pos.hide_pads) {
                    $('.footer_cart .numpad').removeClass('oe_hidden');
                } else {
                    $('.footer_cart .numpad').addClass('oe_hidden');
                }
            }, self);
            this.loading_buttons = false;
            this.pos.bind('open:payment-method', function () {
                var all_payment_methods = self.pos.payment_methods;
                var order = self.pos.get_order();
                if (order && order.pricelist) {
                    var payment_methods_match_pricelist = [];
                    for (var i = 0; i < all_payment_methods.length; i++) {
                        var method = all_payment_methods[i];
                        // TODO:
                        // - if have not journal
                        // - have journal but have not currency
                        // - have journal , required journal currency the same pricelist currency and pos method type of journal is not credit, voucher ...
                        if (!method.journal || (method.journal && !method.journal.currency_id) || (method.journal && !method.journal.pos_method_type) || (method.journal.pos_method_type && method.journal && method.journal.currency_id && order.pricelist.currency_id && method.journal.currency_id[0] == order.pricelist.currency_id[0] && ['rounding', 'wallet', 'voucher', 'credit'].indexOf(method.journal.pos_method_type) == -1)) {
                            payment_methods_match_pricelist.push(method)
                        }
                    }
                    if (payment_methods_match_pricelist.length) {
                        $('.control-buttons-extend').empty();
                        $('.payment-method-list').replaceWith('');
                        $('.control-buttons-extend').removeClass('oe_hidden');
                        self.payment_methed_widget = new PaymentMethodWidget(self, {
                            widget: self,
                            payment_methods: payment_methods_match_pricelist
                        });
                        self.payment_methed_widget.appendTo($('.control-buttons-extend'));
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Have not any payment method ready for Quickly Paid')
                        })
                    }
                }
            });
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.quickly_paid').click(function () {
                var validate = self.pos.get_order().validate_payment_order();
                if (validate) {
                    self.pos.trigger('open:payment-method');
                }
            });
            this.$('.pay').click(function () {
                var order = self.pos.get_order();
                order.validate_payment_order();
            });
            this.$('.set-customer').click(function () {
                self.pos.show_popup_clients('products');
            });
            this.$('.select-pricelist').click(function () {
                self.pos.trigger('open:pricelist');
            });
            var order = this.pos.get_order();
            if (order) {
                this._event_order()
                this._event_line(order.get_selected_orderline())
            }
        },
        get_current_pricelist_name: function () {
            var name = _t('Pricelist');
            var order = this.pos.get_order();
            if (order) {
                var pricelist = order.pricelist;
                if (pricelist) {
                    name = pricelist.display_name;
                }
            }
            return name;
        },
        _event_order() {
            console.log('{ActionpadWidget.js} _event_order')
            var self = this;
            if (this.pos.config.note_order) {
                this.$('.set_note_order').removeClass('oe_hidden');
                this.$('.set_note_order').addClass('highlight');
            } else {
                this.$('.set_note_order').addClass('oe_hidden');
            }
            var el_set_note_order = this.$('.set_note_order');
            if (el_set_note_order) {
                el_set_note_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('textarea', {
                            title: _t('Add Order Note'),
                            value: order.get_note(),
                            confirm: function (note) {
                                order.set_note(note);
                                return self.pos.gui.show_popup('dialog', {
                                    title: _t('Noted'),
                                    body: _t('You just set note: ' + note),
                                    color: 'success'
                                })
                            },
                        });
                    }
                })
            }
            if (this.pos.config.add_sale_person && this.pos.sellers && this.pos.sellers.length > 0) {
                this.$('.set_seller').removeClass('oe_hidden');
                this.$('.set_seller').addClass('highlight');
            } else {
                this.$('.set_seller').addClass('oe_hidden');
            }
            var el_set_seller = this.$('.set_seller');
            if (el_set_seller) {
                el_set_seller.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.set_seller()
                    }
                })
            }
            if (this.pos.report_html) {
                this.$('.print_bill_last_order').removeClass('oe_hidden');
                this.$('.print_bill_last_order').addClass('highlight');
            } else {
                this.$('.print_bill_last_order').addClass('oe_hidden');
            }
            var el_print_bill_last_order = this.$('.print_bill_last_order');
            if (el_print_bill_last_order) {
                el_print_bill_last_order.click(function () {
                    if (self.pos.report_html) {
                        self.pos.gui.show_screen('report');
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            'title': _t('Error'),
                            'body': _t('Could not find bill of last order'),
                        });
                    }
                })
            }
            if (this.pos.config.iface_floorplan) {
                this.$('.set_number_guests').removeClass('oe_hidden');
                this.$('.set_number_guests').addClass('highlight');
            } else {
                this.$('.set_number_guests').addClass('oe_hidden');
            }
            var el_set_number_guests = this.$('.set_number_guests');
            if (el_set_number_guests) {
                el_set_number_guests.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('number', {
                            'title': _t('Guests ?'),
                            'cheap': true,
                            'value': self.pos.get_order().customer_count,
                            'confirm': function (value) {
                                value = Math.max(1, Number(value));
                                self.pos.get_order().set_customer_count(value);
                                self.pos.get_order().trigger('change', self.pos.get_order())
                            },
                        });
                    }
                })
            }
            if (this.pos.config.signature_order) {
                this.$('.signature_order').removeClass('oe_hidden');
                this.$('.signature_order').addClass('highlight');
            } else {
                this.$('.signature_order').addClass('oe_hidden');
            }
            var el_signature_order = this.$('.signature_order');
            if (el_signature_order) {
                el_signature_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('popup_order_signature', {
                            title: _t('Signature Receipt'),
                            body: _t('Signature will display on Order Receipt'),
                            order: self.pos.get_order()
                        });
                    }
                })
            }
            if (this.pos.config.use_pricelist && this.pos.pricelists.length > 1) {
                this.$('.set_pricelist').removeClass('oe_hidden');
                this.$('.set_pricelist').addClass('highlight');
            } else {
                this.$('.set_pricelist').addClass('oe_hidden');
            }
            var set_pricelist = this.$('.set_pricelist');
            if (set_pricelist) {
                set_pricelist.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        var pricelists = _.map(self.pos.pricelists, function (pricelist) {
                            return {
                                label: pricelist.name,
                                item: pricelist
                            };
                        });
                        self.gui.show_popup('selection', {
                            title: _t('Select pricelist'),
                            list: pricelists,
                            confirm: function (pricelist) {
                                var order = self.pos.get_order();
                                order.set_pricelist(pricelist);
                            },
                            is_selected: function (pricelist) {
                                return pricelist.id === self.pos.get_order().pricelist.id;
                            }
                        });
                    }
                })
            }
            var cash_control_active = this.pos.config.management_session && this.pos.config.default_cashbox_id && this.pos.config.cash_control;
            if (cash_control_active) {
                this.$('.cash_management_control').removeClass('oe_hidden');
                this.$('.cash_management_control').addClass('highlight');
            } else {
                this.$('.cash_management_control').addClass('oe_hidden');
            }
            var el_cash_management_control = this.$('.cash_management_control');
            if (el_cash_management_control) {
                el_cash_management_control.click(function () {
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
                })
            }
        },
        _event_line: function (line) {
            console.log('{ActionpadWidget.js} _event_line')
            var self = this;
            var order = this.pos.get_order();
            if (!order) {
                return false;
            }
            this.$('.remove_shopping_cart').addClass('selected-mode');
            if (this.pos.config.return_products) {
                this.$('.return_products').removeClass('oe_hidden');
                this.$('.return_products').addClass('highlight');
            } else {
                this.$('.return_products').addClass('oe_hidden');
            }
            if (line && line.get_product_generic_options().length > 0) {
                this.$('.set_generic_options').removeClass('oe_hidden');
                this.$('.set_generic_options').addClass('highlight');
            } else {
                this.$('.set_generic_options').addClass('oe_hidden');
            }
            if (line && line.is_has_bom()) {
                this.$('.modifier_bom').removeClass('oe_hidden');
                this.$('.modifier_bom').addClass('highlight');
                if (this.pos.config.mrp_produce_direct) {
                    this.$('.create_mrp_product_direct').removeClass('oe_hidden');
                    this.$('.create_mrp_product_direct').addClass('highlight');
                } else {
                    this.$('.create_mrp_product_direct').addClass('oe_hidden');
                }
            } else {
                this.$('.modifier_bom').addClass('oe_hidden');
            }
            if (line && line.is_has_bom() && this.pos.config.mrp_produce_direct) {
                this.$('.create_mrp_product_direct').removeClass('oe_hidden');
                this.$('.create_mrp_product_direct').addClass('highlight');
            } else {
                this.$('.create_mrp_product_direct').addClass('oe_hidden');
            }
            if (line && line.is_cross_selling()) {
                this.$('.change_cross_selling').removeClass('oe_hidden');
                this.$('.change_cross_selling').addClass('highlight');
            } else {
                this.$('.change_cross_selling').addClass('oe_hidden');
            }
            if (line && line.is_package()) {
                this.$('.product_packaging').removeClass('oe_hidden');
                this.$('.product_packaging').addClass('highlight');
            } else {
                this.$('.product_packaging').addClass('oe_hidden');
            }
            if (this.pos.config.service_charge_ids) {
                this.$('.service-charge').removeClass('oe_hidden');
                this.$('.service-charge').addClass('highlight');
            } else {
                this.$('.service-charge').addClass('oe_hidden');
            }
            if (this.pos.config.required_reason_return) {
                this.$('.input_reason_return').removeClass('oe_hidden');
                this.$('.input_reason_return').addClass('highlight');
            } else {
                this.$('.input_reason_return').addClass('oe_hidden');
            }
            if (line && line.is_return && this.pos.config.required_reason_return) {
                this.$('.input_reason_return').removeClass('oe_hidden');
                this.$('.input_reason_return').addClass('highlight');
            } else {
                this.$('.input_reason_return').addClass('oe_hidden');
            }
            if (line && line.has_multi_unit()) {
                this.$('.set_unit_measure').removeClass('oe_hidden');
                this.$('.set_unit_measure').addClass('highlight');
            } else {
                this.$('.set_unit_measure').addClass('oe_hidden');
            }
            if (line && line.is_multi_variant()) {
                this.$('.multi_variant').removeClass('oe_hidden');
                this.$('.multi_variant').addClass('highlight');
            } else {
                this.$('.multi_variant').addClass('oe_hidden');
            }
            if (line && line.has_dynamic_combo_active()) {
                this.$('.set_dynamic_combo').removeClass('oe_hidden');
                this.$('.set_dynamic_combo').addClass('highlight');
            } else {
                this.$('.set_dynamic_combo').addClass('oe_hidden');
            }
            if (line && line.has_bundle_pack()) {
                this.$('.set_bundle_pack').removeClass('oe_hidden');
                this.$('.set_bundle_pack').addClass('highlight');
            } else {
                this.$('.set_bundle_pack').addClass('oe_hidden');
            }
            if (this.pos.discounts && this.pos.discounts.length > 0) {
                this.$('.set_discount').removeClass('oe_hidden');
                this.$('.set_discount').addClass('highlight');
            } else {
                this.$('.set_discount').addClass('oe_hidden');
            }
            if (this.pos.config.discount_value && this.pos.config.discount_value_limit > 0) {
                this.$('.discount-value').removeClass('oe_hidden');
                this.$('.discount-value').addClass('highlight');
            } else {
                this.$('.discount-value').addClass('oe_hidden');
            }
            if (this.pos.tags && this.pos.tags.length > 0) {
                this.$('.set_tags').removeClass('oe_hidden');
                this.$('.set_tags').addClass('highlight');
            } else {
                this.$('.set_tags').addClass('oe_hidden');
            }
            if (this.pos.config.note_orderline) {
                this.$('.set_note_orderline').removeClass('oe_hidden');
                this.$('.set_note_orderline').addClass('highlight');
            } else {
                this.$('.set_note_orderline').addClass('oe_hidden');
            }
            if (this.pos.config.discount_sale_price && this.pos.config.discount_sale_price_limit > 0) {
                this.$('.set_discount_price').removeClass('oe_hidden');
                this.$('.set_discount_price').addClass('highlight');
            } else {
                this.$('.set_discount_price').addClass('oe_hidden');
            }
            if (this.pos.config.update_tax) {
                this.$('.change_taxes').removeClass('oe_hidden');
                this.$('.change_taxes').addClass('highlight');
            } else {
                this.$('.change_taxes').addClass('oe_hidden');
            }
            var loyalty_reward_program_active = this.pos.loyalty && this.pos.rules && this.pos.rules.length && this.pos.rules.length > 0;
            if (loyalty_reward_program_active) {
                this.$('.set_loyalty_reward_program').removeClass('oe_hidden');
                if (order.get_client()) {
                    this.$('.set_loyalty_reward_program').addClass('highlight');
                }
            } else {
                this.$('.set_loyalty_reward_program').addClass('oe_hidden');
            }
            if (this.pos.printers && this.pos.printers.length) {
                this.$('.submit_order').removeClass('oe_hidden');
                var changes = order.hasChangesToPrint();
                if (changes) {
                    this.$('.submit_order').addClass('highlight');
                } else {
                    this.$('.submit_order').removeClass('highlight');
                }
            } else {
                this.$('.submit_order').addClass('oe_hidden');
            }
            if (this.pos.config.iface_splitbill) {
                this.$('.split_order').removeClass('oe_hidden');
            } else {
                this.$('.split_order').addClass('oe_hidden');
            }
            if (this.pos.config.iface_printbill) {
                this.$('.print_receipt_bill').removeClass('oe_hidden');
            } else {
                this.$('.print_receipt_bill').addClass('oe_hidden');
            }
            if (this.pos.config.iface_floorplan) {
                this.$('.transfer_table').removeClass('oe_hidden');
            } else {
                this.$('.transfer_table').addClass('oe_hidden');
            }
            if (this.pos.config.allow_split_table) {
                this.$('.split_table').removeClass('oe_hidden');
            } else {
                this.$('.split_table').addClass('oe_hidden');
            }
            if (this.pos.config.allow_merge_table) {
                this.$('.merge_table').removeClass('oe_hidden');
            } else {
                this.$('.merge_table').addClass('oe_hidden');
            }
            if (this.pos.tables && this.pos.tables.length > 0 && this.pos.config.allow_lock_table == true) {
                this.$('.lock_table').removeClass('oe_hidden');
            } else {
                this.$('.lock_table').addClass('oe_hidden');
            }
            if (this.pos.config.booking_orders) {
                this.$('.add_booking_order').removeClass('oe_hidden');
                if (order && !order.is_return && order.get_client()) {
                    this.$('.add_booking_order').addClass('highlight');
                } else {
                    this.$('.add_booking_order').removeClass('highlight');
                }
                if (order && order.is_return) {
                    this.$('.add_booking_order').addClass('oe_hidden');
                }
            } else {
                this.$('.add_booking_order').addClass('oe_hidden');
            }
            if (this.pos.config.shipping_order) {
                this.$('.add_shipping_order').removeClass('oe_hidden');
                if (order && !order.is_return && order.get_client() && order.orderlines.models.length > 0) {
                    this.$('.add_shipping_order').addClass('highlight');
                } else {
                    this.$('.add_shipping_order').removeClass('highlight');
                }
                if (order && order.is_return) {
                    this.$('.add_shipping_order').addClass('oe_hidden');
                }
            } else {
                this.$('.add_shipping_order').addClass('oe_hidden');
            }
            if (this.pos.config.create_quotation) {
                this.$('.create_pos_quotation').removeClass('oe_hidden');
                if (order && !order.is_return && order.orderlines.models.length > 0) {
                    this.$('.create_pos_quotation').addClass('highlight');
                } else {
                    this.$('.create_pos_quotation').removeClass('highlight');
                }
                if (order && order.is_return) {
                    this.$('.create_pos_quotation').addClass('oe_hidden');
                }
            } else {
                this.$('.create_pos_quotation').addClass('oe_hidden');
            }
            if (this.pos.promotion_ids && this.pos.promotion_ids.length >= 1) {
                var promotion_datas = order.get_promotions_active();
                var promotions_active = promotion_datas['promotions_active'];
                this.$('.set_promotion').removeClass('oe_hidden');
                if (promotions_active && promotions_active.length) {
                    this.$('.set_promotion').addClass('highlight');
                } else {
                    this.$('.set_promotion').removeClass('highlight');
                }
            } else {
                this.$('.set_promotion').addClass('oe_hidden');
            }
            if (this.pos.config.create_purchase_order) {
                this.$('.create_purchase_order').removeClass('oe_hidden');
                if (order.get_client() && order.orderlines.length > 0) {
                    this.$('.create_purchase_order').addClass('highlight');
                } else {
                    this.$('.create_purchase_order').removeClass('highlight');
                }
            } else {
                this.$('.create_purchase_order').addClass('oe_hidden');
            }
            if (this.pos.config.sale_order && !order.is_return) {
                this.$('.create_sale_order').removeClass('oe_hidden');
                if (order.get_client() && order.orderlines.length > 0) {
                    this.$('.create_sale_order').addClass('highlight');
                } else {
                    this.$('.create_sale_order').removeClass('highlight');
                }
                this.$('.set_partner_shipping_id').removeClass('oe_hidden');
                if (order.get_client() && order.orderlines.length > 0) {
                    this.$('.set_partner_shipping_id').addClass('highlight');
                } else {
                    this.$('.set_partner_shipping_id').removeClass('highlight');
                }
            } else {
                this.$('.create_sale_order').addClass('oe_hidden');
                this.$('.set_partner_shipping_id').addClass('oe_hidden');
            }
            if (this.pos.config.internal_transfer) {
                this.$('.create_internal_transfer_order').removeClass('oe_hidden');
                if (order.get_client() && order.orderlines.length > 0) {
                    this.$('.create_internal_transfer_order').addClass('highlight');
                } else {
                    this.$('.create_internal_transfer_order').removeClass('highlight');
                }
            } else {
                this.$('.create_internal_transfer_order').addClass('oe_hidden');
            }
            this.$('.print_receipt').addClass('highlight');
            //---------------------------- actions event ---------------------
            var el_input_return_reason = this.$('.input_reason_return');
            if (el_input_return_reason) {
                el_input_return_reason.click(function () {
                    self.chrome.screens['products'].order_widget.set_reason_return();
                })
            }
            var el_set_note_orderline = this.$('.set_note_orderline');
            if (el_set_note_orderline) {
                el_set_note_orderline.click(function () {
                    self.chrome.screens['products'].order_widget.set_note()
                })
            }
            var el_set_multi_variant = this.$('.multi_variant');
            if (el_set_multi_variant) {
                el_set_multi_variant.click(function () {
                    self.pos.show_products_with_field('multi_variant');
                    var order = self.pos.get_order();
                    var selected_orderline = order.selected_orderline;
                    if (selected_orderline && selected_orderline.product.multi_variant && self.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id]) {
                        return self.gui.show_popup('popup_select_variants', {
                            variants: self.pos.variant_by_product_tmpl_id[selected_orderline.product.product_tmpl_id],
                            selected_orderline: selected_orderline,
                        });
                    } else {
                        return self.pos.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Line selected not active Multi Variant'),
                        })
                    }
                })
            }
            var el_set_generic_options = this.$('.set_generic_options');
            if (el_set_generic_options) {
                el_set_generic_options.click(function () {
                    var order = self.pos.get_order();
                    if (order && order.selected_orderline) {
                        order.ask_cashier_generic_options();
                    }
                })
            }
            var el_modifier_bom = this.$('.modifier_bom');
            if (el_modifier_bom) {
                el_modifier_bom.click(function () {
                    var order = self.pos.get_order();
                    if (order && order.selected_orderline) {
                        order.selected_orderline.modifier_bom();
                    }
                })
            }
            var el_create_mrp_product_direct = this.$('.create_mrp_product_direct');
            if (el_create_mrp_product_direct) {
                el_create_mrp_product_direct.click(function () {
                    var order = self.pos.get_order();
                    if (order && order.selected_orderline) {
                        order.selected_orderline.create_mrp_product_direct();
                    }
                })
            }
            var el_set_change_cross_selling = this.$('.change_cross_selling');
            if (el_set_change_cross_selling) {
                el_set_change_cross_selling.click(function () {
                    self.pos.show_products_with_field('cross_selling');
                    var order = self.pos.get_order();
                    if (order && order.selected_orderline) {
                        order.selected_orderline.change_cross_selling();
                    }
                })
            }
            var el_set_product_packaging = this.$('.product_packaging');
            if (el_set_product_packaging) {
                el_set_product_packaging.click(function () {
                    self.pos.show_products_with_field('sale_with_package');
                    var order = self.pos.get_order();
                    if (order) {
                        var selected_orderline = order.selected_orderline;
                        if (selected_orderline) {
                            var product_id = selected_orderline.product.id;
                            var list = [];
                            var packagings = self.pos.packaging_by_product_id[product_id];
                            if (packagings) {
                                for (var j = 0; j < packagings.length; j++) {
                                    var packaging = packagings[j];
                                    list.push({
                                        'label': packaging.name + ' with price: ' + packaging.list_price + ' and qty: ' + packaging.qty,
                                        'item': packaging
                                    });
                                }
                            }
                            if (list.length) {
                                return self.pos.gui.show_popup('selection', {
                                    title: _t('Select packaging'),
                                    list: list,
                                    confirm: function (packaging) {
                                        var order = self.pos.get_order();
                                        if (order && order.selected_orderline && packaging.list_price > 0 && packaging.qty > 0) {
                                            var selected_orderline = order.selected_orderline;
                                            selected_orderline.packaging = packaging;
                                            return self.pos.gui.show_popup('number', {
                                                title: 'How many boxes',
                                                body: 'How many boxes you need to sell ?',
                                                confirm: function (number) {
                                                    if (number > 0) {
                                                        var order = self.pos.get_order();
                                                        if (!order) {
                                                            return self.pos.gui.show_popup('dialog', {
                                                                title: 'Warning',
                                                                body: 'Could not find order selected',
                                                            })
                                                        }
                                                        var selected_orderline = order.selected_orderline;
                                                        if (!selected_orderline) {
                                                            return self.pos.gui.show_popup('dialog', {
                                                                title: 'Warning',
                                                                body: 'Could not find order line selected',
                                                            })
                                                        }
                                                        selected_orderline.packaging = packaging;
                                                        selected_orderline.set_quantity(packaging.qty * number);
                                                        selected_orderline.set_unit_price(packaging.list_price / packaging.qty);
                                                        selected_orderline.price_manually_set = true;
                                                        return self.pos.gui.show_popup('dialog', {
                                                            title: 'Success',
                                                            body: 'Great job ! You just add ' + number + ' box/boxes for ' + selected_orderline.product.display_name,
                                                            color: 'success'
                                                        })
                                                    } else {
                                                        return self.pos.gui.show_popup('dialog', {
                                                            title: 'Warning',
                                                            body: 'Number of packaging/box could not smaller than 0',
                                                        })
                                                    }
                                                }
                                            })
                                        }
                                        if (packaging.list_price <= 0 || packaging.qty <= 0) {
                                            self.pos.gui.show_popup('dialog', {
                                                title: 'Warning',
                                                body: 'Your packaging selected have price or quantity smaller than or equal 0'
                                            })
                                        }
                                    }
                                });
                            } else {
                                return self.pos.gui.show_popup('dialog', {
                                    title: _t('Alert'),
                                    body: _t('Selected line have not set sale by package')
                                })
                            }
                        }
                    }
                })
            }
            var el_set_unit_measure = this.$('.set_unit_measure');
            if (el_set_unit_measure) {
                el_set_unit_measure.click(function () {
                    self.chrome.screens['products'].order_widget.set_unit()
                })
            }
            var el_remove_shopping_cart = this.$('.remove_shopping_cart');
            if (el_remove_shopping_cart) {
                el_remove_shopping_cart.click(function () {
                    self.chrome.screens['products'].order_widget.remove_shopping_cart()
                })
            }
            var el_return_products = this.$('.return_products');
            if (el_return_products) {
                el_return_products.click(function () {
                    if (self.pos.get_order() && self.pos.get_order().orderlines.length == 0) {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: _t('Your shopping cart is empty')
                        })
                    }
                    self.pos.gui.show_popup('textarea', {
                        title: _t('Warning, you are processing Return Order. Please take note why return this Order'),
                        body: _t('Please take Note for return Order'),
                        confirm: function (note) {
                            var order = self.pos.get_order();
                            order.set_note(note)
                            for (var i = 0; i < order.orderlines.models.length; i++) {
                                var line = order.orderlines.models[i];
                                if (line.quantity > 0) {
                                    line.set_quantity(-line.quantity)
                                }
                            }
                            self.pos.push_order(order);
                            self.pos.gui.show_screen('receipt');
                        }
                    })
                })
            }
            var el_set_dynamic_combo = this.$('.set_dynamic_combo');
            if (el_set_dynamic_combo) {
                el_set_dynamic_combo.click(function () {
                    var order = self.pos.get_order();
                    var selected_line = order.get_selected_orderline();
                    if (!selected_line) {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: _t('No Line Selected, please selected one line inside order cart before')
                        })
                    }
                    var pos_categories_combo = _.filter(self.pos.pos_categories, function (categ) {
                        return categ.is_category_combo
                    });
                    if (pos_categories_combo.length == 0) {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: _t('Your POS Categories have not any Category Combo')
                        })
                    }
                    self.pos.gui.show_popup('popup_dynamic_combo', {
                        title: _t('Please select one Category and Add Combo Items'),
                        body: _t('Please select combo items and add to line selected'),
                        selected_combo_items: selected_line.selected_combo_items,
                        confirm: function (selected_combo_items) {
                            // TODO: selected_combo_items is {product_id: quantity}
                            selected_line.set_dynamic_combo_items(selected_combo_items)
                        }
                    })
                })
            }
            var el_set_bundle_pack = this.$('.set_bundle_pack');
            if (el_set_bundle_pack) {
                el_set_bundle_pack.click(function () {
                    var order = self.pos.get_order();
                    var selected_orderline = order.selected_orderline;
                    var selected_combo_items = selected_orderline.combo_items;
                    var combo_items = []
                    var combo_items_of_selected_line = _.filter(self.pos.combo_items, function (item) {
                        return item.product_combo_id[0] == selected_orderline.product.product_tmpl_id
                    })
                    for (var i = 0; i < combo_items_of_selected_line.length; i++) {
                        var combo_item = combo_items_of_selected_line[i];
                        if (combo_item.product_combo_id[0] == selected_orderline.product.product_tmpl_id) {
                            var combo_item_exist = _.find(selected_combo_items, function (s) {
                                return s.id == combo_item.id
                            })
                            if (combo_item_exist) {
                                combo_item.quantity = combo_item_exist.quantity
                            } else {
                                combo_item.quantity = 0
                            }
                            combo_items.push(combo_item)
                        }
                    }
                    return self.pos.gui.show_popup('PopUpModifierBundlePack', {
                        title: _t('Alert'),
                        body: _t('Modifiers Bundle/Pack Items, you can add/remove some Items bellow'),
                        combo_items: combo_items,
                        confirm: function (combo_items) {
                            var order = self.pos.get_order();
                            var selected_orderline = order.selected_orderline;
                            selected_orderline.set_combo_bundle_pack(combo_items);
                        }
                    })
                })
            }
            var el_service_charge = this.$('.service-charge');
            if (el_service_charge) {
                el_service_charge.click(function () {
                    $('.control-buttons-extend').empty();
                    $('.control-buttons-extend').removeClass('oe_hidden');
                    self.chrome.screens['products'].order_widget.ServiceChargeWidget = new ServiceChargeWidget(self, {
                        widget: self,
                    });
                    self.chrome.screens['products'].order_widget.ServiceChargeWidget.appendTo($('.control-buttons-extend'));
                })
            }
            var el_set_discount = this.$('.set_discount');
            if (el_set_discount) {
                el_set_discount.click(function () {
                    self.pos.trigger('open:discounts');
                })
            }
            var el_discount_value = this.$('.discount-value');
            if (el_discount_value) {
                el_discount_value.click(function () {
                    self.gui.show_popup('number', {
                        title: _t('Set Discount Value'),
                        body: 'Please input discount value, but required smaller than: ' + self.pos.gui.chrome.format_currency(self.pos.discount_value_limit),
                        confirm: function (discount_value) {
                            var order = self.pos.get_order();
                            if (order) {
                                order.set_discount_value(discount_value)
                            }
                        }
                    });
                })
            }
            var el_promotion = this.$('.promotion_details');
            if (el_promotion) {
                el_promotion.click(function () {
                    self.pos.trigger('open:promotions');
                })
            }
            var el_tags = this.$('.set_tags');
            if (el_tags) {
                el_tags.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.set_tags()
                    }
                })
            }
            var el_set_discount_price = this.$('.set_discount_price');
            if (el_set_discount_price) {
                el_set_discount_price.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.set_discount_price()
                    }
                })
            }
            var el_print_receipt = this.$('.print_receipt');
            if (el_print_receipt) {
                el_print_receipt.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.print_receipt()
                    }
                })
            }
            var el_change_taxes = this.$('.change_taxes');
            if (el_change_taxes) {
                el_change_taxes.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.change_taxes()
                    }
                })
            }
            var el_submit_order = this.$('.submit_order');
            if (el_submit_order) {
                el_submit_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.submit_order_to_order_printer()
                    }
                })
            }
            var el_add_booking_order = this.$('.add_booking_order');
            if (el_add_booking_order) {
                el_add_booking_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.create_booking_order()
                    }
                })
            }
            var el_add_shipping_order = this.$('.add_shipping_order');
            if (el_add_shipping_order) {
                el_add_shipping_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.create_shipping_order()
                    }
                })
            }
            var el_assign_order_to_another_session = this.$('.assign_order_to_another_session');
            if (el_assign_order_to_another_session) {
                el_assign_order_to_another_session.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.assign_order_to_another_shop()
                    }
                })
            }
            var el_set_promotion = this.$('.set_promotion');
            if (el_set_promotion) {
                el_set_promotion.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.remove_all_promotion_line();
                        order.manual_set_promotions()
                    }
                })
            }
            var el_create_purchase_order = this.$('.create_purchase_order');
            if (el_create_purchase_order) {
                el_create_purchase_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('popup_create_purchase_order', {
                            title: _t('Create Purchase Order'),
                            widget: self,
                        });
                    }
                })
            }
            var el_create_internal_transfer_order = this.$('.create_internal_transfer_order');
            if (el_create_internal_transfer_order) {
                el_create_internal_transfer_order.click(function () {
                    var order = self.pos.get_order();
                    var length = order.orderlines.length;
                    if (length == 0) {
                        return self.pos.gui.show_popup('dialog', {
                            title: _t('Error'),
                            body: _t('There are no order lines')
                        });
                    } else {
                        self.pos.gui.show_popup('popup_internal_transfer', {
                            title: _t('Create Internal Transfer Order'),
                        })
                    }
                })
            }
            var el_set_loyalty_reward_program = this.$('.set_loyalty_reward_program');
            if (el_set_loyalty_reward_program) {
                el_set_loyalty_reward_program.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.set_reward_program()
                    }
                })
            }
            var el_split_order = this.$('.split_order');
            if (el_split_order) {
                el_split_order.click(function () {
                    var order = self.pos.get_order();
                    if (order && order.orderlines.length > 0) {
                        self.pos.gui.show_screen('splitbill');
                    }
                })
            }
            var el_print_receipt_bill = this.$('.print_receipt_bill');
            if (el_print_receipt_bill) {
                el_print_receipt_bill.click(function () {
                    var order = self.pos.get_order();
                    if (order.get_orderlines().length > 0) {
                        self.pos.gui.show_screen('bill');
                    } else {
                        self.pos.gui.show_popup('error', {
                            'title': _t('Nothing to Print'),
                            'body': _t('There are no order lines'),
                        });
                    }
                })
            }
            var el_transfer_table = this.$('.transfer_table');
            if (el_transfer_table) {
                el_transfer_table.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.transfer_order_to_different_table();
                    }
                })
            }
            var el_merge_table = this.$('.merge_table');
            if (el_merge_table) {
                el_merge_table.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('PopUpMergeTables', {
                            title: _t('Please choice Tables merge to this Order'),
                            confirm: function () {
                                self.gui.show_screen('products');
                            },
                        });
                    }
                })
            }
            var el_lock_table = this.$('.lock_table');
            if (el_lock_table) {
                el_lock_table.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('selection', {
                            title: _t('Alert'),
                            body: _t('Please choose lock on or lock all'),
                            list: [
                                {
                                    label: _t('Only lock current Order'),
                                    item: true
                                },
                                {
                                    label: _t('Lock all Orders'),
                                    item: false
                                }
                            ],
                            confirm: function (choose) {
                                if (choose) {
                                    var order = self.pos.get_order();
                                    return order.lock_order()
                                } else {
                                    for (var i = 0; i < self.pos.get('orders').models.length; i++) {
                                        self.pos.get('orders').models[i].lock_order()
                                    }
                                }
                            }
                        })
                    }
                })
            }
            var el_split_table = this.$('.split_table');
            if (el_split_table) {
                el_split_table.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('split_table', {
                            title: _t('Choice table and click Split button for move line to another table'),
                            confirm: function () {
                                self.gui.show_screen('products');
                            },
                        });
                    }
                })
            }
            var el_create_sale_order = this.$('.create_sale_order');
            if (el_create_sale_order) {
                el_create_sale_order.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        order.create_sale_order()
                    }
                })
            }
            var el_set_partner_shipping_id = this.$('.set_partner_shipping_id');
            if (el_set_partner_shipping_id) {
                el_set_partner_shipping_id.click(function () {
                    var order = self.pos.get_order();
                    if (order) {
                        self.pos.gui.show_popup('popup_selection_extend', {
                            title: _t('Set Receiver'),
                            fields: ['name', 'email', 'phone', 'mobile', 'balance', 'wallet', 'pos_loyalty_point'],
                            header_button: '<button type="submit" style="color: black; background: none" class="btn btn-round btn-just-icon">\n' +
                                '                      <i class="material-icons">person_add</i>\n' +
                                '                    </button>',
                            header_button_action: function () {
                                return self.gui.show_popup('popup_create_customer', {
                                    title: _t('Create new Customer')
                                })
                            },
                            sub_datas: self.pos.db.get_partners_sorted(20),
                            sub_search_string: self.pos.db.partner_search_string,
                            sub_record_by_id: self.pos.db.partner_by_id,
                            sub_template: 'clients_list',
                            body: 'Please select one client',
                            confirm: function (client_id) {
                                var client = self.pos.db.get_partner_by_id(client_id);
                                if (client) {
                                    self.pos.get_order().partner_shipping_id = client_id
                                }
                            }
                        })
                    }
                })
            }
        },
    });

});
