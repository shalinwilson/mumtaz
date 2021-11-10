odoo.define('pos_retail.ClientScreenWidget', function (require) {
    var ClientScreenWidget = require('point_of_sale.chrome').ClientScreenWidget;
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var QWeb = core.qweb;
    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');

    gui.Gui.include({
        save_facing_screen: function (facing_screen_html) {
            var self = this;
            localStorage['facing_screen'] = '';
            localStorage['facing_screen'] = facing_screen_html
        }
    });

    var CustomerFacingScreenWidget = chrome.StatusWidget.extend({
        template: 'CustomerFacingScreenWidget',
        init: function () {
            this._super(arguments[0], {});
            var self = this
            this.pos.bind('open:customer-monitor-screen', function () {
                if (!self.pos.customer_monitor_screen) {
                    self.pos.customer_monitor_screen = window.open(window.location.origin + "/point_of_sale/display", '_blank');
                } else {
                    return false;
                }
            })
        },
        start: function () {
            var self = this;
            this.$el.click(function () {
                if (self.pos.customer_monitor_screen) {
                    self.pos.customer_monitor_screen.close();
                }
                self.pos.customer_monitor_screen = window.open(window.location.origin + "/point_of_sale/display", '_blank');
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            if (this.pos.config.customer_facing_screen) {
                this.widgets.push(
                    {
                        'name': 'CustomerFacingScreenWidget',
                        'widget': CustomerFacingScreenWidget,
                        'append': '.pos-rightheader'
                    }
                );
            }
            this._super();
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var self = this;
            _super_PosModel.initialize.apply(this, arguments);
            this.bind('change:selectedOrder', function () {
                self._do_update_customer_screen();
            });
            this.bind('update:customer-facing-screen', function () {
                self._do_update_customer_screen();
            });
        },
        _do_update_customer_screen: function () {
            if (this.config.customer_facing_screen) {
                var self = this;
                this.render_html_for_customer_facing_display().then(function (rendered_html) {
                    self.gui.save_facing_screen(rendered_html);
                });
            }
        },
        send_current_order_to_customer_facing_display: function () {
            this._do_update_customer_screen();
            var self = this;
            this.render_html_for_customer_facing_display().then(function (rendered_html) {
                self.proxy.update_customer_facing_display(rendered_html);
            });
        },
        render_html_for_customer_facing_display: function () { // TODO: we add shop logo to customer screen
            var self = this;
            var order = this.get_order();
            var rendered_html = this.config.customer_facing_display_html;

            // If we're using an external device like the IoT Box, we
            // cannot get /web/image?model=product.product because the
            // IoT Box is not logged in and thus doesn't have the access
            // rights to access product.product. So instead we'll base64
            // encode it and embed it in the HTML.
            var get_image_promises = [];

            if (order) {
                order.get_orderlines().forEach(function (orderline) {
                    var product = orderline.product;
                    var image_url = window.location.origin + '/web/image?model=product.product&field=image_128&id=' + product.id;

                    // only download and convert image if we haven't done it before
                    if (!product.image_base64) {
                        get_image_promises.push(self._convert_product_img_to_base64(product, image_url));
                    }
                });
            }

            // when all images are loaded in product.image_base64
            return Promise.all(get_image_promises).then(function () {
                var rendered_order_lines = "";
                var rendered_payment_lines = "";
                var order_total_with_tax = self.chrome.format_currency(0);

                if (order) {
                    rendered_order_lines = QWeb.render('CustomerFacingDisplayOrderLines', {
                        'orderlines': order.get_orderlines(),
                        'widget': self.chrome,
                    });
                    rendered_payment_lines = QWeb.render('CustomerFacingDisplayPaymentLines', {
                        'order': order,
                        'widget': self.chrome,
                    });
                    order_total_with_tax = self.chrome.format_currency(order.get_total_with_tax());
                }
                var $rendered_html = $(rendered_html);
                $rendered_html.find('.pos_orderlines_list').html(rendered_order_lines);
                $rendered_html.find('.pos-total').find('.pos_total-amount').html(order_total_with_tax);
                var pos_change_title = $rendered_html.find('.pos-change_title').text();
                $rendered_html.find('.pos-paymentlines').html(rendered_payment_lines);
                $rendered_html.find('.pos-change_title').text(pos_change_title);
                var logo_base64 = self.get_logo();
                var image_html = '<img src="' + logo_base64 + '" class="logo-shop" style="width: 100%">';
                $rendered_html.find('.pos-company_logo').html(image_html);
                // prop only uses the first element in a set of elements,
                // and there's no guarantee that
                // customer_facing_display_html is wrapped in a single
                // root element.
                rendered_html = _.reduce($rendered_html, function (memory, current_element) {
                    return memory + $(current_element).prop('outerHTML');
                }, ""); // initial memory of ""

                rendered_html = QWeb.render('CustomerFacingDisplayHead', {
                    origin: window.location.origin
                }) + rendered_html;
                return rendered_html;
            });
        },
    });

    ClientScreenWidget.include({ // TODO: if posbox installed
        start: function () {
            var self = this;
            this._super();
            if (this.pos.config.iface_customer_facing_display) {
                this.$el.click(function () {
                    if (posmodel && posmodel.proxy) {
                        var host = posmodel.proxy['host'];
                        window.open(host + '/point_of_sale/display/', '_blank');
                    }
                });
            }
        },
    });

    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            var self = this;
            var res = _super_order.initialize.apply(this, arguments);
            this.bind('add', function (order) {
                self.pos._do_update_customer_screen();
            });
            return res;
        }
    });
});
