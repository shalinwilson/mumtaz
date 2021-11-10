"use strict";
odoo.define('pos_retail.ReviewReceipt', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var gui = require('point_of_sale.gui');
    var qweb = core.qweb;
    var chrome = require('point_of_sale.chrome');
    var _t = core._t;
    var rpc = require('pos.rpc');

    var ReviewReceiptScreen = screens.ScreenWidget.extend({
        template: 'ReviewReceiptScreen',
        show: function () {
            this._super();
            var self = this;
            this.render_change();
            this.render_receipt();
            this.handle_auto_print();
            this._remove_active_design_receipt_ui();
            this.selected_element_id = null;
            this.style_by_element_id = {};
            this.$('.drop').click(function () {
                if (self.selected_element_id) {
                    $('[data-id="' + self.selected_element_id + '"]').css('display', 'none');
                    self.style_by_element_id[self.selected_element_id] = "display: none";
                } else {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Please select one element need remove'),
                    })
                }
            });
            this.$('.undo').click(function () {
                return self.pos.gui.show_popup('confirm', {
                    title: _t('Hello'),
                    body: _t('All Design Receipt before of Your Config will remove, are you wanted to do ?'),
                    confirm: function () {
                        rpc.query({
                            model: 'pos.ui',
                            method: 'remove_design_ui_receipt',
                            args: [[], self.pos.config.id],
                            context: {}
                        }, {
                            shadow: true,
                            timeout: 30000
                        }).then(function (values) {
                            return self.pos.reload_pos();
                        }, function (err) {
                            return self.pos.query_backend_fail(err);
                        })
                    }
                })
            });
            this.$('.edit').click(function () {
                self._active_design_receipt_ui();
                self.$('.field_design').draggable({
                    appendTo: '.field_design',
                    stop: function (event, ui) {
                        self.el = this;
                        self.handle_draggable(event, ui);

                    }
                });
                self.$('.field_design').resizable({
                    handles: 'all',
                    resize: self.handle_resizable_element.bind(self),
                });
                self.$('.field_design').click(function () {
                    self.selected_element_id = $(this).data('id');
                });
            });
            this.$('.save_design_ui').click(function () {
                var values = [];
                for (var element_id in self.style_by_element_id) {
                    var style = self.style_by_element_id[element_id];
                    values.push({
                        config_id: self.pos.config.id,
                        element_id: element_id,
                        top: style.top,
                        height: style.height,
                        left: style.left,
                        width: style.width
                    });
                    self.pos.element_style_by_id[element_id] = style;
                }
                if (values.length) {
                    rpc.query({
                        model: 'pos.ui',
                        method: 'save_design_ui_receipt',
                        args: [[], values],
                        context: {}
                    }, {
                        shadow: true,
                        timeout: 30000
                    }).then(function (values) {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Great Job'),
                            body: values['status'] + _t(' . New Design Receipt Save succeed, are you want reload pos and try to use ?'),
                            confirm: function () {
                                return self.pos.gui.show_screen('review_receipt');
                            }
                        })
                    }, function (err) {
                        return self.pos.query_backend_fail(err);
                    })
                } else {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Have not any need update design, please drag/resizable elements'),
                    })
                }
                self._remove_active_design_receipt_ui()

            });
        },
        _active_design_receipt_ui: function () {
            this.$('.field_design').css('background', '#aaaaaa');
            this.$('.field_design').css('cursor', 'pointer');
            var receipt_height = parseInt(this.$('.pos-receipt').css('height')) + 300;
            this.$('.pos-receipt').css('height', receipt_height);
        },
        _remove_active_design_receipt_ui: function () {
            this.$('.field_design').css('background', '#fff');
            this.$('.field_design').css('cursor', 'none');
        },
        line_style: function () {
            var table = this.table;

            function unit(val) {
                return '' + val + 'px';
            }

            var style = {
                'width': table.width,
                'height': table.height,
                'top': table.position_v + table.height / 2,
                'left': table.position_h + table.width / 2,
            };
            if (style.left <= 0) { // not allow move out of receipt layout
                style.left = 0;
            }
            // if (style.top != 0) {
            //     style.top = 0;
            // }
            // if (style['width'] >= 135) {
            //     style['width'] = 135
            // }
            style.left = parseInt(style.left / 10) * 10;
            style.top = parseInt(style.top / 5) * 5;
            style.height = parseInt(style.height / 5) * 5;
            if (style['width'] + style['left'] > 300) {
                style['left'] = 0;
            }
            if (style['width'] >= 295) {
                style['width'] = 295
            }
            style.width = parseInt(style.width / 5) * 5;
            style = {
                'width': unit(style.width),
                'height': unit(style.height),
                'top': unit(style.top),
                'left': unit(style.left),
                'padding': unit(3),
                'line-height': unit(20),

            };
            console.log(style);
            return style;
        },
        handle_draggable: function (event, ui) {
            if (!this.table) {
                this.table = {
                    width: ui.helper.width(),
                    height: ui.helper.height(),
                }
            }
            if (this.table) {
                this.dragging = false;
                this.moved = true;
                this.table.position_h = ui.position.left - this.table.width / 2;
                this.table.position_v = ui.position.top - this.table.height / 2;
                var style = this.line_style();
                ui.helper.css(style);
                this.style_by_element_id[ui.helper.data('id')] = style;
            }
        },
        handle_resizable_element: function (event, ui) {
            this.moved = true;
            this.table = {};
            this.table.width = ui.size.width;
            this.table.height = ui.size.height;
            this.table.position_h = ui.position.left - ui.originalSize.width / 2;
            this.table.position_v = ui.position.top - ui.originalSize.height / 2;
            var style = this.line_style();
            ui.helper.css(style);
            this.style_by_element_id[ui.helper.data('id')] = style;
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.proxy.printer && this.pos.config.iface_print_skip_screen;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.back').removeClass('highlight');
            } else {
                this.$('.back').addClass('highlight');
            }
        },
        print_web: function () {
            window.print();
        },
        print_html: function () {
            var receipt = qweb.render('OrderReceipt', this.pos.gui.screen_instances['receipt'].get_receipt_render_env());
            this.pos.proxy.printer.print_receipt(receipt);
        },
        print: function () {
            if (this.pos.proxy.printer) {
                this.print_html();
                this.lock_screen(false);
            } else {
                this.print_web();
            }
        },

        click_back: function () {
            this.pos.gui.show_screen('products')
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
                self.pos.trigger('back:order');
            });
            this.$('.button.print').click(function () {
                if (!self._locked) {
                    self.print();
                }
            });
        },
        render_change: function () {
            this.$('.change-value').html(this.format_currency(this.pos.get_order().get_change()));
        },
        render_receipt: function () {
            var receipt = qweb.render('OrderReceipt', this.pos.gui.screen_instances['receipt'].get_receipt_render_env());
            this.$('.pos-receipt-container').html(receipt);
        }
    });

    gui.define_screen({name: 'review_receipt', widget: ReviewReceiptScreen});

    return {
        'ReviewReceiptScreen': ReviewReceiptScreen
    }
});
