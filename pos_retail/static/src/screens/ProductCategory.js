"use strict";
odoo.define('pos_retail.screen_product_categories', function (require) {

    // **********************************************
    // Supported >= 1 millions datas products
    // **********************************************

    var screens = require('point_of_sale.screens');
    var indexed_db = require('pos_retail.indexedDB');
    var utils = require('web.utils');
    var core = require('web.core');
    var _t = core._t;
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');

    screens.ProductCategoriesWidget.include({
        perform_search: function (category, query, buy_result) {
            var self = this;
            this._super(category, query, buy_result);
            if (this.pos.limited_size) {
                var products;
                if (query) {
                    products = this.pos.db.search_product_in_category(category.id, query);
                } else {
                    products = this.pos.db.get_product_by_category(this.category.id);
                }
                console.log(query);
                if (!products || products.length == 0) {
                    console.log('search have not result, begin search on indexed database');
                    var index_list = ['bc_index', 'dc_index', 'name_index'];
                    var max_sequence = this.pos.session.model_ids['product.product']['max_id'] / 100000 + 1;
                    $.when(indexed_db.search_by_index('product.product', max_sequence, index_list, query)).then(function (product) {
                        console.log('Searched have result id: ' + product.id);
                        if (product['id']) {
                            var using_company_currency = self.pos.config.currency_id[0] === self.pos.company.currency_id[0];
                            var conversion_rate = self.pos.currency.rate / self.pos.company_currency.rate;
                            self.pos.db.add_products(_.map([product], function (product) {
                                if (!using_company_currency) {
                                    product.lst_price = round_pr(product.lst_price * conversion_rate, self.pos.currency.rounding);
                                }
                                product.categ = _.findWhere(self.pos.product_categories, {'id': product.categ_id[0]});
                                return new models.Product({}, product);
                            }));
                            var product = self.pos.db.get_product_by_id(product['id']);
                            if (product) {
                                self.product_list_widget.set_product_list([product]);
                            }
                            return self.pos.gui.show_popup('dialog', {
                                title: _t('Great job'),
                                body: _t('Product just add to POS'),
                                color: 'info'
                            })
                        }
                    })
                }
            }
        },
    })
});
