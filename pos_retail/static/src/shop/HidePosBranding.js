odoo.define('pos_retail.hide_pos_branding', function (require) {
    var chrome = require('point_of_sale.chrome');

    // var hide_pos_branding_widget = chrome.StatusWidget.extend({
    //     template: 'hide_pos_branding_widget',
    //
    //     hide_pos_branding: function () {
    //         this.pos.show_branding = !this.pos.show_branding;
    //         $('.pos-branding').animate({width: 0}, 'fast');
    //         $('.pos-rightheader').animate({left: 0}, 'fast');
    //         $('.pos-rightheader').addClass('hide_branding');
    //         this.pos.set('lock_status', {state: 'connecting', pending: 0});
    //     },
    //     show_pos_branding: function () {
    //         this.pos.show_branding = !this.pos.show_branding;
    //         $('.pos-branding').animate({width: 640}, 'fast');
    //         $('.pos-rightheader').animate({left: 640}, 'fast');
    //         $('.pos-rightheader').removeClass('hide_branding');
    //         this.pos.set('lock_status', {state: 'connected', pending: 0});
    //     },
    //     start: function () {
    //         var self = this;
    //         this.pos.show_branding = true;
    //         this.pos.bind('change:lock_status', function (pos, datas) {
    //             self.set_status(datas.state, datas.pending);
    //         });
    //         this.$el.click(function () {
    //             if (self.pos.show_branding) {
    //                 self.hide_pos_branding()
    //             } else {
    //                 self.show_pos_branding()
    //             }
    //         });
    //     },
    // });
    //
    // chrome.Chrome.include({
    //     build_widgets: function () {
    //         if (!this.pos.pos_session.mobile_responsive) {
    //             this.widgets.push(
    //                 {
    //                     'name': 'hide_pos_branding_widget',
    //                     'widget': hide_pos_branding_widget,
    //                     'append': '.pos-screens-list',
    //                 }
    //             );
    //         }
    //         this._super();
    //     }
    // });
});
