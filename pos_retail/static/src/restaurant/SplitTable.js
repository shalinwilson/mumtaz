odoo.define('pos_retail.SplitTable', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var models = require('point_of_sale.models');
    var PopupWidget = require("point_of_sale.popups");
    var gui = require('point_of_sale.gui');
    var _t = core._t;
    var QWeb = core.qweb;

    var PopUpSplitTableWidget = PopupWidget.extend({
        template: 'PopUpSplitTableWidget',
        previous_screen: 'products',

        check_table_ordered: function(table_id) {
            var orders = this.pos.get('orders').models
            for (var i=0; i < orders.length; i ++) {
                var order = orders[i];
                if (order.table && order.table.id == table_id) {
                    return order
                }
            }
            return null;
        },
        renderElement: function(){
            var self = this;
            this._super();
            this.$('.button.cancel').click(function(){
                self.gui.show_screen(self.previous_screen);
                $('.modal-dialog').addClass('oe_hidden');
            });
            var current_order = this.pos.get('selectedOrder');
            if (current_order != null) {
                var current_table = current_order.table
                var current_lines = current_order.get_orderlines();
                var tables = this.pos.tables_by_id;
                var tables_show = [];
                for (tb_index in tables) {
                    if (current_table != null && current_table != undefined && current_table.id == tables[tb_index].id) {
                        continue
                    } else {
                        tables_show.push(tables[tb_index]);
                    }
                }
                for (var i=0; i < current_lines.length; i ++) {
                    var line = current_lines[i];
                    var linewidget = $(QWeb.render('ProductMoveRecord',{
                        widget: this,
                        line: line,
                        tables: tables_show,
                    }));
                    linewidget.data('id', line.id);
                    this.$('.product-list').append(linewidget);
                }
                this.$('.client-line .submit').click(function() {
                    var line_id = parseInt($(this).parent().parent().data('id'));
                    var table_id = parseInt($(this).parent().parent().find('.control-button')[0].value);
                    var quantity = parseInt($(this).parent().parent().find('.control-button')[1].value);
                    var order_uid = $(this).parent().parent().find('.control-button')[2].value;
                    self.moving_product(line_id, table_id, quantity, order_uid, $(this));
                });
            }
        },
        moving_product: function(line_id, table_id, quantity, order_uid, button_element) {
            if (!table_id) {
                this.gui.show_popup('error',{
                    message: _t('Please select table'),
                });
                return;
            }
            var ordered = this.check_table_ordered(table_id);
            var table = this.pos.tables_by_id[table_id];
            //------------- *** transfer to new table *** -----------------//
            if (ordered == null) {
                var from_order = this.pos.get('selectedOrder');
                var to_order = new models.Order({},{
                    pos: this.pos,
                });
                to_order.table = table;
                this.pos.get('orders').add(to_order);
                var from_line = from_order.get_orderlines().find(function (line) {
                    return line.id == line_id;
                });
                if (from_line) {
                    var product = this.pos.db.get_product_by_id(from_line.product.id);
                    to_order.moving_product = true;
                    to_order.add_product(product, {
                        price: from_line.price,
                        quantity: quantity,
                        discount: from_line.discount,
                    });
                    var selectedLine = to_order.get_selected_orderline();
                    selectedLine['syncBackEnd'] = from_line.syncBackEnd;
                    selectedLine.state = from_line.state;
                    if (from_line.quantity <= quantity) {
                        from_order.remove_orderline(from_line);
                    } else {
                        from_line.set_quantity(from_line.quantity - quantity);
                    }
                }
                to_order.trigger('change', to_order);
            //------------- *** transfer to old ordered before *** -----------------//
            } else {
                var transfer_to_order = ordered;
                var old_order = this.pos.get('selectedOrder');
                var old_lines = old_order.get_orderlines()
                var line_move = old_lines.find(function (line) {
                    return line.id == line_id
                });

                if (line_move) {
                    var product = this.pos.db.get_product_by_id(line_move.product.id);
                    transfer_to_order.moving_product = true;
                    transfer_to_order.add_product(product, {
                        price: line_move.price,
                        quantity: quantity,
                        discount: line_move.discount,
                    })
                    var selectedLine = transfer_to_order.get_selected_orderline();
                    selectedLine['syncBackEnd'] = line_move.syncBackEnd;
                    selectedLine.state = line_move.state;
                    if (line_move.quantity <= quantity) {
                        old_order.remove_orderline(line_move);
                    } else {
                        line_move.set_quantity(line_move.quantity - quantity);
                    }
                }
                transfer_to_order.trigger('change', transfer_to_order);
            }
            button_element.parent().parent().hide();
        },
    });

    gui.define_popup({name:'split_table', widget: PopUpSplitTableWidget});

});
