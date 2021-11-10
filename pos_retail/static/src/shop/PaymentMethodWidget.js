odoo.define('pos_retail.payment_method', function (require) {
    "use strict";
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var _t = require('web.core')._t;

    var PaymentMethodWidget = PosBaseWidget.extend({
        template: 'PaymentMethodWidget',
        init: function (parent, options) {
            this._super(parent, options);
            this.payment_methods = options.payment_methods || [];
        },
        start: function () {
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.service').click(_.bind(this.clickAppendNewChar, this));
        },
        clickDeleteLastChar: function () {
            $('.payment-method-list').replaceWith();
        },
        clickAppendNewChar: function (event) {
            var order = this.pos.get_order();
            var method_id = parseInt(event.currentTarget.getAttribute('id'));
            if (!order) {
                return;
            }
            if (order.orderlines.length == 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('Your shopping cart is empty')
                })
            } else {
                var paymentlines = order.get_paymentlines();
                for (var i = 0; i < paymentlines.length; i++) {
                    paymentlines[i].destroy();
                }
                var payment_method = this.pos.payment_methods_by_id[method_id];
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Are you want used Payment method ' + payment_method.name + ', Submit Order with total paid :' + this.gui.chrome.format_currency(order.get_due())),
                    body: _t('If yes, please click Yes button'),
                    confirm: function () {
                        var amount_due = order.get_due();
                        order.add_paymentline(payment_method);
                        var payment_interface = payment_method.payment_terminal;
                        if (payment_interface) {
                            order.selected_paymentline.set_payment_status('pending');
                        }
                        var paymentline = order.selected_paymentline;
                        paymentline.set_amount(amount_due);
                        $('.payment-method-list').replaceWith();
                        this.pos.push_order(order);
                        this.pos.gui.show_screen('receipt');
                    }
                })

            }
        },
    });

    return PaymentMethodWidget;
});
