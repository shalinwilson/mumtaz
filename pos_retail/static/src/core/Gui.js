odoo.define('pos_retail.gui', function (require) {
    "use strict";
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('web.rpc');
    var BarcodeEvents = require('barcodes.BarcodeEvents').BarcodeEvents;

    gui.Gui.include({
        init: function (options) {
            this._super(options);
            this.starting_customer_monitors_screen = false;
        },
        closing_session: function () {
            var self = this;
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'pos.session',
                    method: 'action_pos_session_closing_control',
                    args: [[self.pos.pos_session.id]]
                }).then(function (values) {
                    resolve(values)
                }, function (err) {
                    reject(err)
                })
            })
        },
        show_popup: function (name, options) {
            console.log(name)
            if (name == 'popup_login_viva_employee') {
                this.locked_gui = true
            }
            if (this.locked_gui && ['popup_login_viva_employee'].indexOf(name) == -1) {
                return null;
            }
            if (!this.popup_instances[name]) {
                return null; // TODO: we not allow any popup make blank page, required login first
            }
            if (options && options.title == 'Select pricelist') {
                return this.pos.trigger('open:pricelist');
            }
            this._super(name, options);
            this.popup_current_display = name;
            // this.chrome.screens['products'].close(); // kimanh
        },
        _close: function () {
            this._super();
            this.pos.polling_job_auto_paid_orders_draft();
            if (this.pos.customer_monitor_screen) {
                this.pos.customer_monitor_screen.close();
            }
        },
        show_screen: function (screen_name, params, refresh, skip_close_popup) {
            var self = this;
            var order = this.pos.get_order();
            if (!this.screen_instances[screen_name]) {
                self.show_popup('dialog', {
                    title: _t('Alert'),
                    body: screen_name + _t(' not found'),
                })
                return false;
            }
            this._super(screen_name, params, refresh, skip_close_popup);
            // if (['products'].indexOf(screen_name) == -1) {
            //     if (!this.pos.pos_session.mobile_responsive) {
            //         $('.pos-topheader').animate({opacity: 1, height: 50}, 200, 'swing', function () {
            //         });
            //         $('.pos-content').animate({opacity: 1, top: 50}, 200, 'swing', function () {
            //         });
            //     } else {
            //         $('.pos-topheader').animate({opacity: 1, height: 100}, 200, 'swing', function () {
            //         });
            //         $('.pos-content').animate({opacity: 1, top: 100}, 200, 'swing', function () {
            //         });
            //     }
            // } else {
            //     $('.pos-topheader').animate({opacity: 0, height: 0}, 200, 'swing', function () {
            //     });
            //     $('.pos-content').animate({opacity: 1, top: 0}, 200, 'swing', function () {
            //     });
            // }
            if (order) {
                if (screen_name == 'payment') {
                    order.status = 'Waiting Payment';
                    if (this.pos.config.rounding_total_paid && this.pos.config.rounding_automatic) {
                        this.pos.gui.screen_instances[screen_name].auto_rounding_due_amount()
                    }
                }
                if (screen_name == 'clientclient') {
                    order.status = 'Waiting Set Client'
                }
            }
            if (screen_name && this.pos.config.customer_facing_screen && !this.starting_customer_monitors_screen) {
                this.starting_customer_monitors_screen = true;
                self.pos.trigger('open:customer-monitor-screen');
            }
            if (screen_name != 'products') {
                $('.searchbox >input').focus();
            }
            if (screen_name == 'products') {
                if (!BarcodeEvents.$barcodeInput) {
                    $('.search-products >input').focus();
                }
                var guide_elements = [
                    {
                        element_id: '.apps',
                        title: _t('All Apps'),
                        content: _t('All apps and features in here')
                    },
                    {
                        element_id: '.new-product-categ',
                        title: _t('Create New Category'),
                    },
                    {
                        element_id: '.new-product',
                        title: _t('Create New Product'),
                    },
                    {
                        element_id: '.add-new-client',
                        title: _t('Create New Customer'),
                    },
                    {
                        element_id: '.find-order',
                        title: _t('Find Order'),
                    },
                    {
                        element_id: '.set-customer',
                        title: _t('Set Customer to Order'),
                    },
                    {
                        element_id: '.pay',
                        title: _t('Payment Order'),
                    },
                    {
                        element_id: '.total_amount',
                        title: _t('Total Due'),
                    },
                    {
                        element_id: '.multi_variant',
                        title: _t('Set Variants'),
                    },
                    {
                        element_id: '.change_cross_selling',
                        title: _t('Cross Selling'),
                    },
                    {
                        element_id: '.add_discount',
                        title: _t('Add Discount'),
                    },
                    {
                        element_id: '.product_packaging',
                        title: _t('Show Product Package'),
                    },
                    {
                        element_id: '.button-combo',
                        title: _t('Set Combo Items'),
                    },
                    {
                        element_id: '.service-charge',
                        title: _t('Add Service'),
                    },
                    {
                        element_id: '.search-product',
                        title: _t('Find Products'),
                        content: _t('You can find Product and add to cart here')
                    },
                    {
                        element_id: '.find_customer',
                        title: _t('Find Customer'),
                        content: _t('You can fast find customer via mobile/phone number of customer here')
                    },
                    {
                        element_id: '.category_home',
                        title: _t('Go back Home'),
                        content: _t('And show all Products')
                    },
                    {
                        element_id: '.screen-mode',
                        title: _t('Screen Mode'),
                        content: _t('You can click here and switch between Dark and Light Mode')
                    },
                    {
                        element_id: '.keyboard-guide',
                        title: _t('Keyboard Guide'),
                        content: _t('Click show all keyboard shortcut supported of Module')
                    },
                    {
                        element_id: '.lock-session',
                        title: _t('Lock your Session'),
                        content: _t('You can lock your session and unlock via POS Pass Pin of User Setting / Point Of Sale')
                    },
                    {
                        element_id: '.remove-orders-blank',
                        title: _t('Remove Order blank'),
                        content: _t('Click here for remove orders blank lines')
                    },
                    {
                        element_id: '.report-analytic',
                        title: _t('Report Analytic'),
                        content: _t('If you want print some report about selling, you can try it here')
                    },
                    {
                        element_id: '.shop',
                        title: _t('Logo your POS Location'),
                        content: _t('You can click here and change your Logo Shop')
                    },
                    {
                        element_id: '.mobile-mode',
                        title: _t('Go to Mobile Mode'),
                        content: _t('If your Odoo is EE license, or you used mobile web app. You can try it')
                    },
                    {
                        element_id: '.booked-orders',
                        title: _t('Booked Orders Screen'),
                        content: _t('Click here and go to Booked Orders Screen')
                    },
                    {
                        element_id: '.customer-facing-screen',
                        title: _t('Customer Facing Screen'),
                        content: _t('Click here for open new tab and facing order screen to customer')
                    },
                    {
                        element_id: '.invoices-screen',
                        title: _t('Invoices Screen'),
                        content: _t('Show all invoices of your pos shop')
                    },
                    {
                        element_id: '.pos-orders-screen',
                        title: _t('POS Orders Screen'),
                        content: _t('Show all pos orders of your pos shop')
                    },
                    {
                        element_id: '.products-sort-by',
                        title: _t('Sort By'),
                        content: _t('You can short by Products, Filter by Products')
                    },
                    {
                        element_id: '.products-view-type',
                        title: _t('Products View Type'),
                        content: _t('Click it for switch between Box View and List View Products')
                    },
                    {
                        element_id: '.products-operation',
                        title: _t('Products Operation'),
                        content: _t('Go to Products Operation screen, you can create new category, new products, edit products information')
                    },
                    {
                        element_id: '.quickly-return-products',
                        title: _t('Quickly Return Products'),
                        content: _t('Go to Quickly Return Products, you can active your scanner and scan products return')
                    },
                    {
                        element_id: '.review-receipt',
                        title: _t('Print Bill without Payment Order'),
                        content: _t('Click here for print Bill of Order Selected, without payment')
                    },
                    {
                        element_id: '.select-pricelist',
                        title: _t('Set Pricelist'),
                        content: _t('Click here for for ')
                    },
                ];
                this.guide_elements = guide_elements;
                for (var i = 0; i < self.guide_elements.length; i++) {
                    var guide = self.guide_elements[i];
                    self.show_guide_without_chrome(
                        guide.element_id,
                        'top center',
                        guide.title,
                        guide.content
                    );
                }

            }
            if (['products', 'clientlist'].includes(screen_name)) {
                this.pos.get_modifiers_backend_all_models()
                this.pos._do_update_quantity_onhand([])
            }
            if (screen_name == 'PosOrderScreen') {
                this.pos.reloadPosOrders()
            }
            if (screen_name == 'invoices') {
                this.pos.reloadAccountMove()
            }
            if (screen_name == 'sale_orders') {
                this.pos.reloadSaleOrder()
            }
        },
        close_popup: function () {
            if (this.locked_gui && this.popup_current_display == 'popup_login_viva_employee') {
                this.locked_gui = false;
            }
            this._super();
            var current_screen = this.get_current_screen();
            if (current_screen == 'report' || current_screen == 'receipt') {
                $('.alert').addClass('oe_hidden');
            }
            if (current_screen == 'products') {
                this.pos.gui.screen_instances['products'].reset_keyboard_event()
            }
        },
        show_guide_without_chrome: function (element_id, position, title, content) {
            if (!this.pos.config.guide_pos || window.chrome) {
                return false;
            } else {
                $(element_id).popup({
                    position: position,
                    target: element_id,
                    title: title,
                    content: content
                })
            }
        }
    });
});