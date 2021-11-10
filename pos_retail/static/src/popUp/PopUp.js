/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.popup_core', function (require) {
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');
    var core = require('web.core');
    var _t = core._t;
    var QWeb = core.qweb;

    _.each(gui.Gui.prototype.popup_classes, function (o) {
        if (o.name == "confirm") {
            var confirmPopupWidget = o.widget;
            confirmPopupWidget.include({
                click_confirm: function () {
                    this.gui.close_popup();
                    if (this.options.confirm) {
                        this.options.confirm.call(this);
                    }
                },
                click_cancel: function () {
                    this.gui.close_popup();
                    if (this.options.cancel) {
                        this.options.cancel.call(this);
                    }
                },
            })
        }
        if (o.name == "number") {
            var NumberWidget = o.widget;
            NumberWidget.include({
                show: function (options) {
                    this._super(options);
                    if (options.input_direct) { // TODO: we create this variable for always trigger chang value of this popup and set back to value of line
                        this.input_direct = true;
                    } else {
                        this.input_direct = false;
                    }
                    if (this.input_direct) {
                        this.$('.confirm').addClass('oe_hidden')
                    } else {
                        this.$('.confirm').removeClass('oe_hidden')
                    }
                },
                click_numpad: function (event) {
                    this._super(event);
                    if (this.input_direct) {
                        var value = this.$('.value').text();
                        var mode = this.chrome.screens['products'].order_widget.numpad_state.get('mode');
                        if (value != "") {
                            if (mode == 'quantity' && this.pos.config.validate_quantity_change) {
                                return this.pos._validate_by_manager("this.chrome.screens['products'].order_widget.set_value('" + value + "')", 'Change Quantity of Selected Line');
                            }
                            if (mode == 'discount' && this.pos.config.validate_discount_change) {
                                return this.pos._validate_by_manager("this.chrome.screens['products'].order_widget.set_value('" + value + "')", 'Change Discount of Selected Line');
                            }
                            if (mode == 'price' && this.pos.config.validate_price_change) {
                                return this.pos._validate_by_manager("this.chrome.screens['products'].order_widget.set_value('" + value + "')", 'Change Price of Selected Line');
                            }
                            return this.chrome.screens['products'].order_widget.set_value(value);
                        }
                    }

                },
            })
        }
    });

    PopupWidget.include({
        show: function (options) {
            var self = this;
            this._super(options);
            this.popup_keyboard_keydown_handler = function (event) {
                if (!self.pos.gui.has_popup()) {
                    return self.remove_keyboard()
                }
                if (event.keyCode === 27 || event.keyCode === 13) { // key: esc
                    self.press_keyboard(event.keyCode);
                    event.preventDefault();
                }
            };
            this.add_keyboard()
        },
        press_keyboard: function (key) {
            const self = this;
            if (key == 27 && ['lock_session_widget', 'popup_lock_page'].indexOf(this.pos.gui.popup_current_display) == -1) {
                setTimeout(function () {
                    self.remove_keyboard();
                    self.$('.cancel').click();
                    self.pos.gui.close_popup();
                }, 200)// timeout 1/2 second for product screen see popup no trigger event keyboard
            }
            if (key == 13) {
                setTimeout(function () {
                    self.remove_keyboard();
                    self.$('.confirm').click();
                    // todo: if have issue. popup still open, addback popup
                    if (self.gui.has_popup()) {
                        self.add_keyboard()
                    }
                }, 200)// timeout 1/2 second for product screen see popup no trigger event keyboard
            }
        },
        add_keyboard: function () {
            window.document.body.addEventListener('keydown', this.popup_keyboard_keydown_handler);
        },
        remove_keyboard: function () {
            window.document.body.removeEventListener('keydown', this.popup_keyboard_keydown_handler);
        },
        _check_is_duplicate: function (field_value, field_string) {
            var partners = this.pos.db.get_partners_sorted(-1);
            var old_partners = _.filter(partners, function (partner_check) {
                return partner_check[field_string] == field_value;
            });
            if (old_partners.length != 0) {
                return true;
            } else {
                return false;
            }
        },
        validate_date_field: function (value, $el) {
            if (value.match(/^\d{4}$/) !== null) {
                $el.val(value + '-');
            } else if (value.match(/^\d{4}\/\d{2}$/) !== null) {
                $el.val(value + '-');
            }
        },
        check_is_number: function (number) {
            var regex = /^[0-9]+$/;
            if (number.match(regex)) {
                return true
            } else {
                return false
            }
        },
        close: function () {
            this._super();
            var current_screen = this.pos.gui.get_current_screen();
            if (current_screen && current_screen == 'products') {
                this.pos.trigger('back:order'); // trigger again add keyboard
            }
        },
        wrong_input: function (element, message) {
            if (message) {
                this.$("span[class='card-issue']").text(message);
            }
            this.$(element).css({
                'box-shadow': '0px 0px 0px 1px rgb(236, 5, 5) inset',
                'border': 'none !important',
                'border-bottom': '1px solid red !important'
            });
        },
        passed_input: function (element) {
            this.$(element).css({
                'box-shadow': '#3F51B5 0px 0px 0px 1px inset',
            })
        },
        show_report: function (report_html, report_xml, values) {
            values['widget'] = this;
            this.pos.report_html = QWeb.render(report_html, values);
            this.pos.report_xml = QWeb.render(report_xml, values);
            this.gui.show_screen('report');
        }
    });

    var CharPopUpWidget = PopupWidget.extend({
        template: 'CharPopUpWidget',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.renderElement();
        },
        click_confirm: function () {
            this.gui.close_popup();
            if (this.options.confirm) {
                var value = this.$('input').val();
                this.options.confirm.call(this, value);
            }
        },
    });
    gui.define_popup({name: 'char', widget: CharPopUpWidget});

    var SubmitForm = PopupWidget.extend({
        template: 'SubmitForm',
        show: function (options) {
            options = options || {};
            this._super(options);
            this.renderElement();
        },
        click_confirm: function () {
            this.gui.close_popup();
            if (this.options.confirm) {
                var value = this.$('input').val();
                this.options.confirm.call(this, value);
            }
        },
    });
    gui.define_popup({name: 'submit', widget: SubmitForm});
});