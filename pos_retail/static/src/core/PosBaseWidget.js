"use strict";
/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.pos_base_widget', function (require) {

    var BaseWidget = require('point_of_sale.BaseWidget');
    var field_utils = require('web.field_utils');
    var utils = require('web.utils');
    var round_di = utils.round_decimals;

    BaseWidget.include({
        format_currency: function (amount, precision) {
            var order = this.pos.get_order();
            if (order && order.currency) {
                var currency = (order && order.currency) ? order.currency : {
                    symbol: '$',
                    position: 'after',
                    rounding: 0.01,
                    decimals: 2
                };

                amount = this.format_currency_no_symbol(amount, precision);

                if (currency.position === 'after') {
                    return amount + ' ' + (currency.symbol || '');
                } else {
                    return (currency.symbol || '') + ' ' + amount;
                }
            } else {
                return this._super(amount, precision)
            }

        },
        format_currency_no_symbol: function (amount, precision) {
            var order = this.pos.get_order();
            if (order && order.currency) {
                var currency = (order && order.currency) ? order.currency : {
                    symbol: '$',
                    position: 'after',
                    rounding: 0.01,
                    decimals: 2
                };
                var decimals = currency.decimals;

                if (precision && this.pos.dp[precision] !== undefined) {
                    decimals = this.pos.dp[precision];
                }

                if (typeof amount === 'number') {
                    amount = round_di(amount, decimals).toFixed(decimals);
                    amount = field_utils.format.float(round_di(amount, decimals), {digits: [69, decimals]});
                }
                return amount;
            } else {
                return this._super(amount, precision)
            }
        },
    })
});