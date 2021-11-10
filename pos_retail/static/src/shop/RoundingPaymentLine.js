odoo.define('pos_retail.rounding_payment', function (require) {
    "use strict";

    var screen = require('point_of_sale.screens');

    screen.PaymentScreenWidget.include({
        click_paymentmethods: function (id) {
            this._super(id);
            if (this.pos.config.rounding_total_paid) {
                var selected_order = this.pos.get_order();
                var selected_paymentline = selected_order.selected_paymentline;
                var payment_method_rounding = _.find(this.pos.payment_methods, function (method) {
                    return method.pos_method_type == 'rounding';
                });
                if (!selected_order || !payment_method_rounding || !selected_paymentline) {
                    return;
                }
                var due = selected_order.get_due();
                var amount_round = 0;
                if (this.pos.config.rounding_type == 'rounding_integer') {
                    var decimal_amount = due - Math.floor(due);
                    if (decimal_amount <= 0.25) {
                        amount_round = -decimal_amount
                    } else if (decimal_amount > 0.25 && decimal_amount < 0.75) {
                        amount_round = 1 - decimal_amount - 0.5;
                        amount_round = 0.5 - decimal_amount;
                    } else if (decimal_amount >= 0.75) {
                        amount_round = 1 - decimal_amount
                    }
                } else {
                    var after_round = Math.round(due * Math.pow(10, payment_method_rounding.journal.decimal_rounding)) / Math.pow(10, payment_method_rounding.journal.decimal_rounding);
                    amount_round = after_round - due;
                }
                if (amount_round == 0) {
                    return;
                }
                var rounded_paymentline = _.find(selected_order.paymentlines.models, function (payment) {
                    return payment.payment_method.journal && payment.payment_method.journal.pos_method_type == 'rounding';
                });
                if (rounded_paymentline) {
                    rounded_paymentline.set_amount(-amount_round);
                } else {
                    selected_order.add_paymentline(payment_method_rounding);
                    var rounded_paymentline = selected_order.selected_paymentline;
                    rounded_paymentline.set_amount(-amount_round);
                }
                if (selected_paymentline) {
                    selected_order.select_paymentline(selected_paymentline);
                }
                this.reset_input();
                this.render_paymentlines();
            }
        }
    });
});
