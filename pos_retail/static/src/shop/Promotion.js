"use strict";
odoo.define('pos_retail.promotion', function (require) {
    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var qweb = core.qweb;
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');

    var exports = {};
    var Backbone = window.Backbone;
    var bus = require('pos_retail.core_bus');
    var time = require('web.time');

    models.load_models([
        {
            model: 'pos.promotion',
            fields: [
                'name',
                'start_date',
                'end_date',
                'type',
                'product_id',
                'discount_lowest_price',
                'product_ids',
                'minimum_items',
                'discount_first_order',
                'special_customer_ids',
                'promotion_birthday',
                'promotion_birthday_type',
                'promotion_group',
                'promotion_group_ids',
                'pos_branch_ids',
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday',
                'from_time',
                'to_time',
                'special_days',
                'special_times',
                'method',
                'amount_total'
            ],
            domain: function (self) {
                // Todo: load all promotions have added on pos setting
                var domains = [
                    ['state', '=', 'active'],
                    ['start_date', '<=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                    ['end_date', '>=', time.date_to_str(new Date()) + " " + time.time_to_str(new Date())],
                    ['id', 'in', self.config.promotion_ids]
                ];
                return domains
            },
            promotion: true,
            loaded: function (self, promotions) {
                var promotion_applied = [];
                for (var i = 0; i < promotions.length; i++) {
                    var promotion = promotions[i];
                    if (self.config.pos_branch_id) {  // TODO case 1: if pos setting have set branch
                        if (!promotion.pos_branch_ids.length) {
                            promotion_applied.push(promotion);
                            continue
                        }
                        if (promotion.pos_branch_ids.indexOf(self.config.pos_branch_id[0]) != -1) {
                            promotion_applied.push(promotion);
                            continue
                        }
                    } else { // TODO case 2: if pos setting not set branch
                        if (promotion.pos_branch_ids.length == 0) {
                            promotion_applied.push(promotion);
                        }
                    }
                }
                self.promotions = promotion_applied;
                self.promotion_by_id = {};
                self.promotion_ids = [];
                var i = 0;
                while (i < promotions.length) {
                    self.promotion_by_id[promotions[i].id] = promotions[i];
                    self.promotion_ids.push(promotions[i].id);
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.order',
            fields: ['minimum_amount', 'discount', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts) {
                self.promotion_discount_order_by_id = {};
                self.promotion_discount_order_by_promotion_id = {};
                var i = 0;
                while (i < discounts.length) {
                    self.promotion_discount_order_by_id[discounts[i].id] = discounts[i];
                    if (!self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]]) {
                        self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]] = [discounts[i]]
                    } else {
                        self.promotion_discount_order_by_promotion_id[discounts[i].promotion_id[0]].push(discounts[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.category',
            fields: ['category_id', 'discount', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts_category) {
                self.promotion_by_category_id = {};
                var i = 0;
                while (i < discounts_category.length) {
                    self.promotion_by_category_id[discounts_category[i].category_id[0]] = discounts_category[i];
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.quantity',
            fields: ['product_id', 'quantity', 'discount', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts_quantity) {
                self.promotion_quantity_by_product_id = {};
                var i = 0;
                while (i < discounts_quantity.length) {
                    if (!self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]]) {
                        self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]] = [discounts_quantity[i]]
                    } else {
                        self.promotion_quantity_by_product_id[discounts_quantity[i].product_id[0]].push(discounts_quantity[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.gift.condition',
            fields: ['product_id', 'minimum_quantity', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, gift_conditions) {
                self.promotion_gift_condition_by_promotion_id = {};
                var i = 0;
                while (i < gift_conditions.length) {
                    if (!self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]]) {
                        self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]] = [gift_conditions[i]]
                    } else {
                        self.promotion_gift_condition_by_promotion_id[gift_conditions[i].promotion_id[0]].push(gift_conditions[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.gift.free',
            fields: ['product_id', 'quantity_free', 'promotion_id', 'type'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, gifts_free) {
                self.promotion_gift_free_by_promotion_id = {};
                var i = 0;
                while (i < gifts_free.length) {
                    if (!self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]]) {
                        self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]] = [gifts_free[i]]
                    } else {
                        self.promotion_gift_free_by_promotion_id[gifts_free[i].promotion_id[0]].push(gifts_free[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.condition',
            fields: ['product_id', 'minimum_quantity', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discount_conditions) {
                self.promotion_discount_condition_by_promotion_id = {};
                var i = 0;
                while (i < discount_conditions.length) {
                    if (!self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]]) {
                        self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]] = [discount_conditions[i]]
                    } else {
                        self.promotion_discount_condition_by_promotion_id[discount_conditions[i].promotion_id[0]].push(discount_conditions[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.discount.apply',
            fields: ['product_id', 'discount', 'promotion_id', 'type'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, discounts_apply) {
                self.promotion_discount_apply_by_promotion_id = {};
                var i = 0;
                while (i < discounts_apply.length) {
                    if (!self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]]) {
                        self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]] = [discounts_apply[i]]
                    } else {
                        self.promotion_discount_apply_by_promotion_id[discounts_apply[i].promotion_id[0]].push(discounts_apply[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.price',
            fields: ['product_id', 'minimum_quantity', 'price_down', 'promotion_id'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, prices) {
                self.promotion_price_by_promotion_id = {};
                var i = 0;
                while (i < prices.length) {
                    if (!self.promotion_price_by_promotion_id[prices[i].promotion_id[0]]) {
                        self.promotion_price_by_promotion_id[prices[i].promotion_id[0]] = [prices[i]]
                    } else {
                        self.promotion_price_by_promotion_id[prices[i].promotion_id[0]].push(prices[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.special.category',
            fields: ['category_id', 'type', 'count', 'discount', 'promotion_id', 'product_id', 'qty_free'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, promotion_lines) {
                self.promotion_special_category_by_promotion_id = {};
                var i = 0;
                while (i < promotion_lines.length) {
                    if (!self.promotion_special_category_by_promotion_id[promotion_lines[i].promotion_id[0]]) {
                        self.promotion_special_category_by_promotion_id[promotion_lines[i].promotion_id[0]] = [promotion_lines[i]]
                    } else {
                        self.promotion_special_category_by_promotion_id[promotion_lines[i].promotion_id[0]].push(promotion_lines[i])
                    }
                    i++;
                }
            }
        }, {
            model: 'pos.promotion.multi.buy',
            fields: ['promotion_id', 'product_ids', 'list_price', 'qty_apply'],
            condition: function (self) {
                return self.promotion_ids && self.promotion_ids.length > 0;
            },
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            promotion: true,
            loaded: function (self, multi_buy) {
                self.multi_buy = multi_buy;
                self.multi_buy_by_promotion_id = {};
                for (var i = 0; i < multi_buy.length; i++) {
                    var rule = multi_buy[i];
                    if (!self.multi_buy_by_promotion_id[rule.promotion_id[0]]) {
                        self.multi_buy_by_promotion_id[rule.promotion_id[0]] = [rule]
                    } else {
                        self.multi_buy_by_promotion_id[rule.promotion_id[0]].push(rule);
                    }
                }
            }
        }
    ], {after: 'pos.config'});
    exports.pos_sync_prmotions = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        start: function () {
            this.bus = bus.bus;
            this.bus.last = this.pos.db.load('bus_last', 0);
            this.bus.on("notification", this, this.on_notification);
            this.bus.start_polling();
        },
        on_notification: function (notifications) {
            if (notifications && notifications[0] && notifications[0][1]) {
                for (var i = 0; i < notifications.length; i++) {
                    var channel = notifications[i][0][1];
                    if (channel == 'pos.sync.promotions') {
                        var promotions_model = _.filter(this.pos.models, function (model) {
                            return model.promotion
                        });
                        if (promotions_model) {
                            for (var i = 0; i < promotions_model.length; i++) {
                                var model = promotions_model[i];
                                this.pos.load_server_data_by_model(model);
                            }
                        }
                    }
                }
            }
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                self.pos_sync_prmotions = new exports.pos_sync_prmotions(self);
                self.pos_sync_prmotions.start();
                return true;
            })
        },
    });

    screens.PaymentScreenWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.button_remove_promotion').click(function () {
                var order = self.pos.get_order();
                order.remove_all_promotion_line();
            });
            this.$('.button_promotion').click(function () {
                var order = self.pos.get_order();
                order.remove_all_promotion_line();
                var promotion_manual_select = self.pos.config.promotion_manual_select;
                if (!promotion_manual_select) {
                    order.apply_promotion()
                } else {
                    var promotion_datas = order.get_promotions_active();
                    var promotions_active = promotion_datas['promotions_active'];
                    if (promotions_active.length) {
                        return self.pos.gui.show_popup('popup_selection_promotions', {
                            title: _t('Promotions'),
                            body: _t('Please choice promotions and confirm'),
                            promotions_active: promotions_active
                        })
                    } else {
                        return self.pos.gui.show_popup('dialog', {
                            title: _t('Warning'),
                            body: _t('Promotions un-active'),
                        })
                    }

                }
            });
        }
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        init_from_JSON: function (json) {
            var res = _super_Orderline.init_from_JSON.apply(this, arguments);
            if (json.promotion) {
                this.promotion = json.promotion;
            }
            if (json.promotion_gift) {
                this.promotion_gift = json.promotion_gift;
            }
            if (json.promotion_id) {
                this.promotion_id = json.promotion_id;
            }
            if (json.promotion_discount) {
                this.promotion_discount = json.promotion_discount;
            }
            if (json.promotion_amount) {
                this.promotion_amount = json.promotion_amount;
            }
            if (json.promotion_reason) {
                this.promotion_reason = json.promotion_reason;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Orderline.export_as_JSON.apply(this, arguments);
            if (this.promotion) {
                json.promotion = this.promotion;
            }
            if (this.promotion_gift) {
                json.promotion_gift = this.promotion_gift;
            }
            if (this.promotion_id) {
                json.promotion_id = this.promotion_id;
            }
            if (this.promotion_reason) {
                json.promotion_reason = this.promotion_reason;
            }
            if (this.promotion_discount) {
                json.promotion_discount = this.promotion_discount;
            }
            if (this.promotion_amount) {
                json.promotion_amount = this.promotion_amount;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt_line = _super_Orderline.export_for_printing.apply(this, arguments);
            receipt_line['promotion'] = null;
            receipt_line['promotion_reason'] = null;
            if (this.promotion) {
                receipt_line.promotion = this.promotion;
                receipt_line.promotion_reason = this.promotion_reason;
            }
            return receipt_line;
        },
        can_be_merged_with: function (orderline) {
            var merge = _super_Orderline.can_be_merged_with.apply(this, arguments);
            if (this.promotion) {
                return false;
            }
            return merge
        },
        set_quantity: function (quantity, keep_price) {
            _super_Orderline.set_quantity.apply(this, arguments);
            if (!this.promotion && quantity == 'remove' || quantity == '') {
                this.order.remove_all_promotion_line();
            }
        },
        get_unit_price: function () {
            var unit_price = _super_Orderline.get_unit_price.apply(this, arguments);
            if (this.promotion_id) {
                if (this.promotion_amount > 0) {
                    unit_price = unit_price - this.promotion_amount
                }
                if (this.promotion_discount > 0) {
                    unit_price = unit_price - (unit_price * this.promotion_discount / 100)
                }
            }
            return unit_price;
        }
    });
    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            if (this.promotion_amount) {
                json.promotion_amount = this.promotion_amount;
            }
            return json;
        },
        export_for_printing: function () {
            var receipt = _super_Order.export_for_printing.call(this);
            if (this.promotion_amount) {
                receipt.promotion_amount = this.promotion_amount;
            }
            return receipt
        },
        validate_promotion: function () {
            var self = this;
            this.remove_all_promotion_line();
            var datas = this.get_promotions_active();
            var promotions_active = datas['promotions_active'];
            if (promotions_active.length) {
                if (!this.pos.config.promotion_auto_add) {
                    this.pos.gui.show_screen('products');
                    this.pos.gui.show_popup('confirm', {
                        title: _t('Promotions Active'),
                        body: _t('Have some Promotions active, Do you want apply promotions on this order ?'),
                        confirm: function () {
                            self.remove_all_promotion_line();
                            self.apply_promotion();
                            setTimeout(function () {
                                self.validate_global_discount();
                            }, 1000);
                            self.pos.gui.show_screen('payment');
                        },
                        cancel: function () {
                            setTimeout(function () {
                                self.validate_global_discount();
                            }, 1000);
                            self.pos.gui.show_screen('payment');
                        }
                    });
                } else {
                    this.apply_promotion();
                }
            } else {
                setTimeout(function () {
                    self.validate_global_discount();
                }, 1000);
            }
        },
        get_amount_total_without_promotion: function () {
            var lines = _.filter(this.orderlines.models, function (line) {
                return !line['is_return'] && !line['promotion']
            });
            var amount_total = 0;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (this.pos.config.iface_tax_included === 'total') {
                    amount_total += line.get_price_with_tax();
                } else {
                    amount_total += line.get_price_without_tax();
                }
            }
            return amount_total;
        },
        apply_promotion: function (promotions) {
            /*
                If not promotions send me, it mean automatic apply
                We will get all promotions active and set to order
             */
            if (this.is_return) {
                return this.pos.gui.show_popup('confirm', {
                    title: _t('Warning'),
                    body: _t('Return order not allow apply promotions'),
                });
            }
            if (!promotions) {
                promotions = this.get_promotions_active()['promotions_active'];
            }
            if (promotions) {
                this.remove_all_promotion_line();
                for (var i = 0; i < promotions.length; i++) {
                    var type = promotions[i].type
                    var order = this;
                    if (order.orderlines.length) {
                        if (type == '1_discount_total_order') {
                            order.compute_discount_total_order(promotions[i]);
                        }
                        if (type == '2_discount_category') {
                            order.compute_discount_category(promotions[i]);
                        }
                        if (type == '3_discount_by_quantity_of_product') {
                            order.compute_discount_by_quantity_of_products(promotions[i]);
                        }
                        if (type == '4_pack_discount') {
                            order.compute_pack_discount(promotions[i]);
                        }
                        if (type == '5_pack_free_gift') {
                            order.compute_pack_free_gift(promotions[i]);
                        }
                        if (type == '6_price_filter_quantity') {
                            order.compute_price_filter_quantity(promotions[i]);
                        }
                        if (type == '7_special_category') {
                            order.compute_special_category(promotions[i]);
                        }
                        if (type == '8_discount_lowest_price') {
                            order.compute_discount_lowest_price(promotions[i]);
                        }
                        if (type == '9_multi_buy') {
                            order.compute_multi_buy(promotions[i]);
                        }
                        if (type == '10_buy_x_get_another_free') {
                            order.compute_buy_x_get_another_free(promotions[i]);
                        }
                        if (type == '11_first_order') {
                            order.compute_first_order(promotions[i]);
                        }
                        if (type == '12_buy_total_items_free_items') {
                            order.compute_buy_total_items_free_items(promotions[i]);
                        }
                        if (type == '13_gifts_filter_by_total_amount') {
                            order.compute_gifts_filter_by_total_amount(promotions[i]);
                        }
                    }
                }
                var applied_promotion = false;
                var total_promotion_line = 0;
                for (var i = 0; i < this.orderlines.models.length; i++) {
                    if (this.orderlines.models[i]['promotion'] == true) {
                        applied_promotion = true;
                        total_promotion_line += 1;
                    }
                }
                this.trigger('change', this);
            }
        },
        remove_all_buyer_promotion_line: function () {
            var lines = this.orderlines.models;
            for (var n = 0; n < 2; n++) {
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line['buyer_promotion']) {
                        this.orderlines.remove(line);
                    }
                }
            }
        },
        remove_all_promotion_line: function () {
            var lines = this.orderlines.models;
            for (var n = 0; n < 2; n++) {
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line['promotion']) {
                        if (line.promotion && line.promotion_id && (line.promotion_discount || line.promotion_amount)) {
                            line.promotion = false;
                            line.promotion_id = null;
                            line.promotion_discount = null;
                            line.promotion_amount = null;
                            line.promotion_reason = null;
                            line.trigger('change', line)
                        } else {
                            this.orderlines.remove(line);
                        }
                    }
                }
            }
        },
        product_quantity_by_product_id: function () {
            var lines_list = {};
            var lines = this.orderlines.models;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion) {
                    i++;
                    continue
                }
                if (!lines_list[line.product.id]) {
                    lines_list[line.product.id] = line.quantity;
                } else {
                    lines_list[line.product.id] += line.quantity;
                }
                i++;
            }
            return lines_list
        },
        total_price_by_product_id: function () {
            var total_price_by_product = {};
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (this.pos.config.iface_tax_included === 'total') {
                    if (!total_price_by_product[line.product.id]) {
                        total_price_by_product[line.product.id] = line.get_price_with_tax();
                    } else {
                        total_price_by_product[line.product.id] += line.get_price_with_tax();
                    }
                } else {
                    if (!total_price_by_product[line.product.id]) {
                        total_price_by_product[line.product.id] = line.get_price_without_tax();
                    } else {
                        total_price_by_product[line.product.id] += line.get_price_without_tax();
                    }
                }
            }
            return total_price_by_product;
        },
        checking_special_client: function (promotion) {
            /*
                Checking client selected have inside special customers of promotion
             */
            if (!promotion.special_customer_ids || promotion.special_customer_ids.length == 0) {
                return true
            } else {
                var order = this.pos.get_order();
                if (!order) {
                    return true
                } else {
                    var client = order.get_client();
                    if (!client && promotion.special_customer_ids.length) {
                        return false
                    } else {
                        var client_id = client.id;
                        if (promotion.special_customer_ids.indexOf(client_id) == -1) {
                            return false
                        } else {
                            return true
                        }
                    }
                }
            }
        },
        checking_promotion_birthday_match_birthdayof_client: function (promotion) {
            /*
                We checking 2 condition
                1. Promotion is promotion birthday
                2. Birthday of client isnide period time of promotion allow
             */
            if (!promotion.promotion_birthday) {
                return true
            } else {
                var client = this.get_client();
                var passed = false;
                if (client && client['birthday_date']) {
                    var birthday_date = moment(client['birthday_date']);
                    var today = moment(new Date());
                    if (promotion['promotion_birthday_type'] == 'day') {
                        if ((birthday_date.date() == today.date()) && (birthday_date.month() == today.month())) {
                            passed = true
                        }
                    }
                    if (promotion['promotion_birthday_type'] == 'week') {
                        var parts = client['birthday_date'].split('-');
                        var birthday_date = new Date(new Date().getFullYear() + '-' + parts[1] + '-' + parts[0]).getTime() + 86400000;
                        var startOfWeek = moment().startOf('week').toDate().getTime() + 86400000;
                        var endOfWeek = moment().endOf('week').toDate().getTime() + 86400000;
                        if (startOfWeek <= birthday_date && birthday_date <= endOfWeek) {
                            passed = true;
                        }
                    }
                    if (promotion['promotion_birthday_type'] == 'month') {
                        if (birthday_date.month() == today.month()) {
                            passed = true
                        }
                    }
                }
                return passed;
            }
        },
        checking_promotion_has_groups: function (promotion) {
            /*
                We checking 2 condition
                1. Promotion is promotion birthday
                2. Birthday of client isnide period time of promotion allow
             */
            if (!promotion.promotion_group) {
                return true
            } else {
                var client = this.get_client();
                var passed = false;
                if (promotion.promotion_group_ids.length && client && client.group_ids) {
                    for (var i = 0; i < client.group_ids.length; i++) {
                        var group_id = client.group_ids[i];
                        if (promotion['promotion_group_ids'].indexOf(group_id) != -1) {
                            passed = true;
                            break;
                        }
                    }
                }
                return passed;
            }
        },
        order_has_promotion_applied: function () {
            var promotion_line = _.find(this.orderlines.models, function (line) {
                return line.promotion == true;
            });
            if (promotion_line) {
                return true
            } else {
                return false
            }
        },
        // 1) check current order can apply discount by total order
        checking_apply_total_order: function (promotion) {
            var can_apply = false;
            var discount_lines = this.pos.promotion_discount_order_by_promotion_id[promotion.id];
            var total_order = this.get_amount_total_without_promotion();
            var discount_line_tmp = null;
            var discount_tmp = 0;
            if (discount_lines) {
                var i = 0;
                while (i < discount_lines.length) {
                    var discount_line = discount_lines[i];
                    if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                        discount_line_tmp = discount_line;
                        discount_tmp = discount_line.minimum_amount
                        can_apply = true
                    }
                    i++;
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 2) check current order can apply discount by categories
        checking_can_discount_by_categories: function (promotion) {
            var can_apply = false;
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return false;
            }
            for (var i in this.pos.promotion_by_category_id) {
                var promotion_line = this.pos.promotion_by_category_id[i];
                var amount_total_by_category = 0;
                var z = 0;
                var lines = _.filter(this.orderlines.models, function (line) {
                    return !line['is_return'] && !line['promotion']
                });
                while (z < lines.length) {
                    if (!lines[z].product.pos_categ_id) {
                        z++;
                        continue;
                    }
                    if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                        amount_total_by_category += lines[z].get_price_without_tax();
                    }
                    z++;
                }
                if (amount_total_by_category > 0) {
                    can_apply = true
                }
            }
            return can_apply && this.checking_special_client(promotion)
        },
        // 3_discount_by_quantity_of_product
        checking_apply_discount_filter_by_quantity_of_product: function (promotion) {
            var can_apply = false;
            var rules = this.pos.promotion_quantity_by_product_id;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var product_id in product_quantity_by_product_id) {
                var rules_by_product_id = rules[product_id];
                if (rules_by_product_id) {
                    for (var i = 0; i < rules_by_product_id.length; i++) {
                        var rule = rules_by_product_id[i];
                        if (rule && rule['promotion_id'][0] == promotion['id'] && product_quantity_by_product_id[product_id] >= rule.quantity) {
                            can_apply = true;
                        }
                    }
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 4. & 5. : check pack free gift and pack discount product
        // 5_pack_free_gift && 4_pack_discount
        checking_pack_discount_and_pack_free_gift: function (promotion, rules) {
            var method = promotion.method;
            var active_one = false;
            var can_apply = true;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                var product_id = rule.product_id[0];
                var minimum_quantity = rule.minimum_quantity;
                var total_qty_by_product = product_quantity_by_product_id[product_id];
                if ((total_qty_by_product && total_qty_by_product < minimum_quantity) || !total_qty_by_product) {
                    can_apply = false;
                }
                if (total_qty_by_product && total_qty_by_product >= minimum_quantity) {
                    active_one = true;
                }
            }
            if (active_one && method == 'only_one') {
                return active_one && this.checking_special_client(promotion)
            } else {
                return can_apply && this.checking_special_client(promotion)
            }
        },
        // 6. check condition for apply price filter by quantity of product
        checking_apply_price_filter_by_quantity_of_product: function (promotion) {
            var condition = false;
            var rules = this.pos.promotion_price_by_promotion_id[promotion.id];
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                if (rule && product_quantity_by_product_id[rule.product_id[0]] && product_quantity_by_product_id[rule.product_id[0]] >= rule.minimum_quantity) {
                    condition = true;
                }
            }
            return condition && this.checking_special_client(promotion);
        },
        // 7. checking promotion special category
        checking_apply_specical_category: function (promotion) {
            var condition = false;
            var promotion_lines = this.pos.promotion_special_category_by_promotion_id[promotion['id']];
            this.lines_by_category_id = {};
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                var pos_categ_id = line['product']['pos_categ_id'][0];
                if (pos_categ_id) {
                    if (!this.lines_by_category_id[pos_categ_id]) {
                        this.lines_by_category_id[pos_categ_id] = [line]
                    } else {
                        this.lines_by_category_id[pos_categ_id].push(line)
                    }
                }
            }
            for (var i = 0; i < promotion_lines.length; i++) {
                var promotion_line = promotion_lines[i];
                var categ_id = promotion_line['category_id'][0];
                var total_quantity = 0;

                if (this.lines_by_category_id[categ_id]) {
                    var total_quantity = 0;
                    for (var i = 0; i < this.lines_by_category_id[categ_id].length; i++) {
                        total_quantity += this.lines_by_category_id[categ_id][i]['quantity']
                    }
                    if (promotion_line['count'] <= total_quantity) {
                        condition = true;
                    }
                }
            }
            return condition && this.checking_special_client(promotion);
        },
        // 9. checking multi buy
        // TODO: 9_multi_buy
        checking_multi_buy: function (promotion) {
            var can_apply = false;
            var method = promotion.method;
            var rules = this.pos.multi_buy_by_promotion_id[promotion.id];
            var total_qty_by_product = this.product_quantity_by_product_id();
            if (rules) {
                for (var i = 0; i < rules.length; i++) {
                    var rule = rules[i];
                    var product_ids = rule.product_ids;
                    var total_qty_exist = 0;
                    for (var index in product_ids) {
                        var product_id = product_ids[index];
                        if (total_qty_by_product[product_id]) {
                            total_qty_exist += total_qty_by_product[product_id]
                        }
                    }
                    if (total_qty_exist >= rule['qty_apply']) {
                        can_apply = true;
                        break
                    }
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 10. by x (qty) get y (qty) free
        checking_buy_x_get_another_free: function (promotion) {
            var can_apply = false;
            var minimum_items = promotion['minimum_items'];
            var total_quantity = this.product_quantity_by_product_id();
            for (var index_id in promotion.product_ids) {
                var product_id = promotion.product_ids[index_id];
                if (total_quantity[product_id] && total_quantity[product_id] >= minimum_items) {
                    var product = this.pos.db.product_by_id[product_id];
                    if (product) {
                        can_apply = true;
                        break
                    }
                }
            }
            return can_apply && this.checking_special_client(promotion);
        },
        // 11. checking first order of customer
        checking_first_order_of_customer: function (promotion) {
            var order;
            if (this.get_client()) {
                var client = this.get_client();
                order = _.filter(this.pos.db.get_pos_orders(), function (order) {
                    return order.partner_id && order.partner_id[0] == client['id']
                });
                if (order.length == 0) {
                    return true && this.checking_special_client(promotion)
                } else {
                    return false && this.checking_special_client(promotion)
                }
            } else {
                return false && this.checking_special_client(promotion)
            }
        },
        compute_discount_total_order: function (promotion) { // TODO: 1_discount_total_order
            var discount_lines = this.pos.promotion_discount_order_by_promotion_id[promotion.id];
            var total_order = this.get_amount_total_without_promotion();
            var discount_line_tmp = null;
            var discount_tmp = 0;
            if (discount_lines) {
                var i = 0;
                while (i < discount_lines.length) {
                    var discount_line = discount_lines[i];
                    if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                        discount_line_tmp = discount_line;
                        discount_tmp = discount_line.minimum_amount;
                    }
                    i++;
                }
            }
            if (!discount_line_tmp) {
                return false;
            }
            var total_order = this.get_amount_total_without_promotion();
            if (discount_line_tmp && total_order > 0) {
                var promotion_reason = promotion.name;
                var lines = _.filter(this.orderlines.models, function (line) {
                    return !line['is_return'] && !line['promotion']
                });
                this._apply_promotion_to_orderlines(lines, promotion.id, promotion_reason, 0, discount_line_tmp.discount)
            }
        },
        //TODO: 12_buy_total_items_free_items
        checking_buy_total_items_free_items: function (promotion) {
            var total_items_ofRules_inCart = 0;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < promotion.product_ids.length; i++) {
                var product_id = promotion.product_ids[i];
                var total_qty_by_product = product_quantity_by_product_id[product_id];
                if (total_qty_by_product) {
                    total_items_ofRules_inCart += total_qty_by_product
                }
            }
            if (total_items_ofRules_inCart && total_items_ofRules_inCart >= promotion.minimum_items) {
                return true && this.checking_special_client(promotion)
            } else {
                return false && this.checking_special_client(promotion)
            }
        },
        //TODO: 13_gifts_filter_by_total_amount
        checking_gifts_filter_by_total_amount: function (promotion) {
            var total_order = this.get_amount_total_without_promotion();
            if (total_order > 0 && promotion.amount_total && total_order >= promotion.amount_total) {
                return true && this.checking_special_client(promotion)
            } else {
                return false && this.checking_special_client(promotion)
            }
        },
        compute_discount_category: function (promotion) { // TODO: 2_discount_category
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return false;
            }
            for (var i in this.pos.promotion_by_category_id) {
                var promotion_line = this.pos.promotion_by_category_id[i];
                var lines = this.orderlines.models;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line.promotion || line.product.pos_categ_id[0] != promotion_line.category_id[0]) {
                        continue
                    } else {
                        var promotion_reason = 'Category: ' + promotion_line.category_id[1];
                        var promotion_discount = promotion_line.discount;
                        this._apply_promotion_to_orderlines([line], promotion.id, promotion_reason, 0, promotion_discount);

                    }
                }
            }
        },
        compute_discount_by_quantity_of_products: function (promotion) { //TODO: 3_discount_by_quantity_of_product
            var quantity_by_product_id = this.product_quantity_by_product_id();
            var orderlines = this.orderlines.models;
            for (var product_id in quantity_by_product_id) {
                var promotion_lines = this.pos.promotion_quantity_by_product_id[product_id];
                if (!promotion_lines) {
                    continue;
                }
                var quantity_tmp = 0;
                var promotion_line = null;
                for (var index in promotion_lines) {
                    promotion_line = promotion_lines[index]
                    var condition = quantity_tmp <= promotion_line.quantity && quantity_by_product_id[product_id] >= promotion_line.quantity;
                    if (condition && promotion_line['product_id'][0] == product_id && promotion_line['promotion_id'][0] == promotion['id']) {
                        promotion_line = promotion_line;
                        quantity_tmp = promotion_line.quantity
                    }
                }
                if (promotion_line) {
                    var orderlines_promotion = _.filter(orderlines, function (orderline) {
                        return orderline.product.id == promotion_line.product_id[0];
                    });
                    if (orderlines_promotion) {
                        var promotion_reason = promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity;
                        var promotion_discount = promotion_line.discount;
                        this._apply_promotion_to_orderlines(orderlines_promotion, promotion.id, promotion_reason, 0, promotion_discount);
                    }
                }
            }
        },
        count_quantity_by_product: function (product) {
            /*
                Function return total qty filter by product of order
            */
            var qty = 0;
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (line.product['id'] == product['id']) {
                    qty += line['quantity'];
                }
            }
            return qty;
        },
        compute_pack_discount: function (promotion) { // TODO: 4_pack_discount
            var discount_items = this.pos.promotion_discount_apply_by_promotion_id[promotion.id];
            if (!discount_items) {
                return;
            }
            var lines = _.filter(this.orderlines.models, function (line) {
                return !line['is_return'] && !line['promotion']
            });
            for (var n = 0; n < discount_items.length; n++) {
                var discount_item = discount_items[n];
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    if (line.product.id == discount_item.product_id[0]) {
                        var promotion_reason = promotion.name;
                        var promotion_discount = discount_item.discount;
                        this._apply_promotion_to_orderlines([line], promotion.id, promotion_reason, 0, promotion_discount);
                    }
                }
            }
        },
        compute_pack_free_gift: function (promotion) { // TODO: 5_pack_free_gift
            var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id];
            if (!gifts) {
                console.warn('gifts not found');
                return;
            }
            var condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
            var max_qty_of_gift = null;
            var min_qty_of_condition = null;
            var current_qty = null;
            for (var i = 0; i < gifts.length; i++) {
                var gift = gifts[i];
                if (!max_qty_of_gift) {
                    max_qty_of_gift = gift.quantity_free;
                }
                if (max_qty_of_gift && max_qty_of_gift <= gift.quantity_free) {
                    max_qty_of_gift = gift.quantity_free;
                }
            }
            for (var i = 0; i < condition_items.length; i++) {
                var condition_item = condition_items[i];
                if (!min_qty_of_condition) {
                    min_qty_of_condition = condition_item.minimum_quantity;
                }
                if (min_qty_of_condition && min_qty_of_condition >= condition_item.minimum_quantity) {
                    min_qty_of_condition = condition_item.minimum_quantity
                }
                var product = this.pos.db.get_product_by_id(condition_item.product_id[0]);
                if (product) {
                    var total_qty = this.count_quantity_by_product(product);
                    if (total_qty) {
                        if (!current_qty) {
                            current_qty = total_qty
                        }
                        if (promotion.method == 'only_one') {
                            if (current_qty && total_qty >= current_qty) {
                                current_qty = total_qty
                            }
                        } else {
                            if (current_qty && total_qty <= current_qty) {
                                current_qty = total_qty
                            }
                        }

                    }
                }
            }
            if (min_qty_of_condition == 0) {
                min_qty_of_condition = 1
            }
            if (max_qty_of_gift == 0) {
                max_qty_of_gift = 1
            }
            // TODO: buy min_qty_of_condition (A) will have max_qty_of_gift (B)
            // TODO: buy current_qty (C) will have X (qty): x = C / A * B
            var temp = parseInt(current_qty / min_qty_of_condition * max_qty_of_gift);
            if (temp == 0) {
                temp = 1;
            }
            var i = 0;
            while (i < gifts.length) {
                var gift = gifts[i];
                var product = this.pos.db.get_product_by_id(gift.product_id[0]);
                if (product) {
                    var qty_free = gift.quantity_free;
                    if (gift['type'] !== 'only_one') {
                        qty_free = qty_free * temp
                    }
                    this.add_promotion_gift(product, 0, qty_free, {
                        promotion: true,
                        promotion_gift: true,
                        promotion_reason: promotion.name
                    })
                } else {
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: gift.product_id[1] + _t(' not available in POS, please contact your admin')
                    })
                }
                i++;
            }
        },
        compute_price_filter_quantity: function (promotion) { // TODO: 6_price_filter_quantity
            var promotion_prices = this.pos.promotion_price_by_promotion_id[promotion.id];
            if (promotion_prices) {
                var prices_item_by_product_id = {};
                for (var i = 0; i < promotion_prices.length; i++) {
                    var item = promotion_prices[i];
                    if (!prices_item_by_product_id[item.product_id[0]]) {
                        prices_item_by_product_id[item.product_id[0]] = [item]
                    } else {
                        prices_item_by_product_id[item.product_id[0]].push(item)
                    }
                }
                var quantity_by_product_id = this.product_quantity_by_product_id();
                for (i in quantity_by_product_id) {
                    if (prices_item_by_product_id[i]) {
                        var quantity_tmp = 0;
                        var price_item_tmp = null;
                        for (var j = 0; j < prices_item_by_product_id[i].length; j++) {
                            var price_item = prices_item_by_product_id[i][j];
                            if (quantity_by_product_id[i] >= price_item.minimum_quantity && quantity_by_product_id[i] >= quantity_tmp) {
                                quantity_tmp = price_item.minimum_quantity;
                                price_item_tmp = price_item;
                            }
                        }
                        if (price_item_tmp) {
                            var lines = _.filter(this.orderlines.models, function (line) {
                                return !line['is_return'] && !line['promotion'] && line.product.id == price_item_tmp.product_id[0];
                            });
                            var promotion_reason = promotion.name;
                            var promotion_amount = price_item_tmp.price_down;
                            this._apply_promotion_to_orderlines(lines, promotion.id, promotion_reason, promotion_amount, 0);
                        }
                    }
                }
            }
        },
        compute_special_category: function (promotion) { // TODO: 7_special_category
            var promotion_lines = this.pos.promotion_special_category_by_promotion_id[promotion['id']];
            this.lines_by_category_id = {};
            for (var i = 0; i < this.orderlines.models.length; i++) {
                var line = this.orderlines.models[i];
                if (line.promotion) {
                    continue;
                }
                var pos_categ_id = line['product']['pos_categ_id'][0]
                if (pos_categ_id) {
                    if (!this.lines_by_category_id[pos_categ_id]) {
                        this.lines_by_category_id[pos_categ_id] = [line]
                    } else {
                        this.lines_by_category_id[pos_categ_id].push(line)
                    }
                }
            }
            for (var i = 0; i < promotion_lines.length; i++) {
                var promotion_line = promotion_lines[i];
                var categ_id = promotion_line['category_id'][0];
                if (this.lines_by_category_id[categ_id]) {
                    var total_quantity = 0;
                    for (var i = 0; i < this.lines_by_category_id[categ_id].length; i++) {
                        total_quantity += this.lines_by_category_id[categ_id][i]['quantity']
                    }
                    if (promotion_line['count'] <= total_quantity) {
                        var promotion_type = promotion_line['type'];
                        if (promotion_type == 'discount') {
                            var promotion_reason = promotion.name;
                            var promotion_discount = promotion_line.price_down;
                            this._apply_promotion_to_orderlines(lines, promotion.id, promotion_reason, 0, promotion_discount);
                        }
                        if (promotion_type == 'free') {
                            var product_free = this.pos.db.product_by_id[promotion_line['product_id'][0]];
                            if (product_free) {
                                this.add_promotion_gift(product_free, 0, promotion_line['qty_free'], {
                                    promotion: true,
                                    promotion_id: promotion.id,
                                    promotion_reason: 'Buy bigger than or equal ' + promotion_line['count'] + ' product of ' + promotion_line['category_id'][1] + ' free ' + promotion_line['qty_free'] + ' ' + product_free['display_name']
                                })
                            }
                        }
                    }
                }
            }
        },
        compute_discount_lowest_price: function (promotion) { // TODO: 8_discount_lowest_price
            var orderlines = this.orderlines.models;
            var line_apply = null;
            for (var i = 0; i < orderlines.length; i++) {
                var line = orderlines[i];
                if (!line_apply) {
                    line_apply = line
                } else {
                    if (line.get_price_with_tax() < line_apply.get_price_with_tax()) {
                        line_apply = line;
                    }
                }
            }
            var product_discount = this.pos.db.product_by_id[promotion.product_id[0]];
            if (line_apply && product_discount) {
                var promotion_reason = promotion.name;
                var promotion_discount = promotion.discount_lowest_price;
                this._apply_promotion_to_orderlines([line_apply], promotion.id, promotion_reason, 0, promotion_discount);
            }
        },
        _get_rules_apply_multi_buy: function (promotion) {
            var rules_apply = [];
            var rules = this.pos.multi_buy_by_promotion_id[promotion.id];
            var total_qty_by_product = this.product_quantity_by_product_id();
            if (rules) {
                for (var i = 0; i < rules.length; i++) {
                    var rule = rules[i];
                    var product_ids = rule.product_ids;
                    var total_qty_exist = 0;
                    for (var index in product_ids) {
                        var product_id = product_ids[index];
                        if (total_qty_by_product[product_id]) {
                            total_qty_exist += total_qty_by_product[product_id]
                        }
                    }
                    if (total_qty_exist >= rule['qty_apply']) {
                        rules_apply.push(rule)
                    }
                }
            }
            return rules_apply
        },
        compute_multi_buy: function (promotion) { // TODO: 9_multi_buy
            var rules_apply = this._get_rules_apply_multi_buy(promotion);
            var total_qty_by_product = this.product_quantity_by_product_id();
            var total_price_by_product = this.total_price_by_product_id();
            var product_discount = this.pos.db.product_by_id[promotion.product_id[0]];
            if (rules_apply && product_discount) {
                for (var n = 0; n < rules_apply.length; n++) {
                    var rule = rules_apply[n];
                    var product_promotion = {};
                    var qty_remain = rule['qty_apply'];
                    for (var index in rule.product_ids) {
                        var product_id = rule.product_ids[index];
                        if (total_qty_by_product[product_id]) {
                            var qty_of_product_in_cart = total_qty_by_product[product_id];
                            if (qty_remain >= qty_of_product_in_cart) {
                                product_promotion[product_id] = qty_of_product_in_cart;
                                qty_remain -= qty_of_product_in_cart
                            } else if (qty_remain < qty_of_product_in_cart) {
                                if (qty_remain == 0) {
                                    break
                                }
                                if ((qty_remain - qty_of_product_in_cart) <= 0) {
                                    product_promotion[product_id] = qty_remain;
                                    break
                                } else {
                                    product_promotion[product_id] = qty_of_product_in_cart;
                                }
                            }
                        }
                    }
                }
                var promotion_amount = 0;
                var promotion_reason = 'Buy ';
                for (var product_id in product_promotion) {
                    var product = this.pos.db.get_product_by_id(product_id);
                    promotion_amount += (product.lst_price - rule.list_price) * product_promotion[product_id];
                    promotion_reason += product_promotion[product_id] + ' ' + product.display_name;
                    promotion_reason += ' , '
                }
                promotion_reason += ' Set price each item ' + this.pos.gui.chrome.format_currency(rule.list_price);
                this.add_promotion_gift(product_discount, promotion_amount, -1, {
                    promotion: true,
                    promotion_reason: promotion_reason
                })
            }
        },
        compute_buy_x_get_another_free: function (promotion) { // TODO: 10_buy_x_get_another_free
            var minimum_items = promotion['minimum_items'];
            var total_quantity = this.product_quantity_by_product_id();
            for (var index_id in promotion.product_ids) {
                var product_id = promotion.product_ids[index_id];
                if (total_quantity[product_id] && total_quantity[product_id] >= minimum_items) {
                    var qty_free = round_pr((total_quantity[product_id] / minimum_items), 0);
                    var product = this.pos.db.product_by_id[product_id];
                    if (!product) {
                        return this.pos.gui.show_popup('confirm', {
                            title: _t('Error'),
                            body: 'Product id ' + product_id + ' not available in pos'
                        })
                    }
                    this.add_promotion_gift(product, 0, -qty_free, {
                        promotion: true,
                        promotion_reason: promotion.name
                    })
                }
            }
        },
        compute_first_order: function (promotion) { // TODO: 11_first_order
            var total_order = this.get_amount_total_without_promotion();
            if (total_order > 0 && promotion['discount_first_order']) {
                var promotion_reason = promotion.name;
                var lines = _.filter(this.orderlines.models, function (line) {
                    return !line['is_return'] && !line['promotion']
                });
                this._apply_promotion_to_orderlines(lines, promotion.id, promotion_reason, 0, promotion.discount_first_order)
            }
        },
        compute_buy_total_items_free_items: function (promotion) { // TODO: 12_buy_total_items_free_items
            var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id];
            if (!gifts) {
                console.warn('gifts not found');
                return false;
            }
            var total_items_ofRules_inCart = 0;
            var product_quantity_by_product_id = this.product_quantity_by_product_id();
            for (var i = 0; i < promotion.product_ids.length; i++) {
                var product_id = promotion.product_ids[i];
                var total_qty_by_product = product_quantity_by_product_id[product_id];
                if (total_qty_by_product) {
                    total_items_ofRules_inCart += total_qty_by_product
                }
            }
            var minimum_items = promotion.minimum_items;
            for (var i = 0; i < gifts.length; i++) {
                var gift = gifts[i];
                var product = this.pos.db.get_product_by_id(gift.product_id[0]);
                var qty_free = gift.quantity_free;
                if (!product) {
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Warning'),
                        body: gift.product_id[1] + _t(' not available in POS, please contact your admin')
                    })
                } else {
                    if (gift.type == 'only_one') {
                        qty_free = qty_free
                    } else {
                        qty_free = parseInt(this.get_total_items() / minimum_items) * qty_free
                    }
                    var product = this.pos.db.get_product_by_id(gift.product_id[0]);
                    if (product) {
                        this.add_promotion_gift(product, 0, qty_free, {
                            promotion: true,
                            promotion_gift: true,
                            promotion_reason: promotion.name
                        })
                    } else {
                        this.pos.gui.show_popup('dialog', {
                            title: _t('Alert'),
                            body: _t('Product' + gift.product_id[1] + ' not found on YOUR POS')
                        })
                    }
                }
            }
        },
        compute_gifts_filter_by_total_amount: function (promotion) { // TODO: 12_buy_total_items_free_items
            var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id];
            if (!gifts) {
                console.warn('gifts not found');
                return false;
            }
            var total_order = this.get_amount_total_without_promotion();
            for (var i = 0; i < gifts.length; i++) {
                var gift = gifts[i];
                var qty_free = gift.quantity_free;
                if (gift.type != 'only_one') {
                    if (promotion.amount_total == 0) {
                        promotion.amount_total = 1
                    }
                    qty_free = parseInt(total_order / promotion.amount_total * qty_free)
                }
                var product = this.pos.db.get_product_by_id(gift.product_id[0]);
                if (product) {
                    this.add_promotion_gift(product, 0, qty_free, {
                        promotion: true,
                        promotion_gift: true,
                        promotion_reason: promotion.name
                    })
                } else {
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Alert'),
                        body: _t('Product' + gift.product_id[1] + ' not found on YOUR POS')
                    })
                }
            }
        },
        _apply_promotion_to_orderlines: function (lines, promotion_id, promotion_reason, promotion_amount, promotion_discount) {
            for (var n = 0; n < lines.length; n++) {
                var line = lines[n];
                line.promotion = true;
                line.promotion_id = promotion_id;
                line.promotion_reason = promotion_reason;
                if (promotion_amount > 0) {
                    line.promotion_amount = promotion_amount;
                }
                if (promotion_discount > 0) {
                    line.promotion_discount = promotion_discount;
                }
                line.trigger('change', line)
            }
            this.pos.trigger('auto_update:paymentlines');
        },
        add_promotion_gift: function (product, price, quantity, options) {
            var cur_screen = this.pos.gui.get_current_screen();
            var line = new models.Orderline({}, {pos: this.pos, order: this.pos.get_order(), product: product});
            line.promotion = true;
            line.promotion_gift = true;
            if (options.buyer_promotion) {
                line.promotion = options.buyer_promotion;
            }
            if (options.frequent_buyer_id) {
                line.frequent_buyer_id = options.frequent_buyer_id;
            }
            if (options.promotion_reason) {
                line.promotion_reason = options.promotion_reason;
            }
            if (options.promotion_price_by_quantity) {
                line.promotion_price_by_quantity = options.promotion_price_by_quantity;
            }
            line.price_manually_set = true; //no need pricelist change, price of promotion change the same, i blocked
            line.set_quantity(quantity);
            line.set_unit_price(price);
            line.price_manually_set = true;
            this.orderlines.add(line);
            this.pos.trigger('auto_update:paymentlines');
        },
        get_promotions_active: function () {
            if (this.is_return) {
                return [];
            }
            var can_apply = null;
            var promotions_active = [];
            if (!this.pos.promotions) {
                return {
                    can_apply: can_apply,
                    promotions_active: []
                };
            }
            for (var i = 0; i < this.pos.promotions.length; i++) {
                var promotion = this.pos.promotions[i];
                if (!this._checking_period_times_condition(promotion)) {
                    continue
                }
                var is_special_customer = this.checking_special_client(promotion);
                var is_birthday_customer = this.checking_promotion_birthday_match_birthdayof_client(promotion);
                var is_mem_of_promotion_group = this.checking_promotion_has_groups(promotion);
                if (promotion['type'] == '1_discount_total_order' && this.checking_apply_total_order(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '2_discount_category' && this.checking_can_discount_by_categories(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '3_discount_by_quantity_of_product' && this.checking_apply_discount_filter_by_quantity_of_product(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '4_pack_discount' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    var promotion_condition_items = this.pos.promotion_discount_condition_by_promotion_id[promotion.id];
                    if (!promotion_condition_items) {
                        console.warn(promotion.name + 'have not rules');
                        continue
                    }
                    var checking_pack_discount_and_pack_free = this.checking_pack_discount_and_pack_free_gift(promotion, promotion_condition_items);
                    if (checking_pack_discount_and_pack_free) {
                        can_apply = true;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '5_pack_free_gift' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    var promotion_condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
                    if (!promotion_condition_items) {
                        console.warn(promotion.name + 'have not rules');
                        continue
                    }
                    var checking_pack_discount_and_pack_free = this.checking_pack_discount_and_pack_free_gift(promotion, promotion_condition_items);
                    if (checking_pack_discount_and_pack_free) {
                        can_apply = checking_pack_discount_and_pack_free;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '6_price_filter_quantity' && this.checking_apply_price_filter_by_quantity_of_product(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '7_special_category' && this.checking_apply_specical_category(promotion) && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '8_discount_lowest_price' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    can_apply = true;
                    promotions_active.push(promotion);
                } else if (promotion['type'] == '9_multi_buy' && is_special_customer && is_birthday_customer && is_mem_of_promotion_group) {
                    var check_multi_by = this.checking_multi_buy(promotion);
                    if (check_multi_by) {
                        can_apply = check_multi_by;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '10_buy_x_get_another_free' && this.checking_special_client(promotion) && this.checking_promotion_birthday_match_birthdayof_client(promotion)) {
                    var check_by_x_get_another_free = this.checking_buy_x_get_another_free(promotion);
                    if (check_by_x_get_another_free) {
                        can_apply = check_by_x_get_another_free;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '11_first_order' && this.checking_special_client(promotion) && this.checking_promotion_birthday_match_birthdayof_client(promotion)) {
                    var can_apply_promotion = this.checking_first_order_of_customer(promotion);
                    if (can_apply_promotion) {
                        can_apply = can_apply_promotion;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '12_buy_total_items_free_items' && this.checking_special_client(promotion) && this.checking_promotion_birthday_match_birthdayof_client(promotion)) {
                    var product_ids = promotion.product_ids;
                    if (!product_ids || product_ids.length == 0) {
                        console.warn(promotion.name + ' product_ids not set');
                        continue
                    }
                    var can_apply_promotion = this.checking_buy_total_items_free_items(promotion);
                    if (can_apply_promotion) {
                        can_apply = can_apply_promotion;
                        promotions_active.push(promotion);
                    }
                } else if (promotion['type'] == '13_gifts_filter_by_total_amount' && this.checking_special_client(promotion) && this.checking_promotion_birthday_match_birthdayof_client(promotion)) {
                    var can_apply_promotion = this.checking_gifts_filter_by_total_amount(promotion);
                    if (can_apply_promotion) {
                        can_apply = can_apply_promotion;
                        promotions_active.push(promotion);
                    }
                }
            }
            return {
                can_apply: can_apply,
                promotions_active: promotions_active
            };
        },
        _checking_period_times_condition: function (promotion) {
            var days = {
                1: 'monday',
                2: 'tuesday',
                3: 'wednesday',
                4: 'thursday',
                5: 'friday',
                6: 'saturday',
                7: 'sunday',
            };
            var pass_condition = false;
            if (!promotion.special_days && !promotion.special_times) {
                pass_condition = true
            } else {
                var date_now = new Date();
                var day_now = date_now.getDay();
                if (promotion.special_days) {
                    if (promotion[days[day_now]] == true) {
                        pass_condition = true
                    } else {
                        return pass_condition
                    }
                }
                if (promotion.special_times) {
                    var limit_from_time = promotion.from_time;
                    var limit_to_time = promotion.to_time;
                    var current_time = date_now.getHours() + date_now.getMinutes() / 600;
                    if (current_time >= limit_from_time && current_time <= limit_to_time) {
                        pass_condition = true
                    } else {
                        pass_condition = false
                    }
                }
            }
            return pass_condition;
        }
    });
    screens.OrderWidget.include({
        display_promotions_active: function (selected_order) {
            var promotion_datas = selected_order.get_promotions_active();
            var promotions_active = promotion_datas['promotions_active'];
            if (promotions_active && promotions_active.length) {
                var promotion_recommend_customer_html = qweb.render('promotion_recommend_customer', {
                    promotions: promotions_active
                });
                $('.promotion_recommend_customer').removeClass('oe_hidden');
                $('.promotion_recommend_customer').html(promotion_recommend_customer_html);
            } else {
                $('.promotion_recommend_customer').html("");
                $('.promotion_recommend_customer').addClass('oe_hidden');
            }
        },
        active_buyers_promotion: function (buttons, selected_order) {
            if (selected_order && selected_order.is_return && buttons && buttons.button_buyer_promotion) {
                return buttons.button_buyer_promotion.highlight(false);
            }
            if (buttons.button_buyer_promotion) {
                var check = false;
                if (selected_order.orderlines.length == 0) {
                    check = false;
                }
                var customer = selected_order.get_client();
                if (!customer) {
                    check = false;
                } else {
                    var buyers = this.pos.buyer_by_partner_id[customer.id];
                    if (buyers && buyers.length > 0) {
                        for (var i = 0; i < buyers.length; i++) {
                            var buyer = buyers[i];
                            var promotion_id = buyer['promotion_id'][0];
                            var promotion = this.pos.buyer_by_promotion_id[promotion_id];
                            if (promotion) {
                                var buyer_group_id = promotion['buyers_group'][0];
                                var buyer_group = this.pos.buyer_group_by_id[buyer_group_id];
                                if (buyer_group) {
                                    var product_ids = buyer_group['products_ids'];
                                    if (product_ids.length > 0) {
                                        var number_of_sales = buyer_group['number_of_sales'];
                                        var lines = _.filter(selected_order.orderlines.models, function (line) {
                                            return product_ids.indexOf(line.product.id) != -1
                                        });
                                        var products_add_promotion = {};
                                        for (var j = 0; j < lines.length; j++) {
                                            var line = lines[j];
                                            if (!products_add_promotion[line.product.id]) {
                                                var qty_total = selected_order.count_quantity_by_product(line.product);
                                                if (qty_total >= number_of_sales) {
                                                    check = true;
                                                }
                                            }
                                        }
                                    }
                                }

                            }
                        }
                    }
                }
                buttons.button_buyer_promotion.highlight(check);
            }
        },
    });


    var popup_selection_promotions = PopupWidget.extend({
        template: 'popup_selection_promotions',
        show: function (options) {
            var self = this;
            this._super(options);
            this.promotions_selected = {};
            var promotions = options.promotions_active;
            this.promotions = promotions;
            this.$el.find('.card-content').html(qweb.render('promotion_list', {
                promotions: promotions,
                widget: self
            }));
            this.$('.selection-item').click(function () {
                var promotion_id = parseInt($(this).data('id'));
                var promotion = self.pos.promotion_by_id[promotion_id];
                if (promotion) {
                    if ($(this).closest('.selection-item').hasClass("item-selected") == true) {
                        $(this).closest('.selection-item').toggleClass("item-selected");
                        delete self.promotions_selected[promotion.id];
                    } else {
                        $(this).closest('.selection-item').toggleClass("item-selected");
                        self.promotions_selected[promotion.id] = promotion;
                    }
                }
            });
            this.$('.cancel').click(function () {
                self.pos.gui.close_popup();
            });
            this.$('.confirm').click(function () {
                self.pos.gui.close_popup();
                var promotions = [];
                for (var i in self.promotions_selected) {
                    promotions.push(self.promotions_selected[i]);
                }
                if (promotions.length) {
                    self.pos.get_order().apply_promotion(promotions)
                } else {
                    self.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Have not any promotions selected, please choice one'
                    })
                }
            });
            this.$('.add_all').click(function () {
                self.pos.get_order().apply_promotion(self.promotions);
                self.pos.gui.close_popup();
            });
        }
    });
    gui.define_popup({name: 'popup_selection_promotions', widget: popup_selection_promotions});

    var button_buyer_promotion = screens.ActionButtonWidget.extend({
        template: 'button_buyer_promotion',
        init: function (parent, options) {
            this._super(parent, options);
        },
        button_click: function () {
            var order = this.pos.get_order();
            if (!order) {
                return null
            }
            if (order.orderlines.length == 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: _t('There are no order lines')
                })
            }
            var customer = order.get_client();
            order.remove_all_buyer_promotion_line();
            if (!customer) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Please choice customer, customer of order is blank'
                })
            } else {
                var buyers = this.pos.buyer_by_partner_id[customer.id];
                if (buyers && buyers.length > 0) {
                    for (var i = 0; i < buyers.length; i++) {
                        var buyer = buyers[i];
                        var promotion_id = buyer['promotion_id'][0];
                        var promotion = this.pos.buyer_by_promotion_id[promotion_id];
                        if (promotion) {
                            var buyer_group_id = promotion['buyers_group'][0];
                            var buyer_group = this.pos.buyer_group_by_id[buyer_group_id];
                            if (buyer_group) {
                                var product_ids = buyer_group['products_ids'];
                                if (product_ids.length > 0) {
                                    var number_of_sales = buyer_group['number_of_sales'];
                                    var lines = _.filter(order.orderlines.models, function (line) {
                                        return product_ids.indexOf(line.product.id) != -1
                                    });
                                    var products_add_promotion = {};
                                    for (var j = 0; j < lines.length; j++) {
                                        var line = lines[j];
                                        if (!products_add_promotion[line.product.id]) {
                                            var qty_total = order.count_quantity_by_product(line.product);
                                            if (qty_total >= number_of_sales) {
                                                var qty_free = parseInt(qty_total / number_of_sales);
                                                var product_discount = this.pos.db.product_by_id[line.product.id];
                                                order.add_promotion_gift(product_discount, 0, 1, {
                                                    'promotion': true,
                                                    'promotion_reason': 'By smaller than ' + number_of_sales + ' ' + line.product['display_name'] + ' free ' + qty_free,
                                                    'frequent_buyer_id': buyer['id'],
                                                    'buyer_promotion': true
                                                });
                                                products_add_promotion[line.product.id] = line.product.id;
                                            }
                                        }
                                    }
                                }
                            } else {
                                return this.pos.gui.show_popup('dialog', {
                                    title: 'Warning',
                                    body: 'Could not find buyer group',
                                })
                            }

                        } else {
                            return this.pos.gui.show_popup('dialog', {
                                title: 'Warning',
                                body: 'Could not find promotion',
                            })
                        }
                    }
                } else {
                    return this.pos.gui.show_popup('dialog', {
                        title: 'Warning',
                        body: 'Customer have not promotion',
                    })
                }
            }
        }
    });
    screens.define_action_button({
        'name': 'button_buyer_promotion',
        'widget': button_buyer_promotion,
        'condition': function () {
            return this.pos.buyers_promotion && this.pos.buyers_promotion.length;
        }
    });
    return exports
});
