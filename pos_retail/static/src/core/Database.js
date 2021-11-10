/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.database', function (require) {
    var db = require('point_of_sale.DB');
    var _super_db = db.prototype;
    var rpc = require('pos.rpc');
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    // We replace method of core odoo because
    // 1. odoo core looping products for store to database parameter
    //    - And if big products (few millions products) will made browse crash
    //    - And we need cache faster than, store values for quickly search
    _super_db.add_products = function (products) {
        var stored_categories = this.product_by_category_id;
        if (!products instanceof Array) {
            products = [products];
        }
        if (!self.posmodel) {
            self.posmodel = self.pos;
        }
        products = this.get_data_by_company(self.posmodel, products);
        // TODO: only display product have category inside field iface_available_categ_ids of pos config
        if (self.posmodel.config.limit_categories && self.posmodel.config.iface_available_categ_ids.length > 0) {
            var products_allow_display = _.filter(products, function (product) {
                if (!product.pos_categ_id[0]) {
                    return true
                } else {
                    return self.posmodel.config.iface_available_categ_ids.indexOf(product.pos_categ_id[0]) != -1
                }
            });
            products = products_allow_display;
        }
        for (var i = 0, len = products.length; i < len; i++) {
            var product = products[i];
            if (self.posmodel.session && self.posmodel.session.products_name && self.posmodel.session.products_name[product.id]) {
                product['display_name'] = self.posmodel.session.products_name[product.id]
                product['name'] = self.posmodel.session.products_name[product.id]
            }
            product.taxes_id = _.filter(product.taxes_id, function (tax_id) { // TODO: if have any tax id not loaded from account.tax of core odoo, we remove it
                return self.posmodel.taxes_by_id[tax_id] != undefined
            });
            if (this.stock_datas[product['id']]) { // add qty on hand to product
                product['qty_available'] = this.stock_datas[product['id']]
            } else {
                product['qty_available'] = null;
            }
            if (product['uom_id']) { // save core uom id of product
                product['base_uom_id'] = product['uom_id'];
            }
            this.product_string_by_id[product['id']] = this.get_product_string(product);
            // start core odoo, merge from v14 improvement search
            var search_string = utils.unaccent(this._product_search_string(product));
            var categ_id = product.pos_categ_id ? product.pos_categ_id[0] : this.root_category_id;
            if (product.product_tmpl_id instanceof Array) { // it very very important, please keep on v11 and 12. because some functions used product_tmpl_id with integer not array
                product.product_tmpl_id = product.product_tmpl_id[0];
            } else {
                product.product_tmpl_id = product.product_tmpl_id;
            }
            if (product.pos_categ_id && self.posmodel.pos_category_by_id) {
                product.pos_category = self.posmodel.pos_category_by_id[product.pos_categ_id[0]]
            } else {
                product.pos_category = null
            }
            if (!stored_categories[categ_id]) {
                stored_categories[categ_id] = [];
            }
            stored_categories[categ_id].push(product.id);

            if (this.category_search_string[categ_id] === undefined) {
                this.category_search_string[categ_id] = '';
            }
            this.category_search_string[categ_id] += search_string;

            var ancestors = this.get_category_ancestors_ids(categ_id) || [];

            for (var j = 0, jlen = ancestors.length; j < jlen; j++) {
                var ancestor = ancestors[j];
                if (!stored_categories[ancestor]) {
                    stored_categories[ancestor] = [];
                }
                stored_categories[ancestor].push(product.id);

                if (this.category_search_string[ancestor] === undefined) {
                    this.category_search_string[ancestor] = '';
                }
                this.category_search_string[ancestor] += search_string;
            }
            this.product_by_id[product.id] = product;
            if (product['barcode']) {
                this.product_by_barcode[product.barcode] = product;
            }
            // end core odoo
            // Add product by suppliers barcode
            if (product['supplier_barcode']) {
                if (!this.product_by_supplier_barcode[product['supplier_barcode']]) {
                    this.product_by_supplier_barcode[product['supplier_barcode']] = [product];
                } else {
                    this.product_by_supplier_barcode[product['supplier_barcode']].push(product);
                }
            }
            // multi category
            if (product.pos_categ_ids && product.pos_categ_ids.length) {
                for (var j = 0; j < product.pos_categ_ids.length; j++) {
                    var categ_id = product.pos_categ_ids[j];
                    if (!stored_categories[categ_id]) {
                        stored_categories[categ_id] = [];
                    }
                    stored_categories[categ_id].push(product.id);
                    if (this.category_search_string[categ_id] === undefined) {
                        this.category_search_string[categ_id] = '';
                    }
                    this.category_search_string[categ_id] += search_string;
                    var ancestors = this.get_category_ancestors_ids(categ_id) || [];
                    for (var z = 0, jlen = ancestors.length; z < jlen; z++) {
                        var ancestor = ancestors[z];
                        if (!stored_categories[ancestor]) {
                            stored_categories[ancestor] = [];
                        }
                        stored_categories[ancestor].push(product.id);
                        if (this.category_search_string[ancestor] === undefined) {
                            this.category_search_string[ancestor] = '';
                        }
                        this.category_search_string[ancestor] += search_string;
                    }
                }
            }
            if (!this.total_variant_by_product_tmpl_id[product.product_tmpl_id]) {
                this.total_variant_by_product_tmpl_id[product.product_tmpl_id] = [product]
            } else{
                this.total_variant_by_product_tmpl_id[product.product_tmpl_id] = _.filter(this.total_variant_by_product_tmpl_id[product.product_tmpl_id], function (p) {
                    return p.id != product.id
                })
                this.total_variant_by_product_tmpl_id[product.product_tmpl_id].push(product)
            }
            if (this.product_ids.indexOf(product.id) == -1) {
                this.product_ids.push(product.id)
            }
        }
    };
    _super_db.search_partner = function (query) {
        try {
            query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
            query = query.replace(/ /g, '.+');
            var re = RegExp("([0-9]+):.*?" + query, "gi");
        } catch (e) {
            return [];
        }
        var results = [];
        for (var i = 0; i < this.limit; i++) {
            var r = re.exec(this.partner_search_string);
            if (r) {
                var id = Number(r[1]);
                var partner = this.get_partner_by_id(id);
                if (partner) { // if partner exist, we add to list. Core odoo not check it
                    results.push(this.get_partner_by_id(id));
                }
            } else {
                break;
            }
        }
        return results;
    };
    _super_db.add_partners = function (partners) {
        // customize
        // ---------------------------------
        if (!self.posmodel) {
            self.posmodel = self.pos;
        }
        partners = this.get_data_by_company(self.posmodel, partners);
        // ---------------------------------
        // core
        var updated_count = 0;
        var new_write_date = '';
        var partner;
        for (var i = 0, len = partners.length; i < len; i++) {
            partner = partners[i];
            if (self.posmodel.session && self.posmodel.session.partners_name && self.posmodel.session.partners_name[partner.id]) {
                partner['display_name'] = self.posmodel.session.partners_name[partner.id]
                partner['name'] = self.posmodel.session.partners_name[partner.id]
            }
            if (partner['birthday_date']) {
                partner['birthday_date'] = this._format_date(partner['birthday_date'])
            }
            if (partner.pos_loyalty_point) {
                partner.pos_loyalty_point = round_pr(partner.pos_loyalty_point, self.posmodel.currency.rounding);
            }
            if (partner.balance) {
                partner.balance = round_pr(partner.balance, self.posmodel.currency.rounding);
            }
            if (partner.deleted) {
                delete this.partner_string_by_id[partner['id']];
                delete this.partner_by_id[partner['id']];
                continue;
            }
            this.partner_string_by_id[partner.id] = this.get_partner_string(partner);
            if (partner.property_product_pricelist && self.posmodel.pricelist_by_id) { // re-update pricelist when pricelist change the same
                var pricelist = self.posmodel.pricelist_by_id[partner.property_product_pricelist[0]];
                if (pricelist) {
                    partner.property_product_pricelist = [pricelist.id, pricelist.display_name]
                }
            }
            if (partner.pos_loyalty_type) {
                partner.pos_loyalty_type_name = partner.pos_loyalty_type[1];
            }
            // core odoo original
            var local_partner_date = (this.partner_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
            var dist_partner_date = (partner.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
            if (this.partner_write_date &&
                this.partner_by_id[partner.id] &&
                new Date(local_partner_date).getTime() + 1000 >=
                new Date(dist_partner_date).getTime()) {
                // FIXME: The write_date is stored with milisec precision in the database
                // but the dates we get back are only precise to the second. This means when
                // you read partners modified strictly after time X, you get back partners that were
                // modified X - 1 sec ago.
                continue;
            } else if (new_write_date < partner.write_date) {
                new_write_date = partner.write_date;
            }
            if (!this.partner_by_id[partner.id]) {
                this.partner_sorted.push(partner.id);
            }
            this.partner_by_id[partner.id] = partner;
            updated_count += 1;
            if (this.partner_ids.indexOf(partner.id) == -1) {
                this.partner_ids.push(partner.id)
            }
        }

        this.partner_write_date = new_write_date || this.partner_write_date;

        if (updated_count) {
            // If there were updates, we need to completely
            // rebuild the search string and the barcode indexing

            this.partner_search_string = "";
            this.partner_by_barcode = {};

            for (var id in this.partner_by_id) {
                partner = this.partner_by_id[id];

                if (partner.barcode) {
                    this.partner_by_barcode[partner.barcode] = partner;
                }
                partner.address = (partner.street || '') + ', ' +
                    (partner.zip || '') + ' ' +
                    (partner.city || '') + ', ' +
                    (partner.country_id[1] || '');
                this.partner_search_string += this._partner_search_string(partner);
            }
            this.partner_search_string = utils.unaccent(this.partner_search_string); // merge v14
        }
        return updated_count;
    };
    _super_db._partner_search_string = function (partner) {
        var str = partner.display_name;
        if (partner.parent_id) {
            str += '|' + partner.parent_id[1];
        }
        if (partner.ref) {
            str += '|' + partner.ref;
        }
        if (partner.barcode) {
            str += '|' + partner.barcode;
        }
        if (partner.address) {
            str += '|' + partner.address;
        }
        if (partner.phone) {
            str += '|' + partner.phone.split(' ').join('');
        }
        if (partner.mobile) {
            str += '|' + partner.mobile.split(' ').join('');
        }
        if (partner.email) {
            str += '|' + partner.email;
        }
        str = '' + partner.id + ':' + str.replace(':', '') + '\n';
        return str;
    };
    db.include({
        init: function (options) {
            this._super(options);
            this.product_by_supplier_barcode = {};
            this.sequence = 1;
            // TODO: stored pos orders
            this.order_by_id = {};
            this.order_by_ean13 = {};
            this.order_search_string = "";
            this.order_search_string_by_id = {};
            this.lines_by_order_id = {};
            this.order_line_by_id = {};
            // TODO: stored account invoices
            this.invoice_by_id = {};
            this.invoice_by_partner_id = {};
            this.invoice_search_string = "";
            this.invoice_search_string_by_id = {};
            this.invoice_line_by_id = {};
            this.lines_invoice_by_id = {};
            // TODO: auto complete search
            this.pos_order_string_by_id = {};
            this.invoice_string_by_id = {};
            this.sale_order_string_by_id = {};
            this.partner_string_by_id = {};
            this.product_string_by_id = {};
            // TODO: stored sale orders
            this.sale_order_by_id = {};
            this.sale_order_by_name = {};
            this.sale_search_string = '';
            this.sale_search_string_by_id = {};
            this.sale_order_by_ean13 = {};
            this.sale_line_by_id = {};
            this.lines_sale_by_id = {};
            // TODO: stored medical
            this.insurances = [];
            this.insurances_autocomplete = [];
            this.insurance_by_id = {};
            this.insurance_by_partner_id = {};
            // TODO: stored stock datas
            this.stock_datas = {};
            // TODO: last updated date by model
            this.write_date_by_model = {};
            // TODO: save unpaid orders and auto push to BackEnd for revert back Orders
            this.backup_orders = [];
            // Products Search Histories
            this.search_product_by_id = {};
            this.search_products_histories = [];
            this.generic_options = '';
            this.total_variant_by_product_tmpl_id = {};
            // TODO: saved partners and products display on POS
            this.product_ids = [];
            this.partner_ids = []
        },
        _parse_generic_option_to_string: function (generic) {
            var str = generic.name;
            str = generic.id + ':' + str.replace(/:/g, '') + '\n';
            return str
        },
        save_generic_options: function (generic_options) {
            for (var i=0; i < generic_options.length; i++) {
                var generic = generic_options[i];
                this.generic_options += this._parse_generic_option_to_string(generic)
            }
        },
        save: function (store, data) {
            try {
                this._super(store, data)
            } catch (e) {
                console.warn(e)
            }
            if (store == 'unpaid_orders' && self.posmodel && self.posmodel.config.backup_orders_automatic) {
                for (var i = 0; i < data.length; i++) {
                    var order = data[i];
                    this.backup_orders[order.id] = order;
                }
            }
        },
        get_data_by_company: function (pos, records) {
            this.company_id = pos.company.id;
            var self = this
            records = _.filter(records, function (record) {
                if (!record.company_id || (record.company_id && record.company_id[0] == self.company_id)) {
                    return true
                } else {
                    return false
                }
            })
            return records;
        },
        remove_order: function (order_id) {
            this._super(order_id);
            console.warn('Remove order ID:' + order_id)
        },
        _product_search_string: function (product) { // TODO: supported search with name_second
            var str = product.display_name;
            if (product.barcode) {
                str += '|' + product.barcode;
            }
            if (product.default_code) {
                str += '|' + product.default_code;
            }
            if (product.description) {
                str += '|' + product.description;
            }
            if (product.description_sale) {
                str += '|' + product.description_sale;
            }
            if (product.name_second) {
                str += '|' + product.name_second;
            }
            if (product.categ_id) {
                str += '|' + product.categ_id[1];
            }
            if (product.pos_categ_id) {
                str += '|' + product.pos_categ_id[1];
            }
            str = product.id + ':' + str.replace(/:/g, '') + '\n';
            return str
        },
        set_last_write_date_by_model: function (model, results) {
            /* TODO:
                We need to know last records updated (change by backend clients)
                And use field write_date compare datas of pos and datas of backend
                We are get best of write date and compare
             */
            for (var i = 0; i < results.length; i++) {
                var line = results[i];
                if (line.deleted) {
                    continue
                }
                if (!this.write_date_by_model[model]) {
                    this.write_date_by_model[model] = line.write_date;
                    continue;
                }
                if (this.write_date_by_model[model] != line.write_date && new Date(this.write_date_by_model[model]).getTime() < new Date(line.write_date).getTime()) {
                    this.write_date_by_model[model] = line.write_date;
                }
            }
            console.log('LAST UPDATED DATE OF model: ' + model + ' is ' + this.write_date_by_model[model]);
        },
        filter_datas_notifications_with_current_date: function (model, datas) {
            var self = this;
            var new_datas = _.filter(datas, function (data) {
                return new Date(self.write_date_by_model[data['model']]).getTime() <= new Date(data['write_date']).getTime() + 1000;
            });
            return new_datas;
        },
        set_uuid: function (uuid) {
            /*
                TODO:
                    if current sessions have order unpaid, and products data have not exist.
                    we need call product model get products the first
             */
            this._super(uuid);
            var unpaid_orders = this.load('unpaid_orders', []);
            var product_ids = [];
            var product_model = _.find(self.posmodel.model_lock, function (model) {
                return model.fields != undefined && model.model == 'product.product';
            });
            if (unpaid_orders) {
                for (var i = 0; i < unpaid_orders.length; i++) {
                    var unpaid_order = unpaid_orders[i]['data'];
                    for (var j = 0; j < unpaid_order.lines.length; j++) {
                        var unpaid_line = unpaid_order.lines[j][2];
                        if (unpaid_line.product_id) {
                            product_ids.push(unpaid_line.product_id);
                        }
                    }
                }
            }
            if (product_ids.length && product_model.fields) {
                rpc.query({
                    model: 'product.product',
                    method: 'search_read',
                    domain: [['id', 'in', product_ids]],
                    fields: product_model.fields
                }).then(function (products) {
                    var using_company_currency = self.posmodel.config.currency_id[0] === self.posmodel.company.currency_id[0];
                    var conversion_rate;
                    if (self.posmodel.save_pos_orderscurrency && self.posmodel.currency.rate && self.posmodel.company_currency && self.posmodel.company_currency.rate) {
                        conversion_rate = self.posmodel.currency.rate / self.posmodel.company_currency.rate;
                    } else {
                        conversion_rate = 1
                    }
                    self.posmodel.db.add_products(_.map(products, function (product) {
                        if (!using_company_currency) {
                            product.lst_price = round_pr(product.lst_price * conversion_rate, self.pos.currency.rounding);
                        }
                        product.categ = _.findWhere(self.posmodel.product_categories, {'id': product.categ_id[0]});
                        return new models.Product({}, product);
                    }));
                })
            }
        },
        _format_date: function (old_date) {
            var parts = old_date.split('-');
            if (parts[0].length == 4) {
                var new_date = old_date.toString().split("-").reverse().join("-");
            } else {
                var new_date = old_date.toString().split("-").join("-");
            }
            return new_date;
        },
        get_product_by_id: function (id) {
            var product = this.product_by_id[id];
            if (!product) {
                return false;
            } else {
                return this._super(id)
            }
        },
        get_partners_sorted: function (max_count) {
            var partners = [];
            var max = 0;
            for (var partner_id in this.partner_by_id) {
                partners.push(this.partner_by_id[partner_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }
            }
            return partners;
        },
        get_products: function (max_count) {
            var products = [];
            var max = 0;
            for (var product_id in this.product_by_id) {
                products.push(this.product_by_id[product_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }
            }
            return products;
        },
        get_partner_string: function (partner) {
            var label = partner['display_name'];
            if (partner['ref']) {
                label += ', ' + partner['ref']
            }
            if (partner['barcode']) {
                label += ', ' + partner['barcode']
            }
            if (partner['email']) {
                label += ', ' + partner['email']
            }
            if (partner['phone']) {
                label += ', ' + partner['phone']
            }
            if (partner['mobile'] && (partner['mobile'] != partner['phone'])) {
                label += ', ' + partner['mobile']
            }
            return label
        },
        get_partners_source: function () {
            var source = [];
            for (var partner_id in this.partner_string_by_id) {
                var label = this.partner_string_by_id[partner_id];
                source.push({
                    value: partner_id,
                    label: label
                });
            }
            return source;
        },
        _parse_partners_for_autocomplete: function (partners) {
            var source = [];
            for (var i = 0; i < partners.length; i++) {
                var partner_id = partners[i].id;
                var label = this.partner_string_by_id[partner_id];
                source.push({
                    value: partner_id,
                    label: label
                });
            }
            return source;
        },
        get_product_string: function (product) {
            var label = product['default_code'] || '';
            if (product['name']) {
                if (!label) {
                    label = product['name'];
                } else {
                    label += ', ' + product['name'];
                }
            }
            if (product['barcode']) {
                label += ', ' + product['barcode'];
            }

            if (product['description']) {
                label += ', ' + product['description'];
            }
            if (product['lst_price']) {
                label += ', ' + self.posmodel.gui.chrome.format_currency(product.lst_price);
            }
            return label
        },
        get_products_source: function () {
            var source = [];
            for (var product_id in this.product_string_by_id) {
                var label = this.product_string_by_id[product_id];
                source.push({
                    value: product_id,
                    label: label
                })
            }
            return source;
        },
        _parse_products_for_autocomplete: function (products) {
            var source = [];
            for (var i = 0; i < products.length; i++) {
                var product_id = products[i].id;
                var label = this.product_string_by_id[product_id];
                source.push({
                    value: product_id,
                    label: label
                });
            }
            return source;
        },
        get_product_by_category: function (category_id) {
            var list = this._super(category_id);
            if (!self.posmodel) {
                self.posmodel = self.pos;
            }
            if (self.posmodel.config.default_product_sort_by == 'a_z') {
                list = list.sort(self.posmodel.sort_by('display_name', false, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
            } else if (self.posmodel.config.default_product_sort_by == 'z_a') {
                list = list.sort(self.posmodel.sort_by('display_name', true, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
            } else if (self.posmodel.config.default_product_sort_by == 'low_price') {
                list = list.sort(self.posmodel.sort_by('lst_price', false, parseInt));
            } else if (self.posmodel.config.default_product_sort_by == 'high_price') {
                list = list.sort(self.posmodel.sort_by('lst_price', true, parseInt));
            } else if (self.posmodel.config.default_product_sort_by == 'pos_sequence') {
                list = list.sort(self.posmodel.sort_by('pos_sequence', true, parseInt));
            }
            return list
        },
        // save pos orders
        _order_search_string: function (order) {
            var str = order.ean13;
            str += '|' + order.name;
            if (order.create_date) {
                str += '|' + order['create_date'];
            }
            if (order.pos_reference) {
                str += '|' + order['pos_reference'];
            }
            if (order.partner_id) {
                var partner = this.partner_by_id[order.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (order.date_order) {
                str += '|' + order['date_order'];
            }
            if (order.note) {
                str += '|' + order['note'];
            }
            if (order.session_id) {
                str += '|' + order.session_id[1];
            }
            if (order.user_id) {
                str += '|' + order['user_id'][1];
            }
            str = '' + order['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_order: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.order_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.order_by_id[id] !== undefined) {
                        results.push(this.order_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        get_pos_orders: function (max_count) {
            var orders = [];
            var max = 0;
            for (var order_id in this.order_by_id) {
                orders.push(this.order_by_id[order_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }
            }
            return orders;
        },
        get_pos_orders_source: function () {
            var source = [];
            for (var pos_order_id in this.pos_order_string_by_id) {
                var label = this.pos_order_string_by_id[pos_order_id];
                source.push({
                    value: pos_order_id,
                    label: label
                })
            }
            return source;
        },
        get_pos_order_string: function (order) {
            var label = order['name']; // auto complete
            if (order['ean13']) {
                label += ', ' + order['ean13']
            }
            if (order['pos_reference']) {
                label += ', ' + order['pos_reference']
            }
            if (order.partner_id) {
                var partner = this.get_partner_by_id(order.partner_id[0]);
                if (partner) {
                    label += ', ' + partner['name'];
                    if (partner['email']) {
                        label += ', ' + partner['email']
                    }
                    if (partner['phone']) {
                        label += ', ' + partner['phone']
                    }
                    if (partner['mobile']) {
                        label += ', ' + partner['mobile']
                    }
                }
            }
            return label
        },
        save_pos_orders: function (orders) { // stores pos orders
            var branch_id = self.posmodel.config.pos_branch_id;
            var pos_orders_filter_by_branch = self.posmodel.config.pos_orders_filter_by_branch;
            if (branch_id && pos_orders_filter_by_branch) {
                var branch_id = branch_id[0];
                orders = _.filter(orders, function (order) {
                    return order.pos_branch_id && order.pos_branch_id[0] == branch_id
                })
            }
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                if (order.partner_id) {
                    var partner;
                    if (order.partner_id && order.partner_id[0]) {
                        partner = this.get_partner_by_id(order.partner_id[0]);
                    } else {
                        partner = this.get_partner_by_id(order.partner_id);
                    }
                    if (partner) {
                        order.partner = partner;
                        order.partner_name = partner.name;
                    }
                }
                if (order.user_id) {
                    order['sale_person'] = order.user_id[1];
                } else {
                    order['sale_person'] = 'N/A';
                }
                if (order.session_id) {
                    order['session'] = order.session_id[1];
                } else {
                    order['sale_person'] = 'N/A';
                }
                this.order_by_id[order['id']] = order;
                this.order_by_ean13[order.ean13] = order;
                this.order_search_string_by_id[order.id] = this._order_search_string(order);
                this.pos_order_string_by_id[order['id']] = this.get_pos_order_string(order);
                this.lines_by_order_id[order['id']] = [] // covert to odoo14
            }
            this.order_search_string = "";
            for (var order_id in this.order_search_string_by_id) {
                this.order_search_string += this.order_search_string_by_id[order_id];
            }
        },
        save_pos_order_line: function (lines) { // covert to odoo14
            var reload_pos_pack_operation_lot = false;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                this.order_line_by_id[line['id']] = line;
                this.lines_by_order_id[line.order_id[0]].push(line)
                if (line.pack_lot_ids && line.pack_lot_ids.length) {
                    reload_pos_pack_operation_lot = true
                }
            }
            if (self.posmodel && reload_pos_pack_operation_lot) {
                self.posmodel.trigger('update:sync_pos_pack_operation_lot');
            }
        },
        _invoice_search_string: function (invoice) {
            var str = invoice.number;
            str += '|' + invoice.name;
            if (invoice.origin) {
                str += '|' + invoice.origin;
            }
            if (invoice.create_date) {
                str += '|' + invoice.create_date;
            }
            if (invoice.partner_id) {
                var partner = this.partner_by_id[invoice.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (invoice.date_invoice) {
                str += '|' + invoice['date_invoice'];
            }
            str = '' + invoice['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_invoice: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.invoice_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.invoice_by_id[id] !== undefined) {
                        results.push(this.invoice_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        get_invoices: function (max_count) {
            var invoices = [];
            var max = 0;
            for (var invoice_id in this.invoice_by_id) {
                invoices.push(this.invoice_by_id[invoice_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }

            }
            return invoices;
        },
        get_invoices_source: function () {
            var source = [];
            for (var invoice_id in this.invoice_string_by_id) {
                var label = this.invoice_string_by_id[invoice_id];
                source.push({
                    value: invoice_id,
                    label: label
                })
            }
            return source;
        },
        get_invoice_string: function (invoice) {
            var label = invoice['number'];
            var partner = this.get_partner_by_id(invoice.partner_id[0]);
            if (!partner) {
                return label;
            }
            if (invoice['origin']) {
                label += ', ' + invoice['origin'];
            }
            if (invoice['name']) {
                label += ', ' + invoice['name'];
            }
            if (partner['display_name']) {
                label += ', ' + partner['display_name']
            }
            if (partner['email']) {
                label += ', ' + partner['email']
            }
            if (partner['phone']) {
                label += ', ' + partner['phone']
            }
            if (partner['mobile']) {
                label += ', ' + partner['mobile']
            }
            return label
        },
        save_invoices: function (invoices) {
            for (var i = 0; i < invoices.length; i++) {
                var invoice = invoices[i];
                this.invoice_by_id[invoice.id] = invoice;
                if (!this.invoice_by_partner_id[invoice.partner_id[0]]) {
                    this.invoice_by_partner_id[invoice.partner_id[0]] = [invoice]
                } else {
                    this.invoice_by_partner_id[invoice.partner_id[0]].push(invoice);
                }
                invoice['partner_name'] = invoice.partner_id[1];
                if (invoice.invoice_payment_term_id) {
                    invoice['payment_term'] = invoice.invoice_payment_term_id[1];
                } else {
                    invoice['payment_term'] = 'N/A';
                }
                if (invoice.invoice_user_id) {
                    invoice['user'] = invoice.invoice_user_id[1];
                } else {
                    invoice['user'] = 'N/A';
                }
                this.invoice_string_by_id[invoice['id']] = this.get_invoice_string(invoice);
                this.invoice_search_string_by_id[invoice['id']] = this._invoice_search_string(invoice);
                this.lines_invoice_by_id[invoice.id] = [] // covert to odoo14
            }
            this.invoice_search_string = "";
            for (var invoice_id in this.invoice_search_string_by_id) {
                this.invoice_search_string += this.invoice_search_string_by_id[invoice_id];
            }
        },
        save_invoice_lines: function (lines) {
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                this.invoice_line_by_id[line['id']] = line;
                this.lines_invoice_by_id[line.move_id[0]].push(line) // covert to odoo14
            }
        },
        get_invoice_by_id: function (id) {
            return this.invoice_by_id[id];
        },
        _sale_order_search_string: function (sale) {
            var str = sale.name;
            if (sale.origin) {
                str += '|' + sale.origin;
            }
            if (sale.client_order_ref) {
                str += '|' + sale.client_order_ref;
            }
            if (sale.create_date) {
                str += '|' + sale.create_date;
            }
            if (sale.ean13) {
                str += '|' + sale.ean13;
            }
            if (sale.delivery_date) {
                str += '|' + sale.delivery_date;
            }
            if (sale.delivery_phone) {
                str += '|' + sale.delivery_phone;
            }
            if (sale.partner_shipping_id) {
                str += '|' + sale.partner_shipping_id[1];
            }
            if (sale.note) {
                str += '|' + sale.note;
            }
            if (sale.user_id) {
                str += '|' + sale.user_id[1];
            }
            if (sale.partner_id) {
                var partner = this.partner_by_id[sale.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            str = '' + sale['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_sale_orders: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var sale_orders = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.sale_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.sale_order_by_id[id] !== undefined) {
                        sale_orders.push(this.sale_order_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return sale_orders;
        },
        get_sale_orders: function (max_count) {
            var orders = [];
            var max = 0;
            for (var sale_id in this.sale_order_by_id) {
                var sale = this.sale_order_by_id[sale_id];
                if (['done', 'cancel'].indexOf(sale.state) != -1) {
                    continue
                }
                orders.push(sale);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }

            }
            return orders;
        },
        get_sale_orders_source: function () {
            var source = [];
            for (var sale_id in this.sale_order_string_by_id) {
                var sale = this.sale_order_by_id[sale_id];
                if (['done', 'cancel'].indexOf(sale.state) != -1) {
                    continue
                }
                var label = this.sale_order_string_by_id[sale_id];
                source.push({
                    value: sale_id,
                    label: label
                })
            }
            return source;
        },
        save_sale_orders: function (sale_orders) {
            for (var i = 0; i < sale_orders.length; i++) {
                var sale = sale_orders[i];
                if (sale.partner_id) {
                    var partner = this.get_partner_by_id(sale.partner_id[0]);
                    sale.partner = partner;
                }
                var label = this._sale_order_search_string(sale);
                this.sale_order_string_by_id[sale['id']] = label;
                this.sale_order_by_id[sale['id']] = sale;
                this.sale_order_by_name[sale['name']] = sale;
                this.sale_search_string_by_id[sale['id']] = label;
                if (sale.ean13) {
                    this.sale_order_by_ean13[sale.ean13] = sale
                }
                this.lines_sale_by_id[sale.id] = [] // covert to odoo14
            }
            this.sale_search_string = "";
            for (var sale_id in this.sale_search_string_by_id) {
                this.sale_search_string += this.sale_search_string_by_id[sale_id];
            }
        },
        save_sale_order_lines: function (lines) { // covert to odoo14
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                let sale_id = line.order_id[0];
                this.sale_line_by_id[line['id']] = line;
                this.lines_sale_by_id[sale_id].push(line)
            }
        },
        _insurance_search_string: function (insurance) {
            var str = insurance.insurance_company_id[1];
            str += '|' + insurance.code;
            if (insurance.subscriber_id) {
                var partner = this.partner_by_id[insurance.subscriber_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (insurance.patient_name) {
                str += '|' + insurance['patient_name'];
            }
            if (insurance.patient_number) {
                str += '|' + insurance['patient_number'];
            }
            if (insurance.medical_number) {
                str += '|' + insurance['medical_number'];
            }
            if (insurance.employee) {
                str += '|' + insurance['employee'];
            }
            if (insurance.phone) {
                str += '|' + insurance['phone'];
            }
            str = '' + insurance['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_insurances: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.insurances_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.insurance_by_id[id] !== undefined) {
                        results.push(this.insurance_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        save_insurances: function (insurances) {
            if (this.insurances.length == 0) {
                this.insurances = insurances;
            } else {
                this.insurances = this.insurances.concat(insurances);
            }
            for (var i = 0; i < this.insurances.length; i++) {
                var insurance = this.insurances[i];
                this.insurance_by_id[insurance.id] = insurance;
                this.insurance_by_partner_id[insurance.subscriber_id[0]] = insurance
                var str = this._insurance_search_string(insurance);
                this.insurances_autocomplete.push({
                    value: insurance['id'],
                    label: str
                });
                this.insurances_search_string += str;
            }
        },
    });
});
