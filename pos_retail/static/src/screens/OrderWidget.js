"use strict";
odoo.define('pos_retail.screen_order_widget', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var ServiceChargeWidget = require('pos_retail.service_charge');
    var rpc = require('pos.rpc');

    screens.OrderWidget.include({
        init: function (parent, options) {
            var self = this;
            this.decimal_point = _t.database.parameters.decimal_point;
            this._super(parent, options);
            this.pos.bind('change:mode', function () {
                self.change_mode();
            });
            this.inputbuffer = "";
            // TODO: method update_summary made many slow pos if have many features included
            // TODO: we made timeout 0.5 seconds auto update order by uid
            this.queue_order_required_update = {}
            this._update_screen();
        },
        _update_screen: function () {
            var self = this;
            for (var uid in this.queue_order_required_update) {
                this.force = true;
                this.update_summary()
                delete this.queue_order_required_update[uid]
            }
            this.force = false;
            setTimeout(_.bind(self._update_screen, self), 200);
        },
        change_line_selected: function (keycode) {
            var order = this.pos.get_order();
            var line_selected = order.get_selected_orderline();
            if (!line_selected && order && order.orderlines.models.length > 0) {
                this.pos.get_order().select_orderline(order.orderlines.models[0]);
                this.numpad_state.reset();
            }
            if (line_selected && order && order.orderlines.models.length > 1) {
                $('.orderline').removeClass('selected');
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    var line_check = order.orderlines.models[i];
                    if (line_check.cid == line_selected.cid) {
                        if (keycode == 38) {
                            if ((i - 1) >= 0) {
                                var line_will_select = order.orderlines.models[i - 1];
                                this.pos.get_order().select_orderline(line_will_select);
                                this.numpad_state.reset();
                                break;
                            }
                        } else {
                            var line_will_select = order.orderlines.models[i + 1];
                            this.pos.get_order().select_orderline(line_will_select);
                            this.numpad_state.reset();
                            break;
                        }
                    }
                }
            }
        },
        click_line: function (orderline, event) {
            this._super(orderline, event);
            var order = this.pos.get_order();
            if (order && order.get_selected_orderline()) {
                var line = order.get_selected_orderline();
                this.inputbuffer = "";
                this.firstinput = true;
                var mode = this.numpad_state.get('mode');
                if (mode === 'quantity') {
                    this.inputbuffer = line['quantity'].toString();
                } else if (mode === 'discount') {
                    this.inputbuffer = line['discount'].toString();
                } else if (mode === 'price') {
                    this.inputbuffer = line['price'].toString();
                }
                if (mode == 'quantity') {
                    this.$('.qty').addClass('selected-mode');
                    this.$('.price-unit').removeClass('selected-mode');
                    this.$('.discount').removeClass('selected-mode');
                }
                if (mode == 'discount') {
                    this.$('.discount').addClass('selected-mode');
                    this.$('.price-unit').removeClass('selected-mode');
                    this.$('.qty').removeClass('selected-mode');
                }
                if (mode == 'price') {
                    this.$('.price-unit').addClass('selected-mode');
                    this.$('.discount').removeClass('selected-mode');
                    this.$('.qty').removeClass('selected-mode');
                }
            }
        },
        change_mode: function () {
            var mode = this.numpad_state.get('mode');
            var order = this.pos.get_order();
            if (order && order.get_selected_orderline()) {
                var selected_line = order.get_selected_orderline();
                if (mode == 'quantity') {
                    this.inputbuffer = selected_line.quantity;
                }
                if (mode == 'price') {
                    this.inputbuffer = selected_line.price;
                }
                if (mode == 'discount') {
                    this.inputbuffer = selected_line.discount;
                }
            } else {
                this.inputbuffer = "";
            }
            this.firstinput = true;
        },
        orderline_change: function (line) {
            this._super(line);
            this.change_mode();
        },
        change_selected_order: function () {
            this._super();
            var order = this.pos.get_order();
            if (order) {
                var product_ids = [];
                for (var i = 0; i < order.orderlines.models.length; i++) {
                    product_ids.push(order.orderlines.models[i].product.id)
                }
            }
        },
        render_orderline: function (orderline) {
            var self = this;
            var el_node = this._super(orderline);
            var el_edit_item = el_node.querySelector('.edit-item');
            if (el_edit_item) {
                el_edit_item.addEventListener('click', (function () {
                    self.pos.hide_selected_line_detail = false;
                    self.pos.trigger('selected:line', self.pos.get_order().get_selected_orderline())
                }.bind(this)));
            }
            var el_set_unit = el_node.querySelector('.set_unit');
            if (el_set_unit) {
                el_set_unit.addEventListener('click', (function (event) {
                    var order = self.pos.get_order();
                    var selected_orderline = order.selected_orderline;
                    var units = selected_orderline.get_units_price();
                    var list = [];
                    for (var i = 0; i < units.length; i++) {
                        var unit = units[i];
                        list.push({
                            label: unit.uom.name + ' with Price: ' + self.pos.chrome.format_currency(unit.price),
                            item: unit
                        })
                    }
                    self.pos.gui.show_popup('selection', {
                        title: _t('Please choose one Unit Of Measure apply to this Line'),
                        list: list,
                        confirm: function (unit) {
                            self.pos.get_order().selected_orderline.set_unit(unit.uom.id, unit.price)
                        }
                    });
                }.bind(this)));
            }
            return el_node;
        },
        remove_shopping_cart: function () {
            var self = this;
            var order = self.pos.get_order();
            var selected_orderline = order.selected_orderline;
            if (order && selected_orderline) {
                order.remove_orderline(selected_orderline);
            } else {
                return self.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Your shopping cart is empty'),
                    color: 'success'
                })
            }
        },
        set_tags: function () {
            var self = this;
            var order = self.pos.get_order();
            if (order && order.selected_orderline) {
                var selected_orderline = order.selected_orderline;
                return self.gui.show_popup('popup_selection_tags', {
                    selected_orderline: selected_orderline,
                    title: _t('Add Tags')
                });
            } else {
                return self.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('Your shopping cart is empty'),
                })
            }
        },
        set_reason_return: function () {
            var self = this;
            var order = self.pos.get_order();
            if (order && order.selected_orderline) {
                return self.gui.show_popup('popup_selection_tags', {
                    selected_orderline: order.selected_orderline,
                    title: _t('Add Reasons Return'),
                    tags: self.pos.return_reasons,
                });
            }
        },
        set_note: function () {
            var self = this;
            var order = self.pos.get_order();
            if (order && order.selected_orderline) {
                var selected_orderline = order.selected_orderline;
                self.pos.gui.show_popup('popup_add_order_line_note', {
                    title: _t('Add Note to Selected Line'),
                    value: selected_orderline.get_line_note(),
                    confirm: function (note) {
                        selected_orderline.set_line_note(note);
                    }
                });
            } else {
                return self.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Your shopping cart is empty'),
                })
            }
        },
        set_unit: function () {
            var self = this;
            var order = self.pos.get_order();
            var selected_orderline = order.selected_orderline;
            if (order) {
                if (selected_orderline) {
                    selected_orderline.change_unit();
                } else {
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Please select line'),
                    });
                }
            } else {
                return self.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('Order Lines is empty'),
                });
            }
        },
        set_seller: function () {
            var self = this;
            var sellers = self.pos.sellers;
            return self.pos.gui.show_popup('popup_selection_extend', {
                title: _t('Select Sale Person'),
                fields: ['name', 'email', 'id'],
                sub_datas: sellers,
                sub_template: 'sale_persons',
                body: _t('Please select one sale person'),
                confirm: function (user_id) {
                    var seller = self.pos.user_by_id[user_id];
                    var order = self.pos.get_order();
                    if (order && order.get_selected_orderline()) {
                        return order.get_selected_orderline().set_sale_person(seller)
                    } else {
                        self.pos.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Have not Line selected, please select one line before add seller')
                        })
                    }
                }
            })
        },
        remove_orderline: function (order_line) {
            try {
                this._super(order_line);
            } catch (ex) {
                console.error('dont worries, client without table select: ' + ex);
            }
            var order = this.pos.get_order();
            if (order && order.orderlines.length == 0) {
                order.is_return = false; // TODO: cashier select pos order and click return, they clear cart and made to order normal
                this.pos.trigger('hide:orderline-detail');
            }
            var line_selected = order.get_selected_orderline();
            if (line_selected) {
                this.pos.trigger('selected:line', line_selected)
            } else {
                this.pos.trigger('selected:line', null);
                this.pos.trigger('hide:orderline-detail')
            }
        },
        set_value: function (val, validate = false) {
            var self = this;
            var mode = this.numpad_state.get('mode');
            if (mode == 'quantity' && this.pos.config.validate_quantity_change && !validate) {
                return this.pos._validate_by_manager("this.chrome.screens['products'].order_widget.set_value('" + val + "', true)", 'Change Quantity of Selected Line');
            }
            if (mode == 'discount' && this.pos.config.validate_discount_change && !validate) {
                return this.pos._validate_by_manager("this.chrome.screens['products'].order_widget.set_value('" + val + "', true)", 'Change Discount of Selected Line');
            }
            if (mode == 'price' && this.pos.config.validate_price_change && !validate) {
                return this.pos._validate_by_manager("this.chrome.screens['products'].order_widget.set_value('" + val + "', true)", 'Change Price of Selected Line');
            }
            var order = this.pos.get_order();
            if (!order) {
                return false;
            }
            var line_selected = order.get_selected_orderline();
            if (!line_selected) {
                return false;
            }
            if (mode == 'discount' && this.pos.config.discount_limit && line_selected) { // TODO: Security limit discount filter by cashiers
                this.gui.show_popup('number', {
                    'title': _t('Which percentage of discount would you apply ?'),
                    'value': self.pos.config.discount_limit_amount,
                    'confirm': function (discount) {
                        if (discount > self.pos.config.discount_limit_amount) {
                            if (self.pos.config.discount_unlock_by_manager) {
                                var manager_validate = [];
                                _.each(self.pos.config.manager_ids, function (user_id) {
                                    var user = self.pos.user_by_id[user_id];
                                    if (user) {
                                        manager_validate.push({
                                            label: user.name,
                                            item: user
                                        })
                                    }
                                });
                                if (manager_validate.length == 0) {
                                    return self.pos.gui.show_popup('confirm', {
                                        title: _t('Warning'),
                                        body: _t('Could not set discount bigger than: ') + self.pos.config.discount_limit_amount + _t(' . If is required, need manager approve but your pos not set manager users approve on Security Tab'),
                                    })
                                }
                                return self.pos.gui.show_popup('selection', {
                                    title: _t('Choice Manager Validate'),
                                    body: _t('Only Manager can approve this Discount, please ask him'),
                                    list: manager_validate,
                                    confirm: function (manager_user) {
                                        if (!manager_user.pos_security_pin) {
                                            return self.pos.gui.show_popup('confirm', {
                                                title: _t('Warning'),
                                                body: manager_user.name + _t(' have not set pos security pin before. Please set pos security pin first')
                                            })
                                        } else {
                                            return self.pos.gui.show_popup('ask_password', {
                                                title: _t('Pos Security Pin of Manager'),
                                                body: _t('Your staff need approve discount is ') + discount + _t(' please approve'),
                                                confirm: function (password) {
                                                    if (manager_user['pos_security_pin'] != password) {
                                                        self.pos.gui.show_popup('dialog', {
                                                            title: _t('Error'),
                                                            body: _t('POS Security pin of ') + manager_user.name + _t(' not correct !')
                                                        });
                                                    } else {
                                                        var selected_line = order.get_selected_orderline();
                                                        selected_line.manager_user = manager_user;
                                                        return selected_line.set_discount(discount);
                                                    }
                                                }
                                            });
                                        }
                                    }
                                })
                            } else {
                                return self.gui.show_popup('dialog', {
                                    title: _t('Warning'),
                                    body: _t('You can not set discount bigger than ') + self.pos.config.discount_limit_amount + _t('. Please contact your pos manager and set bigger than'),
                                })
                            }
                        } else {
                            order.get_selected_orderline().set_discount(discount);
                        }
                    }
                });
            } else {
                if (this.pos.config.validate_remove_line && val == 'remove' && this.pos.get_order() && this.pos.get_order().get_selected_orderline()) {
                    return this.pos._validate_by_manager("this.pos.get_order().remove_orderline(this.pos.get_order().get_selected_orderline())", 'Remove selected Line');
                }
                this._super(val);
            }
        },
        set_lowlight_order: function (buttons) {
            for (var button_name in buttons) {
                buttons[button_name].highlight(false);
            }
        },
        active_button_combo_item_add_lot: function (buttons, selected_order) { // active button set combo
            if (selected_order.selected_orderline && buttons && buttons.button_combo_item_add_lot) {
                var has_combo_item_tracking_lot = selected_order.selected_orderline.has_combo_item_tracking_lot();
                buttons.button_combo_item_add_lot.highlight(has_combo_item_tracking_lot);
            }
        },
        active_internal_transfer_button: function (buttons, selected_order) { // active button set combo
            if (buttons && buttons.internal_transfer_button) {
                var active = selected_order.validation_order_can_do_internal_transfer();
                buttons.internal_transfer_button.highlight(active);
            }
        },
        active_button_create_purchase_order: function (buttons, selected_order) {
            if (buttons.button_create_purchase_order) {
                if (selected_order.orderlines.length > 0 && selected_order.get_client()) {
                    buttons.button_create_purchase_order.highlight(true);
                } else {
                    buttons.button_create_purchase_order.highlight(false);
                }
            }
        },
        active_button_variants: function (buttons, selected_order) {
            if (buttons.button_add_variants) {
                if (selected_order.selected_orderline && this.pos.variant_by_product_tmpl_id[selected_order.selected_orderline.product.product_tmpl_id]) {
                    buttons.button_add_variants.highlight(true);
                } else {
                    buttons.button_add_variants.highlight(false);
                }
            }
        },
        active_medical_insurance: function (buttons, selected_order) {
            if (buttons.button_medical_insurance_screen) {
                if (selected_order.medical_insurance) {
                    buttons.button_medical_insurance_screen.highlight(true);
                } else {
                    buttons.button_medical_insurance_screen.highlight(false);
                }
            }
        },
        active_reprint_last_order: function (buttons, selected_order) {
            if (buttons.button_print_last_order) {
                if (this.pos.report_html) {
                    buttons.button_print_last_order.highlight(true);

                } else {
                    buttons.button_print_last_order.highlight(false);
                }
            }
        },
        active_button_cash_management: function (buttons) {
            if (buttons.button_cash_management) {
                buttons.button_cash_management.highlight(true);
            }
        },
        set_total_gift: function (total_gift) {
            $('.total_gift').html(total_gift);
        },
        update_summary: function () {
            // TODO: this.force is varialle of init method define, when it is true, all element automatic update
            var selected_order = this.pos.get_order();
            if (!this.force && selected_order) {
                this.queue_order_required_update[selected_order.uid] = selected_order
                return true;
            }
            console.log('{OrderWidget.js} update_summary');
            try { // TODO: try catch for sync between session
                this._super();
            } catch (e) {
                console.warn(e)
            }
            var self = this;
            $('.mode-button').click(function () {
                self.change_mode();
            });
            var buttons = this.getParent().action_buttons;
            if (selected_order) {
                this.pos.trigger('update:customer-facing-screen');
                this.pos.trigger('reload.ActionPad');
                var promotion_lines = _.filter(selected_order.orderlines.models, function (line) {
                    return line.promotion;
                });
                if (promotion_lines.length > 0) {
                    this.set_total_gift(promotion_lines.length)
                }
                var el_signature = $('.signature');
                if (el_signature) {
                    el_signature.attr('src', selected_order.get_signature());
                }
                var el_order_note = $('.order-note');
                if (el_order_note) {
                    el_order_note.html(selected_order.get_note());
                }
                this.pos._update_cart_qty_by_order();
                this.display_promotions_active(selected_order);
                if (buttons) {
                    this.active_button_cash_management(buttons);
                    this.active_reprint_last_order(buttons, selected_order);
                    this.active_medical_insurance(buttons, selected_order);
                    this.active_button_combo_item_add_lot(buttons, selected_order);
                    this.active_internal_transfer_button(buttons, selected_order);
                    this.active_button_variants(buttons, selected_order);
                    this.active_button_create_purchase_order(buttons, selected_order);
                    var changes = selected_order.hasChangesToPrint();
                    if (buttons && buttons.button_kitchen_receipt_screen) {
                        buttons.button_kitchen_receipt_screen.highlight(changes);
                    }
                    // TODO: promotion
                    this.active_buyers_promotion(buttons, selected_order);
                    // TODO: loyalty
                    if (this.pos.loyalty) {
                        this.active_loyalty(buttons, selected_order);
                    }
                    // TODO: booking orders
                    this.show_delivery_address(buttons, selected_order);
                }
            }
        }
    });
});
