odoo.define('pos_retail.discount_widget', function (require) {
    "use strict";
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;

    var DiscountWidget = PosBaseWidget.extend({
        template: 'DiscountWidget',
        init: function (parent) {
            this._super(parent);
        },
        start: function () {
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.discount').click(_.bind(this.clickAppendNewChar, this));
        },
        clickDeleteLastChar: function () {
            $('.discount-list').addClass('oe_hidden');
        },
        clickAppendNewChar: function (event) {
            var order = this.pos.get_order();
            if (!order || order.orderlines.length == 0) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Your shopping cart is empty'),
                })
            }
            var discount_id = parseInt(event.currentTarget.getAttribute('id'));
            event.currentTarget.getAttribute('id')
            var discount = _.find(this.pos.discounts, function (disc) {
                return disc.id == discount_id
            });
            if (discount_id != 0 && discount && order.orderlines.length) {
                order.add_global_discount(discount)
            }
            if (discount_id == 0 && order) {
                order.add_global_discount({
                    type: 'percent',
                    amount: 0
                })
                order.add_global_discount({
                    type: 'fixed',
                    amount: 0
                })
            }
        },
    });

    screens.NumpadWidget.include({
        init: function (parent) {
            var self = this;
            this._super(parent);
            if (this.pos.config.discount) {
                this.pos.bind('open:discounts', function () {
                    self.open_discounts();
                });
            }
        },
        open_discounts: function () {
            $('.control-buttons-extend').empty();
            $('.control-buttons-extend').removeClass('oe_hidden');
            this.discounts = new DiscountWidget(this, {
                widget: this,
            });
            this.discounts.appendTo($('.control-buttons-extend'));
        },
        clickChangeMode: function (event) {
            var newMode = event.currentTarget.attributes['data-mode'].nodeValue;
            if (this.pos.config.discount && newMode == 'discount') {
                this.open_discounts();
            }
            return this._super(event);
        },
    })
});
