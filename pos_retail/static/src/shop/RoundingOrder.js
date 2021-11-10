odoo.define('pos_retail.rounding_order', function (require) {
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        get_total_with_tax: function () {
            var total_with_tax = _super_order.get_total_with_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding) {
                total_with_tax = round_pr(total_with_tax, this.pos.config.rounding);
            }
            return total_with_tax
        },
        get_total_without_tax: function () {
            var total_without_tax = _super_order.get_total_without_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding) {
                total_without_tax = round_pr(total_without_tax, this.pos.config.rounding);
            }
            return total_without_tax
        },
        get_total_discount: function () {
            var total_discount = _super_order.get_total_discount.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding) {
                total_discount = round_pr(total_discount, this.pos.config.rounding);
            }
            return total_discount
        },
        get_total_tax: function () {
            var total_tax = _super_order.get_total_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding) {
                total_tax = round_pr(total_tax, this.pos.config.rounding);
            }
            return total_tax
        },
        get_total_paid: function () {
            var total_paid = _super_order.get_total_paid.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding) {
                total_paid = round_pr(total_paid, this.pos.config.rounding);
            }
            return total_paid
        },
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        get_price_with_tax: function () {
            var price_subtotal_incl = _super_Orderline.get_price_with_tax.apply(this, arguments);
            if (this.pos.config.allow_auto_rounding) {
                price_subtotal_incl = round_pr(price_subtotal_incl, this.pos.config.rounding);
            }
            return price_subtotal_incl;
        },
    });


});
