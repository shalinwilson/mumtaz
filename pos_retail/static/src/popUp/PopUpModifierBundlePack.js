"use strict";
odoo.define('pos_retail.PopUpModifierBundlePack', function (require) {

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;
    var _t = core._t;
    var PopupWidget = require('point_of_sale.popups');


    var PopUpModifierBundlePack = PopupWidget.extend({
        template: 'PopUpModifierBundlePack',
        get_product_image_url: function (combo_item_id) {
            var combo_item = this.pos.combo_item_by_id[combo_item_id];
            return window.location.origin + '/web/image?model=product.product&field=image_128&id=' + combo_item.product_id[0];
        },
        show: function (options) {
            this.limit = 100;
            this.options = options;
            this.combo_items = options.combo_items || [];
            this._super(options);
            this.$el.find('input').focus();
            this.$el.find('.combo_items').html(qweb.render('ComboItems', {
                combo_items: this.combo_items,
                widget: this
            }));
            this._click_minus_plus();
        },
        _click_minus_plus: function () {
            var self = this;
            this.$('.minus').click(function () {
                var combo_item_id = parseInt($(this).parent().data('comboId'));
                var combo_item_selected = _.find(self.combo_items, function (c) {
                    return c.id == combo_item_id
                })
                if (combo_item_selected.quantity == 1 && combo_item_selected.required) {
                    return self.wrong_input("product[comboId=" + combo_item_selected.product_id[0] + "][name='name']", '(*) ' + combo_item_selected.product_id[1] + ' is required, it not possible remove');
                }
                if (combo_item_selected && combo_item_selected.quantity >= 1) {
                    combo_item_selected.quantity -= 1
                }
                $(this).parent().find('.combo-item-cart_qty').html(combo_item_selected.quantity)
            });
            this.$('.trash').click(function () {
                var combo_item_id = parseInt($(this).parent().data('comboId'));
                var combo_item_selected = _.find(self.combo_items, function (c) {
                    return c.id == combo_item_id
                })
                if (combo_item_selected.required) {
                    return self.wrong_input("product[comboId=" + combo_item_selected.product_id[0] + "][name='name']", '(*) ' + combo_item_selected.product_id[1] + ' is required, it not possible remove');
                }
                combo_item_selected.quantity = 0
                $(this).parent().find('.combo-item-cart_qty').html(0)
            });
            this.$('.plus').click(function () {
                var combo_item_id = parseInt($(this).parent().data('comboId'));
                var combo_item_selected = _.find(self.combo_items, function (c) {
                    return c.id == combo_item_id
                })
                if (combo_item_selected && combo_item_selected.quantity >= 0) {
                    combo_item_selected.quantity += 1
                }
                $(this).parent().find('.combo-item-cart_qty').html(combo_item_selected.quantity)
            });
        },
        click_confirm: function () {
            if (this.options.confirm) {
                this.options.confirm.call(this, this.combo_items);
                this.pos.gui.close_popup();
            }
        },
    });
    gui.define_popup({name: 'PopUpModifierBundlePack', widget: PopUpModifierBundlePack});
});
