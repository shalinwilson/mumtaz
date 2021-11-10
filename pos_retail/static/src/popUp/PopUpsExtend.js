odoo.define('pos_retail.popups', function (require) {

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var _t = core._t;

    // add lot to combo items
    var popup_add_lot_to_combo_items = PopupWidget.extend({
        template: 'popup_add_lot_to_combo_items',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .remove-lot': 'remove_lot',
            'blur .packlot-line-input': 'lose_input_focus'
        }),

        show: function (options) {
            this.orderline = options.orderline;
            this.combo_items = options.combo_items;
            this._super(options);
            this.focus();
        },
        lose_input_focus: function (ev) {
            var $input = $(ev.target),
                id = $input.attr('id');
            var combo_item = this.pos.combo_item_by_id[id];
            var lot = this.pos.lot_by_name[$input.val()];
            if (lot) {
                combo_item['use_date'] = lot['use_date']
            } else {
                combo_item['lot_number'] = 'Wrong lot, input again.';
            }
            for (var i = 0; i < this.orderline.combo_items.length; i++) {
                if (this.orderline.combo_items[i]['id'] == id) {
                    this.orderline.combo_items[i] = combo_item;
                }
            }
            this.orderline.trigger('change', this.orderline);
        },
        remove_lot: function (ev) {
            $input = $(ev.target).prev(),
                id = $input.attr('id');
            var combo_item = this.pos.combo_item_by_id[id];
            combo_item['lot_number'] = '';
            combo_item['use_date'] = '';
            for (var i = 0; i < this.orderline.combo_items.length; i++) {
                if (this.orderline.combo_items[i]['id'] == id) {
                    this.orderline.combo_items[i] = combo_item;
                }
            }
            this.orderline.trigger('change', this.orderline);
            this.renderElement();
        },

        focus: function () {
            this.$("input[autofocus]").focus();
            this.focus_model = false;   // after focus clear focus_model on widget
        }
    });
    gui.define_popup({name: 'popup_add_lot_to_combo_items', widget: popup_add_lot_to_combo_items});

    var popup_internal_transfer = PopupWidget.extend({ // internal transfer
        template: 'popup_internal_transfer',

        show: function (options) {
            var self = this;
            if (this.pos.stock_locations.length == 0) {
                return this.gui.show_popup('dialog', {
                    'title': 'Warning',
                    'body': 'Your stock locations have not any location checked to checkbox [Available in POS]. Please back to backend and config it'
                })
            }
            this._super(options);
            this.$('.datetimepicker').datetimepicker({
                format: 'YYYY-MM-DD  HH:mm:00',
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
            var self = this;
            var fields = {};
            this.$('.internal_transfer_field').each(function (idx, el) {
                fields[el.id] = el.value || false;
            });
            if (!fields['scheduled_date']) {
                return self.wrong_input('input[id="scheduled_date"]', 'Scheduled date is required');
            } else {
                self.passed_input('input[id="scheduled_date"]');
            }
            if (fields['location_id'] == fields['location_dest_id']) {
                return self.wrong_input('input[id="location_id"]', 'Source location and Dest Location it not possible the same');
            } else {
                self.passed_input('input[id="location_id"]');
            }
            var order = this.pos.get_order();
            var length = order.orderlines.length;
            var picking_vals = {
                is_locked: true,
                move_type: 'direct',
                origin: order['name'],
                picking_type_id: parseInt(fields['picking_type_id']),
                location_id: parseInt(fields['location_id']),
                location_dest_id: parseInt(fields['location_dest_id']),
                move_type: fields['move_type'],
                note: fields['note'],
                scheduled_date: fields['scheduled_date'],
                immediate_transfer: true,
            };
            var move_lines = [];
            this.product_need_update_onhand = [];
            for (var i = 0; i < length; i++) {
                var line = order.orderlines.models[i];
                var line_json = line.export_as_JSON();
                var pack_lots = [];
                if (line.product.tracking == 'lot') {
                    if (line_json.pack_lot_ids.length == 0) {
                        return this.gui.show_popup('confirm', {
                            title: _t('Error'),
                            body: line.product.name + _t(' Tracking by Lot, Required add Lot and quantity. Total quantity set to pack lots the same quantity of line'),
                        });
                    } else {
                        var quantity_by_lot = 0;
                        for (var j = 0; j < line_json.pack_lot_ids.length; j++) {
                            quantity_by_lot += line_json.pack_lot_ids[j][2]['quantity']
                            pack_lots.push(line_json.pack_lot_ids[j][2])
                        }
                        if (line_json.qty > quantity_by_lot) {
                            return this.gui.show_popup('confirm', {
                                title: _t('Error'),
                                body: _t('Total Quantity of Product ') + line.product.name + _t(' is ') + line_json.qty + _t(' but Total Quantity of Lot Set is ') + quantity_by_lot + _t('. Please set quantity line and lot the same.'),
                            });
                        }
                    }
                }
                var product = this.pos.db.get_product_by_id(line.product.id);
                if (product['uom_po_id'] == undefined || !product['uom_po_id'] || product['type'] == 'service') {
                    continue
                } else {
                    move_lines.push({
                        product_uom_id: product['uom_po_id'][0],
                        product_id: line.product.id,
                        qty_done: line.quantity,
                        location_id: parseInt(fields['location_id']),
                        location_dest_id: parseInt(fields['location_dest_id']),
                        pack_lots: pack_lots,
                        company_id: this.pos.company.id
                    });
                    this.product_need_update_onhand.push(product.id)
                }
            }
            if (move_lines.length > 0) {
                return rpc.query({
                    model: 'stock.picking',
                    method: 'pos_made_internal_transfer',
                    args: [picking_vals, move_lines],
                    context: {}
                }, {shadow: true}).then(function (picking) {
                    var order = self.pos.get_order();
                    order.temporary = true;
                    self.pos.config.auto_nextscreen_when_validate_payment = false;
                    self.pos.config.auto_print_web_receipt = false;
                    order.internal_ref = picking.internal_ref;
                    self.link = window.location.origin + "/web#id=" + picking.id + "&view_type=form&model=stock.picking";
                    self.pos._do_update_quantity_onhand(self.product_need_update_onhand);
                    window.open(self.link, '_blank');
                    if (picking.error) {
                        self.pos.gui.show_popup('confirm', {
                            title: _t('Error'),
                            body: picking.error
                        })
                    }
                    self.pos.gui.show_screen('receipt');
                }, function (error) {
                    return self.pos.query_backend_fail(error)
                }).catch(function (error) {
                    return self.pos.query_backend_fail(error)
                })
            } else {
                this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Your Order have not product have type is Storable Product, or all quantities of lines smaller than 0')
                })
            }
        }
    });

    gui.define_popup({name: 'popup_internal_transfer', widget: popup_internal_transfer});

    var popup_create_purchase_order = PopupWidget.extend({
        template: 'popup_create_purchase_order',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.signed = false;
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
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            if (lines.length == 0) {
                return this.gui.show_popup('dialog', {
                    title: _t('Error'),
                    body: _t('There are no order lines')
                });
            }
            if (!order.get_client()) {
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Please select Vendor first')
                })
                return self.pos.gui.show_screen('clientlist');
            }
            this.$(".pos_signature").jSignature();
            this.$(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
        },
        renderElement: function () {
            var self = this;
            this._super();
        },
        click_confirm: function () {
            var fields = {};
            this.$('.po-field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['date_planned']) {
                return this.wrong_input('input[name="date_planned"]', '(*) Scheduled Date is required');
            } else {
                this.passed_input('input[name="date_planned"]');
            }
            var self = this;
            var order = this.pos.get_order();
            var lines = order.get_orderlines();
            var client = this.pos.get_client();
            var values = {
                journal_id: parseInt(fields['journal_id']),
                origin: order.name,
                partner_id: this.pos.get_client().id,
                order_line: [],
                payment_term_id: client['property_payment_term_id'] && client['property_payment_term_id'][0],
                date_planned: fields['date_planned'],
                notes: fields['notes'],
                currency_id: parseInt(fields['currency_id'])
            };
            var sign_datas = this.$(".pos_signature").jSignature("getData", "image");
            if (sign_datas && sign_datas[1]) {
                values['signature'] = sign_datas[1]
            }
            if (this.pos.config.create_purchase_order_required_signature && !self.signed) {
                return this.wrong_input('div[name="pos_signature"]', '(*) Required Signature');
            }
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var uom_id;
                if (line['uom_id']) {
                    uom_id = line['uom_id']
                } else {
                    uom_id = line.product.uom_id[0]
                }
                var taxes_id = [[6, false, line.product['supplier_taxes_id'] || []]];
                values['order_line'].push([0, 0, {
                    product_id: line.product['id'],
                    name: line.product['display_name'],
                    product_qty: line['quantity'],
                    product_uom: uom_id,
                    price_unit: line.price,
                    taxes_id: taxes_id
                }])
            }
            this.pos.gui.close_popup();
            return rpc.query({
                model: 'purchase.order',
                method: 'create_po',
                args:
                    [values, this.pos.config.purchase_order_state]
            }, {shadow: true}).then(function (purchase_order) {
                var order = self.pos.get_order();
                order.temporary = true;
                self.pos.config.auto_nextscreen_when_validate_payment = false;
                self.pos.config.auto_print_web_receipt = false;
                order.purchase_ref = purchase_order.name;
                var link = window.location.origin + "/web#id=" + purchase_order['id'] + "&view_type=form&model=purchase.order";
                window.open(link, '_blank');
                if (purchase_order.error) {
                    self.pos.gui.show_popup('confirm', {
                        title: _t('Error'),
                        body: purchase_order.error
                    })
                }
                self.pos.gui.show_screen('receipt');
            }, function (error) {
                return self.pos.query_backend_fail(error);
            })
        }
    });
    gui.define_popup({
        name: 'popup_create_purchase_order',
        widget: popup_create_purchase_order
    });

    // TODO: return products from sale order
    var popup_stock_return_picking = PopupWidget.extend({
        template: 'popup_stock_return_picking',
        show: function (options) {
            var self = this;
            this.sale = options.sale;
            this.move_lines = this.pos.db.lines_sale_by_id[this.sale['id']];
            this._super(options);
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_128&id=';
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
            if (!this.move_lines) {
                return this.gui.show_popup('error', {
                    title: 'Error',
                    body: 'Order have not any lines'
                })
            }
            if (this.move_lines) {
                this.$el.find('tbody').html(qweb.render('stock_move_line', {
                    move_lines: self.move_lines,
                    image_url: image_url,
                    widget: self
                }));
                this.$('.line-select').click(function () {
                    var line_id = parseInt($(this).data('id'));
                    var line = self.pos.db.sale_line_by_id[line_id];
                    var checked = this.checked;
                    if (checked == false) {
                        for (var i = 0; i < self.move_lines.length; ++i) {
                            if (self.move_lines[i].id == line.id) {
                                self.move_lines.splice(i, 1);
                            }
                        }
                    } else {
                        self.move_lines.push(line);
                    }
                });
                this.$('.confirm').click(function () {
                    self.pos.gui.close_popup();
                    if (self.move_lines.length == 0) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Please select line for return'
                        })
                    }
                    if (self.sale.picking_ids.length == 0) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Sale order have not delivery order, could not made return'
                        })
                    }
                    if (self.sale.picking_ids.length > 1) {
                        return self.pos.gui.show_popup('dialog', {
                            title: 'Warning',
                            body: 'Sale order have delivery orders bigger than 2, could not made return'
                        })
                    }
                    if (self.sale.picking_ids.length == 1) {
                        return rpc.query({
                            model: 'stock.return.picking',
                            method: 'default_get',
                            args: [['product_return_moves', 'move_dest_exists', 'parent_location_id', 'original_location_id', 'location_id']],
                            context: {
                                active_ids: [self.sale.picking_ids[0]],
                                active_id: self.sale.picking_ids[0]
                            }
                        }).then(function (default_vals) {
                            var product_return_moves = default_vals['product_return_moves'];
                            var product_return_ids = [];
                            for (var i = 0; i < self.move_lines.length; i++) {
                                product_return_ids.push(self.move_lines[i]['product_id'][0])
                            }
                            if (product_return_moves) {
                                product_return_moves = _.filter(product_return_moves, function (move_return) {
                                    var product_index = _.findIndex(product_return_ids, function (id) {
                                        return id == move_return[2]['product_id'];
                                    });
                                    if (product_index != -1) {
                                        return true
                                    }
                                });
                                default_vals['product_return_moves'] = product_return_moves;
                                return rpc.query({
                                    model: 'stock.return.picking',
                                    method: 'create',
                                    args: [default_vals],
                                }).then(function (return_picking_id) {
                                    self.return_picking_id = return_picking_id;
                                    return rpc.query({
                                        model: 'stock.return.picking',
                                        method: 'create_returns',
                                        args: [[return_picking_id]],
                                    }).then(function (result) {
                                        return rpc.query({
                                            model: 'sale.order',
                                            method: 'action_validate_picking',
                                            args:
                                                [[self.sale['id']]],
                                            context: {
                                                pos: true
                                            }
                                        }).then(function (picking_name) {
                                            if (picking_name) {
                                                return self.pos.gui.show_popup('dialog', {
                                                    title: 'Succeed',
                                                    body: 'Return Delivery Order ' + picking_name + ' processed to Done',
                                                });
                                            } else {
                                                return self.pos.gui.show_popup('dialog', {
                                                    title: 'Warning',
                                                    body: 'Have not any delivery order of this sale order',
                                                });
                                            }
                                        }).catch(function (error) {
                                            return self.pos.query_backend_fail(error);
                                        })
                                    }).catch(function (error) {
                                        return self.pos.query_backend_fail(error);
                                    })
                                }).catch(function (error) {
                                    return self.pos.query_backend_fail(error);
                                })
                            }
                            return self.pos.gui.close_popup();
                        }).catch(function (error) {
                            return self.pos.query_backend_fail(error);
                        })
                    }
                });
            }
        }
    });
    gui.define_popup({
        name: 'popup_stock_return_picking',
        widget: popup_stock_return_picking
    });

    var popup_selection_tags = PopupWidget.extend({
        template: 'popup_selection_tags',
        show: function (options) {
            var self = this;
            this._super(options);
            var tags = [];
            if (options.tags) {
                tags = options.tags
            } else {
                tags = _.filter(this.pos.tags, function (tag) {
                    return !tag.is_return_reason
                });
            }
            this.tags_selected = {};
            var selected_orderline = options.selected_orderline;
            var tag_selected = selected_orderline['tags'];
            for (var i = 0; i < tags.length; i++) {
                var tag = _.findWhere(tag_selected, {id: tags[i].id});
                if (tag) {
                    self.tags_selected[tag.id] = tags[i];
                    tags[i]['selected'] = true
                } else {
                    tags[i]['selected'] = false
                }
            }
            self.$el.find('.body').html(qweb.render('tags_list', {
                tags: tags,
                widget: self
            }));

            self.$('.tag').click(function () {
                var tag_id = parseInt($(this).data('id'));
                var tag = self.pos.tag_by_id[tag_id];
                if (tag) {
                    if ($(this).closest('.tag').hasClass("item-selected") == true) {
                        $(this).closest('.tag').toggleClass("item-selected");
                        delete self.tags_selected[tag.id];
                        self.remove_tag_out_of_line(selected_orderline, tag)
                    } else {
                        $(this).closest('.tag').toggleClass("item-selected");
                        self.tags_selected[tag.id] = tag;
                        self.add_tag_to_line(selected_orderline, tag)
                    }
                }
            });
        },
        add_tag_to_line: function (line, tag_new) {
            if (!line.tags) {
                line.tags = []
            }
            line.tags.push(tag_new);
            line.trigger('change', line);
            line.trigger_update_line();
        },
        remove_tag_out_of_line: function (line, tag_new) {
            var tag_exist = _.filter(line.tags, function (tag) {
                return tag['id'] !== tag_new['id'];
            });
            line.tags = tag_exist;
            line.trigger('change', line);
            line.trigger_update_line();
        }
    });
    gui.define_popup({name: 'popup_selection_tags', widget: popup_selection_tags});

    var popup_print_receipt = PopupWidget.extend({
        template: 'popup_print_receipt',
        show: function (options) {
            options = options || {};
            this.options = options;
            this._super(options);
            var contents = this.$el[0].querySelector('.xml');
            var tbody = document.createElement('tbody');
            tbody.innerHTML = options.xml;
            tbody = tbody.childNodes[1];
            contents.appendChild(tbody);
            var self = this;
            setTimeout(function () {
                self.pos.gui.close_popup();
            }, 5000);
        }
    });
    gui.define_popup({name: 'popup_print_receipt', widget: popup_print_receipt});

    var popup_add_order_line_note = PopupWidget.extend({
        template: 'popup_add_order_line_note',
        show: function (options) {
            var self = this;
            options = options || {};
            options.notes = this.pos.notes;
            this.options = options;
            this._super(options);
            this.renderElement();
            this.$('input,textarea').focus();
            this.$('.note').click(function () {
                var note_id = parseInt($(this).data('id'));
                var note = self.pos.note_by_id[note_id];
                self.pos.get_order().get_selected_orderline().set_line_note(note['name']);
                self.pos.gui.close_popup();
            });
        },
        click_confirm: function () {
            var value = this.$('input,textarea').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });
    gui.define_popup({name: 'popup_add_order_line_note', widget: popup_add_order_line_note});

    var popup_set_datetime = PopupWidget.extend({
        template: 'popup_set_datetime',
        show: function (options) {
            options = options || {};
            this.options = options;
            this._super(options);
            this.renderElement();
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
            this.$('input').focus();
        },
        click_confirm: function () {
            var value = this.$('input').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });
    gui.define_popup({name: 'popup_set_datetime', widget: popup_set_datetime});

    var popup_set_date = PopupWidget.extend({
        template: 'popup_set_date',
        show: function (options) {
            options = options || {};
            this.options = options;
            this._super(options);
            this.renderElement();
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
            this.$('input').focus();
        },
        click_confirm: function () {
            var value = this.$('input').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });
    gui.define_popup({name: 'popup_set_date', widget: popup_set_date});

    var popup_cross_selling = PopupWidget.extend({ // popup cross selling
        template: 'popup_cross_selling',
        show: function (options) {
            var self = this;
            this.options = options;
            this._super(options);
            var cross_items = options.cross_items;
            this.cross_items_selected = [];
            var image_url = window.location.origin + '/web/image?model=product.product&field=image_128&id=';
            this.$el.find('div.table-responsive').html(qweb.render('cross_item', {
                cross_items: cross_items,
                image_url: image_url,
                widget: this
            }));
            this.$('.combo-item').click(function () {
                var cross_item_id = parseInt($(this).data('id'));
                var cross_item = self.pos.cross_item_by_id[cross_item_id];
                if (cross_item) {
                    if ($(this).closest('.combo-item').hasClass("item-selected") == true) {
                        $(this).closest('.combo-item').toggleClass("item-selected");
                        self.cross_items_selected = _.filter(self.cross_items_selected, function (cross_item_selected) {
                            return cross_item_selected['id'] != cross_item['id']
                        })
                    } else {
                        $(this).closest('.combo-item').toggleClass("item-selected");
                        self.cross_items_selected.push(cross_item)
                    }

                }
            });
            this.$('.add_cross_selling').click(function () {
                var order = self.pos.get_order();
                if (self.cross_items_selected.length == 0) {
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Please click and choice product item')
                    });
                }
                if (order) {
                    self.pos.gui.show_popup('dialog', {
                        title: _t('Succeed'),
                        body: _t('Cross items selected just added to Order'),
                        color: 'success'
                    });
                    for (var i = 0; i < self.cross_items_selected.length; i++) {
                        var cross_item = self.cross_items_selected[i];
                        var product = self.pos.db.get_product_by_id(cross_item['product_id'][0]);
                        if (product) {
                            if (!product) {
                                continue
                            }
                            var price = cross_item['list_price'];
                            var discount = 0;
                            if (cross_item['discount_type'] == 'fixed') {
                                price = price - cross_item['discount']
                            }
                            if (cross_item['discount_type'] == 'percent') {
                                discount = cross_item['discount']
                            }
                            order.add_product(product, {
                                quantity: cross_item['quantity'],
                                price: price,
                                merge: false,
                            });
                            if (discount > 0) {
                                order.get_selected_orderline().set_discount(discount)
                            }
                        }
                    }
                }
                return true
            });
        }
    });
    gui.define_popup({name: 'popup_cross_selling', widget: popup_cross_selling});


    var popup_order_signature = PopupWidget.extend({
        template: 'popup_order_signature',
        init: function (parent, options) {
            this._super(parent, options);
        },
        show: function (options) {
            var self = this;
            this._super(options);
            this.signed = false;
            this.$(".pos_signature").jSignature();
            this.$(".pos_signature").bind('change', function (e) {
                self.signed = true;
            });
            this.$('.confirm').click(function () {
                if (!self.signed) {
                    return self.wrong_input('div[name="pos_signature"]', '(*) Please signature before confirm')
                }
                var order = self.pos.get_order();
                var sign_datas = self.$(".pos_signature").jSignature("getData", "image");
                if (sign_datas.length > 1) {
                    order.set_signature(sign_datas[1])
                }
                self.click_confirm();
            })
            this.$('.cancel').click(function () {
                self.click_cancel();
            })
        }
    });
    gui.define_popup({
        name: 'popup_order_signature',
        widget: popup_order_signature
    });

    var DialogPopUp = PopupWidget.extend({
        template: 'dialog',
        show: function (options) {
            this.show_notification(options.from, options.align, options.title, options.body, options.timer, options.color)
        },
        show_notification: function (from, align, title, body, timer, color) {
            if (!from) {
                from = 'right';
            }
            if (!align) {
                align = 'top';
            }
            if (!title) {
                title = 'Message'
            }
            if (!timer) {
                timer = 500;
            }
            if (!color) {
                color = 'danger'
            }
            if (!color) {
                var type = ['info', 'success', 'warning', 'danger', 'rose', 'primary'];
                var random = Math.floor((Math.random() * 6) + 1);
                color = type[random];
            }
            try {
                $.notify({
                    icon: "notifications",
                    message: "<b>" + title + "</b> - " + body

                }, {
                    type: color,
                    timer: timer,
                    placement: {
                        from: from,
                        align: align
                    }
                });
            } catch (e) {
                this.do_notify(title, body);
            }
            this.pos.gui.close_popup();
        }
    });
    gui.define_popup({name: 'dialog', widget: DialogPopUp});


    var alert_input = PopupWidget.extend({
        template: 'alert_input',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.renderElement();
            this.$('input').focus();
        },
        click_confirm: function () {
            var value = this.$('input').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        },
    });
    gui.define_popup({name: 'alert_input', widget: alert_input});


    var popup_set_guest = PopupWidget.extend({
        template: 'popup_set_guest',
        click_confirm: function () {
            var fields = {};
            this.$('.guest_field').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['guest']) {
                return this.wrong_input("input[name='guest']", "(*) Guest name is Blank");
            } else {
                this.passed_input("input[name='guest']")
            }
            if (!fields['guest_number']) {
                return this.wrong_input("input[name='number']", "(*) Guest Number is Blank");
            } else {
                this.passed_input("input[name='guest']")
            }
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, fields);
            }
        },
    });

    gui.define_popup({name: 'popup_set_guest', widget: popup_set_guest});

    var ask_password = PopupWidget.extend({
        template: 'ask_password',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.renderElement();
        },
        click_confirm: function () {
            var value = this.$('input').val();
            this.gui.close_popup();
            if (this.options.confirm) {
                this.options.confirm.call(this, value);
            }
        }
    });

    gui.define_popup({name: 'ask_password', widget: ask_password});

    _.each(gui.Gui.prototype.popup_classes, function (popup) {
        if (popup.name == 'packlotline') {
            var packlotline_widget = popup.widget;
            packlotline_widget.include({
                show: function (options) {
                    this._super(options);
                    var order = this.pos.get_order();
                    if (order) {
                        var selected_line = order.get_selected_orderline();
                        var lots = this.pos.lot_by_product_id[selected_line.product.id];
                        if (lots) {
                            var lots_auto_complete = [];
                            for (var i = 0; i < lots.length; i++) {
                                lots_auto_complete.push({
                                    value: lots[i]['name'],
                                    label: lots[i]['name']
                                })
                            }
                            var self = this;
                            var $input_lot = $('.packlot-lines  >input');
                            $input_lot.autocomplete({
                                source: lots_auto_complete,
                                minLength: this.pos.config.min_length_search,
                                select: function (event, item_selected) {
                                    if (item_selected && item_selected['item'] && item_selected['item']['value']) {
                                        var lot = self.pos.lot_by_name[item_selected['item']['value']];
                                        if (lot && lot.replace_product_public_price && lot.public_price) {
                                            self.lot_selected = lot;
                                            setTimeout(function () {
                                                self.click_confirm();
                                            }, 500)
                                        }
                                    }
                                }
                            });
                        }
                    }
                },
                click_confirm: function () {
                    this._super();
                    if (this.lot_selected) {
                        var order = this.pos.get_order();
                        var selected_line = order.get_selected_orderline();
                        selected_line.set_unit_price(this.lot_selected['public_price']);
                        selected_line.price_manually_set = true;
                        selected_line.trigger('change', selected_line);
                        order.trigger('change', order);
                    }
                },
            })
        }
        if (popup.name == 'alert') {
            popup.widget.include({
                // TODO: we force core pos 2 option click
                // TODO 1: replace click ".button.confirm" become "click .confirm"
                // TODO 2: replace click ".button.cancel"  become "click .cancel"
                events: {
                    'click .cancel': 'click_cancel',
                    'click .confirm': 'click_confirm',
                    'click .selection-item': 'click_item',
                    'click .input-button': 'click_numpad',
                    'click .mode-button': 'click_numpad',
                },
            })
        }
    });

    var popup_select_tax = PopupWidget.extend({
        template: 'popup_select_tax',
        show: function (options) {
            var self = this;
            this.options = options;
            this.line_selected = options.line_selected;
            var product = this.line_selected.get_product();
            var taxes_ids = product.taxes_id;
            this._super(options);
            var taxes = options.taxes;
            this.taxes_selected = [];
            for (var i = 0; i < taxes.length; i++) {
                var tax = taxes[i];
                var tax_selected = _.find(taxes_ids, function (tax_id) {
                    return tax_id == tax['id'];
                });
                if (tax_selected) {
                    tax.selected = true;
                    this.taxes_selected.push(tax);
                } else {
                    tax.selected = false;
                }
            }
            self.$el.find('div.body').html(qweb.render('taxes_list', {
                taxes: taxes,
                widget: this
            }));
            this.$('.tax-item').click(function () {
                var tax_id = parseInt($(this).data('id'));
                var tax = self.pos.taxes_by_id[tax_id];
                if (tax) {
                    if ($(this).closest('.left_button').hasClass("item-selected") == true) {
                        $(this).closest('.left_button').toggleClass("item-selected");
                        self.taxes_selected = _.filter(self.taxes_selected, function (tax_selected) {
                            return tax_selected['id'] != tax['id']
                        })
                    } else {
                        $(this).closest('.left_button').toggleClass("item-selected");
                        self.taxes_selected.push(tax)
                    }
                }
            });
            this.$('.cancel').click(function () {
                self.gui.close_popup();
            });
            this.$('.add_taxes').click(function () {
                var line_selected = self.line_selected;
                if (self.taxes_selected.length == 0) {
                    return self.wrong_input("div[class='body']", '(*) Please select one tax');
                }
                var tax_ids = _.pluck(self.taxes_selected, 'id');
                line_selected.set_taxes(tax_ids);
                return self.pos.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_select_tax', widget: popup_select_tax});

    var popup_select_variants = PopupWidget.extend({
        template: 'popup_select_variants',
        get_attribute_by_id: function (attribute_id) {
            return this.pos.product_attribute_by_id[attribute_id];
        },
        remove_variant_selected: function () {
            for (var n = 0; n < this.variants.length; n++) {
                this.variants[n]['selected'] = false;
            }
        },
        show: function (options) {
            var self = this;
            this._super(options);
            this.variants_selected = {};
            var variants = options.variants;
            self.variants = variants;
            var selected_orderline = options.selected_orderline;
            var variants_selected = selected_orderline['variants'];
            if (!variants_selected) {
                variants_selected = [];
                selected_orderline.variants = [];
            }
            var variants_by_product_attribute_id = {};
            var attribute_ids = [];
            for (var i = 0; i < variants.length; i++) {
                var variant = variants[i];
                var attribute_id = variant['attribute_id'][0];
                var attribute = this.pos.product_attribute_by_id[attribute_id];
                if (attribute_ids.indexOf(attribute_id) == -1) {
                    attribute_ids.push(attribute_id)
                }
                if (attribute) {
                    if (!variants_by_product_attribute_id[attribute_id]) {
                        variants_by_product_attribute_id[attribute_id] = [variant];
                    } else {
                        variants_by_product_attribute_id[attribute_id].push(variant);
                    }
                }
            }
            if (variants_selected.length != 0) {
                for (var i = 0; i < variants.length; i++) {
                    var variant = _.findWhere(variants_selected, {id: variants[i].id});
                    if (variant) {
                        self.variants_selected[variant.id] = variant;
                        variants[i]['selected'] = true
                    } else {
                        variants[i]['selected'] = false
                    }
                }
            }
            var image_url = window.location.origin + '/web/image?model=product.template&field=image_128&id=';
            self.$el.find('div.card-content').html(qweb.render('attribute_variant_list', {
                attribute_ids: attribute_ids,
                variants_by_product_attribute_id: variants_by_product_attribute_id,
                image_url: image_url,
                widget: self
            }));

            this.$('.line-select').click(function () {
                var variant_id = parseInt($(this).data('id'));
                var variant = self.pos.variant_by_id[variant_id];
                if (variant) {
                    if ($(this).closest('.line-select').hasClass("item-selected") == true) {
                        $(this).closest('.line-select').toggleClass("item-selected");
                        delete self.variants_selected[variant.id];
                    } else {
                        $(this).closest('.line-select').toggleClass("item-selected");
                        self.variants_selected[variant.id] = variant;

                    }
                }
            });
            this.$('.confirm').click(function () {
                var variant_ids = _.map(self.variants_selected, function (variant) {
                    return variant.id;
                });
                var order = self.pos.get_order();
                if (!order) {
                    return
                }
                var selected_line = order.get_selected_orderline();
                if (variants.length == 0) {
                    return self.wrong_input("div[class='body']", '(*) No variants select, please select one variant and back to confirm')
                }
                if (selected_line) {
                    selected_line.set_variants(variant_ids);
                }
                self.pos.gui.close_popup();
            });
            this.$('.cancel').click(function () {
                self.remove_variant_selected();
                self.pos.gui.close_popup();
            });
            this.$('.remove_variants_selected').click(function () {
                var selected_orderline = self.pos.get_order().selected_orderline;
                if (!selected_orderline) {
                    return self.gui.show_popup('dialog', {
                        title: 'Warning !',
                        body: _t('Please select line'),
                    });
                } else {
                    selected_orderline.set_variants([])
                }
                self.remove_variant_selected();
                self.pos.gui.close_popup();
                self.pos.gui.show_popup('dialog', {
                    title: _t('Succeed'),
                    body: _t('All variants removed'),
                    color: 'success'
                })
            })
        }
    });
    gui.define_popup({
        name: 'popup_select_variants',
        widget: popup_select_variants
    });
});
