odoo.define('pos_retail.ui', function (require) {
    var core = require('web.core');
    var models = require('point_of_sale.models');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var chrome = require('point_of_sale.chrome');
    var exports = {};
    var _t = core._t;
    var PosBaseWidget = require('point_of_sale.BaseWidget');
    var _SuperPosModel = models.PosModel.prototype;

    screens.ProductScreenWidget.include({
        line_style_with_px: function () {
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
            style = {
                'width': unit(style.width),
                'height': unit(style.height),
                'top': unit(style.top),
                'left': unit(style.left),
            };
            return style;
        },
        line_style_without_px: function () {
            var table = this.table;
            var style = {
                'width': table.width,
                'height': table.height,
                'top': table.position_v + table.height / 2,
                'left': table.position_h + table.width / 2,
            };
            style = {
                'width': style.width,
                'height': style.height,
                'top': style.top,
                'left': style.left,
            };
            return style;
        },
        _get_count_message_need_save: function () {
            var count = 0;
            for (var index in this.style_by_tag) {
                count += 1
            }
            return count
        },
        handle_draggable: function (event, ui) {
            var tag = ui.helper.data('tag');
            if (!this.table || (this.table && tag != this.table.tag)) {
                this.table = {
                    tag: tag,
                    width: ui.helper.width(),
                    height: ui.helper.height(),
                }
            }
            this.dragging = false;
            this.moved = true;
            this.table.position_h = ui.position.left - this.table.width / 2;
            this.table.position_v = ui.position.top - this.table.height / 2;
            var style = this.line_style_with_px();
            ui.helper.css(style);
            this.style_by_tag[ui.helper.data('tag')] = this.line_style_without_px();
            this.pos.tag_selected = ui.helper.data('tag');
            $('.' + ui.helper.data('tag')).css(style);
            this.ui_selected = ui;
            this.pos.set('crop_mode', {
                state: 'disconnected',
                pending: this._get_count_message_need_save()
            });
        },
        handle_resizable_element: function (event, ui) {
            var tag = ui.helper.data('tag');
            this.moved = true;
            this.table = {
                tag: tag
            };
            this.table.width = ui.size.width;
            this.table.height = ui.size.height;
            this.table.position_h = ui.position.left - ui.originalSize.width / 2;
            this.table.position_v = ui.position.top - ui.originalSize.height / 2;
            var style = this.line_style_with_px();
            ui.helper.css(style);
            this.style_by_tag[tag] = this.line_style_without_px();
            this.pos.tag_selected = tag;
            $('.' + tag).css(style);
            this.ui_selected = ui;
            this.pos.set('crop_mode', {
                state: 'disconnected',
                pending: this._get_count_message_need_save()
            });
            this.pos.set('design-mode', {state: 'connected', pending: 0})
        },
        _save_ui: function () {
            var self = this;
            var values = [];

            function covert_int(value) {
                return parseInt(value)
            }

            for (var tag in this.style_by_tag) {
                var style = this.style_by_tag[tag];
                var style_vals = {
                    config_id: this.pos.config.id,
                    tag: tag,
                    top: covert_int(style.top),
                    height: covert_int(style.height),
                    left: covert_int(style.left),
                    width: covert_int(style.width),
                };
                if (style.background) {
                    style_vals['background'] = style.background
                }
                if (style['background-color']) {
                    style_vals['background'] = style['background-color'];
                }
                if (style['color']) {
                    style_vals['color'] = style['color'];
                }
                if (style['font-size']) {
                    style_vals['fontsize'] = covert_int(style['font-size']);
                }
                if (style['line-height']) {
                    style_vals['lineheight'] = covert_int(style['line-height']);
                }
                if (style['font-weight']) {
                    style_vals['fontweight'] = covert_int(style['font-weight']);
                }
                if (style['border-radius']) {
                    style_vals['borderradius'] = covert_int(style['border-radius']);
                }
                if (style['padding']) {
                    style_vals['padding'] = covert_int(style['padding']);
                }
                if (style['text-align']) {
                    style_vals['textalign'] = style['text-align'];
                }
                if (style['display']) {
                    style_vals['display'] = style['display'];
                }
                if (style['margin']) {
                    style_vals['margin'] = covert_int(style['margin']);
                }
                values.push(style_vals);
                this.pos.style_by_tag[tag] = style;
            }
            if (values.length) {
                rpc.query({
                    model: 'pos.ui',
                    method: 'save_design_ui_receipt',
                    args: [[], values],
                    context: {}
                }, {
                    shadow: true,
                    timeout: 65000
                }).then(function (values) {
                    self.pos.reload_pos()
                }, function (err) {
                    self.pos.gui.show_popup('error', {
                        title: _t('Warning'),
                        body: err.message
                    })
                })
            }
        },
        _handle_event_design: function () {
            var self = this;
            for (var i = 0; i < this.class_supported_design.length; i++) {
                var el_class = this.class_supported_design[i];
                var $elmenent = $('.' + el_class);
                if (!$elmenent || $elmenent.length == 0) {
                    continue
                }
                $elmenent.draggable({
                    appendTo: '.' + el_class,
                    refreshPositions: true,
                    stop: function (event, ui) {
                        self.el = this;
                        self.handle_draggable(event, ui);

                    }
                });
                $elmenent.resizable({
                    handles: 'all',
                    resize: self.handle_resizable_element.bind(self),
                });
                $elmenent.off('click');
                $elmenent.addClass('ready-design-ui');
                $elmenent.click(function (event) {
                    self._remove_active_design_receipt_ui();
                    var background = $(event.target).css('background');
                    var color = $(event.target).css('color');
                    var fontsize = $(event.target).css('font-size');
                    var lineheight = $(event.target).css('line-height');
                    var fontweight = $(event.target).css('font-weight');
                    var borderradius = $(event.target).css('border-radius');
                    var padding = $(event.target).css('padding');
                    var textalign = $(event.target).css('text-align');
                    var display = $(event.target).css('display');
                    var tag_selected = $(this).data('tag');
                    var margin = $(event.target).css('margin');
                    self.pos.set('selected-element', {
                        background: background,
                        color: color,
                        fontsize: parseInt(fontsize),
                        lineheight: parseInt(lineheight),
                        fontweight: parseInt(fontweight),
                        borderradius: parseInt(borderradius),
                        textalign: textalign,
                        padding: padding,
                        margin: margin,
                        display: display
                    });
                    $(this).addClass('element-selected');
                    self.pos.tag_selected = tag_selected;
                    event.preventDefault();
                    event.stopPropagation();
                });
            }
            $('.breadcrumb').off('click');
            $('.orderline').off('click');
            $('.input-button').off('click');
            $('.category-list simple').off('click');
            $('.breadcrumbs').css('display', 'none !important')
        },
        _remove_active_design_receipt_ui: function () {
            for (var i = 0; i < this.class_supported_design.length; i++) {
                var el_class = this.class_supported_design[i];
                var $elmenent = $('.' + el_class);
                $elmenent.removeClass('element-selected');
            }
        },
        show: function () {
            this._super();
            this.style_by_tag = {};
            this.pos.tag_selected = null;
            this.ui_selected = null;
            this.class_supported_design = [
                // header page
                // 'pos-topheader',
                // 'pos-branding',
                // 'pos-rightheader',
                // 'order-selector',
                // 'category-simple-button',
                // 'order-selector',
                // 'neworder-button',
                // 'deleteorder-button',
                // 'order-button',
                //
                'leftpane',
                'rightpane',
                // 'right-content',
                // 'left-content',
                // 'rightpane-header',
                // 'header_order',
                //
                // 'product-list-container',
                'product',
                'price-tag',
                'product-img',
                'box-product-name',
                // // 'orderline-product-name',
                'qty_available',
                //
                // 'icon_line',
                // 'find_customer',
                // // product screen
                // 'search-product',
                // 'breadcrumbs',
                // 'categories',
                // 'category-button',
                // 'category-name',
                // 'header_order',
                // 'numpad',
                // 'orderline',
                // // 'orderline-product-name',
                // 'orderline-qty',
                // 'orderline-price',
                // 'set-customer',
                // 'customer-name',
                // 'pay',
                // 'summary',
                // 'pos-screens-list',
                // 'control-button',
                // // Payment
                // 'paymentmethods-container',
                // 'payment-buttons',
                // 'next',
                // 'back',
                // 'left-content',
                // 'right-content',
                // 'paymentmethod',
                // 'total',
                // // client screen
                // 'search-partner',
                // 'top-content',
                // 'full-content',
                // 'label',
                // 'detail',
                // 'client-picture',
                // 'new-customer',
                // 'client-name',
            ];
        }
    });
    models.PosModel = models.PosModel.extend({
        reload_pos: function () {
            location.reload();
        },
        _get_style_by_element_tag: function (tag) {
            if (!this.style_by_tag) {
                return ''
            }
            var style = this.style_by_tag[tag];
            if (!style) {
                return ''
            }

            function unit_to_px(attribute, value) {
                return attribute + ':' + value + 'px !important;';
            }

            var style_to_string = 'vertical-align: middle !important;';
            if (style.width)
                style_to_string += unit_to_px('width', style.width);
            if (style.height && ['orderline', 'orderline-product-name'].indexOf(tag) == -1)
                style_to_string += unit_to_px('height', style.height);
            if (['set-customer'].indexOf(tag) != -1)
                style_to_string += unit_to_px('line-height', style.height);
            if (tag !== 'product-box') {
                if (style.top)
                    style_to_string += unit_to_px('top', style.top);
                if (style.left)
                    style_to_string += unit_to_px('left', style.left);
            }
            if (style.left || style.right) {
                style_to_string += ";float: none !important"
            }
            if (style.fontsize && style.fontsize > 0)
                style_to_string += unit_to_px('font-size', style.fontsize);
            if (style.lineheight && style.lineheight > 0)
                style_to_string += unit_to_px('line-height', style.lineheight);
            if (style.background)
                style_to_string += 'background:' + style.background + ';';
            if (style.color)
                style_to_string += 'color:' + style.color + ';';
            if (style.textalign)
                style_to_string += 'text-align:' + style.textalign + ';';
            if (style.display)
                style_to_string += 'display:' + style.display + ';';
            if (style.fontweight)
                style_to_string += 'font-weight:' + style.fontweight + ';';
            if (style.borderradius)
                style_to_string += unit_to_px('border-radius', style['borderradius']);
            if (style.padding)
                style_to_string += unit_to_px('padding', style['padding']);
            if (style.margin) {
                style_to_string += unit_to_px('margin', style['margin']);
            }
            style_to_string += 'left: unset ;';
            style_to_string += 'right: unset ;';
            return style_to_string;
        },
    });
    models.load_models([
        {
            model: 'pos.ui',
            fields: ['tag', 'top', 'left', 'width', 'height', 'background', 'parent_with', 'parent_height', 'fontsize', 'lineheight', 'borderradius', 'textalign', 'color', 'fontweight', 'padding', 'margin', 'display'],
            condition: function (self) {
                self.style_by_tag = {};
                return self.config.load_design_of_pos_config_id != null;
            },
            domain: function (self) {
                return [['config_id', '=', self.config.load_design_of_pos_config_id[0]]]
            },
            loaded: function (self, receipt_styles) {
                self.style_by_tag = {};
                for (var i = 0; i < receipt_styles.length; i++) {
                    var style = receipt_styles[i];
                    self.style_by_tag[style['tag']] = style;
                }
            }
        },
    ], {
        after: 'pos.config'
    });

    var DesignUiButtonWidget = chrome.StatusWidget.extend({
        template: 'DesignUiButtonWidget',
        start: function () {
            var self = this;
            this.product_screen = this.pos.gui.screen_instances['products'];
            this.pos.bind('change:crop_mode', function (pos, datas) {
                self.set_status(datas.state, datas.pending);
            });
            this.$el.click(function () {
                self.pos.design_mode = true;
                self.product_screen._handle_event_design();
                self.product_screen._save_ui();
                self.pos.set('design-mode', {state: 'connected', pending: 0});
                $('.design-widget').animate({opacity: 1,}, 200, 'swing', function () {
                    $('.design-widget').removeClass('oe_hidden');
                });
            });
        },
    });

    var UndoDesignUiButtonWidget = chrome.StatusWidget.extend({
        template: 'UndoDesignUiButtonWidget',
        start: function () {
            var self = this;
            this.$el.click(function () {
                self.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('We will remove all last design and back to default POS Odoo, are you sure to do it ?'),
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
                            // return self.pos.query_backend_fail(err);
                        })
                    }
                })
            });
        },
    });

    var DesignFormWidget = PosBaseWidget.extend({
        template: "DesignFormWidget",
        init: function (parent, options) {
            this._super(parent, options);
            this.style_element_selected = {};
            var self = this;
            this.pos.bind('change:selected-element', function (pos, style_element_selected) {
                self.style_element_selected = style_element_selected;
                self.renderElement();
                self.show();
                self._event_widget();
            });
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
        renderElement: function () {
            this._super();
            this.$el = this.$el;
        },
        show: function () {
            this.$el.css({opacity: 0});
            this.$el.removeClass('oe_hidden');
            this.$el.animate({opacity: 1}, 250, 'swing');
        },
        hide: function () {
            var self = this;
            this.$el.animate({opacity: 0,}, 250, 'swing', function () {
                self.$el.addClass('oe_hidden');
            });
        },
        start: function () {
            this._event_widget()
        },
        _event_widget: function () {
            var self = this;
            this.product_screen = this.pos.gui.screen_instances['products'];
            this.el.addEventListener('mouseleave', this.dragend_handler);
            this.el.addEventListener('mouseup', this.dragend_handler);
            this.el.addEventListener('touchend', this.dragend_handler);
            this.el.addEventListener('touchcancel', this.dragend_handler);
            this.el.addEventListener('mousedown', this.dragstart_handler);
            this.el.addEventListener('touchstart', this.dragstart_handler);
            this.el.addEventListener('mousemove', this.dragmove_handler);
            this.el.addEventListener('touchmove', this.dragmove_handler);

            this.$('.toggle').click(function () {
                self.hide();
            });
            this.$('.save').click(function () {
                self.product_screen._save_ui();
            });
            this.$('.confirm').click(function () {
                function to_px(value) {
                    return value + 'px'
                }

                var tag_selected = self.pos.tag_selected;
                if (!tag_selected) {
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Please select one area for apply new design')
                    })
                }
                var vals = {};
                if (!self.product_screen.style_by_tag[tag_selected]) {
                    self.product_screen.style_by_tag[tag_selected] = vals
                } else {
                    vals = self.product_screen.style_by_tag[tag_selected]
                }
                var background = $('.background').val();
                var font_size = $('.font-size').val();
                var line_height = $('.line-height').val();
                var font_weight = $('.font-weight').val();
                var border_radius = $('.border-radius').val();
                var text_align = $('.text-align').val();
                var display = $('.display').val();
                var padding = $('.padding').val();
                var color = $('.color').val();
                var margin = $('.margin').val();
                if (background) {
                    vals['background-color'] = background;
                }
                if (font_size) {
                    vals['font-size'] = to_px(font_size);
                }
                if (line_height) {
                    vals['line-height'] = to_px(line_height);
                }
                if (border_radius) {
                    vals['border-radius'] = to_px(border_radius);
                }
                if (padding) {
                    vals['padding'] = to_px(padding);
                }
                if (margin) {
                    vals['margin'] = to_px(margin)
                }
                if (font_weight) {
                    vals['font-weight'] = font_weight;
                }
                if (color) {
                    vals['color'] = color;
                }
                if (text_align) {
                    vals['text-align'] = text_align;
                }
                if (display) {
                    vals['display'] = display;
                }
                $('.' + tag_selected).removeClass('element-selected');
                $('.' + tag_selected).css(vals);
                self.product_screen.style_by_tag[tag_selected] = vals;
                self.pos.set('crop_mode', {
                    state: 'disconnected',
                    pending: self.product_screen._get_count_message_need_save()
                });
                self.pos.gui.show_popup('dialog', {
                    title: _t('Succeed'),
                    body: _t('Click save button if you need save design, else if need remove and rollback design please reload browse'),
                    color: 'success'
                })
            })
        }
    });

    // TODO: It not stable, we invisible it in sometimes
    // kimanh
    // chrome.Chrome.include({
    //     build_widgets: function () {
    //         if (this.pos.config.active_design_layout && this.pos.config.load_design_of_pos_config_id != null) {
    //             this.widgets.push(
    //                 {
    //                     'name': 'UndoDesignUiButtonWidget',
    //                     'widget': UndoDesignUiButtonWidget,
    //                     'append': '.pos-rightheader'
    //                 },
    //                 {
    //                     'name': 'DesignUiButtonWidget',
    //                     'widget': DesignUiButtonWidget,
    //                     'append': '.pos-rightheader'
    //                 },
    //                 {
    //                     'name': 'DesignFormWidget',
    //                     'widget': DesignFormWidget,
    //                     'append': '.pos-rightheader'
    //                 },
    //             );
    //         }
    //         this._super();
    //     }
    // });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        add_product: function (product, options) {
            if (!this.pos.design_mode) {
                return _super_Order.add_product.apply(this, arguments);
            }
        },
        select_orderline: function (line) {
            if (!this.pos.design_mode) {
                return _super_Order.select_orderline.apply(this, arguments);
            }
        }
    });

    screens.ProductCategoriesWidget.include({
        renderElement: function () {
            if (!this.pos.design_mode) {
                return this._super()
            }
        },
        reset_category: function () {
            if (!this.pos.design_mode) {
                return this._super()
            }
        },
    });

    return exports;
});
