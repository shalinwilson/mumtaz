"use strict";
odoo.define('pos_retail.multi_lots', function (require) {
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var screens = require('point_of_sale.screens');
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var _t = core._t;

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            _super_PosModel.initialize.apply(this, arguments);
            var self = this;
            this.bind('update:sync_pos_pack_operation_lot', function (pos) {
                self.sync_pos_pack_operation_lot()
            });
        },
        sync_pos_pack_operation_lot: function () {
            var pos_pack_operation_lot_model = _.filter(this.models, function (model) {
                return model.model == 'pos.pack.operation.lot'
            });
            if (pos_pack_operation_lot_model) {
                for (var i = 0; i < pos_pack_operation_lot_model.length; i++) {
                    var model = pos_pack_operation_lot_model[i];
                    this.load_server_data_by_model(model);
                }
            }
        },
        sync_stock_production_lot: function () {
            var stock_production_lot_model = _.filter(this.models, function (model) {
                return model.lot
            });
            if (stock_production_lot_model) {
                for (var i = 0; i < stock_production_lot_model.length; i++) {
                    var model = stock_production_lot_model[i];
                    this.load_server_data_by_model(model);
                }
            }
        }
    });
    var popup_create_lots = PopupWidget.extend({
        template: 'popup_create_lots',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .lot-add': 'add_new_lot',
            'click .lot-delete': 'delete_lot'
        }),
        show: function (options) {
            this.options = options;
            var products = this.pos.db.get_product_by_category(0);
            var products_tracking_lot = _.filter(products, function (product) {
                return product.tracking == 'lot';
            });
            this.products = products_tracking_lot;
            this._super(options);
            this.$('.lot-add').click();
            var self = this;
            this.$('.confirm').click(function () {
                self.click_confirm()
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
            this.pos.gui.screen_instances.products.product_list_widget.set_product_list(products_tracking_lot);
        },
        click_confirm: function () {
            var fields = {};
            var self = this;
            var is_valid = true;
            this.$('.lot_input').each(function (idx, el) {
                if (!fields[el.id]) {
                    fields[el.id] = {};
                }
                if (el.name == 'name') {
                    fields[el.id]['name'] = el.value || '';
                    if (el.value == "") {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='name']", '(*) Serial/Number is required');
                    } else {
                        self.passed_input("input[id=" + el.id + "][name='name']");
                    }
                    var name_lot_is_exist = self.pos.lot_by_name[el.value];
                    if (name_lot_is_exist) {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='name']", '(*) Serial/Number unique ' + el.value + ', this serial have exist');
                    } else {
                        self.passed_input("input[id=" + el.id + "][name='name']");
                    }
                }
                if (el.name == 'product_id') {
                    fields[el.id]['product_id'] = parseInt(el.value)
                }
                if (el.name == 'quantity') {
                    var quantity = parseFloat(el.value) || 0;
                    fields[el.id]['quantity'] = parseFloat(el.value) || 0;
                    if (quantity <= 0) {
                        is_valid = false;
                        return self.wrong_input("input[id=" + el.id + "][name='quantity']", '(*) Quantity required bigger than 0');
                    } else {
                        self.passed_input("input[id=" + el.id + "][name='quantity']");
                    }
                }
            });
            if (is_valid) {
                var lots = [];
                for (var index in fields) {
                    fields[index]['company_id'] = this.pos.company.id;
                    fields[index]['location_id'] = this.pos.get_picking_source_location()['id'];
                    lots.push(fields[index]);
                }
                if (lots.length) {
                    this.pos.gui.close_popup();
                    if (this.options.confirm) {
                        this.options.confirm.call(this, lots);
                    }
                } else {
                    return self.wrong_input("table[class='client-list']", '(*) Please input lots list');
                }
            }
        },
        _render_products_select: function() {
            var options = "";
            for (var i=0; i < this.products.length; i++) {
                var product = this.products[i];
                options += "<option value='" + product.id + "'>" + product.display_name + "</option>";
            }
            return options

        },
        add_new_lot: function (e) {
            var table = document.getElementById('lots_tree');
            var rowCount = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr").length;

            var newRow = table.insertRow(rowCount);
            var row = rowCount - 1;
            newRow.id = row;

            var col0html = "<input class='input_required lot_input' name='name' type='text'" + "id='" + row + "'" + ">" + "</input>";
            var col1html = "<select class='form-control voucher-select input_required lot_input' name='product_id' id='" + row + "'>";
            col1html += this._render_products_select();
            col1html += "</select>";
            var col2html = "<input class='input_required lot_input' name='quantity' type='number'" + "id='" + row + "'" + ">" + "</input>";
            var col3html = "<span class='lot-delete fa fa-trash-o' name='delete'/>";

            var col0 = newRow.insertCell(0);
            col0.innerHTML = col0html;
            var col1 = newRow.insertCell(1);
            col1.innerHTML = col1html;
            var col2 = newRow.insertCell(2);
            col2.innerHTML = col2html;
            var col3 = newRow.insertCell(3);
            col3.innerHTML = col3html;

        },
        delete_lot: function (e) {
            var tr = $(e.currentTarget).closest('tr');
            var record_id = tr.find('td:first-child').text();
            if (parseInt(record_id))
                tr.find("td:not(:first)").remove();
            else
                tr.find("td").remove();
            tr.hide();
        }
    });
    gui.define_popup({name: 'popup_create_lots', widget: popup_create_lots});

    var button_create_lots = screens.ActionButtonWidget.extend({
        template: 'button_create_lots',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var self = this;
            if (!this.pos.config.stock_location_id) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Your POS Config not Setting Stock Location')
                })
            }

            this.gui.show_popup('popup_create_lots', {
                title: _t('Create Lot/Serial'),
                body: _t('Name/Serial is unique, quantity required bigger than 0 and product required select not input manual'),
                confirm: function (lots) {
                    var lot_model = self.pos.get_model('stock.production.lot');
                    return rpc.query({
                        model: 'stock.production.lot',
                        method: 'pos_create_lots',
                        args: [[], lots, lot_model.fields, self.pos.config.name, self.pos.config.stock_location_id[0]],
                        context: {}
                    }).then(function (lots) {
                        self.pos.sync_stock_production_lot();
                        self.pos.lots_cache = [];
                        var lots_name_created = '';
                        for (var i = 0; i < lots.length; i++) {
                            if (i == lots.length) {
                                lots_name_created += lots[i]['name']
                            } else {
                                lots_name_created += lots[i]['name'] + ','
                            }
                        }
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Great Job'),
                            body: _t(lots_name_created + ' created at backend. You can use this lots now'),
                        })
                    }, function (err) {
                        return self.pos.query_backend_fail(err);
                    })
                }
            })
        }
    });
    screens.define_action_button({
        'name': 'button_create_lots',
        'widget': button_create_lots,
        'condition': function () {
            return this.pos.config.create_lots;
        }
    });

    var popup_set_multi_lots = PopupWidget.extend({
        template: 'popup_set_multi_lots',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .lot-add': 'add_new_lot',
            'click .lot-delete': 'delete_lot'
        }),
        show: function (options) {
            var self = this;
            this.pos.sync_stock_production_lot();
            if (options && options.selected_orderline) {
                options.lot_ids = options.selected_orderline.lot_ids;
            } else {
                options.lot_ids = [];
            }
            this.options = options;
            this.lots = this.options.lots;
            this._super(options);
            this.$('.confirm').click(function () {
                self.click_confirm()
            });
            this.$('.cancel').click(function () {
                self.click_cancel();
            });
        },
        click_confirm: function () {
            var fields = {};
            var total_quantity = 0;
            var selected_line = this.options.selected_orderline;
            this.$('.lot_input').each(function (idx, el) {
                if (!fields[el.id]) {
                    fields[el.id] = {};
                }
                if (el.name == 'lot_quantity') {
                    var qty = parseFloat(el.value) || null || 0;
                    if (qty <= 0) {
                        return self.wrong_input("div[class='lots-grid']", "(*) It not possible set quantity of Lot smaller than or equal 0");
                    }
                    total_quantity += qty;
                    fields[el.id]['quantity'] = qty;

                }
                if (el.name == 'lot_id') {
                    fields[el.id]['id'] = parseInt(el.value) || null
                }
            });
            if (total_quantity > selected_line['quantity']) {
                return this.wrong_input("div[class='lots-grid']", "(*) Total quantity of lots could not bigger than quantity of line selected");
            }
            this.pos.gui.close_popup();
            if (this.options.confirm) {
                var lots = [];
                for (var index in fields) {
                    lots.push(fields[index])
                }
                if (lots.length > 1 && this.options.selected_orderline.bom) {
                    return this.wrong_input("div[class='lots-grid']", "(*) it not possible set multi lot for product have bom added, 1 bom only allow 1 lot each line");
                }
                this.options.confirm.call(this, lots);
            }
        },
        add_new_lot: function (e) {
            var table = document.getElementById('lots_list');
            var rowCount = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr").length;

            var newRow = table.insertRow(rowCount);
            var row = rowCount - 1;
            newRow.id = row;

            var col0html = "<select style='margin-top: 7px; width: 100%;height: 40px; border-radius: 3px' class='input_required form-control voucher-select lot_input' name='lot_id'" + "id='" + row + "'" + ">";
            for (var i = 0; i < this.lots.length; i++) {
                var lot = this.lots[i];
                col0html += "<option value=" + lot.id + ">";
                col0html += lot.name;
                if (lot.barcode) {
                    col0html += '[Ean13]:' + lot.barcode;
                }
                col0html += "</option>"
            }
            col0html += "</select>";
            var col1html = "<input style='margin-top: 7px; width: 100%' class='input_required lot_input'" + " name='lot_quantity'" + " type='number'" + "id='" + row + "'" + ">" + "</input>";
            var col2html = "<span class='lot-delete fa fa-trash-o' name='delete'/>";

            var col0 = newRow.insertCell(0);
            col0.innerHTML = col0html;
            var col1 = newRow.insertCell(1);
            col1.innerHTML = col1html;
            var col2 = newRow.insertCell(2);
            col2.innerHTML = col2html;

        },
        delete_lot: function (e) {
            var tr = $(e.currentTarget).closest('tr');
            var record_id = tr.find('td:first-child').text();
            if (parseInt(record_id))
                tr.find("td:not(:first)").remove();
            else
                tr.find("td").remove();
            tr.hide();
        }
    });
    gui.define_popup({name: 'popup_set_multi_lots', widget: popup_set_multi_lots});
});
