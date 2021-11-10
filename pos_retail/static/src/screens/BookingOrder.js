"use strict";
odoo.define('pos_retail.screen_sale_orders', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var chrome = require('point_of_sale.chrome');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');

    var ButtonSaleOrdersScreen = screens.ActionButtonWidget.extend({
        template: 'ButtonSaleOrdersScreen',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('open:book-orders', function () {
                self.button_click();
            });
            this.pos.bind('reload:countOrders', function () {
                self.renderElement();
            });
        },
        button_click: function () {
            this.pos.gui.show_screen('sale_orders');
        },
        get_sale_orders: function () {
            var orders = this.pos.db.get_sale_orders();
            return orders.length;
        }
    });

    screens.define_action_button({
        'name': 'ButtonSaleOrdersScreen',
        'widget': ButtonSaleOrdersScreen,
        'condition': function () {
            return this.pos.config.booking_orders
        }
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        init_from_JSON: function (json) {
            _super_order.init_from_JSON.apply(this, arguments);
            if (json.booking_id) {
                this.booking_id = json.booking_id;
            }
        },
        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            if (this.booking_id) {
                json.booking_id = this.booking_id
            }
            return json;
        },
        _covert_pos_line_to_sale_line: function (line) {
            var product = this.pos.db.get_product_by_id(line.product_id);
            var line_val = {
                product_id: line.product_id,
                price_unit: line.price_unit,
                product_uom_qty: line.qty,
                discount: line.discount,
                product_uom: product.uom_id[0],
            };
            if (line.uom_id) {
                line_val['product_uom'] = line.uom_id
            }
            if (line.variants) {
                line_val['variant_ids'] = [[6, false, []]];
                for (var j = 0; j < line.variants.length; j++) {
                    var variant = line.variants[j];
                    line_val['variant_ids'][0][2].push(variant.id)
                }
            }
            if (line.tax_ids) {
                line_val['tax_id'] = line.tax_ids;
            }
            if (line.note) {
                line_val['pos_note'] = line.note;
            }
            return [0, 0, line_val];
        },
        _final_and_print_booking_order: function (result) {
            var order = this.pos.get_order();
            this.pos.set('order', order);
            this.pos.db.remove_unpaid_order(order);
            this.pos.db.remove_order(order['uid']);
            order.name = result['name'];
            order.uid = result['name']
            order.booking_uid = result['name']
            order.temporary = true;
            order.trigger('change', order);
            var booking_link = window.location.origin + "/web#id=" + result.id + "&view_type=form&model=sale.order";
            window.open(booking_link, '_blank');
            this.pos.gui.show_screen('receipt');
        }
    });

    var popup_create_sale_order = PopupWidget.extend({ // popup create sale order
        template: 'popup_create_sale_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            this._super(options);
            this.$(".pos_signature").jSignature();
            this.signed = false;
            this.$(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            self.$('.sale_order_field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            var pricelist_id = null;
            var order = self.pos.get_order();
            if (!order) {
                return self.wrong_input('span[class="card-issue"]', '(*) Order does not exist');
            }
            var client = order.get_client();
            if (!client) {
                return self.wrong_input('span[class="card-issue"]', '(*) Client is not select');
            }
            var order = self.pos.get_order();
            if (self.signed == false && self.pos.config.sale_order_required_signature == true) {
                return self.wrong_input('div[name="pos_signature"]', '(*) Required Signature first');
            } else {
                self.passed_input('div[name="pos_signature"]');
            }
            var pricelist = order['pricelist'];
            if (!pricelist && this.pos.default_pricelist) {
                pricelist_id = this.pos.default_pricelist.id;
            }
            if (pricelist) {
                pricelist_id = pricelist.id;
            }
            var so_val = order.export_as_JSON();
            var value = {
                origin: self.pos.config.name,
                note: fields['note'],
                partner_id: so_val.partner_id,
                pricelist_id: pricelist_id,
                order_line: [],
                signature: null,
                payment_term_id: parseInt(fields['payment_term_id']),
                book_order: true,
                ean13: order['ean13'],
                pos_config_id: self.pos.config.id,
            };
            if (order.partner_shipping_id) {
                value['partner_shipping_id'] = order.partner_shipping_id
            }
            var location = self.pos.get_picking_source_location();
            if (!location) {
                return self.wrong_input('span[class="card-issue"]', '(*) Your pos not config stock location');
            } else {
                value['pos_location_id'] = location['id'];
            }
            var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
            if (sign_datas && sign_datas[1]) {
                value['signature'] = sign_datas[1]
                order['signature'] = value['signature'];
            }
            for (var i = 0; i < so_val.lines.length; i++) {
                var line = so_val.lines[i][2];
                var line_value = order._covert_pos_line_to_sale_line(line);
                value.order_line.push(line_value)
            }
            var fiscal_position_id = null;
            if (order.fiscal_position) {
                fiscal_position_id = order.fiscal_position['id']
                value['fiscal_position_id'] = fiscal_position_id;
            }
            var sale_order_auto_confirm = self.pos.config.sale_order_auto_confirm;
            var sale_order_auto_invoice = self.pos.config.sale_order_auto_invoice;
            var sale_order_auto_delivery = self.pos.config.sale_order_auto_delivery;
            self.pos.gui.close_popup();
            rpc.query({
                model: 'sale.order',
                method: 'pos_create_sale_order',
                args: [value, sale_order_auto_confirm, sale_order_auto_invoice, sale_order_auto_delivery]
            }).then(function (result) {
                self.pos.get_order()._final_and_print_booking_order(result);
            }, function (err) {
                self.pos.query_backend_fail(err);
            });
        }
    });
    gui.define_popup({
        name: 'popup_create_sale_order',
        widget: popup_create_sale_order
    });

    var popup_create_booking_order = PopupWidget.extend({ // create booking order
        template: 'popup_create_booking_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            this.options = options;
            var order = options.order;
            this.payment_methods = [];
            for (var i = 0; i < this.pos.payment_methods.length; i++) {
                var payment_method = this.pos.payment_methods[i];
                if (!payment_method.journal || (payment_method.journal && !payment_method.journal.currency_id) || (payment_method.journal && order.currency && payment_method.journal.currency_id && payment_method.journal.currency_id[0] == order.currency.id && payment_method.journal.pos_method_type == 'default')) {
                    this.payment_methods.push(payment_method)
                }
            }
            this._super(options);
            this.$('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD HH:mm:00',
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
            this.$(".pos_signature").jSignature();
            this.signed = false;
            this.$(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
        },
        click_confirm: function () {
            var self = this;
            var fields = {};
            self.$('.booking_field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            var pricelist_id = parseInt(fields.pricelist_id);
            if (typeof pricelist_id != 'number' || isNaN(pricelist_id)) {
                return self.wrong_input('input[name="pricelist_id"]', "(*) Pricelist doesn't exist");
            } else {
                self.passed_input('input[name="pricelist_id"]');
            }
            var order = self.pos.get_order();
            if (self.signed == false && self.pos.config.booking_orders_required_cashier_signature == true) {
                return self.wrong_input('div[name="pos_signature"]', "(*) Please signature");
            } else {
                self.passed_input('div[name="pos_signature"]');
            }
            var payment_partial_amount = parseFloat(fields.payment_partial_amount);
            var payment_partial_method_id = parseInt(fields.payment_partial_method_id);

            if (payment_partial_amount <= 0) {
                return self.wrong_input('input[name="payment_partial_amount"]', "(*) Partial Payment Amount required bigger than 0");
            } else {
                self.passed_input('input[name="payment_partial_amount"]');
            }
            if (!payment_partial_method_id && payment_partial_amount > 0) {
                return self.wrong_input('input[id="payment_partial_method_id"]', '(*) Method is required');
            } else {
                self.passed_input('input[id="payment_partial_method_id"]');
            }
            var so_val = order.export_as_JSON();
            var value = {
                name: so_val['name'],
                note: fields['note'],
                origin: self.pos.config.name,
                partner_id: so_val.partner_id,
                pricelist_id: pricelist_id,
                order_line: [],
                signature: null,
                book_order: true,
                ean13: order['ean13'],
                delivery_address: fields['delivery_address'],
                delivery_phone: fields['delivery_phone'],
                delivery_date: fields['delivery_date'],
                payment_partial_amount: payment_partial_amount,
                payment_partial_method_id: payment_partial_method_id,
                pos_config_id: self.pos.config.id,
            };
            var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
            if (sign_datas && sign_datas[1]) {
                value['signature'] = sign_datas[1];
                order['signature'] = value['signature'];
            }
            order['delivery_address'] = value['delivery_address'];
            order['delivery_date'] = value['delivery_date'];
            order['delivery_phone'] = value['delivery_phone'];
            order['note'] = value['note'];
            for (var i = 0; i < so_val.lines.length; i++) {
                var line = so_val.lines[i][2];
                var line_val = order._covert_pos_line_to_sale_line(line);
                value.order_line.push(line_val);
            }
            self.payment_partial_amount = payment_partial_amount;
            self.pos.gui.close_popup();
            rpc.query({
                model: 'sale.order',
                method: 'booking_order',
                args: [value]
            }).then(function (result) {
                self.pos.get_order()._final_and_print_booking_order(result);
                if (self.payment_partial_amount > 0) {
                    var cash_in = {
                        amount: self.payment_partial_amount,
                        reason: 'Booked Order ' + result.name,
                        session_id: self.pos.pos_session.id,
                    };
                    rpc.query({
                        model: 'cash.box.out',
                        method: 'cash_input_from_pos',
                        args: [0, cash_in],
                    }).then(function (result) {
                        console.log('Cash In  amount ' + self.payment_partial_amount)
                    }, function (err) {
                        self.pos.query_backend_fail(err);
                    });
                }
            }, function (err) {
                self.pos.query_backend_fail(err);
            });
        }
    });
    gui.define_popup({
        name: 'popup_create_booking_order',
        widget: popup_create_booking_order
    });

    var sale_orders = screens.ScreenWidget.extend({
        template: 'sale_orders',

        init: function (parent, options) {
            var self = this;
            this.sale_selected = null;
            this.reverse = true;
            this._super(parent, options);
            this.pos.bind('reload:countOrders', function () {
                self.renderElement();
                self._display_order_selected();
            }, this);
        },
        _display_order_selected: function () {
            if (this.sale_selected) {
                var order = this.pos.db.sale_order_by_id[this.sale_selected['id']];
                if (order) {
                    this.display_sale_order(order)
                } else {
                    this.hide_sale_selected();
                }
            }
        },
        renderElement: function () {
            // TODO: this method only one time called
            //      - show method: will call when show screen
            //      - this is reason if wanted init any event, do it in this function
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
            this.apply_sort_sale_orders();
            this.render_sale_orders(this.pos.db.get_sale_orders(1000));
            this.$('.client-list-contents').delegate('.sale_row', 'click', function (event) {
                self.order_select(event, $(this), parseInt($(this).data('id')));
            });
            this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);
            this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.booked_order_button').click(function () {
                var sale_orders = _.filter(self.pos.db.get_sale_orders(), function (order) {
                    return order['book_order'] == true && (order['state'] == 'draft' || order['state'] == 'sent');
                });
                self.hide_sale_selected();
                self.render_sale_orders(sale_orders);
            });
            this.$('.sale_lock_button').click(function () {
                var sale_orders = _.filter(self.pos.db.get_sale_orders(), function (order) {
                    return order['state'] == 'sale' || order['state'] == 'done';
                });
                self.hide_sale_selected();
                self.render_sale_orders(sale_orders);
            });
            this.$('.back').click(function () {
                self.gui.show_screen('products');
            });
        },
        apply_sort_sale_orders: function () {
            var self = this;
            this.$('.sort_by_create_date').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('create_date', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_ean13').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('ean13', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_id').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('id', self.reverse, parseInt));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_name').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_origin').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('origin', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;

            });
            this.$('.sort_by_sale_order_sale_person').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('sale_person', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;

            });
            this.$('.sort_by_sale_order_partner_name').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('partner_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_date_order').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('date_order', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_payment_partial_amount').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('payment_partial_amount', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase();
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_amount_tax').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('amount_tax', self.reverse, parseInt));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_amount_total').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('amount_total', self.reverse, parseInt));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_sale_order_state').click(function () {
                var orders = self._get_sale_orders_list().sort(self.pos.sort_by('state', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase();
                }));
                self.render_sale_orders(orders);
                self.reverse = !self.reverse;
            });
        },
        show: function () {
            var self = this;
            var sale_selected = this.sale_selected;
            this._super();
            this.$el.find('input').focus();
            if (sale_selected) {
                var sale = self.pos.db.sale_order_by_id[sale_selected['id']];
                self.display_sale_order(sale);
            }
        },
        clear_search: function () {
            var contents = this.$('.sale_order_detail');
            contents.empty();
            this.render_sale_orders(this.pos.db.get_sale_orders(1000));
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        perform_search: function (query, associate_result) {
            var orders;
            if (query) {
                orders = this.pos.db.search_sale_orders(query);
                if (associate_result && orders.length === 1) {
                    return this.display_sale_order(orders[0]);
                }
                return this.render_sale_orders(orders);
            } else {
                sale_orders = this.pos.db.get_sale_orders(1000);
                return this.render_sale_orders(sale_orders);
            }
        },
        _get_sale_orders_list: function () {
            if (!this.sale_list) {
                return this.pos.db.get_sale_orders(1000)
            } else {
                return this.sale_list;
            }
        },
        partner_icon_url: function (id) {
            return '/web/image?model=res.partner&id=' + id + '&field=image_128';
        },
        order_select: function (event, $order, id) {
            var order = this.pos.db.sale_order_by_id[id];
            this.$('.client-line').removeClass('highlight');
            $order.addClass('highlight');
            this.display_sale_order(order);
        },
        render_sale_orders: function (sales) {
            var contents = this.$el[0].querySelector('.sale_orders_table');
            contents.innerHTML = "";
            for (var i = 0, len = Math.min(sales.length, 1000); i < len; i++) {
                var sale = sales[i];
                var sale_row_html = qweb.render('sale_row', {widget: this, sale: sale});
                var sale_row = document.createElement('tbody');
                sale_row.innerHTML = sale_row_html;
                sale_row = sale_row.childNodes[1];
                if (sale === this.sale_selected) {
                    sale_row.classList.add('highlight');
                } else {
                    sale_row.classList.remove('highlight');
                }
                contents.appendChild(sale_row);
            }
            this.sale_list = sales;
        },
        display_sale_order: function (sale) {
            this.sale_selected = sale;
            var self = this;
            var contents = this.$('.sale_order_detail');
            contents.empty();
            if (!sale) {
                return contents.empty();
            }
            var $row_selected = this.$("[data-id='" + sale['id'] + "']");
            $row_selected.addClass('highlight');
            sale['link'] = window.location.origin + "/web#id=" + sale.id + "&view_type=form&model=sale.order";
            contents.append($(qweb.render('sale_order_detail', {widget: this, sale: sale})));
            var sale_lines = this.pos.db.lines_sale_by_id[sale['id']];
            if (sale_lines) {
                var line_contents = this.$('.lines_detail');
                line_contents.empty();
                line_contents.append($(qweb.render('sale_order_lines', {widget: this, lines: sale_lines})));
            }
            this.$('.print_quotation').click(function () {
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select order the first'
                    })
                }
                self.chrome.do_action('sale.action_report_saleorder', {
                    additional_context: {
                        active_ids: [self.sale_selected['id']]
                    }
                })
            });
            this.$('.action_report_pro_forma_invoice').click(function () {
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select order the first'
                    })
                }
                self.chrome.do_action('sale.action_report_saleorder', {
                    additional_context: {
                        active_ids: [self.sale_selected['id']]
                    }
                });
            });
            this.$('.action_confirm').click(function () {
                self.pos.gui.close_popup();
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select order the first'
                    })
                }
                return rpc.query({
                    model: 'sale.order',
                    method: 'action_confirm',
                    args:
                        [[self.sale_selected['id']]],
                    context: {
                        pos: true
                    }
                }).then(function () {
                    self.pos.reloadSaleOrder();
                }, function (err) {
                    self.pos.query_backend_fail(error)
                })
            });
            this.$('.action_done').click(function () {
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select order the first'
                    })
                }
                return rpc.query({
                    model: 'sale.order',
                    method: 'action_done',
                    args:
                        [[self.sale_selected['id']]],
                    context: {
                        pos: true
                    }
                }).then(function () {
                    self.pos.reloadSaleOrder();
                }, function (err) {
                    self.pos.query_backend_fail(err);
                })
            });
            this.$('.action_return').click(function () {
                if (self.sale_selected) {
                    self.pos.gui.show_popup('popup_stock_return_picking', {
                        title: _t('Return Order: ' + self.sale_selected.name),
                        sale: self.sale_selected,
                        confirm: function () {
                            self.render_sale_orders(self.pos.db.get_sale_orders(1000));
                        }
                    })
                }
            });
            this.$('.action_validate_picking').click(function () {
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select order the first'
                    })
                }
                if (self.sale_selected) {
                    return rpc.query({
                        model: 'sale.order',
                        method: 'action_validate_picking',
                        args:
                            [[self.sale_selected['id']]],
                        context: {
                            pos: true
                        }
                    }).then(function (picking_name) {
                        self.pos.reloadSaleOrder();
                        if (picking_name) {
                            return self.pos.gui.show_popup('dialog', {
                                title: 'Done',
                                body: 'Order process to delivery done',
                                color: 'success'
                            })
                        } else {
                            self.link = window.location.origin + "/web#id=" + self.sale_selected.id + "&view_type=form&model=sale.order";
                            return self.pos.gui.show_popup('confirm', {
                                title: 'Warning',
                                body: 'Order have 2 picking, please do manual',
                                confirm: function () {
                                    window.open(self.link, '_blank');
                                },
                                cancel: function () {
                                    self.pos.gui.close_popup();
                                }
                            })
                        }
                        return self.pos.gui.close_popup();
                    }).catch(function (error) {
                        return self.pos.query_backend_fail(error);
                    })
                }
            });
            this.$('.action_covert_to_pos_order').click(function () {
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Alert'),
                        body: _t('Please select order the first')
                    })
                }
                if (self.sale_selected) {
                    if (self.sale_selected.state == 'booked' && self.sale_selected.pos_order_id) {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: _t('This order covert to POS Order succeed before')
                        })
                    }
                    var sale_selected = self.sale_selected;
                    var last_covert_order = _.find(self.pos.get('orders').models, function (order) {
                        return order.booking_id == self.sale_selected;
                    })
                    if (last_covert_order) {
                        return self.pos.set('selectedOrder', last_covert_order);
                    }
                    var lines = self.pos.db.lines_sale_by_id[sale_selected['id']];
                    if (!lines) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Sale order is blank lines, could not cover to pos order',
                        })
                    }
                    var order = new models.Order({}, {pos: self.pos, temporary: false});
                    order['name'] = self.sale_selected['name'];
                    order['delivery_address'] = sale_selected['delivery_address'];
                    order['delivery_date'] = sale_selected['delivery_date'];
                    order['delivery_phone'] = sale_selected['delivery_phone'];
                    order['booking_id'] = self.sale_selected['id'];
                    var partner_id = sale_selected['partner_id'];
                    var partner = self.pos.db.get_partner_by_id(partner_id[0]);
                    if (partner) {
                        order.set_client(partner);
                    } else {
                        order.temporary = true;
                        order.destroy({'reason': 'abandon'});
                        return self.pos.gui.show_popup('dialog', {
                            title: _t('Alert'),
                            body: _t('Partner ') + partner_id[1] + _t(' not available on pos, please update this partner active on POS'),
                        })
                    }
                    if (self.sale_selected.pricelist_id) {
                        var pricelist = self.pos.pricelist_by_id[self.sale_selected.pricelist_id[0]]
                        if (pricelist) {
                            order.set_pricelist(pricelist)
                        }
                    }
                    var added_line = false;
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        var product = self.pos.db.get_product_by_id(line.product_id[0]);
                        if (!product) {
                            continue
                        } else {
                            added_line = true;
                            var new_line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            new_line.set_quantity(line.product_uom_qty, 'keep price');
                            order.orderlines.add(new_line);
                            new_line.set_discount(line.discount || 0);
                            if (line.variant_ids) {
                                var variants = _.map(line.variant_ids, function (variant_id) {
                                    if (self.pos.variant_by_id[variant_id]) {
                                        return self.pos.variant_by_id[variant_id]
                                    }
                                });
                                new_line.set_variants(variants);
                            }
                            if (line.pos_note) {
                                new_line.set_line_note(line.pos_note);
                            }
                            if (line.product_uom) {
                                var uom_id = line.product_uom[0];
                                var uom = self.pos.uom_by_id[uom_id];
                                if (uom) {
                                    new_line.set_unit(line.product_uom[0]);
                                } else {
                                    self.pos.gui.show_popup('dialog', {
                                        title: _t('Alert'),
                                        body: _t('Your pos have not unit ') + line.product_uom[1]
                                    })
                                }
                            }
                            new_line.set_unit_price(line.price_unit);
                        }
                    }
                    var orders = self.pos.get('orders');
                    orders.add(order);
                    self.pos.set('selectedOrder', order);
                    if (!added_line) {
                        order.temporary = true;
                        order.destroy({'reason': 'abandon'});
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Alert'),
                            body: _t('Lines of Booked Order have not any products available in pos, made sure all products of Booked Order have check to checkbox [Available in pos]')
                        })
                    }
                    if (self.sale_selected['payment_partial_amount']) {
                        var ref = _t('This order have paid before: ') + self.pos.gui.chrome.format_currency(self.sale_selected['payment_partial_amount']);
                        ref += _t(' Sale Order name: ') + self.sale_selected.name;
                        var payment_partial_method_id = self.sale_selected['payment_partial_method_id'][0];
                        var payment_method = _.find(self.pos.payment_methods, function (method) {
                            return method.id == payment_partial_method_id;
                        });
                        if (payment_method) {
                            order.add_paymentline(payment_method);
                            var paymentline = order.selected_paymentline;
                            paymentline.set_amount(self.sale_selected['payment_partial_amount']);
                            paymentline.add_partial_amount_before = true;
                            paymentline.set_reference(ref);
                        }
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Alert'),
                            body: ref,
                            color: 'success'
                        });
                    }
                }
            });
            this.$('.print_receipt').click(function () {
                if (!self.sale_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Please select order the first'
                    })
                }
                if (self.sale_selected) {
                    var sale_selected = self.sale_selected;
                    var lines = self.pos.db.lines_sale_by_id[sale_selected['id']];
                    if (!lines) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Sale order is blank lines, could not cover to pos order',
                        })
                    }
                    var order = new models.Order({}, {pos: self.pos, temporary: true});
                    order['name'] = self.sale_selected['name'];
                    order['booking_id'] = sale_selected['id'];
                    order['delivery_address'] = sale_selected['delivery_address'];
                    order['delivery_date'] = sale_selected['delivery_date'];
                    order['delivery_phone'] = sale_selected['delivery_phone'];
                    order['ean13'] = sale_selected['ean13'];
                    order['note'] = sale_selected['note'];
                    var partner_id = sale_selected['partner_id'];
                    // TODO: because sale order required have partner, we can get partner_id[0] and nothing bug
                    var partner = self.pos.db.get_partner_by_id(partner_id[0]);
                    if (partner) {
                        order.set_client(partner);
                    } else {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Partner ' + partner_id[1] + ' not available on pos, please update this partner active on POS',
                        })
                    }
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        var product = self.pos.db.get_product_by_id(line.product_id[0])
                        if (!product) {
                            continue
                        } else {
                            var new_line = new models.Orderline({}, {pos: self.pos, order: order, product: product});
                            new_line.set_quantity(line.product_uom_qty, 'keep price');
                            order.orderlines.add(new_line);
                            new_line.set_discount(line.discount || 0)
                            if (line.variant_ids) {
                                var variants = _.map(line.variant_ids, function (variant_id) {
                                    if (self.pos.variant_by_id[variant_id]) {
                                        return self.pos.variant_by_id[variant_id]
                                    }
                                });
                                new_line.set_variants(variants);
                            }
                            if (line.pos_note) {
                                new_line.set_line_note(line.pos_note);
                            }
                            if (line.product_uom) {
                                var uom_id = line.product_uom[0];
                                var uom = self.pos.uom_by_id[uom_id];
                                if (uom) {
                                    new_line.set_unit(line.product_uom[0]);
                                } else {
                                    self.pos.gui.show_popup('dialog', {
                                        title: 'Warning',
                                        body: 'Your pos have not unit ' + line.product_uom[1]
                                    })
                                }
                            }
                            new_line.set_unit_price(line.price_unit);
                        }
                    }
                    var orders = self.pos.get('orders');
                    orders.add(order);
                    self.pos.set('selectedOrder', order);
                    return self.pos.gui.show_screen('receipt');
                }
            })
        },
        hide_sale_selected: function () {
            var contents = this.$('.sale_order_detail');
            contents.empty();
            this.sale_selected = null;

        }
    });
    gui.define_screen({name: 'sale_orders', widget: sale_orders});

    screens.OrderWidget.include({
        init: function (parent, options) {
            this._super(parent, options);
            var self = this;
            this.pos.bind('reload:countOrders', function () {
                self.update_count_booked_orders();
            }, this);
            this.pos.bind('change:selectedOrder', function () {
                self.update_count_booked_orders();
            }, this);
        },
        update_count_booked_orders: function () { // set count booked orders
            var $booked_orders = $('.booked_orders');
            if ($booked_orders) {
                var sale_orders = _.filter(this.pos.db.get_sale_orders(), function (order) {
                    return order['book_order'] == true && (order['state'] == 'draft' || order['state'] == 'sent');
                });
                $booked_orders.text(sale_orders.length);
            }
        },
        show_delivery_address: function (buttons, selected_order) {
            if (selected_order && selected_order.is_return) {
                return;
            }
            var $delivery_address = this.el.querySelector('.delivery_address');
            var $delivery_date = this.el.querySelector('.delivery_date');
            if ($delivery_address) {
                $delivery_address.textContent = selected_order['delivery_address'];
            }
            if ($delivery_date) {
                $delivery_date.textContent = selected_order['delivery_date'];
            }
        },
    })
});
