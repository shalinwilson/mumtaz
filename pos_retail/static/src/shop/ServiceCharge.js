odoo.define('pos_retail.service_charge', function (require) {
    "use strict";
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var _t = require('web.core')._t;
    var models = require('point_of_sale.models');

    models.load_models([
        {
            model: 'pos.service.charge',
            fields: ['name', 'product_id', 'type', 'amount'],
            condition: function (self) {
                return self.config.service_charge_ids && self.config.service_charge_ids.length;
            },
            domain: function (self) {
                return [
                    ['id', 'in', self.config.service_charge_ids],
                ]
            },
            loaded: function (self, services_charge) {
                self.services_charge = services_charge;
                self.services_charge_ids = [];
                self.service_charge_by_id = {};
                for (var i = 0; i < services_charge.length; i++) {
                    var service = services_charge[i];
                    self.services_charge_ids.push(service.id);
                    self.service_charge_by_id[service.id] = service;
                }
            }
        },
    ], {
        after: 'pos.config'
    });

    var ServiceChargeWidget = PosBaseWidget.extend({
        template: 'ServiceChargeWidget',
        init: function (parent) {
            this._super(parent);
        },
        start: function () {
            this.$el.find('.numpad-backspace').click(_.bind(this.clickDeleteLastChar, this));
            this.$el.find('.service').click(_.bind(this.clickAppendNewChar, this));
        },
        clickDeleteLastChar: function () {
            $('.service-list').addClass('oe_hidden');
        },
        clickAppendNewChar: function (event) {
            var order = this.pos.get_order();
            var service_id = parseInt(event.currentTarget.getAttribute('id'));
            var service = this.pos.service_charge_by_id[service_id];
            var product = this.pos.db.get_product_by_id(service['product_id'][0]);
            if (product) {
                order.add_shipping_cost(service, product, false)
            } else {
                this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Could not found Product: ' + service['product_id'][1] + ' available in pos')
                })
            }
        },
    });

    return ServiceChargeWidget;
});
