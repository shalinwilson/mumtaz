odoo.define('pos_retail.multi_pricelist', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var field_utils = require('web.field_utils');
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var round_di = utils.round_decimals;
    var retail_model = require('pos_retail.model');
    var retail_payment_screen = require('pos_retail.screen_payment');
    var load_models = require('pos_retail.load_models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;

    screens.PaymentScreenWidget.include({
        click_paymentmethods: function (id) {
            if (id) {
                var order_selected = this.pos.get_order();
                var payment_method_selected = this.pos.payment_methods_by_id[id];
                if ((payment_method_selected && order_selected.currency && payment_method_selected.journal && payment_method_selected.journal['currency_id'] && payment_method_selected.journal['currency_id'][0] != order_selected.currency.id)) {
                    return this.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Your payment method selected have currency difference Order selected Currency. Please review before do payment Order')
                    })
                }
                if (payment_method_selected.journal && !payment_method_selected.journal['currency_id']) {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: _t('Journal :' + payment_method_selected.journal.name + ', not set currency. Please go to this journal and add currency and reload pos')
                    })
                }
            }
            this._super(id);
        },
    });
    PosBaseWidget.include({
        init: function (parent, options) {
            this._super(parent, options);
        },
        format_currency: function (amount, precision) {
            var order_selected = this.pos.get_order();
            if (order_selected && order_selected.currency) {
                var currency = (order_selected && order_selected.currency) ? order_selected.currency : {
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
                return this._super(amount, precision);
            }
        },
    });

    var _super_posmodel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var pricelist_model = _.find(this.models, function (model) {
                return model.model === 'product.pricelist';
            });
            if (pricelist_model) {
                pricelist_model.fields.push('id', 'currency_id');
                var _super_loaded_pricelist_model = pricelist_model.loaded;
                pricelist_model.loaded = function (self, pricelists) {
                    for (var i = 0; i < pricelists.length; i++) {
                        var pricelist = pricelists[i];
                        if (pricelist.currency_id) {
                            pricelist.name = pricelist.name + ' (' + pricelist.currency_id[1] + ')'
                            continue
                        }
                        if (!pricelist.currency_id) {
                            pricelist.name = pricelist.name + ' (' + self.pos.config.currency_id[1] + ')';
                            continue
                        }
                    }
                    _super_loaded_pricelist_model(self, pricelists);
                };
            }
            return _super_posmodel.initialize.call(this, session, attributes);
        },
        get_price: function (product, pricelist, quantity, uom_id) { // TODO :we overide method get_price of pos_retail.model line 485
            if (!pricelist) {
                pricelist = this._get_active_pricelist()
            }
            var price = _super_posmodel.get_price.call(this, product, pricelist, quantity, uom_id);
            var pos_config_currency_id = this.config.currency_id[0];
            var config_currency = this.currency_by_id[pos_config_currency_id];
            if (pricelist && pricelist.currency_id && config_currency != pricelist.currency_id[0]) {
                var currency_selected = this.currency_by_id[pricelist.currency_id[0]];
                if (currency_selected && currency_selected['converted_currency']) {
                    var price_coverted = (currency_selected['converted_currency'] * price);
                    price = price_coverted
                }
            }
            return price
        },
    });

    var super_product = models.Product.prototype;
    models.Product = models.Product.extend({
        get_price: function (pricelist, quantity) {
            if (!pricelist) {
                return this.lst_price;
            }
            var price = super_product.get_price.call(this, pricelist, quantity);
            if (self.posmodel) {
                var pos_config_currency_id = self.posmodel.config.currency_id[0];
                var config_currency = self.posmodel.currency_by_id[pos_config_currency_id];
                if (pricelist.currency_id && config_currency != pricelist.currency_id[0]) {
                    var currency_selected = self.posmodel.currency_by_id[pricelist.currency_id[0]];
                    if (currency_selected && currency_selected['converted_currency']) {
                        var price_coverted = (currency_selected['converted_currency'] * price);
                        price = price_coverted
                    } else {
                        self.posmodel.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Currency ' + pricelist.currency_id[1] + ' not active. Please go to Acconting/Invoice Setting / Currencies active it')
                        })
                    }
                }
            }
            return price;
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attr, options) {
            _super_order.initialize.call(this, attr, options);
            if (!options.json) {
                var pos_config_currency_id = this.pos.config.currency_id[0];
                var config_currency = this.pos.currency_by_id[pos_config_currency_id];
                if (config_currency) {
                    this.currency = config_currency;
                }
            }
        },
        set_pricelist: function (pricelist) {
            var self = this;
            var last_pricelist = this.pricelist;
            if (!this.is_return && pricelist) {
                var currency_selected = this.pos.currency_by_id[pricelist.currency_id[0]];
                if (last_pricelist && last_pricelist.currency_id && pricelist.currency_id && last_pricelist.currency_id[0] != pricelist.currency_id[0]) {
                    var lines_to_recompute = _.filter(this.get_orderlines(), function (line) {
                        return !line.price_manually_set;
                    });
                    _.each(lines_to_recompute, function (line) {
                        line.set_unit_price(line.product.get_price(self.pricelist, line.get_quantity()));
                        self.fix_tax_included_price(line);
                    });
                    this.trigger('change');
                }
                this.currency = currency_selected;
                this.pricelist = pricelist;
            }
            // TODO: no need call parent method if pricelist set automatic from pricelist customer, and pricelist new the same with current pricelist
            if (last_pricelist && pricelist && last_pricelist.id != pricelist.id) {
                _super_order.set_pricelist.apply(this, arguments);
            }
            this.pos.trigger('reload:ActionPad') // TODO: change pricelist name of button set pricelist
        },
        export_as_JSON: function () {
            var json = _super_order.export_as_JSON.apply(this, arguments);
            if (this.currency) {
                json.currency_id = this.currency.id
            }
            return json;
        },
        init_from_JSON: function (json) {
            _super_order.init_from_JSON.call(this, json);
            if (json.currency_id) {
                this.currency = this.pos.currency_by_id[json.currency_id]
            }
        },
    });

});
