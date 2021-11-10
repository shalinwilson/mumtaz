odoo.define('pos_retail.screen_single', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var qweb = core.qweb;

    screens.ScreenWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('change:selectedOrder', function () {
                self.show_ticket();
            }, this);
            this.pos.bind('change:currency', function () {
                self.show_ticket();
            }, this);
        },
        show: function () {
            this._super();
            this.show_ticket();
        },
        hide: function () {
            this._super();
            this.show_ticket();
        },
        renderElement: function () {
            this._super();
            this.show_ticket();
        },
        render_template_receipt: function () {
            this.$('.pos-sale-ticket').replaceWith('');
            this.$('.pos-receipt').replaceWith();
            var receipt = qweb.render('OrderReceipt', this.pos.gui.screen_instances['receipt'].get_receipt_render_env());
            var cur_screen = this.pos.gui.get_current_screen();
            if (cur_screen == 'payment') {
                this.$('.receipt-detail').append(receipt);
                this.$('.pos-receipt').css({'width': '100%'});
                this.$('.receipt-line').css({'font-size': '13px'});
                this.$('.product-line-name').css({'font-size': '13px'});
                this.$('.pos-receipt>tr>th').css({'font-size': '13px'});
                this.$('.line-header').css({'font-size': '13px'});
                this.$('.receipt-line').css({'font-size': '13px'});
            }
        },
        show_ticket: function () {
            var cur_screen = this.pos.gui.get_current_screen();
            if (!cur_screen || !this.pos.config.review_receipt_before_paid || this.pos.config.receipt_fullsize) {
                return true;
            }
            if (cur_screen == 'payment') {
                this.render_template_receipt();
            }
        },
    });
});
