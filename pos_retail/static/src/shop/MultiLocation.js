odoo.define('pos_retail.multi_locations', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var qweb = core.qweb;
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');

    var ButtonSetPickingTypeOrder = screens.ActionButtonWidget.extend({
        template: 'ButtonSetPickingTypeOrder',
        init: function (parent, options) {
            this._super(parent, options);
            this.pos.bind('change:selectedOrder', function () {
                this.renderElement();
            }, this);
            this.pos.bind('set.picking.type', function () {
                this.renderElement();
            }, this);
        },
        get_order_operation_type: function () {
            var order = this.pos.get_order();
            var picking_type = this.pos.stock_picking_type_by_id[this.pos.config.picking_type_id[0]];
            if (!order) {
                return picking_type
            } else {
                if (order.picking_type) {
                    return order.picking_type
                } else {
                    return picking_type
                }
            }
        },
        button_click: function () {
            var list = [];
            var self = this;
            for (var i = 0; i < this.pos.stock_picking_types.length; i++) {
                var stock_picking_type = this.pos.stock_picking_types[i];
                if (stock_picking_type.default_location_src_id) {
                    list.push({
                        'label': stock_picking_type['name'] + ', Default Source Location: ' + stock_picking_type['default_location_src_id'][1],
                        'item': stock_picking_type
                    });
                }
            }
            return self.pos.gui.show_popup('selection', {
                title: _t('Please select one Stock Operation Type'),
                list: list,
                confirm: function (stock_picking_type) {
                    var order = self.pos.get_order();
                    order.set_picking_type(stock_picking_type.id);
                    self.set_location(stock_picking_type.default_location_src_id[0])
                }
            })
        },
        set_location: function (location_id) {
            var self = this;
            var location = self.pos.stock_location_by_id[location_id];
            var order = self.pos.get_order();
            if (location && order) {
                order.set_picking_source_location(location);
            }
            return self.pos._get_stock_on_hand_by_location_ids([], [location_id]).then(function (stock_datas_by_location_id) {
                self.pos.stock_datas_by_location_id = stock_datas_by_location_id;
                var location = self.pos.get_picking_source_location();
                var datas = stock_datas_by_location_id[location.id];
                var products = [];
                self.pos.db.stock_datas = datas;
                for (var product_id in datas) {
                    var product = self.pos.db.product_by_id[product_id];
                    if (product) {
                        product['qty_available'] = datas[product_id];
                        products.push(product)
                    }
                }
                if (products.length) {
                    self.pos.auto_update_stock_products(products);
                    self.pos.gui.screen_instances["products_operation"].refresh_screen();
                }
                return self.gui.show_popup('dialog', {
                    title: _t('Succeed'),
                    body: _t('Delivery Order of Selected Order will set Source Location from ' + location.name),
                    color: 'success'
                });
            })
        }
    });
    screens.define_action_button({
        'name': 'ButtonSetPickingTypeOrder',
        'widget': ButtonSetPickingTypeOrder,
        'condition': function () {
            return this.pos.config.multi_stock_operation_type;
        }
    });

    var ButtonUpdateStockOnHand = screens.ActionButtonWidget.extend({
        template: 'ButtonUpdateStockOnHand',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('stock:update', function () {
                self.renderElement();
            });
        },
        get_active_mode_update_stock: function () {
            return this.pos.update_stock_active;
        },
        get_count_products_out_of_stock: function () {
            var stock_datas = this.pos.db.stock_datas;
            var total_products_out_of_stock = 0;
            for (var product_id in stock_datas) {
                if (stock_datas[product_id] <= 0) {
                    total_products_out_of_stock += 1
                }
            }
            return total_products_out_of_stock
        },
        button_click: function () {
            if (this.pos.update_stock_active) {
                this.pos.update_stock_active = false;
                var products = this.pos.db.get_product_by_category(0);
                if (products.length > 0) {
                    this.pos.gui.screen_instances.products.product_list_widget.set_product_list(products);
                }
                return this.renderElement()
            }
            var self = this;
            var order = this.pos.get_order();
            if (!order) {
                return this.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('Have not order selected, please select order')
                })
            }
            var products = this.pos.db.get_product_by_category(0);
            var products_outof_stock = _.filter(products, function (product) {
                return product.type == 'product';
            });
            if (products_outof_stock.length > 0) {
                this.pos.gui.screen_instances.products.product_list_widget.set_product_list(products_outof_stock);
            }
            var count_products_out_of_stock = this.get_count_products_out_of_stock();
            if (count_products_out_of_stock >= 0) {
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Have ' + count_products_out_of_stock + ' products out of Stock, you can click Product and Update Stock on hand')
                })
            } else {
                this.pos.gui.show_popup('dialog', {
                    title: _t('Alert'),
                    body: _t('Have not any products out of Stock')
                })
            }
            this.pos.update_stock_active = true;
            this.renderElement()
        }
    });
    screens.define_action_button({
        'name': 'ButtonUpdateStockOnHand',
        'widget': ButtonUpdateStockOnHand,
        'condition': function () {
            return this.pos.config.multi_location && this.pos.config.update_stock_onhand;
        }
    });
});