odoo.define('pos_retail.pricelist_widget', function (require) {
    "use strict";
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var _t = require('web.core')._t;

    var PriceListWidget = PosBaseWidget.extend({
        template: 'PriceListWidget',
        init: function (parent) {
            this._super(parent);
        },
        start: function () {
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.service').click(_.bind(this.clickAppendNewChar, this));
        },
        clickDeleteLastChar: function () {
            $('.pricelist-list').replaceWith();
        },
        clickAppendNewChar: function (event) {
            var order = this.pos.get_order();
            var pricelist_id = parseInt(event.currentTarget.getAttribute('id'));
            var pricelist = this.pos.pricelist_by_id[pricelist_id];
            order.set_pricelist(pricelist);
        },
    });

    return PriceListWidget;
});
