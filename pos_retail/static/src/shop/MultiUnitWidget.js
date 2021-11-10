odoo.define('pos_retail.multi_unit', function (require) {
    "use strict";
    var PosBaseWidget = require('point_of_sale.BaseWidget');

    var MultiUnitWidget = PosBaseWidget.extend({
        template: 'MultiUnitWidget',
        init: function (parent, options) {
            this.uom_items = options.uom_items;
            this.selected_line = options.selected_line;
            this.uom_item_by_id = {};
            for (var i=0; i < this.uom_items.length; i++) {
                var uom_item = this.uom_items[i];
                this.uom_item_by_id[uom_item.uom_id[0]] = uom_item;
            }
            this._super(parent, options);
        },
        start: function () {
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.service').click(_.bind(this.clickAppendNewChar, this));
        },
        clickDeleteLastChar: function () {
            $('.uom-list').replaceWith();
        },
        clickAppendNewChar: function (event) {
            var uom_item_id = parseInt(event.currentTarget.getAttribute('id'));
            var uom_item = this.uom_item_by_id[uom_item_id];
            this.selected_line.set_unit(uom_item.uom_id[0], uom_item.price)
        },
    });

    return MultiUnitWidget;
});
