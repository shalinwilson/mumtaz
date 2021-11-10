"use strict";
odoo.define('pos_retail.screen_product_list', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var ReTailBigData = require('pos_retail.big_data');
    var qweb = core.qweb;
    var _t = core._t;
    // var mobile_product_categories = require('pos_retail.mobile_product_categories');
    var chrome = require('point_of_sale.chrome');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var BarcodeEvents = require('barcodes.BarcodeEvents').BarcodeEvents;

    var OrderLineSelected = PosBaseWidget.extend({
        template: 'OrderLineSelected',
        init: function (parent, options) {
            var self = this;
            if (options.selected_line) {
                this.selected_line = options.selected_line
            }
            this._super(parent, options);
            this.pos.bind('selected:line', function (selected_line) {
                self.selected_line = selected_line;
                if (!self.pos.display_cart_list) {
                    self.renderElement()
                } else {
                    self.hide_orderline_detail()
                }
                if (self.selected_line) {
                    self.selected_line.order.bind('remove', function () {
                        self.hide_orderline_detail()
                    });
                    self.selected_line.bind('remove', function () {
                        self.hide_orderline_detail()
                    });
                } else {
                    self.hide_orderline_detail()
                }
            });
            // this.pos.bind('hide:orderline-detail', function () {
            //     debugger
            //     self.selected_line = self.pos.get_order().get_selected_orderline();
            //     if (self.selected_line) {
            //         self.renderElement();
            //     } else {
            //         self.hide_orderline_detail();
            //     }
            // });
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.plus').click(function () {
                var selected_line = self.pos.get_order().get_selected_orderline();
                if (selected_line) {
                    var next_qty = selected_line.quantity + 1;
                    if (self.pos.config.validate_quantity_change) {
                        self.pos._validate_by_manager('this.pos.get_order().get_selected_orderline().set_quantity("' + next_qty + '")', 'Delete Selected Order')
                    } else {
                        selected_line.set_quantity(next_qty)
                    }
                }
            });
            this.$('.minus').click(function () {
                var selected_line = self.pos.get_order().get_selected_orderline();
                if (selected_line) {
                    var next_qty = selected_line.quantity - 1;
                    if (self.pos.config.validate_quantity_change) {
                        self.pos._validate_by_manager('this.pos.get_order().get_selected_orderline().set_quantity("' + next_qty + '")', 'Delete Selected Order')
                    } else {
                        selected_line.set_quantity(next_qty)
                    }
                }
            });
            this.$('.remove').click(function () {
                var selected_line = self.pos.get_order().get_selected_orderline();
                if (selected_line) {
                    if (self.pos.config.validate_remove_line) {
                        return self.pos._validate_by_manager("this.pos.get_order().remove_orderline(this.pos.get_order().get_selected_orderline())", 'Remove selected Line');
                    } else {
                        return self.pos.get_order().remove_orderline(self.pos.get_order().get_selected_orderline())
                    }
                } else {
                    self.hide_orderline_detail();
                }
            })
        },
        hide_orderline_detail: function () {
            this.selected_line = null;
            this.renderElement();
            this.$('.orderline-selected').addClass('oe_hidden');
        }
    });

    var ViewCartListWidget = PosBaseWidget.extend({
        template: 'ViewCartListWidget',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.display_cart_list = true;
            this.pos.bind('reload.ActionPad', function () {
                self.renderElement();
            });
            this.pos.bind('click.cart-detail', function () {
                self.$('.cart-detail').click();
            });
            this.total_with_tax = this.pos.gui.chrome.format_currency(0);
            this.total_items = 0;
            var el_leftpane = $('.pos .leftpane');
            var el_rightpane = $('.pos .rightpane');
            if (el_leftpane && el_leftpane.length == 1 && el_rightpane && el_rightpane.length == 1 && this.pos.display_cart_list) {
                el_leftpane.css({'left': '55%'});
                el_rightpane.css({'right': '45%'});
                this.pos.trigger('hide:orderline-detail');
            }
        },
        get_count_orders: function () {
            var orders = this.pos.get('orders').models;
            var selected_order = this.pos.get_order();
            if (selected_order && selected_order.table) {
                orders = _.filter(orders, function (o) {
                    return o.table && o.table.id == selected_order.table.id
                })
            }
            return orders.length
        },
        renderElement: function () {
            var self = this;
            var selected_order = this.pos.get_order();
            if (selected_order) {
                this.total_with_tax = this.pos.gui.chrome.format_currency(selected_order.get_total_with_tax());
                this.total_items = selected_order.get_total_items();
            } else {
                this.total_with_tax = this.pos.gui.chrome.format_currency(0);
                this.total_items = 0;
            }
            this.selected_order = selected_order;
            this._super();
            if (!this.pos.display_cart_list) {
                $('.pos .leftpane').css({'left': '100%'});
                $('.pos .rightpane').css({'right': '100px'});
            }
            this.$('.show_tickets').click(function () {
                self.pos.gui.show_screen('tickets')
            });
            this.$('.cart-detail').click(function () {
                if (!self.pos.display_cart_list) {
                    $('.pos .leftpane').css({'left': '55%'});
                    $('.pos .rightpane').css({'right': '45%'});
                } else {
                    $('.pos .leftpane').css({'left': '100%'});
                    $('.pos .rightpane').css({'right': '100px'});
                }
                self.pos.display_cart_list = !self.pos.display_cart_list;
                self.renderElement();
                if (self.pos.display_cart_list) {
                    self.pos.trigger('selected:line', self.pos.get_order().get_selected_orderline())
                } else {
                    self.pos.trigger('hide:orderline-detail');
                }
            });
            this.$('.remove-selected-order').click(function () {
                if (self.pos.config.validate_remove_order) {
                    return self.pos._validate_by_manager('this.pos.delete_current_order()', 'Delete Selected Order')
                }
                var order = self.pos.get_order();
                if (!order) {
                    return;
                } else if (!order.is_empty()) {
                    self.gui.show_popup('confirm', {
                        'title': _t('Destroy Current Order ?'),
                        'body': _t('You will lose any data associated with the current order'),
                        confirm: function () {
                            self.pos.delete_current_order();
                        },
                    });
                } else {
                    self.pos.delete_current_order();
                }
            });
            this.$('.add-new-order').click(function () {
                if (self.pos.config.validate_new_order) {
                    return self.pos._validate_by_manager('this.pos.add_new_order()', 'Add new Order')
                }
                self.pos.add_new_order();
            });
            this.$('.checkout').click(function () {
                self.pos.gui.screen_instances['products'].actionpad.$el.find('.pay').click();
            });
            this.$('.checkout-full').click(function () {
                if (!self.pos.display_cart_list) {
                    self.$('.total_items_in_bottom_cart').click()
                }
                self.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Please select one payment method at Order Cart'),
                    color: 'success'
                })
                self.pos.gui.screen_instances['products'].actionpad.$el.find('.quickly_paid').click();
            });
            this.$('.customer-name').click(function () {
                self.pos.show_popup_clients('products');
            });
        },
    });

    var OrderSelectedLineDetail = PosBaseWidget.extend({
        template: 'OrderSelectedLineDetail',
        init: function (parent, options) {
            var self = this;
            if (options.selected_line) {
                this.selected_line = options.selected_line
            }
            this._super(parent, options);
            this.pos.hide_selected_line_detail = true;
            this.pos.bind('selected:line', function (selected_line) {
                self.selected_line = selected_line;
                if (self.pos.display_cart_list) {
                    self.renderElement()
                }
            });
            this.pos.bind('hide:orderline-detail', function () {
                self.hide_orderline_detail()
            });
        },
        renderElement: function () {
            var selected_line = this.selected_line;
            var order = this.pos.get_order();
            if (!selected_line || !order || this.pos.hide_selected_line_detail) {
                return false;
            }
            var self = this;
            this.order = order;
            this.client = order.get_client();
            var qty_available = this.pos.db.stock_datas[this.selected_line.product['id']];
            selected_line.qty_available = qty_available;
            this.selected_line = selected_line;
            $('.product-list-scroller').css({width: '50%'});
            this.pos.gui.screen_instances['products'].$el.find('.placeholder-SelectedLineDetail').html(qweb.render('OrderSelectedLineDetail', {
                widget: this,
                order: order
            }));
            this.pos.gui.screen_instances['products'].$el.find('.close').click(function () {
                return self.hide_orderline_detail();
            });
            // todo: replace numpad widget to this template
            this.numpad = this.pos.gui.screen_instances['products']['numpad'];
            this.numpad.appendTo($('.placeholder-NumpadWidgetWidget'));
            $('.mode').click(function (event) {
                var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
                self.numpad.state.changeMode(newMode)
            });
            this._super();
        },
        hide_orderline_detail: function () {
            this.pos.hide_selected_line_detail = true;
            $('.selected-line-detail').addClass('oe_hidden');
            $('.product-list-scroller').css({width: '100%'});
            this.numpad = this.pos.gui.screen_instances['products']['numpad'];
            this.numpad.appendTo($('.placeholder-NumpadWidgetBackUp'));
        }
    });

    var ProductSortBy = PosBaseWidget.extend({
        template: 'ProductSortBy',
        init: function (parent, options) {
            this._super(parent, options);
        },
        start: function () {
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.service').click(_.bind(this.clickAppendNewChar, this));
        },
        clickDeleteLastChar: function () {
            $('.category-simple-button').removeClass('selected-mode');
            $('.product-sort-by').replaceWith();
            this.pos.config.default_product_sort_by = 'all';
            this.pos.trigger('update:categories');
        },
        clickAppendNewChar: function (event) {
            var sort_by_key = event.currentTarget.getAttribute('id');
            this.pos.config.default_product_sort_by = sort_by_key;
            this.pos.trigger('update:categories');
            $('.category-simple-button').removeClass('selected-mode');
            $('span[class="category-simple-button js-category-switch service"][id=' + sort_by_key + ']').addClass('selected-mode');
        },
    });

    screens.ProductCategoriesWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            var search_timeout = null;
            this.search_handler = function (event) {
                if (event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8) {
                    clearTimeout(search_timeout);
                    var searchbox = this;
                    search_timeout = setTimeout(function () {
                        self.perform_search(self.category, searchbox.value, event.which === 13);
                    }, 200);
                }
                if (event.type == 'keydown' && event.keyCode == 27) {
                    self.clear_search();
                }
            };
            this.search_partners_handler = function (event) {
                if (event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8) {
                    clearTimeout(search_timeout);
                    var searchbox = this;
                    search_timeout = setTimeout(function () {
                        self.perform_search_partners(searchbox.value, event.which === 13);
                    }, 200);
                }
                if (event.type == 'keydown' && event.keyCode == 27) {
                    self.clear_search();
                }
            };
        },
        perform_search_partners: function (query) {
            var self = this;
            var partners = this.pos.db.search_partner(query);
            var $find_customer_box = $('.find_customer >input');
            if ($find_customer_box.length && partners.length) {
                var sources = this.pos.db._parse_partners_for_autocomplete(partners);
                $find_customer_box.autocomplete({
                    source: sources,
                    minLength: this.pos.config.min_length_search,
                    select: function (event, ui) {
                        $('.find_customer input').blur();
                        if (ui && ui['item'] && ui['item']['value']) {
                            var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                            if (partner) {
                                self.gui.screen_instances["clientlist"]['new_client'] = partner;
                                setTimeout(function () {
                                    var input = $('.find_customer input');
                                    input.val("");
                                    self.pos.trigger('client:save_changes');
                                }, 200);
                            }
                        }
                    }
                });
            }
        },
        perform_search: function (category, query, buy_result) {
            var self = this;
            this._super(category, query, buy_result);
            var products = [];
            if (query) {
                products = this.pos.db.search_product_in_category(category.id, query);
            } else {
                products = this.pos.db.get_product_by_category(this.category.id);
            }
            if (products.length) {
                var source = this.pos.db._parse_products_for_autocomplete(products);
                $('.search-products >input').autocomplete({
                    source: source,
                    minLength: 3,
                    select: function (event, ui) {
                        if (ui && ui['item'] && ui['item']['value']) {
                            var product = self.pos.db.get_product_by_id(ui['item']['value']);
                            if (product) {
                                self.pos.get_order().add_product(product);
                                $('.search-products').blur();
                            }
                            setTimeout(function () {
                                self.clear_search();
                            }, 200);
                        }

                    }
                });
            }
            if (this.pos.config.save_search_histories && this.pos.db.search_products_histories.length) {
                $('.search-products >input').autocomplete({
                    source: this.pos.db.search_products_histories,
                    minLength: 0,
                    select: function (event, ui) {
                        if (ui && ui['item'] && ui['item']['value']) {
                            var product = self.pos.db.get_product_by_id(ui['item']['value_id']);
                            if (product) {
                                self.pos.get_order().add_product(product);
                                $('.search-products').blur();
                            }
                        }

                    }
                });
            }
        },
        renderElement: function () {
            var self = this;
            this._super();
            if (this.el.querySelector('.find_customer input')) {
                this.el.querySelector('.find_customer input').addEventListener('keypress', this.search_partners_handler);
                this.el.querySelector('.find_customer input').addEventListener('keydown', this.search_partners_handler);
            }
            if (this.el.querySelector('.add-new-client')) {
                this.el.querySelector('.add-new-client').addEventListener('click', function () {
                    self.pos.gui.show_popup('popup_create_customer', {
                        title: _t('Add Customer')
                    })
                });
            }
            if (this.el.querySelector('.open-clientlist')) {
                this.el.querySelector('.open-clientlist').addEventListener('click', function () {
                    self.pos.gui.show_screen('clientlist');
                });
            }
            if (this.el.querySelector('.new-product-categ')) {
                this.el.querySelector('.new-product-categ').addEventListener('click', function () {
                    self.pos.gui.show_popup('popup_create_pos_category', {
                        title: _t('New Category')
                    })
                });
            }
            if (this.el.querySelector('.new-product')) {
                this.el.querySelector('.new-product').addEventListener('click', function () {
                    self.pos.gui.show_popup('popup_create_product', {
                        title: _t('New Product'),
                    })
                });
            }
            if (this.el.querySelector('.products-sort-by')) {
                this.el.querySelector('.products-sort-by').addEventListener('click', function () {
                    $('.product_sort_by').empty();
                    $('.product_sort_by').removeClass('oe_hidden');
                    self.ProductSortBy = new ProductSortBy(self, {
                        widget: self
                    });
                    self.ProductSortBy.appendTo($('.product_sort_by')[0]);
                });
            }
            if (this.el.querySelector('.change_view_type')) {
                this.el.querySelector('.change_view_type').addEventListener('click', function () {
                    if (self.pos.config.product_view == 'box') {
                        self.pos.config.product_view = 'list'
                    } else {
                        self.pos.config.product_view = 'box'
                    }
                    $('.header-category').replaceWith();
                    self.pos.gui.screen_instances['products'].rerender_products_screen(self.pos.config.product_view);
                });
            }
            if (this.el.querySelector('.zoom_in')) {
                this.el.querySelector('.zoom_in').addEventListener('click', function () {
                    $('.product').animate({height: '16.5em', width: '14em'}, 'slow');
                    $('.product-img-big').animate({height: '0px'}, 'slow');
                    $('.product-img').animate({height: '0px'}, 'slow');
                });
            }
            if (this.el.querySelector('.zoom_out')) {
                this.el.querySelector('.zoom_out').addEventListener('click', function () {
                    $('.product-list-container').animate({opacity: 0,}, 200, 'swing', function () {
                        self.pos.gui.screen_instances['products'].rerender_products_screen(self.pos.config.product_view);
                    });
                });
            }
        },
        clear_search: function () {
            this._super();
            var el_search_product = this.el.querySelector('.search-products input');
            var el_search_partner = this.el.querySelector('.find_customer input');
            if (el_search_product) {
                el_search_product.value = '';
                el_search_product.blur();
            }
            if (el_search_partner) {
                el_search_partner.value = '';
                el_search_partner.blur();
            }
            if (!this.search_gudie) {
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Enter on Your Keyboard with key (S) for quickly lookup Products, and Enter (ESC) for quickly leave Search Box'),
                    color: 'success'
                })
            }
            this.search_gudie = true;
        },
    });

    screens.ProductScreenWidget.include({
        init: function () {
            var self = this;
            this._super.apply(this, arguments);
            this.buffered_keyboard = [];
            this.pos.bind('reload:product-categories-screen', function () {
                self.rerender_products_screen(self.pos.config.product_view);
            }, self);
            this.pos.hide_pads = false;
        },
        start: function () {
            var self = this;
            this._super();
            this.$('.pad').click(function () {
                self.pos.hide_pads = !self.pos.hide_pads;
                self.pos.trigger('reload.ActionPad');
            });
            this.decimal_point = _t.database.parameters.decimal_point;
            this.widget = {};
            this.widgets = this.pos.gui.chrome.widgets;
            this.view_cartlist_widget = new ViewCartListWidget(this, {});
            this.view_cartlist_widget.replace(this.$('.placeholder-ViewCartListWidget'));
            this.orderline_selected_widget = new OrderLineSelected(this, {});
            this.orderline_selected_widget.replace(this.$('.placeholder-OrderLineSelected'));
            this.$el.find('.placeholder-screens').html(qweb.render('RightPaneScreen', {
                widget: this
            }));
            // this.load_right_screens(this.widgets);
            for (var button in this.action_buttons) {
                var super_button = this.action_buttons[button];
                if (button == 'set_pricelist') {
                    super_button.button_click = function () {
                        if (!self.pos.config.allow_cashier_select_pricelist) {
                            return self.pos.gui.show_popup('dialog', {
                                title: 'Warning',
                                body: 'Your pos config have not allow you manual choose pricelist, contact your admin and check to checkbox: Go to POS config / Tab [Order and Booking] Allow cashiers select pricelist',
                            })
                        } else {
                            var pricelists = _.map(self.pos.pricelists, function (pricelist) {
                                return {
                                    label: pricelist.name,
                                    item: pricelist
                                };
                            });
                            self.pos.gui.show_popup('selection', {
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
                    }
                }
            }
            this.loading_buttons();
            if (this.pos.config.product_view == 'box') {
                self.pos.set('set_product_view', {state: 'connected', pending: 0});
            } else {
                self.pos.set('set_product_view', {state: 'connecting', pending: 0});
            }
        },
        show: function (reset) {
            $(document).off('keydown.productscreen', this._onKeypadKeyDown);
            this._super(reset);
        },
        reset_keyboard_event: function () {
            $(document).off('keydown.productscreen', this._onKeypadKeyDown);
            $(document).on('keydown.productscreen', this._onKeypadKeyDown);
        },
        _handleBufferedKeys: function () {
            this.last_buffered_key_events = this.buffered_key_events;
            this._super();
            if (this.last_buffered_key_events.length > 2) {
                this.last_buffered_key_events = [];
                return true; // todo: return because barcode scanner will many items in array
            } else {
                var ev = this.last_buffered_key_events[0];
                this.keyboard_handler(ev)
                this.last_buffered_key_events = [];
            }
        },
        keyboard_handler: function (event) {
            var self = this;
            console.log('keyboard_handler: ' + event.keyCode);
            var current_screen = this.pos.gui.get_current_screen();
            if (current_screen != 'products' || self.gui.has_popup()) {
                return true;
            }
            var key = '';
            if (event.keyCode === 8) { // Backspace
                key = 'BACKSPACE';
            } else if (event.keyCode == 9) { // key: Tab
                this.pos.trigger('open:promotions');
            } else if (event.keyCode == 13) { // key: Enter
                this.$('.pay').click();
            } else if (event.keyCode === 27) { // Key: ESC
                key = 'ESC';
            } else if (event.keyCode === 32) { // key: space
                this.pos.gui.show_screen('clientlist');
            } else if (event.keyCode === 38 || event.keyCode === 40) { //Key: Up and Down
                self.order_widget.change_line_selected(event.keyCode);
            } else if (event.keyCode === 45) { //Key: Ins (Insert)
                this.$('.new-product').click();
            } else if (event.keyCode == 66) { // key: B
                this.pos.trigger('open:book-orders');
            } else if (event.keyCode === 37) { // arrow left
                if (this.pos.get('orders').models.length == 0 || !this.pos.get_order()) {
                    return
                }
                var sequence = this.pos.get_order().sequence_number;
                var i = sequence - 1;
                while (i <= sequence) {
                    var last_order = _.find(this.pos.get('orders').models, function (o) {
                        return o.sequence_number == i
                    })
                    if (last_order) {
                        this.pos.set('selectedOrder', last_order);
                        break
                    }
                    if (i <= 0) {
                        i = this.pos.pos_session.sequence_number + 1
                        sequence = this.pos.pos_session.sequence_number + 2;
                        continue
                    }
                    i = i - 1;
                }

            } else if (event.keyCode === 39) { // arrow right
                if (this.pos.get('orders').models.length == 0 || !this.pos.get_order()) {
                    return
                }
                var sequence = this.pos.get_order().sequence_number;
                var i = sequence + 1;
                while (i >= sequence) {
                    var last_order = _.find(this.pos.get('orders').models, function (o) {
                        return o.sequence_number == i
                    })
                    if (last_order) {
                        this.pos.set('selectedOrder', last_order);
                        break
                    }
                    if (i > this.pos.pos_session.sequence_number) {
                        i = 0;
                        sequence = 0;
                        continue
                    }
                    i = i + 1;
                }

            } else if (event.keyCode === 190 || // Dot
                event.keyCode === 188 ||  // Comma
                event.keyCode === 46) {  // Numpad dot
                key = this.decimal_point;
            } else if (event.keyCode === 46) { // key: del
                key = 'REMOVE';
            } else if (event.keyCode >= 48 && event.keyCode <= 57) { // Numbers
                // todo: key = '' + (event.keyCode - 48);
                // todo: Odoo core doing it, not need call event
                return true;
            } else if (event.keyCode === 65 && this.pos.config.add_client) {  // TODO key: a
                this.$('.add-new-client').click();
            } else if (event.keyCode === 67 && this.pos.config.allow_customer) { // TODO key: c
                this.$('.set-customer').click()
            } else if (event.keyCode === 68 && this.pos.config.allow_discount) { // TODO key: d
                this.order_widget.numpad_state.changeMode('discount');
                this.pos.trigger('change:mode');
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Change Discount active, please enter your Keyboard 0 to 9 for set new Discount'),
                    color: 'success'
                })
            } else if (event.keyCode === 69 && this.pos.get_order().get_selected_orderline()) { // TODO key: e
                this.pos.hide_selected_line_detail = false;
                this.pos.trigger('selected:line', this.pos.get_order().get_selected_orderline());
            } else if (event.keyCode === 70 && this.pos.config.quickly_payment_full) { // TODO key: f
                this.$('.quickly_paid').click();
            } else if (event.keyCode == 71) { // TODO key g
                this.$('.show_tickets').click();
            } else if (event.keyCode === 72) { // TODO key: h
                this.$('.category_home').click();
            } else if (event.keyCode === 73 && this.pos.config.management_invoice) { // TODO key: i
                this.pos.gui.show_screen('invoices');
            } else if (event.keyCode === 74 && this.pos.tables_by_id) { // TODO key: j
                if (self.pos.gui.screen_instances['floors']) {
                    this.pos.set_table(null);
                    this.pos.gui.show_screen('floors');
                }
            } else if (event.keyCode === 75) { // TODO key: k (lookup partners)
                this.$('.find_partner_input').focus();
            } else if (event.keyCode === 76) { // TODO key: l
                if (this.gui.chrome.widget['lock_session_widget']) {
                    this.gui.chrome.widget['lock_session_widget'].el.click();
                }
            } else if (event.keyCode === 77) { // TODO key: m
                $('.cart-detail').click()
            } else if (event.keyCode === 78 && this.pos.config.allow_add_order) { // TODO key: n
                this.$('.add-new-order').click();
            } else if (event.keyCode === 79 && this.pos.config.pos_orders_management) { // TODO key: o
                this.pos.gui.show_screen('PosOrderScreen');
            } else if (event.keyCode === 80 && this.pos.config.allow_price) { // TODO key: p
                this.order_widget.numpad_state.changeMode('price');
                this.pos.trigger('change:mode');
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Change Price active, please enter your Keyboard 0 to 9 for set new Price'),
                    color: 'success'
                })
            } else if (event.keyCode === 81 && this.pos.config.allow_qty) { // TODO key q
                this.order_widget.numpad_state.changeMode('quantity');
                this.pos.trigger('change:mode');
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Change Quantity active, please enter your Keyboard 0 to 9 for set new Quantity'),
                    color: 'success'
                })
            } else if (event.keyCode === 82 && this.pos.config.allow_remove_order) { // TODO key: r
                this.$('.remove-selected-order').click();
            } else if (event.keyCode === 83) { // TODO key:  s (lookup products)
                this.$('.search-products').focus();
            } else if (event.keyCode === 84 && this.pos.tags) { // TODO key:  t
                this.order_widget.set_tags()
            } else if (event.keyCode === 85 && this.pos.config.note_orderline) { // TODO key:  u
                this.order_widget.set_note();
            } else if (event.keyCode === 86) { // TODO key:  v (kimanh)

            } else if (event.keyCode === 87 && this.pos.config.product_operation) { // TODO key:  w
                this.pos.gui.show_popup('popup_create_pos_category', {
                    title: _t('New Category')
                })
            } else if (event.keyCode === 88) { // TODO key:  x
                self.pos.trigger('hide:orderline-detail');
            } else if (event.keyCode === 89) { // TODO key:  y
                self.pos.trigger('open:discounts');
            } else if (event.keyCode === 90 && this.pos.config.product_operation) { // TODO key: z
                this.pos.gui.show_popup('popup_create_product', {
                    title: _t('New Product'),
                })
            } else if (event.keyCode == 112) { // TODO key: F1
                $('.keyboard').animate({opacity: 1,}, 200, 'swing', function () {
                    $('.keyboard').removeClass('oe_hidden');
                });
            } else if (event.keyCode == 113) { // TODO F2
                this.pos.trigger('print:last_receipt');
            } else if (event.keyCode == 114) { // TODO F3
                var order = this.pos.get_order();
                if (order) {
                    return self.gui.show_popup('textarea', {
                        title: _t('Note for Order'),
                        value: order.get_note(),
                        confirm: function (note) {
                            order.set_note(note);
                            order.trigger('change', order);
                            return self.pos.gui.show_popup('dialog', {
                                title: _t('Succeed'),
                                body: _t('You set note to order: ' + note),
                                color: 'success'
                            })
                        },
                    });
                }
            } else if (event.keyCode == 115) { // TODO F4
                this.pos.show_purchased_histories();
            } else if (event.keyCode == 116) { // TODO F5
                this.pos.reload_pos();
            } else if (event.keyCode == 117) { // TODO F6
                this.pos.trigger('open:cash-control');
            } else if (event.keyCode == 118) { // TODO F7
                this.pos.trigger('open:pricelist');
            } else if (event.keyCode == 119) { // TODO F8
                this.pos.trigger('print:bill');
            } else if (event.keyCode == 120) { // TODO F9
                this.pos.trigger('open:report');
            } else if (event.keyCode == 121) { // TODO F10
                $('.service-charge').click()
            } else if (event.keyCode === 187) { // TODO +
                key = '+';
            } else if (event.keyCode === 189) { // TODO -
                key = '-';
            } else if (event.keyCode === 192) { // key: ~ open pricelist
                self.pos.gui.screen_instances['products'].actionpad.$el.find('.select-pricelist').click();
            } else if (event.keyCode === 191) { // key: / close session
                this.pos.gui.chrome.widget['close_button'].el.click();
            }
            if (key) {
                this.press_keyboard(key);
            }
        },
        press_keyboard: function (input) {
            var self = this;
            if ((input == "CLEAR" || input == "BACKSPACE") && this.inputbuffer == "") {
                var order = this.pos.get_order();
                if (order.get_selected_orderline()) {
                    var mode = this.order_widget.numpad_state.get('mode');
                    if (mode === 'quantity') {
                        this.inputbuffer = order.get_selected_orderline()['quantity'].toString();
                    } else if (mode === 'discount') {
                        this.inputbuffer = order.get_selected_orderline()['discount'].toString();
                    } else if (mode === 'price') {
                        this.inputbuffer = order.get_selected_orderline()['price'].toString();
                    }
                }
            }
            if (input == "REMOVE") {
                var order = this.pos.get_order();
                if (order.get_selected_orderline()) {
                    self.order_widget.set_value('remove');
                }
            }
            if (input == "ESC") { // Clear Search
                var input = $('input'); // find all input elements and clear
                input.val("");
                var product_categories_widget = this.product_categories_widget;
                product_categories_widget.clear_search();
            }
            if (this.pos.gui.has_popup()) {
                return;
            }
            if (input == '-' || input == '+') {
                if (input == '-') {
                    var newbuf = parseFloat(this.order_widget.inputbuffer) - 1;
                } else {
                    var newbuf = parseFloat(this.order_widget.inputbuffer) + 1;
                }
                if (newbuf >= 0) {
                    this.order_widget.set_value(newbuf)
                }
            }
        },
        set_idle_timer(deactive, timeout) { // TODO: only restaurant. we not allow auto back floor screen
            return null;
        },
        click_product: function (product) {
            if (this.pos.update_stock_active) {
                return this.pos.update_onhand_by_product(product)
            }
            if (this.pos.config.allow_select_variant) {
                var total_variants = this.pos.get_count_variant(product.product_tmpl_id)
                if (total_variants.length > 1) {
                    return this.pos.get_order().popup_add_products_to_cart(product)
                }
            }
            var $p = $('article[data-product-id="' + product.id + '"]');
            this._super.apply(this, arguments);
            // todo: first time add item to cart, auto show cart list
            var selected_order = this.pos.get_order();
            if (selected_order && selected_order.orderlines.length == 1 && !this.pos.display_cart_list) {
                this.pos.trigger('click.cart-detail');
            }
            // if (!this.pos.gui.has_popup()) {
            //     $($p).animate({
            //         'opacity': 0.5,
            //     }, 300, function () {
            //         $($p).animate({
            //             'opacity': 1,
            //         }, 300);
            //     });
            //     var imgtodrag = $p.children('div').find("img").eq(0);
            //     if (this.pos.config.product_view == 'list') {
            //         $p = $('tr[data-product-id="' + product.id + '"]');
            //         imgtodrag = $p.children('td').find("img")
            //     }
            //     var cart_list = $('.checkout');
            //     if (imgtodrag && imgtodrag.length && cart_list && cart_list.length == 1) {
            //         var imgclone = imgtodrag.clone()
            //             .offset({
            //                 top: imgtodrag.offset().top,
            //                 left: imgtodrag.offset().left
            //             })
            //             .css({
            //                 'opacity': '1',
            //                 'position': 'absolute',
            //                 'height': '50px',
            //                 'width': '150px',
            //                 'z-index': '100'
            //             })
            //             .appendTo($('body'))
            //             .animate({
            //                 'top': cart_list.offset().top,
            //                 'left': cart_list.offset().left,
            //                 'width': 75,
            //                 'height': 50
            //             }, 1000, 'easeInOutExpo');
            //
            //         setTimeout(function () {
            //             cart_list.effect("shake", {
            //                 times: 2
            //             }, 200);
            //         }, 1000);
            //
            //         imgclone.animate({
            //             'width': 0,
            //             'height': 0
            //         }, function () {
            //             $(this).detach()
            //         });
            //     }
            // }
        },
        load_right_screens: function (widgets) {
            for (var i = 0; i < widgets.length; i++) {
                var widget = widgets[i];
                if (!widget.condition || widget.condition.call(this)) {
                    var args = typeof widget.args === 'function' ? widget.args(this) : widget.args;
                    var w = new widget.widget(this, args || {});
                    if (widget.append == '.pos-screens-list') {
                        w.appendTo(this.$(widget.append));
                    }
                }
            }
        },
        loading_buttons: function () {
            // this.apps = [];
            for (var key in this.action_buttons) {
                var button = this.action_buttons[key];
                // this.apps.push(button);
                button.appendTo($('.shortcut_screens'));
            }
            // launchpad.setData(this.apps);
            // launchpad.toggle();
            // launchpad.toggle();
        },
        starting_sidebar: function () {
            // this.$el.find('.placeholder-SideBar').html(qweb.render('SideBar', {
            //     widget: this
            // }));
        },
        // This function will eat more RAM memory
        // Pleas take care when call it
        rerender_products_screen: function (product_view) { // function work without mobile app
            console.warn('Starting rerender_products_screen()');
            var self = this;
            this.pos.config.product_view = product_view;
            this.product_list_widget = new screens.ProductListWidget(this, {
                click_product_action: function (product) {
                    self.click_product(product);
                },
                product_list: self.pos.db.get_products(1000)
            });
            this.product_list_widget.replace($('.product-list-container')); // could not use: this.$('.product-list-container') because product operation update stock, could not refresh qty on hand
            this.product_categories_widget = new screens.ProductCategoriesWidget(this, {
                product_list_widget: self.product_list_widget,
            });
            this.$('.header-category').replaceWith();
            this.$('.category-list-scroller').remove();
            this.$('.categories').remove();
            this.product_categories_widget.replace($('.rightpane-header'));  // could not use: this.$('.rightpane-header') because product operation update stock, could not refresh qty on hand
        },
    });

    screens.ProductListWidget.include({
        set_product_list: function (product_list, search_word) {
            if (this.pos.config.allow_select_variant) {
                this.product_by_product_tmpl_id = {}
                for (var i = 0; i < product_list.length; i++) {
                    var product = product_list[i];
                    this.product_by_product_tmpl_id[product.product_tmpl_id] = product
                }
                var new_product_list = []
                for (var index_number in this.product_by_product_tmpl_id) {
                    new_product_list.push(this.product_by_product_tmpl_id[index_number])
                }
                product_list = new_product_list;
            }
            if (this.pos.config.limited_products_display > 0) {
                product_list = product_list.slice(0, this.pos.config.limited_products_display);
            }
            this._super(product_list, search_word);
            console.log('{Product.js} set_product_list, products length: ' + product_list.length)
            this.pos.auto_update_stock_products(product_list);
        },
        get_product_image_url: function (product) {
            if (this.pos.config.hide_product_image) {
                return null
            } else {
                return this._super(product);
            }
        },
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('update:categories', function () {
                self.renderElement();
            }, this);
            //TODO: bind action only for v10
            //TODO: we are only change price of items display, not loop and change all, lost many memory RAM
            this.pos.bind('product:change_price_list', function (products) {
                try {
                    var $products_element = $('.product .product-img .price-tag');
                    for (var i = 0; i < $products_element.length; i++) {
                        var element = $products_element[i];
                        var product_id = parseInt(element.parentElement.parentElement.dataset.productId);
                        var product = self.pos.db.product_by_id(product_id);
                        if (product) {
                            var product = products[i];
                            var $product_el = $("[data-product-id='" + product['id'] + "'] .price-tag");
                            $product_el.html(self.format_currency(product['price']) + '/' + product['uom_id'][1]);
                        }
                    }
                } catch (e) {
                }
            });

        },
        // we remove Odoo original method
        // because when price list sync to pos, attribute items of pricelist no change
        _get_active_pricelist: function () {
            var current_order = this.pos.get_order();
            var default_pricelist = this.pos.default_pricelist;
            if (current_order && current_order.pricelist) {
                var pricelist = _.find(this.pos.pricelists, function (pricelist_check) {
                    return pricelist_check['id'] == current_order.pricelist['id']
                });
                return pricelist;
            } else {
                if (default_pricelist) {
                    var pricelist = _.find(this.pos.pricelists, function (pricelist_check) {
                        return pricelist_check['id'] == default_pricelist['id']
                    });
                    return pricelist
                } else {
                    return null
                }
            }
        },
        render_product: function (product) {
            var pricelist = this.pos._get_active_pricelist();
            var cache_key = this.calculate_cache_key(product, pricelist);
            var cached = this.product_cache.get_node(cache_key);
            if (!cached) {
                var product_html = qweb.render('Product', {
                    widget: this,
                    product: product,
                    pricelist: pricelist,
                    image_url: this.get_product_image_url(product),
                });
                if (this.pos.config.product_view == 'box') {
                    var product_node = document.createElement('div');
                } else {
                    var product_node = document.createElement('tbody');
                }
                product_node.innerHTML = product_html;
                product_node = product_node.childNodes[1];
                this.product_cache.cache_node(cache_key, product_node);
                return product_node;
            }
            return cached;
        },
        _get_content_of_product: function (product) {
            var content = '';
            if (product.pos_categ_id) {
                content += 'Category: ' + product.pos_categ_id[1] + ', ';
            }
            if (product.default_code) {
                content += 'Ref: ' + product.default_code + ', ';
            }
            if (product.barcode) {
                content += 'Barcode: ' + product.barcode + ', ';
            }
            if (product.qty_available != null) {
                content += 'Stock Available: ' + product.qty_available + ', ';
            }
            if (product.standard_price) {
                content += 'Cost Price: ' + this.gui.chrome.format_currency(product.standard_price) + ', ';
            }
            if (product.description) {
                content += 'Description: ' + product.description + ', ';
            }
            if (product.description_picking) {
                content += 'Description Picking: ' + product.description_picking + ', ';
            }
            if (product.description_sale) {
                content += 'Description Sale: ' + product.description_sale + ', ';
            }
            if (product.uom_id) {
                content += 'Sale Unit: ' + product.uom_id[1] + ', ';
            }
            if (product.uom_po_id) {
                content += 'Purchase Unit: ' + product.uom_po_id[1] + ', ';
            }
            if (product.weight) {
                content += 'Weight: ' + product.weight + ', ';
            }
            return content;
        },
        sort_products_view: function () {
            var self = this;
            $('.sort_by_product_default_code').click(function () {
                self.product_list = self.product_list.sort(self.pos.sort_by('default_code', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.renderElement(true);
                self.reverse = !self.reverse;
            });
            $('.sort_by_product_name').click(function () {
                self.product_list = self.product_list.sort(self.pos.sort_by('display_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.renderElement(true);
                self.reverse = !self.reverse;
            });
            $('.sort_by_product_list_price').click(function () {
                self.product_list = self.product_list.sort(self.pos.sort_by('lst_price', self.reverse, parseInt));
                self.renderElement(true);
                self.reverse = !self.reverse;
            });
            $('.sort_by_product_standard_price').click(function () {
                self.product_list = self.product_list.sort(self.pos.sort_by('standard_price', self.reverse, parseInt));
                self.renderElement(true);
                self.reverse = !self.reverse;
            });
            $('.sort_by_product_qty_available').click(function () {
                self.product_list = self.product_list.sort(self.pos.sort_by('qty_available', self.reverse, parseInt));
                self.renderElement(true);
                self.reverse = !self.reverse;
            });
        },
        renderElement: function (sort) {
            var self = this;
            var current_product_list = this.product_list;
            if (!sort) {
                if (this.pos.config.default_product_sort_by == 'a_z') {
                    this.product_list = this.product_list.sort(this.pos.sort_by('display_name', false, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                } else if (this.pos.config.default_product_sort_by == 'z_a') {
                    this.product_list = this.product_list.sort(this.pos.sort_by('display_name', true, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                } else if (this.pos.config.default_product_sort_by == 'low_price') {
                    this.product_list = this.product_list.sort(this.pos.sort_by('lst_price', false, parseInt));
                } else if (this.pos.config.default_product_sort_by == 'high_price') {
                    this.product_list = this.product_list.sort(this.pos.sort_by('lst_price', true, parseInt));
                } else if (this.pos.config.default_product_sort_by == 'pos_sequence') {
                    this.product_list = this.product_list.sort(this.pos.sort_by('pos_sequence', true, parseInt));
                } else if (this.pos.config.default_product_sort_by == 'low_stock') {
                    this.product_list = this.product_list.sort(this.pos.sort_by('qty_available', false, parseInt));
                } else if (this.pos.config.default_product_sort_by == 'high_stock') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.type == 'product';
                    });
                    this.product_list = this.product_list.sort(this.pos.sort_by('qty_available', true, parseInt));
                } else if (this.pos.config.default_product_sort_by == 'voucher') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.is_voucher;
                    });
                } else if (this.pos.config.default_product_sort_by == 'credit') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.is_credit;
                    });
                } else if (this.pos.config.default_product_sort_by == 'cross_selling') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.cross_selling;
                    });
                } else if (this.pos.config.default_product_sort_by == 'service') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.type == 'service';
                    });
                } else if (this.pos.config.default_product_sort_by == 'lot') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.tracking == 'lot';
                    });
                } else if (this.pos.config.default_product_sort_by == 'serial') {
                    this.product_list = _.filter(this.product_list, function (p) {
                        return p.tracking == 'serial';
                    });
                } else if (this.pos.config.default_product_sort_by == 'all') {
                    this.pos.config.default_product_sort_by = 'a_z';
                    this.product_list = current_product_list
                }
            }
            setTimeout(function () { // TODO: return back product list
                self.product_list = current_product_list;
            }, 200)
            if (this.pos.config.product_view == 'box') {
                this._super();
            } else {
                this.$('.product-list-contents').replaceWith();
                var el_str = qweb.render(this.template, {widget: this});
                var el_node = document.createElement('div');
                el_node.innerHTML = el_str;
                el_node = el_node.childNodes[1];

                if (this.el && this.el.parentNode) {
                    this.el.parentNode.replaceChild(el_node, this.el);
                }
                this.el = el_node;
                var list_container = el_node.querySelector('.product-list-contents');
                if (list_container) {
                    for (var i = 0, len = this.product_list.length; i < len; i++) {
                        var product_node = this.render_product(this.product_list[i]);
                        product_node.addEventListener('click', this.click_product_handler);
                        list_container.appendChild(product_node);
                    }
                }
            }
            this.sort_products_view();
            this._display_content_of_products();
        },
        _display_content_of_products: function () {
            var products = this.product_list;
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                var content = this._get_content_of_product(product);
                this.pos.gui.show_guide_without_chrome(
                    '.product[data-product-id="' + product.id + '"]',
                    'right center',
                    product.display_name + ' : ' + this.gui.chrome.format_currency(product.lst_price),
                    content
                );
            }
        },
        _get_default_pricelist: function () {
            var current_pricelist = this.pos.default_pricelist;
            return current_pricelist
        }
    });

    return {
        OrderSelectedLineDetail: OrderSelectedLineDetail,
        ViewCartListWidget: ViewCartListWidget,
        OrderLineSelected: OrderLineSelected
    }
});
