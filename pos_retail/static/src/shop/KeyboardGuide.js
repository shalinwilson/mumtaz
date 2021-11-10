"use strict";
odoo.define('pos_retail.keyboard_guide_widget', function (require) {

    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var chrome = require('point_of_sale.chrome');

    var hide_keyboard_guide_widget = chrome.StatusWidget.extend({
        template: 'hide_keyboard_guide_widget',

        hide_keyboard: function () {
            $('.keyboard').animate({opacity: 0,}, 200, 'swing', function () {
                $('.keyboard').addClass('oe_hidden');
            });
        },
        show_keyboard: function () {
            $('.keyboard').animate({opacity: 1,}, 200, 'swing', function () {
                $('.keyboard').removeClass('oe_hidden');
            });
        },
        start: function () {
            var self = this;
            this.$el.click(function () {
                self.show_keyboard();
            });
        },
    });

    var KeyBoard_Guide_Widget = PosBaseWidget.extend({
        template: "KeyBoard_Guide_Widget",
        init: function (parent, options) {
            this._super(parent, options);
            var self = this;

            // for dragging the debug widget around
            this.dragging = false;
            this.dragpos = {x: 0, y: 0};

            function eventpos(event) {
                if (event.touches && event.touches[0]) {
                    return {x: event.touches[0].screenX, y: event.touches[0].screenY};
                } else {
                    return {x: event.screenX, y: event.screenY};
                }
            }

            this.dragend_handler = function (event) {
                self.dragging = false;
            };
            this.dragstart_handler = function (event) {
                self.dragging = true;
                self.dragpos = eventpos(event);
            };
            this.dragmove_handler = function (event) {
                if (self.dragging) {
                    var top = this.offsetTop;
                    var left = this.offsetLeft;
                    var pos = eventpos(event);
                    var dx = pos.x - self.dragpos.x;
                    var dy = pos.y - self.dragpos.y;

                    self.dragpos = pos;

                    this.style.right = 'auto';
                    this.style.bottom = 'auto';
                    this.style.left = left + dx + 'px';
                    this.style.top = top + dy + 'px';
                }
                event.preventDefault();
                event.stopPropagation();
            };
        },
        hide: function () {
            var self = this;
            this.$el.animate({opacity: 0,}, 200, 'swing', function () {
                self.$el.addClass('oe_hidden');
            });
        },
        show: function () {
            this.$el.css({opacity: 0});
            this.$el.removeClass('oe_hidden');
            this.$el.animate({opacity: 1}, 250, 'swing');
        },
        start: function () {
            var self = this;
            this.$('.toggle').click(function () {
                self.hide();
            });
            this.el.addEventListener('mouseleave', this.dragend_handler);
            this.el.addEventListener('mouseup', this.dragend_handler);
            this.el.addEventListener('touchend', this.dragend_handler);
            this.el.addEventListener('touchcancel', this.dragend_handler);
            this.el.addEventListener('mousedown', this.dragstart_handler);
            this.el.addEventListener('touchstart', this.dragstart_handler);
            this.el.addEventListener('mousemove', this.dragmove_handler);
            this.el.addEventListener('touchmove', this.dragmove_handler);
        }
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets.push(
                {
                    'name': 'hide_keyboard_guide_widget',
                    'widget': hide_keyboard_guide_widget,
                    'append': '.pos-rightheader'
                },
                {
                    'name': 'KeyBoard_Guide_Widget',
                    'widget': KeyBoard_Guide_Widget,
                    'append': '.pos-content'
                }
            );
            this._super();
        }
    });
});