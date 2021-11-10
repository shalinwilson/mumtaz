"use strict";
odoo.define('pos_retail.PopUpSelectProductVariant', function (require) {

    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;
    var _t = core._t;
    var PopupWidget = require('point_of_sale.popups');

    var PopUpSelectProductAttributes = PopupWidget.extend({ // select combo
        template: 'PopUpSelectProductAttributes',
        get_product_image_url: function (product) {
            return window.location.origin + '/web/image?model=product.product&field=image_128&id=' + product.id;
        },
        show: function (options) {
            this.limit = 100;
            this.options = options;
            this.products = options.products;
            this.attributes = options.attributes;
            this._super(options);
            this.attributes_selected_ids = [];
            this.products_selected_ids = [];
            this.$el.find('input').focus();
            this.$el.find('.table-attributes>tbody').html(qweb.render('Attributes', {
                attributes: this.attributes,
                widget: this
            }));
            this.$el.find('.table-products>tbody').html(qweb.render('ProductAttributes', {
                products: this.products,
                widget: this
            }));
            this._click_attribute();
            this._click_product();
        },
        _click_product: function () {
            var self = this;
            this.$('.product').click(function () {
                var product_id = parseInt($(this).data('productId'));
                var product = _.find(self.products, function (p) {
                    return p.id == product_id
                })
                if (self.products_selected_ids.indexOf(product_id) == -1) {
                    self.products_selected_ids.push(product_id);
                    $(this).addClass("item-selected");
                    product.selected = true;
                } else {
                    self.products_selected_ids = _.filter(self.products_selected_ids, function (p) {
                        return p != product_id
                    });
                    $(this).removeClass("item-selected");
                    product.selected = false;
                }
            });
        },
        _click_attribute: function () {
            var self = this;
            this.$('.popup_category_item').click(function () {
                var attribute_id = parseInt($(this).data('attributeId'));
                if (self.attributes_selected_ids.indexOf(attribute_id) == -1) {
                    self.attributes_selected_ids.push(attribute_id);
                    $(this).addClass("item-selected");
                } else {
                    self.attributes_selected_ids = _.filter(self.attributes_selected_ids, function (a) {
                        return a != attribute_id;
                    })
                    $(this).removeClass("item-selected");
                }
                var products_will_display = [];
                for (var i = 0; i < self.products.length; i++) {
                    var product = self.products[i];
                    if (self.attributes_selected_ids.length == 1) {
                        for (var j = 0; j < product.product_template_attribute_value_ids.length; j++) {
                            var attribute_product_id = product.product_template_attribute_value_ids[j];
                            if (self.attributes_selected_ids.indexOf(attribute_product_id) != -1) {
                                products_will_display.push(product);
                            }
                        }
                    } else {
                        var temp = true
                        for (var j = 0; j < product.product_template_attribute_value_ids.length; j++) {
                            var attribute_product_id = product.product_template_attribute_value_ids[j];
                            if (self.attributes_selected_ids.indexOf(attribute_product_id) == -1) {
                                temp = false
                                break
                            }
                        }
                        if (temp) {
                            products_will_display.push(product);
                        }
                    }
                }
                self.$el.find('.table-products>tbody').html(qweb.render('ProductAttributes', {
                    products: products_will_display,
                    widget: self
                }));
                self._click_product();
            });
        },
        unselect_items: function () {
            for (var i = 0; i < this.products.length; i++) {
                this.products[i].selected = false;
            }
        },
        click_confirm: function () {
            if (this.options.confirm) {
                this.unselect_items();
                this.options.confirm.call(this, this.products_selected_ids);
                this.pos.gui.close_popup();
            }
        },
        click_cancel: function () {
            this.gui.close_popup();
            if (this.options.cancel) {
                this.options.cancel.call(this);
                this.unselect_items();
            }
        },
    });
    gui.define_popup({name: 'PopUpSelectProductAttributes', widget: PopUpSelectProductAttributes});
});
