"use strict";
odoo.define('pos_retail.screen_receipt', function (require) {

    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var _t = core._t;
    var BarcodeEvents = require('barcodes.BarcodeEvents').BarcodeEvents;
    var Printer = require('point_of_sale.Printer').Printer;

    screens.ReceiptScreenWidget.include({
        // TODO: when core active _onKeypadKeyDown, we turn off my event keyboard
        _onKeypadKeyDown: function (ev) {
            // if (this.buffered_key_events) {
            //     this.buffered_key_events = [];
            // }
            $(document).off('keydown.receipt_screen', this._event_keyboard);
            this._super(ev);
        },
        // TODO: so when core process end keyboard buffered keys, we turn on back my keyboard
        _handleBufferedKeys: function () {
            $(document).on('keydown.receipt_screen', this._event_keyboard);
            this._super();
        },
        // TODO: this is our event keyboard
        _on_event_keyboard: function (ev) {
            if (!_.contains(["INPUT", "TEXTAREA"], $(ev.target).prop('tagName'))) {
                this.buffered_keyboard.push(ev);
                this.timeout = setTimeout(_.bind(this._handle_event_keyboard, this), BarcodeEvents.max_time_between_keys_in_ms);
            }
        },
        _handle_event_keyboard: function () {
            for (var i = 0; i < this.buffered_keyboard.length; ++i) {
                var ev = this.buffered_keyboard[i];
                this.keyboard_handler(ev)
            }
            this.buffered_keyboard = [];
        },
        keyboard_handler: function (event) {
            var current_screen = this.pos.gui.get_current_screen();
            if (current_screen != 'receipt') {
                // todo: turn off event keyboard if user not still on receipt screen
                $(document).off('keydown.receipt_screen', this._event_keyboard);
                return true;
            }
            if (event.keyCode === 13) {
                this.click_next();
            }
            if (event.keyCode === 80) {
                this.print();
            }
        },
        close: function () {
            this._super();
            $(document).off('keydown.receipt_screen', this._event_keyboard);
        },
        init: function () {
            this._super.apply(this, arguments);
            this.buffered_keyboard = [];
        },
        start: function () {
            this._super();
            this._event_keyboard = this._on_event_keyboard.bind(this);
        },
        init_pos_before_calling: function (pos) {
            this.pos = pos;
        },
        get_email: function () {
            var order = this.pos.get_order();
            if (order && order.get_client() && order.get_client()['email']) {
                return  order.get_client().email
            } else {
                return ''
            }
        },
        get_note: function () {
            var order = this.pos.get_order();
            if (order && order.note) {
                return  order.note
            } else {
                return ''
            }
        },
        build_receipt: function (email, body) {
            var order = this.pos.get_order();
            var data = {
                widget: this,
                pos: order.pos,
                order: order,
                receipt: order.export_for_printing(),
                orderlines: order.get_orderlines(),
                paymentlines: order.get_paymentlines(),
            };

            var receipt = qweb.render('OrderReceipt', data);
            var printer = new Printer();
            return new Promise(function (resolve, reject) {
                printer.htmlToImg(receipt).then(function (ticket) {
                    rpc.query({
                        model: 'pos.order',
                        method: 'action_send_email_with_receipt_to_customer',
                        args: [order.get_name(), order.get_client(), ticket, email, body],
                    }).then(function () {
                        resolve();
                    }).catch(function () {
                        reject("There is no internet connection, impossible to send the email.");
                    });
                });
            });
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.send_email').click(function () {
                var order = self.pos.get_order();
                var email = self.$('.email').val();
                var body = self.$('.body').val();
                if (!email || email == "") {
                    self.$('.email_issue').text("Please input email Client !");
                    self.$('.email_result').text("");
                } else {
                    self.build_receipt(email, body).then(function () {
                        self.$('.email_issue').text("");
                        self.$('.email_result').text("Email send succeed !");
                    }, function (err) {
                        self.$('.email_issue').text("Could not send email, please check your internet or your odoo Email Setting !");
                        self.$('.email_result').text("");
                    });
                }
            });
        },
        show: function () {
            this.pos.gui.close_popup();
            this._super();
            this.$('.email').val(this.get_email())
            this.$('.body').val(this.get_note())
            this.$('.email_result').text("");
            this.$('.email_issue').text("");
            $(document).on('keydown.receipt_screen', this._event_keyboard);
        },
        print: function () {
            var self = this;
            this.$('.email-receipt-container').addClass('oe_hidden');
            this.$('.pos-receipt-container').css({'width': '100%', 'float': 'unset'})
            this._super();
            setTimeout(function () {
                self.$('.email-receipt-container').removeClass('oe_hidden');
                self.$('.pos-receipt-container').css({'width': '50%', 'float': 'left'})
            }, 1000)
        },
        handle_auto_print: function () {
            if (this.pos.config.auto_print_web_receipt) {
                return false
            } else {
                return this._super();
            }
        },
        should_auto_print: function () {
            if (!this.pos.get_order() || this.pos.config.auto_print_web_receipt) { // TODO: if active both fuute 1. iface_prin_auto (odoo) and auto print of this module, will have issue
                return false
            } else {
                return this._super()
            }
        },
        render_change: function () {
            if (this.pos.get_order()) {
                return this._super();
            }
        },
        get_receipt_render_env: function () {
            var data_print = this._super();
            if (this.pos.company.contact_address) {
                data_print.receipt.contact_address = this.pos.company.contact_address
            }
            var orderlines_by_category_name = {};
            var order = this.pos.get_order();
            var orderlines = order.orderlines.models;
            var categories = [];
            if (this.pos.config.category_wise_receipt) {
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var line_print = line.export_for_printing();
                    line['product_name_wrapped'] = line_print['product_name_wrapped'][0];
                    var pos_categ_id = line['product']['pos_categ_id'];
                    if (pos_categ_id && pos_categ_id.length == 2) {
                        var root_category_id = order.get_root_category_by_category_id(pos_categ_id[0]);
                        var category = this.pos.db.category_by_id[root_category_id];
                        var category_name = category['name'];
                        if (!orderlines_by_category_name[category_name]) {
                            orderlines_by_category_name[category_name] = [line];
                            var category_index = _.findIndex(categories, function (category) {
                                return category == category_name;
                            });
                            if (category_index == -1) {
                                categories.push(category_name)
                            }
                        } else {
                            orderlines_by_category_name[category_name].push(line)
                        }

                    } else {
                        if (!orderlines_by_category_name['None']) {
                            orderlines_by_category_name['None'] = [line]
                        } else {
                            orderlines_by_category_name['None'].push(line)
                        }
                        var category_index = _.findIndex(categories, function (category) {
                            return category == 'None';
                        });
                        if (category_index == -1) {
                            categories.push('None')
                        }
                    }
                }
            }
            data_print['orderlines_by_category_name'] = orderlines_by_category_name;
            data_print['categories'] = categories;
            data_print['total_paid'] = order.get_total_paid(); // save amount due if have (display on receipt of parital order)
            data_print['total_due'] = order.get_due(); // save amount due if have (display on receipt of parital order)
            data_print['invoice_ref'] = order.invoice_ref;
            data_print['picking_ref'] = order.picking_ref;
            data_print['order_fields_extend'] = order.order_fields_extend;
            data_print['delivery_fields_extend'] = order.delivery_fields_extend;
            data_print['invoice_fields_extend'] = order.invoice_fields_extend;
            return data_print
        },
        auto_next_screen: function () {
            var order = this.pos.get_order();
            var printed = false;
            if (order) {
                printed = order._printed;
            }
            if (this.pos.config.auto_print_web_receipt && !printed && order) {
                this.print();
                order._printed = true;

            }
            if (this.pos.config.auto_nextscreen_when_validate_payment && order) {
                this.click_next();
            }
        },
        actions_after_render_succeed_receipt: function () {
            this.auto_next_screen();
        },
        render_receipt: function () {
            $('.ui-helper-hidden-accessible').replaceWith();
            var self = this;
            this.pos.report_html = qweb.render('OrderReceipt', this.get_receipt_render_env());
            if (this.pos.config.duplicate_receipt && this.pos.config.print_number > 1) {
                var contents = this.$('.pos-receipt-container');
                contents.empty();
                var i = 0;
                var data = this.get_receipt_render_env();
                while (i < this.pos.config.print_number) {
                    contents.append(qweb.render('OrderReceipt', data));
                    i++;
                }
            } else {
                this._super();
                var contents = this.$('.pos-receipt-container');
                contents.empty();
                var data = this.get_receipt_render_env();
                contents.append(qweb.render('OrderReceipt', data));
            }
            setTimeout(function () {
                self.actions_after_render_succeed_receipt();
            }, 1000)
        },
    });
});
