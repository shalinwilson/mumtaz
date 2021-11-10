odoo.define('theme_clarico_vega.wishlist_animate', function (require) {
    "use strict";

    var publicWidget = require('web.public.widget');
    var wSaleUtils = require('website_sale.utils');
    var ProductWishlist = new publicWidget.registry.ProductWishlist();
    //--------------------------------------------------------------------------
    // Shop page wishlist animation & wishlist page add to cart animation
    //--------------------------------------------------------------------------
    publicWidget.registry.ProductWishlist.include({
        /**
         * @private
         */
        _addNewProducts: function ($el) {
            var self = this;
            var productID = $el.data('product-product-id');
            if ($el.hasClass('o_add_wishlist_dyn')) {
                productID = $el.parent().find('.product_id').val();
                if (!productID) { // case List View Variants
                    productID = $el.parent().find('input:checked').first().val();
                }
                productID = parseInt(productID, 10);
            }
            var $form = $el.closest('form');
            var templateId = $form.find('.product_template_id').val();
            // when adding from /shop instead of the product page, need another selector
            if (!templateId) {
                templateId = $el.data('product-template-id');
            }
            $el.prop("disabled", true).addClass('disabled');
            var productReady = this.selectOrCreateProduct(
                $el.closest('form'),
                productID,
                templateId,
                false
            );

            productReady.then(function (productId) {
                productId = parseInt(productId, 10);

                if (productId && !_.contains(self.wishlistProductIDs, productId)) {
                    return self._rpc({
                        route: '/shop/wishlist/add',
                        params: {
                            product_id: productId,
                        },
                    }).then(function () {
                        var $navButton = self.getCustomNavBarButton('.te_wish_icon_head');
                        self.wishlistProductIDs.push(productId);
                        self._updateWishlistView();
                        wSaleUtils.animateClone($navButton, $el.closest('form'), 17, 12);
                    }).guardedCatch(function () {
                        $el.prop("disabled", false).removeClass('disabled');
                    });
                }
            }).guardedCatch(function () {
                $el.prop("disabled", false).removeClass('disabled');
            });
        },
        _addOrMoveWish: function (e) {
            var self = this;
            var $navButton = self.getCustomNavBarButton('.te_cart_icon_head');
            if($navButton.length == 0) {
                $navButton = $('#top_menu_collapse #my_cart');
            }
            var tr = $(e.currentTarget).parents('tr');
            var product = tr.data('product-id');
            $('.te_cart_icon_head').removeClass('d-none');
            wSaleUtils.animateClone($navButton, tr, 17, 10);

            if ($('#b2b_wish').is(':checked')) {
                return this._addToCart(product, tr.find('add_qty').val() || 1);
            } else {
                var adding_deffered = this._addToCart(product, tr.find('add_qty').val() || 1);
                this._removeWish(e, adding_deffered);
                return adding_deffered;
            }
        },
        // To get product wishlist and wishlist page addtocart selector based on header
        getCustomNavBarButton: function(selector) {
            var $affixedHeaderButton = $('header.affixed ' + selector);
            if ($affixedHeaderButton.length) {
                return $affixedHeaderButton;
            } else {
                var $header = $('div.te_header_before_overlay '+ selector);
                if($header.length){
                    return $header;
                } else {
                    return $('header ' + selector).first();
                }
            }
        },
    });

});