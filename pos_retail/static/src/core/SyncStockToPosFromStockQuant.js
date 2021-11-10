odoo.define('pos_retail.sync_stock', function (require) {
    var models = require('point_of_sale.models');
    var rpc = require('pos.rpc');
    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');

    // exports.pos_sync_stock = Backbone.Model.extend({
    //     initialize: function (pos) {
    //         this.pos = pos;
    //         this.pos.product_ids_need_update_stock = [];
    //     },
    //     start: function () {
    //         this.bus = bus.bus;
    //         this.bus.last = this.pos.db.load('bus_last', 0);
    //         this.bus.on("notification", this, this.on_notification);
    //         this.bus.start_polling();
    //     },
    //     on_notification: function (notifications) {
    //         if (notifications && notifications[0] && notifications[0][1]) {
    //             for (var i = 0; i < notifications.length; i++) {
    //                 var channel = notifications[i][0][1];
    //                 if (channel == 'pos.sync.stock') {
    //                     var product_ids = JSON.parse(notifications[i][1])['product_ids'];
    //                     for (var j = 0; j < product_ids.length; j++) {
    //                         if (this.pos.product_ids_need_update_stock.indexOf(product_ids[j]) == -1) {
    //                             this.pos.product_ids_need_update_stock.push(product_ids[j]);
    //                         }
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // });

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_posmodel.load_server_data.apply(this, arguments).then(function () {
                if (self.config.display_onhand && self.config.update_stock_onhand_realtime) {
                    // self.pos_sync_stock = new exports.pos_sync_stock(self);
                    // self.pos_sync_stock.start();
                    self._automatic_update_stock_products();
                }
                return true;
            })
        },
        // TODO: pos session auto scan variable product_ids_need_update_stock, if have length auto call backend get new stock on hand
        _automatic_update_stock_products: function () {
            console.log('{SyncStockToPosFromStockQuant} _automatic_update_stock_products()');
            this._do_update_quantity_onhand([])
            setTimeout(_.bind(this._automatic_update_stock_products, this), 30000);
        },
        _do_update_quantity_onhand: function (product_ids) {
            var self = this;
            var location_selected = this.get_picking_source_location();
            console.log('{SyncStockToPosFromStockQuant.js} _do_update_quantity_onhand of Location: ' + location_selected.name);
            if (product_ids.length == 0) {
                var products = this.db.get_product_by_category(0);
                var products_type_product = _.filter(products, function (product) {
                    return product.type == 'product';
                });
                if (products_type_product.length) {
                    product_ids = _.pluck(products_type_product, 'id');
                }
            }
            if (product_ids.length == 0) {
                return true
            }
            return this._get_stock_on_hand_by_location_ids(product_ids, [location_selected.id]).then(function (stock_datas) {
                var products = [];
                var datas = stock_datas[self.get_picking_source_location().id];
                if (!datas) {
                    return;
                }
                for (var product_id in datas) {
                    var product = self.db.product_by_id[product_id];
                    if (product) {
                        products.push(product);
                        var qty_available = datas[product_id];
                        self.db.stock_datas[product['id']] = qty_available;
                    }
                }
                if (products.length) {
                    self.auto_update_stock_products(products);
                }
                self.product_ids_need_update_stock = [];
            })
        },
    });

});
