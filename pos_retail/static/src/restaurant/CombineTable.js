odoo.define('pos_retail.CombineTable', function (require) {
    var screens = require('point_of_sale.screens');
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var _t = core._t;

    var PopUpMergeTables = PopupWidget.extend({
        template: 'PopUpMergeTables',

        show: function (options) {
            var tables = [];
            var orders = this.pos.get('orders').models;
            var current_order = this.pos.get('selectedOrder');
            if (current_order && orders.length) {
                for (var i=0; i < orders.length; i ++) {
                    if (current_order.uid != orders[i].uid) {
                        if (orders[i].table) {
                            tables.push(orders[i].table);
                        }
                    }
                }
            }
            this.tables = tables;
            this._super(options);
            var self = this;
            this.tables_seleted = {}
            this.$('.product').click(function () {
                var table_id = parseInt($(this).data('id'));
                var table = self.pos.tables_by_id[table_id];
                if (table) {
                    if ($(this).closest('.product').hasClass("table-selected") == true) {
                        $(this).closest('.product').toggleClass("table-selected");
                        delete self.tables_seleted[table_id];
                    } else {
                        $(this).closest('.product').toggleClass("table-selected");
                        self.tables_seleted[table_id] = table;
                    }
                }
            });
            this.$('.confirm').click(function () {
                if (self.tables_seleted) {
                    for (table_id in self.tables_seleted) {
                        var table = self.tables_seleted[table_id];
                        var order = orders.find(function (order) {
                            if (order.table) {
                                return order.table.id == table.id;
                            }
                        })
                        if (order) {
                            for (var j=0; j < order.orderlines.models.length; j++) {
                                var line = order.orderlines.models[j];
                                current_order.add_product(line.product, {
                                    price: line.price,
                                    quantity: line.quantity,
                                    discount: line.discount,
                                })
                            }
                            order.destroy({'reason':'abandon'});
                        }
                    }
                    self.$('.cancel').click()
                } else {
                    self.show();
                }
            })
        },
    });
    gui.define_popup({name:'PopUpMergeTables', widget: PopUpMergeTables});
});
