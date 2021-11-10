"use strict";
odoo.define('pos_retail.screen_payment', function (require) {

    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var rpc = require('pos.rpc');
    var qweb = core.qweb;
    var BarcodeEvents = require('barcodes.BarcodeEvents').BarcodeEvents;
    var Session = require('web.Session');

    screens.PaymentScreenWidget.include({
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.pos.bind('auto_update:paymentlines', function () {
                self.order_changes();
                self.renderElement()
            });
            // TODO: we removed keyboard event of odoo pos core and included more event
            this.keyboard_keydown_handler = function (event) {
                console.log(event.keyCode)
                if (event.keyCode === 8 || event.keyCode === 46 || event.keyCode === 27) { // Backspace and Delete
                    event.preventDefault();
                    self.keyboard_handler(event);
                }
                if ([37, 38, 112, 113, 114, 115, 116, 117, 118, 119, 120].indexOf(event.keyCode) != -1) {
                    if (event.keyCode === 37) { // left
                        if (this.pos.get('orders').models.length == 0 || !this.pos.get_order()) {
                            return
                        }
                        var sequence = this.pos.get_order().sequence_number;
                        var i = sequence - 1;
                        while (i <= sequence) {
                            var last_order = _.find(this.pos.get('orders').models, function (o) {
                                return o.sequence_number == i
                            })
                            if (last_order) {
                                this.pos.set('selectedOrder', last_order);
                                break
                            }
                            if (i <= 0) {
                                i = this.pos.pos_session.sequence_number + 1
                                sequence = this.pos.pos_session.sequence_number + 2;
                                continue
                            }
                            i = i - 1;
                        }

                    } else if (event.keyCode === 39) { // right
                        if (this.pos.get('orders').models.length == 0 || !this.pos.get_order()) {
                            return
                        }
                        var sequence = this.pos.get_order().sequence_number;
                        var i = sequence + 1;
                        while (i >= sequence) {
                            var last_order = _.find(this.pos.get('orders').models, function (o) {
                                return o.sequence_number == i
                            })
                            if (last_order) {
                                this.pos.set('selectedOrder', last_order);
                                break
                            }
                            if (i > this.pos.pos_session.sequence_number) {
                                i = 0;
                                sequence = 0;
                                continue
                            }
                            i = i + 1;
                        }

                    } else if (event.keyCode >= 112 && event.keyCode <= 120) {
                        self.$("[keycode-id='" + event.keyCode + "']").click();
                    }
                }
            };
            this.keyboard_handler = function (event) {
                if (BarcodeEvents.$barcodeInput && BarcodeEvents.$barcodeInput.is(":focus")) {
                    return;
                }
                var selected_order = self.pos.get_order();
                console.log(event.keyCode)
                var key = '';
                if (event.type === "keypress") {
                    if (event.keyCode === 13) { // Enter
                        self.validate_order();
                    } else if (event.keyCode === 32) { // Space
                        // todo 1: if not full fill amount due, auto set full amount due
                        // todo 2: if due = 0, auto click validate order
                        if (selected_order.get_due() != 0) {
                            var selected_paymentline = selected_order.selected_paymentline;
                            if (selected_paymentline) {
                                selected_paymentline.set_amount(selected_order.get_due())
                            } else {
                                var payment_method_default = _.find(self.pos.payment_methods, function (method) {
                                    return method.pos_method_type == 'default';
                                });
                                var due = selected_order.get_due()
                                selected_order.add_paymentline(payment_method_default);
                                var selected_paymentline = selected_order.selected_paymentline;
                                selected_paymentline.set_amount(due);
                                self.render_paymentlines();
                                self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(due));
                            }
                            selected_order.trigger('change', selected_order);
                        } else {
                            self.validate_order();
                        }
                    } else if (event.keyCode === 37) { // left
                        if (this.pos.get('orders').models.length == 0 || !this.pos.get_order()) {
                            return
                        }
                        var sequence = this.pos.get_order().sequence_number;
                        var i = sequence - 1;
                        while (i <= sequence) {
                            var last_order = _.find(this.pos.get('orders').models, function (o) {
                                return o.sequence_number == i
                            })
                            if (last_order) {
                                this.pos.set('selectedOrder', last_order);
                                break
                            }
                            if (i <= 0) {
                                i = this.pos.pos_session.sequence_number + 1
                                sequence = this.pos.pos_session.sequence_number + 2;
                                continue
                            }
                            i = i - 1;
                        }

                    } else if (event.keyCode === 39) { // right
                        if (this.pos.get('orders').models.length == 0 || !this.pos.get_order()) {
                            return
                        }
                        var sequence = this.pos.get_order().sequence_number;
                        var i = sequence + 1;
                        while (i >= sequence) {
                            var last_order = _.find(this.pos.get('orders').models, function (o) {
                                return o.sequence_number == i
                            })
                            if (last_order) {
                                this.pos.set('selectedOrder', last_order);
                                break
                            }
                            if (i > this.pos.pos_session.sequence_number) {
                                i = 0;
                                sequence = 0;
                                continue
                            }
                            i = i + 1;
                        }

                    } else if (event.keyCode === 190 || // Dot
                        event.keyCode === 188 ||  // Comma
                        event.keyCode === 46) {  // Numpad dot
                        key = self.decimal_point;
                    } else if (event.keyCode >= 48 && event.keyCode <= 57) { // Numbers
                        key = '' + (event.keyCode - 48);
                    } else if (event.keyCode === 45) { // Minus
                        key = '-';
                    } else if (event.keyCode === 43) { // Plus
                        key = '+';
                    } else if (event.keyCode === 82) { // r: remove promotion
                        self.$('.button_remove_promotion').click();
                    } else if (event.keyCode == 100) { // d: add credit
                        self.$('.add_credit').click();
                    } else if (event.keyCode == 102) { // f: pay full
                        self.$('.paid_full').click();
                    } else if (event.keyCode == 112) {  // p: partial paid
                        self.$('.paid_partial').click();
                    } else if (event.keyCode == 98) {  // b: back screen
                        self.gui.back();
                    } else if (event.keyCode == 99) { // c: customer
                        self.$('.js_set_customer').click();
                    } else if (event.keyCode == 101) { // e: email
                        self.$('.js_email').click();
                    } else if (event.keyCode == 105) { // i: invoice
                        self.$('.js_invoice').click();
                    } else if (event.keyCode == 118) { // v: voucher
                        self.$('.input_voucher').click();
                    } else if (event.keyCode == 115) { // s: signature order
                        self.$('.js_signature_order').click();
                    } else if (event.keyCode == 116) { // t: tip
                        self.$('.js_tip').click();
                    } else if (event.keyCode == 110) { // n: note
                        self.$('.add_note').click();
                    } else if (event.keyCode == 109) { // n: email invoice
                        self.$('.send_invoice_email').click();
                    } else if (event.keyCode == 119) { // w: wallet
                        self.$('.add_wallet').click();
                    }
                } else { // keyup/keydown
                    if (event.keyCode === 46) { // Delete
                        key = 'CLEAR';
                    } else if (event.keyCode === 8) { // Backspace
                        key = 'BACKSPACE';
                    } else if (event.keyCode === 27) { // Backspace
                        self.gui.back();
                        self.pos.trigger('back:order');
                    }
                }
                self.payment_input(key);
                event.preventDefault();
            };
        },
        show: function () {
            this._super();
            this.reload_payment_methods();
            this.render_paymentlines();
            this.order_changes();
        },
        finalize_validation: function () {
            // TODO: if pos config missed setting Invoicing / Invoice Journal (invoice_journal_id)
            // We allow order continue and submit to backend without invoice
            var order = this.pos.get_order();
            // TODO: if pos setting not set printer but active iface_cashdrawer is true, force set iface_cashdrawer to false
            // TODO: if not force, function finalize_validation of odoo core error at line 2352 (code error: this.pos.proxy.printer.open_cashbox();)
            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer && !this.pos.proxy.printer) {
                this.pos.config.iface_cashdrawer = false;
            }
            var self = this;
            if (order.is_to_invoice()) {
                var invoice_journal_id = this.pos.config.invoice_journal_id;
                if (!invoice_journal_id) {
                    order.set_to_invoice(false);
                    return this.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Order set to invoice but POS config not setting Invoicing / Invoice Journal. If you wanted order submitted to backend without Invoice please confirm YES'),
                        confirm: function () {
                            return self.finalize_validation();
                        }
                    })
                } else {
                    this._super();
                }
            } else {
                this._super();
            }
        },
        auto_rounding_due_amount: function () {
            var selected_order = this.pos.get_order();
            var payment_method_rounding = _.find(this.pos.payment_methods, function (method) {
                return method.pos_method_type == 'rounding';
            });
            if (!selected_order || !payment_method_rounding) {
                return this.pos.gui.show_popup('dialog', {
                    title: _t('Warning'),
                    body: _t('You active Rounding on POS Profile but your POS profile have missed add Payment Method Rounding'),
                })
            }
            var due = selected_order.get_due();
            var amount_round = 0;
            if (this.pos.config.rounding_type == 'rounding_integer') {
                var decimal_amount = due - Math.floor(due);
                if (decimal_amount <= 0.25) {
                    amount_round = -decimal_amount
                } else if (decimal_amount > 0.25 && decimal_amount < 0.75) {
                    amount_round = 1 - decimal_amount - 0.5;
                    amount_round = 0.5 - decimal_amount;
                } else if (decimal_amount >= 0.75) {
                    amount_round = 1 - decimal_amount
                }
            } else {
                var after_round = Math.round(due * Math.pow(10, payment_method_rounding.journal.decimal_rounding)) / Math.pow(10, payment_method_rounding.journal.decimal_rounding);
                amount_round = after_round - due;
            }
            if (amount_round == 0) {
                return true;
            }
            var rounded_paymentline = _.find(selected_order.paymentlines.models, function (payment) {
                return payment.payment_method.journal && payment.payment_method.journal.pos_method_type == 'rounding';
            });
            if (rounded_paymentline) {
                rounded_paymentline.set_amount(-amount_round);
            } else {
                selected_order.add_paymentline(payment_method_rounding);
                var rounded_paymentline = selected_order.selected_paymentline;
                rounded_paymentline.set_amount(-amount_round);
            }
            selected_order.select_paymentline(rounded_paymentline);
            this.reset_input();
            this.render_paymentlines();
            this.pos.trigger('auto_update:paymentlines');
        },
        render_paymentlines: function () {
            var self = this;
            this._super();
            this.$('.payment-ref-button').click(function () {
                self.hide();
                var line_cid = $(this).data('cid');
                var line = self.pos.get_order().get_paymentline(line_cid);
                if (line.amount == 0) {
                    self.hide();
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Please set amount before set payment reference'),
                        confirm: function () {
                            self.show();
                        },
                        cancel: function () {
                            self.show()
                        }
                    })
                }
                self.pos.gui.show_popup('textarea', {
                    title: _t('Set Reference to Payment Line selected'),
                    value: line.ref,
                    confirm: function (ref) {
                        line.set_reference(ref);
                        self.show();
                    },
                    cancel: function () {
                        self.show()
                    }
                });
            })
        },
        click_numpad: function (button) {
            // TODO: when cashier click to numpad, 1) if pos have set rouding, rounding first 2) when (1) done, auto add payment method with pos method type required default
            if (this.pos.config.rounding_total_paid) {
                this.auto_rounding_due_amount();
            }
            var selected_order = this.pos.get_order();
            if (!selected_order) {
                return this._super(button)
            }
            var paymentlines = selected_order.get_paymentlines();
            var open_paymentline_is_paid = _.find(paymentlines, function (p) {
                return !p.paid && p.payment_method && p.payment_method.pos_method_type != "rounding";
            })
            if (!open_paymentline_is_paid) {
                var default_payment_method = _.find(this.pos.payment_methods, function (p) {
                    return p.pos_method_type == 'default'
                })
                if (default_payment_method) {
                    selected_order.add_paymentline(default_payment_method);
                    this.render_paymentlines();
                }
            }
            this._super(button)
        },
        click_paymentmethods: function (id) {
            if (this.pos.config.rounding_total_paid) {
                this.auto_rounding_due_amount();
            }
            this._super(id);
        },
        reload_payment_methods: function () {
            // TODO: reload payment methods element
            var methods = this.render_paymentmethods();
            this.$('.paymentmethods-container').empty();
            methods.appendTo(this.$('.paymentmethods-container'));
        },
        payment_input: function (input) {
            try {
                this._super(input);
            } catch (e) {
                this.reset_input();
            }
        },
        _update_payment_detail: function (order) {
            var amount_paid = order.paymentlines.reduce((function (sum, paymentLine) {
                if (paymentLine.get_payment_status()) {
                    if (paymentLine.get_payment_status() == 'done') {
                        sum += paymentLine.get_amount();
                    }
                } else {
                    sum += paymentLine.get_amount();
                }
                return sum;
            }), 0);
            var amount_total = order.get_total_with_tax();
            var amount_change = order.get_change();
            var amount_due = order.get_due();
            var remainning_amount = 0;
            if (amount_total - amount_paid >= 0) {
                remainning_amount = amount_total - amount_paid
            }
            var client = order.get_client();
            $('.remaining-amount').html(this.pos.gui.chrome.format_currency(remainning_amount));
            if (remainning_amount > 0) {
                $('.remaining-amount').addClass('oe_red')
            } else {
                $('.remaining-amount').addClass('oe_green')
            }
            if (amount_due >= 0) {
                $('.due-amount').html(this.pos.gui.chrome.format_currency(amount_due));
            } else {
                $('.due-amount').html(this.pos.gui.chrome.format_currency(0.00));
            }

            $('.change-amount').html(this.pos.gui.chrome.format_currency(amount_change));
            if (amount_change > 0) {
                $('.change-amount').addClass('oe_red')
            } else {
                $('.change-amount').addClass('oe_green')
            }
            $('.order-ref').html(order.uid);
            if (client) {
                $('.client-name').html(client.name);
                $('.credit-card').html(this.pos.gui.chrome.format_currency_no_symbol(client.balance));
                $('.wallet-card').html(this.pos.gui.chrome.format_currency_no_symbol(client.wallet));
                $('.points-card').html(this.pos.gui.chrome.format_currency_no_symbol(client.pos_loyalty_point));
            }
        },
        order_changes: function () {
            this._super();
            var order = this.pos.get_order();
            this.$('.add_wallet').removeClass('highlight');
            if (!order) {
                return;
            } else if (order.is_paid()) {
                var amount_due = order.get_due();
                this.$('.next_without_print_receipt').addClass('highlight');
                if (amount_due < 0) {
                    this.$('.add_wallet').addClass('highlight');
                }
            } else {
                this.$('.next_without_print_receipt').removeClass('highlight');
            }
            this._update_payment_detail(order);
        },
        click_set_customer: function () {
            var self = this;
            return this.gui.show_popup('popup_selection_extend', {
                title: _t('Request create Invoice, required select Customer'),
                fields: ['name', 'email', 'phone', 'mobile'],
                sub_datas: this.pos.db.get_partners_sorted(5),
                sub_search_string: this.pos.db.partner_search_string,
                sub_record_by_id: this.pos.db.partner_by_id,
                sub_template: 'clients_list',
                sub_button: '<div class="btn btn-success pull-right go_clients_screen">Go Clients Screen</div>',
                sub_button_action: function () {
                    self.pos.gui.show_screen('clientlist')
                },
                body: 'Please select one client',
                confirm: function (client_id) {
                    var client = self.pos.db.get_partner_by_id(client_id);
                    if (client) {
                        self.pos.gui.screen_instances["clientlist"]['new_client'] = client;
                        self.pos.trigger('client:save_changes');
                        self.show();
                    }
                }
            })
        },
        click_invoice: function () {
            var self = this;
            this._super();
            var order = this.pos.get_order();
            var invoice_journal_id = this.pos.config.invoice_journal_id;
            if (!invoice_journal_id) {
                order.set_to_invoice(false);
                this.$('.js_invoice').removeClass('highlight');
                return this.pos.gui.show_popup('error', {
                    title: _t('Warning'),
                    body: _t('Your pos setting not active Invoicing / Invoice Journal. Please close session and setup it before use this future')
                })
            }
            if (order.is_to_invoice()) {
                this.$('.js_invoice').addClass('highlight');
            } else {
                this.$('.js_invoice').removeClass('highlight');
            }
            if (order && !order.get_client() && order.is_to_invoice()) {
                this.click_set_customer();
            }
        },
        customer_changed: function () { // when client change, email invoice auto change
            this._super();
            var client = this.pos.get_client();
            var $send_invoice_email = this.$('.send_invoice_email');
            if (client && client.email) {
                if ($send_invoice_email && $send_invoice_email.length) {
                    $send_invoice_email.text(client ? client.email : _t('N/A'));
                }
            } else {
                if ($send_invoice_email && $send_invoice_email.length) {
                    $send_invoice_email.text('Email N/A');
                }
            }
        },
        click_invoice_journal: function (journal_id) { // change invoice journal when create invoice
            this.$('.journal').removeClass('highlight');
            var order = this.pos.get_order();
            order['sale_journal'] = journal_id;
            order.trigger('change', order);
            this.$('.journal').removeClass('highlight');
            var journal_selected = $("span[data-id='" + journal_id + "'][class='left_button paymentmethod journal']");
            journal_selected.addClass('highlight');
        },
        render_invoice_journals: function () { // render invoice journal, no use invoice journal default of pos
            var self = this;
            var methods = $(qweb.render('journal_list', {widget: this}));
            methods.on('click', '.journal', function () {
                self.click_invoice_journal($(this).data('id'));
            });
            return methods;
        },
        renderElement: function () {
            var self = this;
            if (this.pos.quickly_datas) {
                this.quickly_datas = this.pos.quickly_datas;
            } else {
                this.quickly_datas = []
            }
            this._super();
            if (this.pos.invoice_journals.length > 0) {
                var methods = this.render_invoice_journals();
                methods.appendTo(this.$('.invoice_journals'));
            }
            var order = this.pos.get_order();
            if (!order) {
                return;
            }
            this.$('.add_note').click(function () { //TODO: Button add Note
                var order = self.pos.get_order();
                if (order) {
                    self.hide();
                    self.gui.show_popup('textarea', {
                        title: _t('Add Order Note'),
                        value: order.get_note(),
                        confirm: function (note) {
                            order.set_note(note);
                            order.trigger('change', order);
                            self.show();
                            self.renderElement();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.js_signature_order').click(function () { //TODO: Signature on Order
                var order = self.pos.get_order();
                self.hide();
                self.gui.show_popup('popup_order_signature', {
                    order: order,
                    confirm: function (rate) {
                        self.show();
                    },
                    cancel: function () {
                        self.show();
                    }
                });
            });
            this.$('.paid_full').click(function () { // payment full
                var order = self.pos.get_order();
                var pricelist = order.pricelist;
                var payment_method = null;
                if (pricelist && pricelist.currency_id) {
                    payment_method = _.find(self.pos.payment_methods, function (method) {
                        return method.journal && method.journal.pos_method_type == 'default' && method.journal.currency_id && method.journal.currency_id[0] == pricelist.currency_id[0];
                    })
                } else {
                    payment_method = _.find(self.pos.payment_methods, function (method) {
                        return method.journal && !method.journal.currency_id;
                    })
                }
                var selected_paymentline = order.selected_paymentline;
                if (!selected_paymentline && payment_method) {
                    order.add_paymentline(payment_method);
                    self.render_paymentlines();
                    selected_paymentline = order.selected_paymentline;
                }
                if (selected_paymentline) {
                    selected_paymentline.set_amount(0);
                    var amount_due = order.get_due();
                    if (amount_due > 0) {
                        selected_paymentline.set_amount(amount_due);
                        self.reset_input();
                        self.render_paymentlines();
                    } else {
                        return self.pos.gui.show_popup('confirm', {
                            title: 'Warning',
                            body: 'Your Order payment full succeed, have not amount due'
                        })
                    }
                } else {
                    self.wrong_input("span[class='left_button paymentmethod']", "Please select payment method");
                    return self.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: _t('Please select Payment Method on right Page the first')
                    })
                }
                return self.pos.gui.show_popup('confirm', {
                    title: _t('Order Finished'),
                    body: _t('Submit and Print Receipt now ?'),
                    confirm: function () {
                        self.validate_order();
                    }
                })

            });
            this.$('.paid_partial').click(function () {
                var order = self.pos.get_order();
                return self.gui.show_popup('confirm', {
                    title: _t('Alert'),
                    body: _t('Total Amount of Order is: ' + self.gui.chrome.format_currency(order.get_total_with_tax()) + ', and you wanted submit Order with amount paid is: ' + self.gui.chrome.format_currency(order.get_total_paid() - order.get_change())),
                    confirm: function () {
                        var order = self.pos.get_order();
                        order.do_partial_payment();
                    }
                })
            });
            this.$('.next_without_print_receipt').click(function () {
                var is_valid = self.order_is_valid();
                if (is_valid) {
                    var order = self.pos.get_order();
                    order._printed = true;
                    self.pos.config.auto_print_web_receipt = false;
                    self.finalize_validation();
                    setTimeout(function () {
                        $('.next').click()
                    }, 500)
                } else {
                    self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Payments Lines is Blank or Order is not valid')
                    })
                }
            });
            this.$('.print_receipt_number').click(function () {
                return self.pos.gui.show_popup('number', {
                    title: 'How many Receipt wanted copy ?',
                    confirm: function (number) {
                        if (number > 0) {
                            self.pos.config.duplicate_receipt = true;
                        }
                        self.pos.config.print_number = number;
                        self.show();
                        self.renderElement();
                    },
                    cancel: function () {
                        self.show();
                        self.renderElement();
                    }
                })
            });
            this.$('.category_wise_receipt').click(function () {
                self.pos.config.category_wise_receipt = !self.pos.config.category_wise_receipt;
                self.show();
                self.renderElement();
            });
            this.$('.barcode-receipt').click(function () {
                self.pos.config.barcode_receipt = !self.pos.config.barcode_receipt;
                self.show();
                self.renderElement();
            });
            this.$('.auto_nextscreen_when_validate_payment').click(function () {
                self.pos.config.auto_nextscreen_when_validate_payment = !self.pos.config.auto_nextscreen_when_validate_payment;
                self.show();
                self.renderElement();
            });
            this.$('.auto_print_web_receipt').click(function () {
                self.pos.config.auto_print_web_receipt = !self.pos.config.auto_print_web_receipt;
                self.show();
                self.renderElement();
            });
            this.$('.add_wallet').click(function () { // add change amount to wallet card
                self.hide();
                var order = self.pos.get_order();
                var change = order.get_change();
                var wallet_journal = _.find(self.pos.account_journals, function (journal) {
                    return journal.pos_method_type == 'wallet'
                });
                if (!wallet_journal) {
                    self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Your system missed add Wallet journal, please create journal wallet with pos method is wallet and add it to Payment Method',
                        confirm: function () {
                            self.show()
                        },
                        cancel: function () {
                            self.show()
                        }
                    })
                }
                var wallet_method = _.find(self.pos.payment_methods, function (method) {
                    return method.journal && method.journal['id'] == wallet_journal['id'];
                });
                if (!wallet_method) {
                    return self.pos.gui.show_popup('confirm', {
                        title: 'Warning',
                        body: 'Payment method Wallet have not add to your pos config, contact admin and add it before use this future',
                        confirm: function () {
                            self.show()
                        },
                        cancel: function () {
                            self.show()
                        }
                    })
                }
                if (order && !order.get_client()) {
                    self.pos.gui.show_screen('clientlist');
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Required select customer for add Wallet Amount'),
                    });
                }
                if (!change || change == 0) {
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Order change empty'),
                        cancel: function () {
                            self.show();
                            self.renderElement();
                            self.order_changes();
                            return self.pos.gui.close_popup();
                        },
                        confirm: function () {
                            self.show();
                            self.renderElement();
                            self.order_changes();
                            return self.pos.gui.close_popup();
                        }
                    });
                }
                if (!order.finalized) {
                    self.gui.show_popup('number', {
                        'title': _t('Add Change Amount to Wallet Card of: ' + order.get_client().name),
                        'value': change,
                        'confirm': function (value) {
                            if (value <= order.get_change()) {
                                order.add_paymentline(wallet_method);
                                var paymentline = order.selected_paymentline;
                                paymentline.set_amount(-value);
                                order.trigger('change', order);
                            } else {
                                self.pos.gui.show_popup('confirm', {
                                    title: _t('Warning'),
                                    body: _t('It not possible set Wallet amount bigger than Change Amount'),
                                    cancel: function () {
                                        self.show();
                                        return self.pos.gui.close_popup();
                                    },
                                    confirm: function () {
                                        self.show();
                                        return self.pos.gui.close_popup();
                                    }
                                });
                            }
                            self.show();
                            self.renderElement();
                            self.order_changes();
                        },
                        cancel: function () {
                            self.show();
                            self.renderElement();
                        }
                    });
                }
            });
            this.$('.add_credit').click(function () { // add return amount to credit card
                var order = self.pos.get_order();
                order.add_order_credit();
            });
            this.$('.quickly-payment').click(function () { // Quickly Payment
                var quickly_payment_id = parseInt($(this).data('id'));
                var quickly_payment = self.pos.quickly_payment_by_id[quickly_payment_id];
                var order = self.pos.get_order();
                var cash_method = _.find(self.pos.payment_methods, function (method) {
                    return method.cash_journal_id
                });
                var selected_paymentline = order.selected_paymentline;
                if (selected_paymentline) {
                    var amount = quickly_payment['amount'] + selected_paymentline['amount'];
                    order.selected_paymentline.set_amount(amount);
                    self.render_paymentlines();
                    self.$('.paymentline.selected .edit').text(self.format_currency_no_symbol(amount));
                }
                if (!selected_paymentline && cash_method) {
                    order.add_paymentline(cash_method);
                    self.reset_input();
                    self.payment_interface = cash_method.payment_terminal;
                    if (self.payment_interface) {
                        order.selected_paymentline.set_payment_status('pending');
                    }
                    var selected_paymentline = order.selected_paymentline;
                    selected_paymentline.set_amount(quickly_payment['amount']);
                    self.render_paymentlines();
                    $('.paymentline.selected .edit').text(self.format_currency_no_symbol(quickly_payment['amount']));
                }
            });
            this.$('.send_invoice_email').click(function () { // input email send invoice
                var order = self.pos.get_order();
                var client = order.get_client();
                if (client) {
                    if (client.email) {
                        var email_invoice = order.is_email_invoice();
                        order.set_email_invoice(!email_invoice);
                        if (order.is_email_invoice()) {
                            self.$('.send_invoice_email').addClass('highlight');
                            if (!order.to_invoice) {
                                self.$('.js_invoice').click();
                            }
                        } else {
                            self.$('.send_invoice_email').removeClass('highlight');
                            if (order.to_invoice) {
                                self.$('.js_invoice').click();
                            }
                        }
                    } else {
                        self.pos.gui.show_screen('clientlist');
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: _t('Customer email is blank, please update')
                        })
                    }

                } else {
                    self.pos.gui.show_screen('clientlist');
                    return self.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Please select client the first')
                    })
                }
            });
        },
        _is_pos_order_paid: function (order) {
            if (order.is_return) {
                return true
            }
            var amount_paid = order.paymentlines.reduce((function (sum, paymentLine) {
                if (paymentLine.get_payment_status()) {
                    if (paymentLine.get_payment_status() == 'done') {
                        sum += paymentLine.get_amount();
                    }
                } else {
                    sum += paymentLine.get_amount();
                }
                return sum;
            }), 0);
            var amount_total = order.get_total_with_tax();
            var amount_change = order.get_change();
            if ((amount_change + amount_total - amount_paid) >= 0.00000001) {
                this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Order not fully paid amount')
                });
                return false
            }
            if (amount_total <= 0 && !this.pos.config.allow_payment_zero) {
                this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('It not possible allow Amount Total is Zero')
                });
                return false
            }
            return true
        },
        validate_order: function (force_validation) {
            // TODO: if return in this method, it mean no call super method Odoo POS Original (*), if not call (*): it mean order not valid
            var self = this;
            self.force_validation = force_validation;
            var order = this.pos.get_order();
            if (!this._is_pos_order_paid(order)) {
                return false
            }
            // TODO: we checking stock on hand available for sale
            if (!this.pos.config.allow_order_out_of_stock) {
                var orderlines = order.orderlines.models;
                for (var i = 0; i < orderlines.length; i++) {
                    var line = orderlines[i];
                    var warning_message = line._validate_stock_on_hand();
                    if (warning_message == true) {
                        continue
                    } else {
                        return this.pos.gui.show_popup('confirm', {
                            title: _t('Warning, Your POS setting not allow sale product when products out of stock'),
                            body: warning_message,
                        });
                    }
                }
            }
            if (order.is_return) {
                if (order.paymentlines.models.length == 0) {
                    return this.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: _t('Please choose Payment Method')
                    });
                }
            }
            var wallet = 0;
            var use_wallet = false;
            var credit = 0;
            var use_credit = false;
            var payments_lines = order.paymentlines.models;
            var client = this.pos.get_order().get_client();
            if (client) {
                for (var i = 0; i < payments_lines.length; i++) {
                    var payment_line = payments_lines[i];
                    var cash_journal_id = payment_line.payment_method.cash_journal_id;
                    if (!cash_journal_id) {
                        continue
                    } else {
                        var journal = this.pos.journal_by_id[cash_journal_id[0]]
                        if (journal['pos_method_type'] == 'wallet') {
                            wallet += payment_line.get_amount();
                            use_wallet = true;
                        }
                        if (journal['pos_method_type'] == 'credit') {
                            credit += payment_line.get_amount();
                            use_credit = true;
                        }
                    }
                }
                if (client['wallet'] < wallet && use_wallet == true) {
                    this.pos.gui.show_popup('confirm', {
                        title: _t('Warning'),
                        body: client.name + ' have Wallet Amount ' + ' only have ' + this.pos.chrome.format_currency(client['wallet']) + '. It not possible set payment line amount bigger than ' + this.pos.chrome.format_currency(client['wallet'])
                    });
                    return false;
                }
                if (!order.is_return && client && (client['balance'] - credit < 0) && use_credit == true) {
                    this.pos.gui.show_popup('confirm', {
                        title: _t('Error'),
                        body: client.name + ' have Credit Amount ' + this.pos.chrome.format_currency(client['balance']) + '. It not possible set payment line amount bigger than ' + this.pos.chrome.format_currency(client['balance'])
                    });
                    return false;
                }
            }
            if (this.pos.config.allow_offline_mode) {
                var iot_url = this.pos.session.origin;
                var connection = new Session(void 0, iot_url, {
                    use_cors: true
                });
                connection.rpc('/pos/passing/login', {}, {shadow: true, timeout: 650000}).then(function (result) {
                    if (result == 'ping') {
                        if (self.order_is_valid(self.force_validation)) {
                            self.pos.gui.screen_instances['payment'].finalize_validation();
                        }
                    }
                }, function (err) {
                    if (err.message.code == -32098) {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: _t('Your Odoo Offline mode or Your Device have problem about internet, please checking your internet connection first'),
                        })
                    } else {
                        return self.pos.gui.show_popup('confirm', {
                            title: _t('Warning'),
                            body: err.message.message,
                        })
                    }
                })
            } else {
                return this._super(force_validation);
            }
        }
    });
});
