/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i'm not accepted
 */
odoo.define('pos_retail.model', function (require) {
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var core = require('web.core');
    var round_pr = utils.round_precision;
    var _t = core._t;
    var rpc = require('pos.rpc');
    var session = require('web.session');
    var time = require('web.time');
    var Session = require('web.Session');

    models.load_models([
        {
            label: 'Your Odoo Server IP/Port and All POS Boxes',
            model: 'pos.iot',
            condition: function (self) {
                if (self.config.posbox_save_orders && self.config.posbox_save_orders_iot_ids.length) {
                    return true
                } else {
                    return false;
                }
            },
            fields: [],
            domain: function (self) {
                return [['id', 'in', self.config.posbox_save_orders_iot_ids]]
            },
            loaded: function (self, iot_boxes) {
                self.iot_boxes_save_orders_by_id = {};
                self.iot_boxes_save_orders = [];
                for (var i = 0; i < iot_boxes.length; i++) {
                    var iot_box = iot_boxes[i];
                    var iot_url = 'http://' + iot_box.proxy + ':' + iot_box.port;
                    self.iot_boxes_save_orders_by_id[iot_box['id']] = iot_box;
                    var iot_connection = new Session(void 0, iot_url, {
                        use_cors: true
                    });
                    self.iot_boxes_save_orders.push(iot_connection);
                }
                self._bind_iot();
            }
        }
    ]);
    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _bind_iot: function () { // TODO: get notifications update from another sessions the same bus id
            // TODO: timeout 30 seconds, auto checking status of all pos boxes
            var self = this;
            for (var i = 0; i < this.iot_boxes_save_orders.length; i++) {
                var iot = this.iot_boxes_save_orders[i];
                iot.rpc('/pos/ping/server', {
                    ip: this.config.posbox_save_orders_server_ip,
                    port: this.config.posbox_save_orders_server_port
                }, {shadow: true, timeout: 650000}).then(function (result) {
                    var value = JSON.parse(result);
                    var response_ping_odoo_server = value.values;
                    if (!response_ping_odoo_server) {
                        self.set('synch', {state: 'disconnected', pending: 1});
                        self.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Odoo server down or network PosBox have problem, IoT could not ping to your Odoo with ip ' + self.config.posbox_save_orders_server_ip + ' and port:' + self.config.posbox_save_orders_server_port)
                        })
                    } else {
                        console.log('Ping Odoo server IP: http://' + self.config.posbox_save_orders_server_ip + ':8069 from IoT succeed')
                    }
                }).catch(function (error) {
                    self.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Your session could not connect to posbox, ip address of posbox is wrong or your network and posbox network not the same lan network')
                    })
                });
                iot.rpc('/pos/push/orders', {
                    database: this.session.db,
                }, {shadow: true, timeout: 65000}).then(function (result) {
                    console.log('Result of Call IoT Box push orders to Odoo Server: ' + result)
                    self.set('synch', {state: 'connected', pending: 1});
                }).catch(function (error) {
                    self.set('synch', {state: 'disconnected', pending: 1});
                    console.log(error)
                })
            }
            setTimeout(_.bind(this._bind_iot, this), 5000);
        },
        _flush_orders: function (orders, options) {
            // TODO: this is test case push 500 orders / current time
            var self = this;
            if (this.iot_boxes_save_orders) {
                if (orders.length) {
                    console.log('Send direct orders to posbox: ' + orders.length)
                    for (var i = 0; i < this.iot_boxes_save_orders.length; i++) {
                        this.iot_boxes_save_orders[i].rpc("/pos/save/orders", {
                            database: this.session.db,
                            orders: orders,
                            url: 'http://' + this.config.posbox_save_orders_server_ip + ':' + this.config.posbox_save_orders_server_port + '/pos/create_from_ui',
                            username: this.session.username,
                            server_version: this.session.server_version,

                        }, {shadow: true, timeout: 60000}).then(function (results) {
                            var order_ids = JSON.parse(results)['order_ids'];
                            for (var i = 0; i < order_ids.length; i++) {
                                self.db.remove_order(order_ids[i]);
                                self.set('failed', false);
                            }
                            return order_ids

                        }).catch(function (reason) {
                            console.error('Failed to send orders:', orders);
                            self.gui.show_sync_error_popup();
                            throw reason;
                        });
                    }
                }
                return Promise.resolve([]);
            } else {
                return _super_PosModel._flush_orders.apply(this, arguments)
            }
        },
        get_picking_source_location: function () {
            var stock_location_id = this.config.stock_location_id;
            var selected_order = this.get_order();
            if (selected_order && selected_order.location) {
                return selected_order.location;
            } else {
                return this.stock_location_by_id[stock_location_id[0]];
            }
        },
        get_all_source_locations: function () {
            if (this.stock_location_ids.length != 0) {
                return this.stock_location_ids.concat(this.config.stock_location_id[0])
            } else {
                return [this.config.stock_location_id[0]]
            }
        },
        generate_wrapped_name: function (name) {
            var MAX_LENGTH = 24; // 40 * line ratio of .6
            var wrapped = [];
            var current_line = "";

            while (name.length > 0) {
                var space_index = name.indexOf(" ");

                if (space_index === -1) {
                    space_index = name.length;
                }

                if (current_line.length + space_index > MAX_LENGTH) {
                    if (current_line.length) {
                        wrapped.push(current_line);
                    }
                    current_line = "";
                }

                current_line += name.slice(0, space_index + 1);
                name = name.slice(space_index + 1);
            }

            if (current_line.length) {
                wrapped.push(current_line);
            }

            return wrapped;
        },
        show_popup_clients: function (keep_screen) {
            var self = this;
            var quickly_search_client = this.config.quickly_search_client;
            if (quickly_search_client) {
                this.gui.show_screen(keep_screen);
                this.gui.show_popup('popup_selection_extend', {
                    title: _t('Find Customer'),
                    fields: ['name', 'email', 'phone', 'mobile', 'balance', 'wallet', 'pos_loyalty_point'],
                    header_button: '<button type="submit" style="color: black; background: none" class="btn btn-round btn-just-icon">\n' +
                        '                      <i class="material-icons">person_add</i>\n' +
                        '                    </button>',
                    header_button_action: function () {
                        return self.gui.show_popup('popup_create_customer', {
                            title: _t('Create new Customer')
                        })
                    },
                    sub_datas: this.db.get_partners_sorted(5),
                    sub_search_string: this.db.partner_search_string,
                    sub_record_by_id: this.db.partner_by_id,
                    sub_template: 'clients_list',
                    sub_button: '<div class="btn btn-success pull-right go_clients_screen">Go Clients Screen</div>',
                    sub_button_action: function () {
                        self.gui.show_screen('clientlist')
                    },
                    body: 'Please select one client',
                    confirm: function (client_id) {
                        var client = self.db.get_partner_by_id(client_id);
                        if (client) {
                            self.gui.screen_instances["clientlist"]['new_client'] = client;
                            self.trigger('client:save_changes');
                        }
                    }
                })
            } else {
                this.gui.show_screen('clientlist');
            }
        },
        update_onhand_by_product: function (product) {
            var self = this;
            this.product_need_update = product;
            var stock_location_ids = this.get_all_source_locations();
            return this._get_stock_on_hand_by_location_ids([product.id], stock_location_ids).then(function (datas) {
                var list = [];
                for (var location_id in datas) {
                    var location = self.stock_location_by_id[location_id];
                    if (location) {
                        list.push({
                            'id': location['id'],
                            'location': location['name'],
                            'qty_available': datas[location_id][self.product_need_update.id]
                        })
                    }
                }
                if (list.length <= 0) {
                    self.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Product type not Stockable Product')
                    })
                } else {
                    return self.gui.show_popup('popup_selection_extend', {
                        title: _t('Are you want update Stock on hand of : ') + self.product_need_update.name,
                        body: _t('All Quantity Available of Product: ') + self.product_need_update.name + _t('.If you want add more stock on hand, click to one line'),
                        fields: ['location', 'qty_available'],
                        sub_datas: list,
                        sub_template: 'stocks_list',
                        confirm: function (location_id) {
                            self.location_id = location_id;
                            var location = self.stock_location_by_id[location_id];
                            setTimeout(function () {
                                return self.gui.show_popup('number', {
                                    'title': _t('Update Product Quantity of ' + self.product_need_update.name + ' to Location ' + location.name),
                                    'value': 0,
                                    'confirm': function (new_quantity) {
                                        var new_quantity = parseFloat(new_quantity);
                                        return rpc.query({
                                            model: 'stock.location',
                                            method: 'pos_update_stock_on_hand_by_location_id',
                                            args: [location.id, {
                                                product_id: self.product_need_update.id,
                                                product_tmpl_id: self.product_need_update.product_tmpl_id,
                                                new_quantity: new_quantity,
                                                location_id: location.id
                                            }],
                                            context: {}
                                        }, {
                                            shadow: true,
                                            timeout: 60000
                                        }).then(function (values) {
                                            self._do_update_quantity_onhand([self.product_need_update.id]);
                                            return self.gui.show_popup('confirm', {
                                                title: values['product'],
                                                body: values['location'] + ' have new on hand: ' + values['quantity'],
                                                color: 'success'
                                            })
                                        }, function (err) {
                                            return self.query_backend_fail(err);
                                        })
                                    }
                                })
                            }, 500)
                        }
                    })
                }
            });
        },
        highlight_control_button: function (button_class) {
            $('.' + button_class).addClass('highlight')
        },
        remove_highlight_control_button: function (button_class) {
            $('.' + button_class).removeClass('highlight')
        },
        show_purchased_histories: function (client) {
            var self = this;
            if (!client) {
                client = this.get_client();
            }
            if (!client) {
                this.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'We could not find purchased orders histories, please set client first'
                });
                this.gui.show_screen('clientlist')
            } else {
                var orders = this.db.get_pos_orders().filter(function (order) {
                    return order.partner_id && order.partner_id[0] == client['id']
                });
                if (orders.length) {
                    return this.gui.show_popup('popup_selection_extend', {
                        title: _t('Purchased Histories of ') + client.name,
                        fields: ['name', 'ean13', 'date_order', 'pos_reference'],
                        sub_datas: orders,
                        sub_template: 'purchased_orders',
                        body: 'Please select one sale person',
                        confirm: function (order_id) {
                            var order = self.db.order_by_id[order_id];
                            self.gui.show_screen('PosOrderScreen')
                            self.gui.screen_instances['PosOrderScreen'].order_selected = order;
                            self.trigger('reload:countOrders');
                        }
                    })
                } else {
                    this.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your POS not active POS Order Management or Current Client have not any Purchased Orders'
                    })
                }
            }
        },
        _get_stock_on_hand_by_location_ids: function (product_ids = [], location_ids = []) {
            console.log('{Models.js} _get_stock_on_hand_by_location_ids')
            return rpc.query({
                model: 'stock.location',
                method: 'get_stock_data_by_location_ids',
                args: [[], product_ids, location_ids],
                context: {}
            }, {
                shadow: true,
                timeout: 65000
            });
        },
        _get_voucher_number: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                return rpc.query({
                    model: 'pos.config',
                    method: 'get_voucher_number',
                    args: [[], self.config.id],
                    context: {}
                }).then(function (number) {
                    resolve(number)
                }, function (err) {
                    reject(err)
                })
            })
        },
        show_products_with_field: function (field) {
            var products = this.db.get_product_by_category(0);
            var products_by_field = _.filter(products, function (product) {
                return product[field] == true;
            });
            if (products_by_field.length != 0) {
                this.gui.screen_instances.products.product_list_widget.set_product_list(products_by_field);
            }
        },
        show_products_type_only_product: function () {
            var products = this.db.get_product_by_category(0);
            var products_type_product = _.filter(products, function (product) {
                return product.type == 'product';
            });
            this.gui.screen_instances.products.product_list_widget.set_product_list(products_type_product);
        },
        auto_update_stock_products: function (product_list) {
            if (!product_list || product_list.length == 0) {
                return;
            }
            console.log('{Models.js} auto_update_stock_products')
            var picking_source = this.get_picking_source_location();
            this.trigger('stock.update');
            for (var i = 0; i < product_list.length; i++) {
                var product = product_list[i]
                var product_id = product.id;
                var $qty_available_product_element = $("article[data-product-id='" + product_id + "'] span[class='qty_available'] span[class='value']") || $("article[data-product-id='" + product_id + "'] span[class='qty_available'] span[class='value oe_hidden']");
                if ($qty_available_product_element.length) {
                    $qty_available_product_element.removeClass('oe_hidden');
                    $qty_available_product_element.html(picking_source.display_name + ' : ' + this.db.stock_datas[product_id]);
                    var qty_available = this.db.stock_datas[product_id] || 0;
                    if (qty_available > 0) {
                        $($qty_available_product_element).animate({
                            'opacity': 1.0,
                            'color': 'blue',
                        }, 300, function () {
                            $($qty_available_product_element).animate({
                                'color': 'blue',
                                'opacity': 1,
                            }, 300);
                        });
                    } else {
                        $($qty_available_product_element).animate({
                            'opacity': 1.0,
                            'color': 'red',
                        }, 300, function () {
                            $($qty_available_product_element).animate({
                                'color': 'red',
                                'opacity': 1,
                            }, 300);
                        });
                    }
                }
            }
            // todo: no need update realtime, because made users confuse when still change price, discount ...
            // var selected_order = this.get_order(); // automatic update stock on hand each line
            // if (selected_order && !selected_order.finalized) {
            //     var lines_to_recompute = _.filter(selected_order.get_orderlines(), function (line) {
            //         return !line.price_manually_set;
            //     });
            //     _.each(lines_to_recompute, function (line) {
            //         line.set_unit_price(line.product.get_price(selected_order.pricelist, line.get_quantity()));
            //         selected_order.fix_tax_included_price(line);
            //     });
            // }
        },
        update_stock_on_hand_products: function () {
            var self = this;
            var location_ids = [];
            if (this.config.multi_location) {
                location_ids = location_ids.concat(this.config.stock_location_ids)
            }
            if (location_ids.indexOf(this.config.stock_location_id[0]) == -1) {
                location_ids.push(this.config.stock_location_id[0])
            }
            return this._get_stock_on_hand_by_location_ids([], location_ids).then(function (stock_datas_by_location_id) {
                self.stock_datas_by_location_id = stock_datas_by_location_id;
                var location = self.get_picking_source_location();
                console.log('selected stock location: ' + location.name);
                var stock_datas = self.stock_datas_by_location_id[location.id];
                if (!stock_datas) {
                    console.warn('Could not found stock datas of location: ' + location.name);
                    return;
                }
                self.db.stock_datas = stock_datas_by_location_id[location.id];
            })
        },
        _validate_by_manager: function (action_will_do_if_passing_security, title) {
            var self = this;
            var manager_validate = [];
            _.each(this.config.manager_ids, function (user_id) {
                var user = self.user_by_id[user_id];
                if (user) {
                    manager_validate.push({
                        label: user.name,
                        item: user
                    })
                }
            });
            if (manager_validate.length == 0) {
                this.gui.show_popup('confirm', {
                    title: 'Warning',
                    body: 'Your POS Setting / Tab Security not set Managers Approve',
                })
            }
            var popup_title = _t('Only Manager can approve this Action');
            if (title) {
                popup_title += ' : ' + title;
            }
            return this.gui.show_popup('selection', {
                title: popup_title,
                body: _t('Only Manager can approve this Action'),
                list: manager_validate,
                confirm: function (manager_user) {
                    if (!manager_user.pos_security_pin) {
                        return self.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: manager_user.name + _t(' have not set pos security pin on User Setting')
                        })
                    } else {
                        return self.gui.show_popup('ask_password', {
                            title: _t('Approve by: ') + manager_user.name,
                            body: _t('Please request ' + manager_user.name + ' and input POS Pass Pin here, for validate this action'),
                            confirm: function (password) {
                                if (manager_user['pos_security_pin'] != password) {
                                    self.gui.show_popup('dialog', {
                                        title: _t('Warning'),
                                        body: _t('Pos Security Pin of ') + manager_user.name + _t(' Incorrect.')
                                    });
                                    setTimeout(function () {
                                        self._validate_by_manager(action_will_do_if_passing_security, title);
                                    }, 500)
                                } else {
                                    eval(action_will_do_if_passing_security);
                                }
                            }
                        });
                    }
                }
            })
        },
        _search_read_by_model_and_id: function (model, ids) {
            var object = this.get_model(model);
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: model,
                    method: 'search_read',
                    domain: [['id', 'in', ids]],
                    fields: object.fields
                }).then(function (datas) {
                    resolve(datas)
                }, function (error) {
                    reject(error)
                })
            })
        },
        _update_cart_qty_by_order: function (product_ids) {
            var selected_order = this.get_order();
            $('.cart_qty').addClass('oe_hidden');
            var product_quantity_by_product_id = selected_order.product_quantity_by_product_id();
            for (var i = 0; i < selected_order.orderlines.models.length; i++) {
                var line = selected_order.orderlines.models[i];
                var product_id = line.product.id;
                var $qty = $('article[data-product-id="' + product_id + '"] .cart_qty');
                var qty = product_quantity_by_product_id[product_id];
                if (qty) {
                    $qty.removeClass('oe_hidden');
                    $('article[data-product-id="' + product_id + '"] .add_shopping_cart').html(qty);
                } else {
                    $qty.addClass('oe_hidden');
                }
            }
            var total_items = selected_order.get_total_items();
            $('.items-incart').text(total_items);
        },
        _get_active_pricelist: function () {
            var current_order = this.get_order();
            var default_pricelist = this.default_pricelist;
            if (current_order && current_order.pricelist) {
                var pricelist = _.find(this.pricelists, function (pricelist_check) {
                    return pricelist_check['id'] == current_order.pricelist['id']
                });
                return pricelist;
            } else {
                if (default_pricelist) {
                    var pricelist = _.find(this.pricelists, function (pricelist_check) {
                        return pricelist_check['id'] == default_pricelist['id']
                    });
                    return pricelist
                } else {
                    return null
                }
            }
        },
        _get_default_pricelist: function () {
            var current_pricelist = this.default_pricelist;
            return current_pricelist
        },
        get_model: function (_name) {
            var _index = this.models.map(function (e) {
                return e.model;
            }).indexOf(_name);
            if (_index > -1) {
                return this.models[_index];
            }
            return false;
        },
        initialize: function (session, attributes) {
            this.is_mobile = odoo.is_mobile;
            var account_tax_model = this.get_model('account.tax');
            account_tax_model.fields.push('type_tax_use');
            var wait_currency = this.get_model('res.currency');
            wait_currency.fields.push(
                'rate'
            );
            var account_fiscal_position_tax_model = this.get_model('account.fiscal.position.tax');
            var _super_account_fiscal_position_tax_model_loaded = account_fiscal_position_tax_model.loaded;
            account_fiscal_position_tax_model.loaded = function (self, fiscal_position_taxes) {
                fiscal_position_taxes = _.filter(fiscal_position_taxes, function (tax) {
                    return tax.tax_dest_id != false;
                });
                if (fiscal_position_taxes.length > 0) {
                    _super_account_fiscal_position_tax_model_loaded(self, fiscal_position_taxes);
                }
            };
            var pos_category_model = this.get_model('pos.category');
            var _super_loaded_pos_category_model = pos_category_model.loaded;
            pos_category_model.loaded = function (self, categories) {
                if (!self.pos_categories) {
                    self.pos_categories = categories;
                    self.pos_category_by_id = {};
                } else {
                    self.pos_categories = self.pos_categories.concat(categories);
                }
                for (var i = 0; i < categories.length; i++) {
                    var category = categories[i];
                    self.pos_category_by_id[category.id] = category;
                }
                _.each(categories, function (category) {
                    category.parent = self.pos_category_by_id[category.parent_id[0]];
                });
                _super_loaded_pos_category_model(self, categories);
            };
            pos_category_model.fields = pos_category_model.fields.concat([
                'is_category_combo',
                'sale_limit_time',
                'from_time',
                'to_time',
                'submit_all_pos',
                'pos_branch_ids',
                'pos_config_ids',
            ]);
            var product_model = this.get_model('product.product');
            product_model.fields.push(
                'name',
                'is_credit',
                'multi_category',
                'multi_uom',
                'multi_variant',
                'supplier_barcode',
                'is_combo',
                'combo_limit',
                'uom_po_id',
                'barcode_ids',
                'pos_categ_ids',
                'supplier_taxes_id',
                'volume',
                'weight',
                'description_sale',
                'description_picking',
                'type',
                'cross_selling',
                'standard_price',
                'pos_sequence',
                'is_voucher',
                'minimum_list_price',
                'sale_with_package',
                'qty_warning_out_stock',
                'write_date',
                'is_voucher',
                'combo_price',
                'is_combo_item',
                'name_second',
                'note_ids',
                'tag_ids',
                'commission_rate',
                'company_id',
                'uom_ids',
                'product_template_attribute_value_ids',
            );
            this.bus_location = null;
            var partner_model = this.get_model('res.partner');
            partner_model.fields.push(
                'display_name',
                'parent_id',
                'ref',
                'vat',
                'comment',
                'discount_id',
                'credit',
                'debit',
                'balance',
                'limit_debit',
                'wallet',
                'property_product_pricelist',
                'property_payment_term_id',
                'is_company',
                'write_date',
                'birthday_date',
                'group_ids',
                'title',
                'company_id',
            );
            var pricelist_model = this.get_model('product.pricelist');
            pricelist_model['pricelist'] = true;
            var _super_pricelist_loaded = pricelist_model.loaded;
            pricelist_model.loaded = function (self, pricelists) {
                self.pricelist_currency_ids = [];
                self.pricelist_by_id = {};
                for (var i = 0; i < pricelists.length; i++) {
                    var pricelist = pricelists[i];
                    self.pricelist_by_id[pricelist.id] = pricelist;
                    if (pricelist.currency_id) {
                        self.pricelist_currency_ids.push(pricelist.currency_id[0])
                    }
                }
                _super_pricelist_loaded(self, pricelists);
            };
            var pricelist_item_model = this.get_model('product.pricelist.item');
            pricelist_item_model['pricelist'] = true;
            var payment_method_object = this.get_model('pos.payment.method');
            payment_method_object.fields.push('cash_journal_id');
            var res_users_object = this.get_model('res.users');
            if (res_users_object) {
                res_users_object.fields = res_users_object.fields.concat([
                    'pos_security_pin',
                    'barcode',
                    'pos_config_id',
                    'partner_id',
                    'company_ids',
                ]);
                // todo: move load res.users after pos.config, we dont want load res.users after partners or products because we need checking company_ids of user
                var res_users = _.filter(this.models, function (model) {
                    return model.model == 'res.users';
                });
                this.models = _.filter(this.models, function (model) {
                    return model.model != 'res.users';
                })
                if (res_users) {
                    var index_number_pos_config = null;
                    for (var i = 0; i < this.models.length; i++) {
                        var model = this.models[i];
                        if (model.model == 'pos.config') {
                            index_number_pos_config = i;
                            break
                        }
                    }
                    for (var i = 0; i < res_users.length; i++) {
                        var user_model = res_users[i];
                        this.models.splice(index_number_pos_config + 1, 0, user_model)
                    }
                }
            }
            var pos_session_model = this.get_model('pos.session');
            pos_session_model.fields.push('lock_state');
            var pos_config_model = this.get_model('pos.config');
            var _pos_config_loaded = pos_config_model.loaded;
            pos_config_model.loaded = function (self, configs) {
                _pos_config_loaded(self, configs);
                self.config.sync_to_pos_config_ids = _.filter(self.config.sync_to_pos_config_ids, function (id) {
                    return id != self.config.id
                })
            };
            _super_PosModel.initialize.apply(this, arguments);
            var wait_res_company = this.get_model('res.company');
            wait_res_company.fields.push('logo');
            wait_res_company.fields = wait_res_company.fields.concat(['logo', 'contact_address'])
            var _super_company_model_loaded = wait_res_company.loaded;
            wait_res_company.loaded = function (self, companies) {
                _super_company_model_loaded(self, companies);
            };
            // todo: store employee by id
            var employee_model = this.get_model('hr.employee');
            var _super_employee_model_loaded = employee_model.loaded;
            employee_model.loaded = function (self, employees) {
                _super_employee_model_loaded(self, employees);
                self.employee_by_id = {};
                for (var i = 0; i < employees.length; i++) {
                    var emp = employees[i];
                    self.employee_by_id[emp.id] = emp;
                }
            };
        },
        add_new_order: function () {
            var self = this;
            _super_PosModel.add_new_order.apply(this, arguments);
            var order = this.get_order();
            var client = order.get_client();
            if (!client && this.config.customer_default_id) {
                var client_default = this.db.get_partner_by_id(this.config.customer_default_id[0]);
                var order = this.get_order();
                if (client_default && order) {
                    setTimeout(function () {
                        order.set_client(client_default);
                    }, 500);
                }
            }
            if (!client && this.config.add_customer_before_products_already_in_shopping_cart) {
                setTimeout(function () {
                    self.gui.show_screen('clientlist');
                }, 500);
            }
        },
        formatDateTime: function (value, field, options) {
            if (value === false) {
                return "";
            }
            if (!options || !('timezone' in options) || options.timezone) {
                value = value.clone().add(session.getTZOffset(value), 'minutes');
            }
            return value.format(time.getLangDatetimeFormat());
        },
        format_date: function (date) { // covert datetime backend to pos
            if (date) {
                return this.formatDateTime(
                    moment(date), {}, {timezone: true});
            } else {
                return ''
            }
        },
        get_config: function () {
            return this.config;
        },
        get_packaging_by_product: function (product) {
            if (!this.packaging_by_product_id || !this.packaging_by_product_id[product.id]) {
                return false;
            } else {
                return true
            }
        },
        get_default_sale_journal: function () {
            var invoice_journal_id = this.config.invoice_journal_id;
            if (!invoice_journal_id) {
                return null
            } else {
                return invoice_journal_id[0];
            }
        },
        get_bus_location: function () {
            return this.bus_location
        }
        ,
        query_backend_fail: function (error) {
            if (error && error.message && error.message.code && error.message.code == 200) {
                return this.gui.show_popup('confirm', {
                    title: error.message.code,
                    body: error.message.data.message,
                })
            }
            if (error && error.message && error.message.code && error.message.code == -32098) {
                return this.gui.show_popup('confirm', {
                    title: error.message.code,
                    body: 'Your Odoo Server Offline',
                })
            } else {
                return this.gui.show_popup('confirm', {
                    title: 'Error',
                    body: 'Odoo offline mode or backend codes have issues. Please contact your admin system',
                })
            }
        }
        ,
        scan_product: function (parsed_code) {
            /*
                    This function only return true or false
                    Because if barcode passed mapping data of products, customers ... will return true
                    Else all return false and popup warning message
             */
            var self = this;
            console.log('-> scan barcode: ' + parsed_code.code);
            var product = this.db.get_product_by_barcode(parsed_code.code);
            var lot_by_barcode = this.lot_by_barcode;
            var lots = lot_by_barcode[parsed_code.code];
            var selectedOrder = this.get_order();
            var products_by_supplier_barcode = this.db.product_by_supplier_barcode[parsed_code.code];
            var barcodes = this.barcodes_by_barcode[parsed_code.code];
            var lots = _.filter(lots, function (lot) {
                var product_id = lot.product_id[0];
                var product = self.db.product_by_id[product_id];
                return product != undefined
            });
            var quantity_pack = _.find(this.quantities_pack, function (pack) {
                return pack.barcode == parsed_code.code;
            });
            if (quantity_pack) {
                var product_by_product_tmpl_id = _.find(this.pos.db.get_product_by_category(0), function (product) { // need check v10
                    return product.product_tmpl_id == quantity_pack['product_tmpl_id'][0];
                });
                if (product_by_product_tmpl_id) {
                    var product = self.db.product_by_id[product_by_product_tmpl_id.id];
                    if (product) {
                        selectedOrder.add_product(product, {quantity: quantity_pack.quantity, merge: true});
                        var order_line = selectedOrder.get_selected_orderline();
                        order_line.set_unit_price(quantity_pack['public_price']);
                        order_line.price_manually_set = true;
                        return true
                    }
                }
            }
            if (lots && lots.length) {
                if (lots.length > 1) {
                    var list = [];
                    for (var i = 0; i < lots.length; i++) {
                        list.push({
                            'label': lots[i]['name'],
                            'item': lots[i]
                        })
                    }
                    this.gui.show_popup('selection', {
                        title: _t('Select Lot'),
                        list: list,
                        confirm: function (lot) {
                            var product = self.db.product_by_id[lot.product_id[0]];
                            if (product) {
                                selectedOrder.add_product(product, {merge: false});
                                self.gui.close_popup();
                                var order_line = selectedOrder.get_selected_orderline();
                                if (order_line) {
                                    if (lot.replace_product_public_price && lot.public_price) {
                                        order_line.set_unit_price(lot['public_price'])
                                        order_line.price_manually_set = true;
                                    }
                                    $('.packlot-line-input').remove(); // fix on safari
                                    setTimeout(function () {
                                        var pack_models = order_line.pack_lot_lines.models;
                                        if (pack_model) {
                                            for (var i = 0; i < pack_models.length; i++) {
                                                var pack_model = pack_models[i];
                                                pack_model.set_lot_name(lot['name'], lot);
                                            }
                                            order_line.trigger('change', order_line);
                                        }
                                    }, 300);
                                }
                                return true
                            } else {
                                this.gui.show_popup('dialog', {
                                    title: 'Warning',
                                    body: 'Lot name is correct but product of lot not available on POS'
                                });
                                return false;
                            }
                        }
                    });
                    return true;
                } else if (lots.length == 1) {
                    var lot = lots[0];
                    var product = self.db.product_by_id[lot.product_id[0]];
                    if (product) {
                        selectedOrder.add_product(product, {merge: false});
                        self.gui.close_popup();
                        var order_line = selectedOrder.get_selected_orderline();
                        if (order_line) {
                            if (lot.replace_product_public_price && lot.public_price) {
                                order_line.set_unit_price(lot['public_price']);
                                order_line.price_manually_set = true;
                            }
                            $('.packlot-line-input').remove(); // fix on safari
                            setTimeout(function () {
                                var pack_models = order_line.pack_lot_lines.models;
                                if (pack_models) {
                                    for (var i = 0; i < pack_models.length; i++) {
                                        var pack_model = pack_models[i];
                                        pack_model.set_lot_name(lot['name'], lot);
                                    }
                                    order_line.trigger('change', order_line);
                                }
                            }, 300);
                        }
                        return true
                    } else {
                        return this.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Lot name is correct but product of lot not available on POS'
                        });
                    }
                }
            } else if (products_by_supplier_barcode) { // scan code by suppliers code
                var products = [];
                for (var i = 0; i < products_by_supplier_barcode.length; i++) {
                    products.push({
                        label: products_by_supplier_barcode[i]['display_name'],
                        item: products_by_supplier_barcode[i]
                    })
                }
                var product = this.db.get_product_by_barcode(parsed_code.code);
                if (product) {
                    products.push({
                        label: product['display_name'],
                        item: product
                    })
                }
                this.gui.show_popup('selection', {
                    title: _t('Select product'),
                    list: products,
                    confirm: function (product) {
                        var selectedOrder = self.get('selectedOrder');
                        if (selectedOrder) {
                            if (parsed_code.type === 'price') {
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    price: product['lst_price'],
                                    merge: true
                                });
                            } else if (parsed_code.type === 'weight') {
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    price: product['lst_price'],
                                    merge: false
                                });
                            } else if (parsed_code.type === 'discount') {
                                selectedOrder.add_product(product, {discount: parsed_code.value, merge: false});
                            } else {
                                selectedOrder.add_product(product);
                            }
                        }
                    }
                });
                return true
            } else if (product && barcodes) { // multi barcode, if have product and barcodes
                var list = [{
                    'label': product['name'] + '| price: ' + product['lst_price'] + ' with Unit of Measure: ' + product['uom_id'][1],
                    'item': product,
                }];
                for (var i = 0; i < barcodes.length; i++) {
                    var barcode = barcodes[i];
                    list.push({
                        'label': barcode['product_id'][1] + '| with Pricelist: ' + barcode['pricelist_id'][1] + ' and Unit of Measure: ' + barcode['uom_id'][1],
                        'item': barcode,
                    });
                }
                this.gui.show_popup('selection', {
                    title: _t('Select product'),
                    list: list,
                    confirm: function (item) {
                        var barcode;
                        var product;
                        if (item['product_id']) {
                            barcode = item;
                            product = self.db.product_by_id[barcode.product_id[0]]
                            selectedOrder.add_product(product, {
                                extras: {
                                    uom_id: barcode['uom_id'][0]
                                }
                            });
                        } else {
                            product = item;
                            selectedOrder.add_product(product, {});
                        }
                    }
                });
                if (list.length > 0) {
                    return true;
                }
            } else if (!product && barcodes) { // not have product but have barcodes
                var list = [];
                for (var i = 0; i < barcodes.length; i++) {
                    var barcode = barcodes[i];
                    list.push({
                        'label': 'We found ' + barcode.product_id[1] + ' , with PriceList ' + barcode.pricelist_id[1] + ', and Unit : ' + barcode.uom_id[1] + ' . Click for add this Product to Cart',
                        'item': barcode,
                    });
                }
                if (list.length > 1) {
                    this.gui.show_popup('selection', {
                        title: _t('Select one Item'),
                        list: list,
                        confirm: function (barcode) {
                            var product = self.db.product_by_id[barcode['product_id'][0]];
                            if (product) {
                                var pricelist_id = barcode.pricelist_id[0];
                                var pricelist = self.pricelist_by_id[pricelist_id];
                                if (pricelist) {
                                    selectedOrder.set_pricelist(pricelist)
                                }
                                selectedOrder.add_product(product, {
                                    quantity: 1,
                                    extras: {
                                        uom_id: barcode['uom_id'][0]
                                    }
                                });
                                var uom_id = barcode.uom_id[0];
                                var uom = self.uom_by_id[uom_id];
                                if (uom && selectedOrder.pricelist) {
                                    var price = self.get_price(product, selectedOrder.pricelist, 1, uom_id);
                                    selectedOrder.selected_orderline.set_unit(uom_id, price)
                                }
                            }
                        }
                    })
                    return true
                }
                if (list.length == 1) {
                    barcode = barcodes[0]
                    var product = this.db.product_by_id[barcode['product_id'][0]];
                    if (product) {
                        var pricelist_id = barcode.pricelist_id[0];
                        var pricelist = this.pricelist_by_id[pricelist_id];
                        if (pricelist) {
                            selectedOrder.set_pricelist(pricelist)
                        }
                        selectedOrder.add_product(product, {
                            quantity: 1,
                            extras: {
                                uom_id: barcode['uom_id'][0]
                            }
                        });
                        var uom_id = barcode.uom_id[0];
                        var uom = this.uom_by_id[uom_id];
                        if (uom && selectedOrder.pricelist) {
                            var price = this.get_price(product, selectedOrder.pricelist, 1, uom_id);
                            selectedOrder.selected_orderline.set_unit(uom_id, price)
                        }
                    }
                    return true
                }
            }
            return _super_PosModel.scan_product.apply(this, arguments);
        },
        _save_to_server: function (orders, options) {
            var self = this;
            this.partner_need_update_ids = [];
            this.wait_print_voucher = false;
            var order_to_invoice = _.find(orders, function (order) { // TODO: first we checking have any orders request to invoice
                return order['data']['to_invoice'];
            });
            if (!order_to_invoice && this.config.turbo_sync_orders) { // TODO: if have not to invoice, we save orders to draft
                options.draft = true;
            }
            if (orders.length) {
                for (var n = 0; n < orders.length; n++) {
                    var order = orders[n]['data'];
                    if (order.partner_id) {
                        this.partner_need_update_ids.push(order.partner_id)
                    }
                    for (var i = 0; i < order.lines.length; i++) {
                        var line = order.lines[i][2];
                        if (line.voucher) {
                            this.wait_print_voucher = true;
                            break;
                        }
                    }
                }
            }
            return _super_PosModel._save_to_server.call(this, orders, options).then(function (pos_order_backend_ids) {
                if (pos_order_backend_ids.length == 1) {
                    if (self.config.print_order_report && !self.config.print_delivery_report) {
                        self.chrome.do_action('pos_retail.report_pos_order', {
                            additional_context: {
                                active_ids: [pos_order_backend_ids[0]['id']],
                            }
                        });
                    }
                    if (!self.config.print_order_report && self.config.print_delivery_report) {
                        rpc.query({
                            model: 'stock.picking',
                            method: 'search_read',
                            domain: [['pos_order_id', '=', pos_order_backend_ids[0]['id']]],
                            fields: ['id'],
                            context: {
                                limit: 1
                            }
                        }).then(function (picking_ids) {
                            if (picking_ids.length > 0) {
                                self.chrome.do_action('stock.action_report_picking', {
                                    additional_context: {
                                        active_ids: [picking_ids[0]['id']],
                                    }
                                });
                            }
                        })
                    }
                    if (self.config.print_order_report && self.config.print_delivery_report) { //report_combine_order_picking_and_invoice
                        self.chrome.do_action('pos_retail.report_combine_order_picking_and_invoice', {
                            additional_context: {
                                active_ids: [pos_order_backend_ids[0]['id']],
                            }
                        });
                    }
                    if (pos_order_backend_ids) {
                        var frontend_order = self.get_order();
                        for (var i = 0; i < pos_order_backend_ids.length; i++) {
                            var backend_order = pos_order_backend_ids[i];
                            if (frontend_order && frontend_order.ean13 == backend_order['ean13']) {
                                frontend_order.invoice_ref = backend_order.invoice_ref;
                                frontend_order.picking_ref = backend_order.picking_ref;
                                if (backend_order.included_order_fields_extend) {
                                    frontend_order.order_fields_extend = backend_order.order_fields_extend;
                                }
                                if (backend_order.included_delivery_fields_extend) {
                                    frontend_order.delivery_fields_extend = backend_order.delivery_fields_extend;
                                }
                                if (backend_order.included_invoice_fields_extend) {
                                    frontend_order.invoice_fields_extend = backend_order.invoice_fields_extend;
                                }

                            }
                        }
                    }
                    if (self.gui.get_current_screen() == 'receipt') {
                        self.gui.screen_instances['receipt'].render_receipt();
                    }
                    if (self.partner_need_update_ids.length) {
                        for (var i = 0; i < self.partner_need_update_ids.length; i++) {
                            self.load_new_partners(self.partner_need_update_ids[i]);
                        }
                    }
                    if (self.wait_print_voucher) {
                        rpc.query({
                            model: 'pos.voucher',
                            method: 'get_vouchers_by_order_ids',
                            args: [[], _.pluck(pos_order_backend_ids, 'id')]
                        }).then(function (vouchers_created) {
                            if (vouchers_created.length) {
                                self.wait_print_voucher = false;
                                self.vouchers_created = vouchers_created;
                                self._render_vouchers(self.vouchers_created);
                            }
                        })
                    }
                    // todo: when finish orders, auto up to date datas with backend
                    self.trigger('hide:orderline-detail');
                    self.trigger('pos.listen.event.backend.update');
                }
                self.partner_need_update_ids = [];
                return pos_order_backend_ids
            });
        },
        push_order: function (order, opts) {
            var pushed = _super_PosModel.push_order.apply(this, arguments);
            if (!order) {
                return pushed;
            }
            var client = order && order.get_client();
            if (client) {
                for (var i = 0; i < order.paymentlines.models.length; i++) {
                    var line = order.paymentlines.models[i];
                    var amount = line.get_amount();
                    var pos_method_type = line.payment_method.pos_method_type;
                    if (pos_method_type == 'wallet') {
                        client.wallet = -amount;
                    }
                    if (pos_method_type == 'credit') {
                        client.balance -= line.get_amount();
                    }
                }
            }
            return pushed;
        },
        push_and_invoice_order: function (order) {
            if (!this.config.invoice_without_download) {
                return _super_PosModel.push_and_invoice_order.apply(this, arguments);
            } else {
                return _super_PosModel.push_order.apply(this, arguments);
            }

        },
        requesting_another_sessions_sync: function () {
            rpc.query({
                model: 'pos.cache.database',
                method: 'send_notification_pos_sessions_online_action_update',
                args: [[], 'pos.listen.event.backend.update'],
            })
        },
        get_balance: function (client) {
            var balance = round_pr(client.balance, this.currency.rounding);
            return (Math.round(balance * 100) / 100).toString()
        }
        ,
        get_wallet: function (client) {
            var wallet = round_pr(client.wallet, this.currency.rounding);
            return (Math.round(wallet * 100) / 100).toString()
        }
        ,
        add_return_order: function (order_return, lines) {
            var self = this;
            var order_return_id = order_return['id'];
            var order_selected_state = order_return['state'];
            var partner_id = order_return['partner_id'];
            var return_order_id = order_return['id'];
            var order = new models.Order({}, {pos: this});
            order['is_return'] = true;
            order['return_order_id'] = return_order_id;
            order['pos_reference'] = 'Return/' + order['name'];
            order['name'] = 'Return/' + order['name'];
            this.get('orders').add(order);
            if (partner_id && partner_id[0]) {
                var client = this.db.get_partner_by_id(partner_id[0]);
                if (client) {
                    order.set_client(client);
                }
            }
            this.set('selectedOrder', order);
            for (var i = 0; i < lines.length; i++) {
                var line_return = lines[i];
                if (line_return['is_return']) {
                    this.db.remove_order(order.id);
                    order.destroy({'reason': 'abandon'});
                    return this.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('This order is order return before, it not possible return again')
                    })
                }
                var price = line_return['price_unit'];
                if (price < 0) {
                    price = -price;
                }
                var quantity = 0;
                var product = this.db.get_product_by_id(line_return.product_id[0]);
                if (!product) {
                    this.db.remove_order(order.id);
                    order.destroy({'reason': 'abandon'});
                    return this.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t(line_return.product_id[0] + ' not available in POS, it not possible made return')
                    })
                }
                var line = new models.Orderline({}, {
                    pos: this,
                    order: order,
                    product: product,
                });
                order.orderlines.add(line);
                // todo: set lot back
                var pack_operation_lots = this.pack_operation_lots_by_pos_order_line_id[line_return.id];
                if (pack_operation_lots) {
                    var multi_lot_ids = [];
                    var lot_name_manual = null;
                    for (var i = 0; i < pack_operation_lots.length; i++) {
                        var pack_operation_lot = pack_operation_lots[i];
                        if (pack_operation_lot.lot_id) {
                            multi_lot_ids.push({
                                'id': pack_operation_lot.lot_id[0],
                                'quantity': pack_operation_lot.quantity
                            })
                        } else {
                            lot_name_manual = pack_operation_lot.lot_name
                        }
                    }
                    if (multi_lot_ids.length) { // todo: only for multi lot
                        line.set_multi_lot(multi_lot_ids)
                    }
                    if (lot_name_manual) { // todo: only for one lot
                        var pack_lot_lines = line.compute_lot_lines();
                        for (var i = 0; i < pack_lot_lines.models.length; i++) {
                            var pack_line = pack_lot_lines.models[i];
                            pack_line.set_lot_name(lot_name_manual)
                        }
                        pack_lot_lines.remove_empty_model();
                        pack_lot_lines.set_quantity_by_lot();
                        line.order.save_to_db();
                    }
                }
                if (line_return['variant_ids']) {
                    line.set_variants(line_return['variant_ids'])
                }
                if (line_return['tag_ids']) {
                    line.set_tags(line_return['tag_ids'])
                }
                line['returned_order_line_id'] = line_return['id'];
                line['is_return'] = true;
                line.set_unit_price(price);
                line.price_manually_set = true;
                if (line_return.discount)
                    line.set_discount(line_return.discount);
                if (line_return.discount_reason)
                    line.discount_reason = line_return.discount_reason;
                if (line_return['new_quantity']) {
                    quantity = -line_return['new_quantity']
                } else {
                    quantity = -line_return['qty']
                }
                if (line_return.promotion) {
                    quantity = -quantity;
                }
                if (line_return.redeem_point) {
                    quantity = -quantity;
                    line.credit_point = line_return.redeem_point;
                }
                if (quantity > 0) {
                    quantity = -quantity;
                }
                line.set_quantity(quantity, 'keep price when return');
            }
            if (this.combo_picking_by_order_id) {
                var combo_picking_id = this.combo_picking_by_order_id[return_order_id];
                if (combo_picking_id) {
                    moves = this.stock_moves_by_picking_id[combo_picking_id];
                    for (var n = 0; n < moves.length; n++) {
                        var price = 0;
                        var move = moves[n];
                        var product = this.db.get_product_by_id(move.product_id[0]);
                        if (!product) {
                            this.pos.gui.show_popup('dialog', {
                                title: 'Warning',
                                body: 'Product ID ' + move.product_id[1] + ' have removed out of POS. Take care'
                            });
                            continue
                        }
                        if (move.product_uom_qty == 0) {
                            continue
                        }
                        var line = new models.Orderline({}, {
                            pos: this,
                            order: order,
                            product: product,
                        });
                        order.orderlines.add(line);
                        line['is_return'] = true;
                        line.set_unit_price(price);
                        line.price_manually_set = true;
                        line.set_quantity(-move.product_uom_qty, 'keep price when return');
                    }
                }
            }

            if (order_selected_state.is_paid_full == false) {
                return new Promise(function (resolve, reject) {
                    rpc.query({
                        model: 'account.bank.statement.line',
                        method: 'search_read',
                        domain: [['pos_statement_id', '=', order_return_id]],
                        fields: [],
                    }).then(function (statements) {
                        var last_paid = 0;
                        for (var i = 0; i < statements.length; i++) {
                            var statement = statements[i];
                            last_paid += statement['amount'];
                        }
                        last_paid = self.gui.chrome.format_currency(last_paid);
                        self.gui.show_popup('dialog', {
                            'title': _t('Warning'),
                            'body': 'Selected Order need return is partial payment, and customer only paid: ' + last_paid + ' . Please return back money to customer correctly',
                        });
                        resolve()
                    }, function (error) {
                        reject()
                    })
                })
            } else {
                var payment_method = _.find(this.payment_methods, function (method) {
                    return method['journal'] && method['journal']['pos_method_type'] == 'default' && method['journal'].type == 'cash';
                });
                if (payment_method) {
                    order.add_paymentline(payment_method);
                    var amount_withtax = order.get_total_with_tax();
                    order.selected_paymentline.set_amount(amount_withtax);
                    order.trigger('change', order);
                    this.trigger('auto_update:paymentlines', this);
                }
            }
        },
        add_refill_order: function (order, lines) {
            var partner_id = order['partner_id'];
            var order = new models.Order({}, {pos: this});
            this.get('orders').add(order);
            if (partner_id && partner_id[0]) {
                var client = this.db.get_partner_by_id(partner_id[0]);
                if (client) {
                    order.set_client(client);
                }
            }
            this.set('selectedOrder', order);
            for (var i = 0; i < lines.length; i++) {
                var line_refill = lines[i];
                var price = line_refill['price_unit'];
                if (price < 0) {
                    price = -price;
                }
                var quantity = 0;
                var product = this.db.get_product_by_id(line_refill.product_id[0]);
                if (!product) {
                    console.error('Could not find product: ' + line_refill.product_id[0]);
                    continue
                }
                var line = new models.Orderline({}, {
                    pos: this,
                    order: order,
                    product: product,
                });
                order.orderlines.add(line);
                if (line_refill['variant_ids']) {
                    line.set_variants(line_refill['variant_ids'])
                }
                if (line_refill['tag_ids']) {
                    line.set_tags(line_refill['tag_ids'])
                }
                line.set_unit_price(price);
                line.price_manually_set = true;
                if (line_refill.discount)
                    line.set_discount(line_refill.discount);
                if (line_refill.discount_reason)
                    line.discount_reason = line_refill.discount_reason;
                if (line_refill['new_quantity']) {
                    quantity = line_refill['new_quantity']
                } else {
                    quantity = line_refill['qty']
                }
                line.set_quantity(quantity, 'keep price when return');
            }
        },
        lock_order: function () {
            $('.rightpane').addClass('oe_hidden');
            $('.timeline').addClass('oe_hidden');
            $('.find_customer').addClass('oe_hidden');
            $('.leftpane').css({'left': '0px'});
            $('.numpad').addClass('oe_hidden');
            $('.actionpad').addClass('oe_hidden');
            $('.deleteorder-button').addClass('oe_hidden');
        },
        unlock_order: function () {
            $('.rightpane').removeClass('oe_hidden');
            $('.timeline').removeClass('oe_hidden');
            $('.find_customer').removeClass('oe_hidden');
            $('.numpad').removeClass('oe_hidden');
            $('.actionpad').removeClass('oe_hidden');
            if (this.config.staff_level == 'manager') {
                $('.deleteorder-button').removeClass('oe_hidden');
            }
        },
        load_server_data_by_model: function (model) {
            var self = this;
            var tmp = {};
            var fields = typeof model.fields === 'function' ? model.fields(self, tmp) : model.fields;
            var domain = typeof model.domain === 'function' ? model.domain(self, tmp) : model.domain;
            var context = typeof model.context === 'function' ? model.context(self, tmp) : model.context || {};
            var ids = typeof model.ids === 'function' ? model.ids(self, tmp) : model.ids;
            var order = typeof model.order === 'function' ? model.order(self, tmp) : model.order;
            console.log('{Model.js} load_server_data_by_model model: ' + model.model);
            var loaded = new Promise(function (resolve, reject) {
                var params = {
                    model: model.model,
                    context: _.extend(context, session.user_context || {}),
                };
                if (model.ids) {
                    params.method = 'read';
                    params.args = [ids, fields];
                } else {
                    params.method = 'search_read';
                    params.domain = domain;
                    params.fields = fields;
                    params.orderBy = order;
                }
                rpc.query(params).then(function (result) {
                    try {    // catching exceptions in model.loaded(...)
                        Promise.resolve(model.loaded(self, result, tmp)).then(function () {
                            resolve()
                        }, function (err) {
                            reject(err);
                        });
                    } catch (err) {
                        reject()
                    }
                }, function (err) {
                    reject()
                });
            });
            return loaded;
        }
    });

    //TODO: validate click change minus
    var _super_NumpadState = models.NumpadState.prototype;
    models.NumpadState = models.NumpadState.extend({
        switchSign: function () {
            self.posmodel.switchSign = this;
            if (self.posmodel.config.validate_change_minus) {
                return self.posmodel.gui.show_popup('ask_password', {
                    title: 'Pos pass pin ?',
                    body: 'Please use pos security pin for unlock',
                    confirm: function (value) {
                        var pin;
                        if (self.posmodel.config.manager_validate) {
                            var user_validate = self.posmodel.user_by_id[this.pos.config.manager_user_id[0]];
                            pin = user_validate['pos_security_pin']
                        } else {
                            pin = self.posmodel.user.pos_security_pin
                        }
                        if (value != pin) {
                            return self.posmodel.gui.show_popup('dialog', {
                                title: 'Wrong',
                                body: 'Pos security pin not correct'
                            })
                        } else {
                            return _super_NumpadState.switchSign.apply(this.pos.switchSign, arguments);
                        }
                    }
                });
            } else {
                return _super_NumpadState.switchSign.apply(this, arguments);
            }
        }
    });

    // TODO: PROBLEM IS ( if we have 100k, 500k or few millions products record ) and when change pricelist, take a lot times render qweb
    // TODO SOLUTION: we force method get_price of product recordset to posmodel, see to method get_price of LoadModel.js
    models.Product = models.Product.extend({
        get_price: function (pricelist, quantity) {
            return _super_PosModel.get_price.call(this, this, pricelist, quantity);
        },
    });
    var _super_Paymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        init_from_JSON: function (json) {
            var res = _super_Paymentline.init_from_JSON.apply(this, arguments);
            if (json.ref) {
                this.ref = json.ref
            }
            if (json.add_partial_amount_before) {
                this.add_partial_amount_before = json.add_partial_amount_before
            }
            return res
        },
        export_as_JSON: function () {
            var json = _super_Paymentline.export_as_JSON.apply(this, arguments);
            if (this.ref) {
                json['ref'] = this.ref;
            }
            if (this.add_partial_amount_before) {
                json['add_partial_amount_before'] = this.add_partial_amount_before;
            }
            return json
        },
        export_for_printing: function () {
            var datas = _super_Paymentline.export_for_printing.apply(this, arguments);
            if (this.ref) {
                datas['ref'] = this.ref
            }
            if (this.add_partial_amount_before) {
                datas['add_partial_amount_before'] = this.add_partial_amount_before
            }
            return datas
        },
        set_reference: function (ref) {
            this.ref = ref;
            this.trigger('change', this)
        },
        set_amount: function (value) {
            if (this.add_partial_amount_before) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: this.ref + _t(' .Not allow edit amount of this payment line. If you wanted edit, please remove this Line')
                })
            }
            _super_Paymentline.set_amount.apply(this, arguments);

        },
    });
})
;
