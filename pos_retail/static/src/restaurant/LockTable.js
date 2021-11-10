odoo.define('pos_retail.LockTable', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('pos.rpc');

    var ButtonLockTable = screens.ActionButtonWidget.extend({
        template: 'ButtonLockTable',
        lock_order: function (order) {
            var self = this;
            if (order && order.table) {
                this.pos.table_click = order.table;
                var table_will_lock = _.find(this.pos.gui.screen_instances['floors'].floor.tables, function (tb) {
                    return tb.id == self.pos.table_click.id
                })
                if (table_will_lock) {
                    table_will_lock.locked = true;
                }
                rpc.query({
                    model: 'restaurant.table',
                    method: 'lock_table',
                    args: [[order.table.id], {
                        'locked': true,
                    }],
                }).then(function () {
                    self.pos.set_order(null);
                    self.gui.show_screen('floors');
                })
            }
            if (this.pos.pos_bus) {
                this.pos.pos_bus.send_notification({
                    data: {
                        order: order.export_as_JSON(),
                        table_id: order.table.id,
                        order_uid: order.uid,
                        lock: true,
                    },
                    action: 'lock_table',
                    order_uid: order.uid,
                })
            }
        },
        button_click: function () {
            var self = this;
            this.gui.show_popup('selection', {
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
                        return self.lock_order(order)
                    } else {
                        for (var i = 0; i < self.pos.get('orders').models.length; i++) {
                            self.lock_order(self.pos.get('orders').models[i])
                        }
                    }
                }
            })
        }
    });
    screens.define_action_button({
        'name': 'ButtonLockTable',
        'widget': ButtonLockTable,
        'condition': function () {
            return this.pos.tables && this.pos.tables.length > 0 && this.pos.config.allow_lock_table == true;
        },
    });
});
