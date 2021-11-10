"use strict";
odoo.define('pos_retail.screen_client_list', function (require) {
    var models = require('point_of_sale.models');
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var _t = core._t;
    var qweb = core.qweb;
    var rpc = require('pos.rpc');
    var PopupWidget = require('point_of_sale.popups');
    var gui = require('point_of_sale.gui');

    var popup_create_customer = PopupWidget.extend({
        template: 'popup_create_customer',
        show: function (options) {
            var self = this;
            var el_find_partner = $("input[id='find_partner_id']");
            this.pos.last_query_client = el_find_partner.val();
            this.uploaded_picture = null;
            this._super(options);
            var search_customer_not_found_auto_fill_to_field = this.pos.config.search_customer_not_found_auto_fill_to_field;
            var el_field = this.$("input[name='" + search_customer_not_found_auto_fill_to_field + "']");
            if (el_field.length == 1) {
                el_field[0].value = this.pos.last_query_client
            }
            el_find_partner[0].value = '';
            this.$('.datepicker').datetimepicker({
                format: 'DD-MM-YYYY',
                icons: {
                    time: "fa fa-clock-o",
                    date: "fa fa-calendar",
                    up: "fa fa-chevron-up",
                    down: "fa fa-chevron-down",
                    previous: 'fa fa-chevron-left',
                    next: 'fa fa-chevron-right',
                    today: 'fa fa-screenshot',
                    clear: 'fa fa-trash',
                    close: 'fa fa-remove'
                }
            });
            var contents = this.$('.card-content');
            contents.scrollTop(0);
            contents.find('.image-uploader').on('change', function (event) {
                self.load_image_file(event.target.files[0], function (res) {
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='" + res + "'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        },
        click_confirm: function () {
            var fields = {};
            var self = this;
            this.$('.partner_input').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields.name) {
                return this.wrong_input('input[name="name"]', '(*) Field name is required');
            } else {
                this.passed_input('input[name="name"]');
            }
            if (this.pos.config.required_title && !fields.title) {
                return this.wrong_input('select[name="title"]', '(*) Field title is required');
            } else {
                this.passed_input('select[name="title"]');
            }
            if (this.pos.config.required_street && !fields.street) {
                return this.wrong_input('input[name="street"]', '(*) Field street is required');
            } else {
                this.passed_input('input[name="street"]');
            }
            if (this.pos.config.required_city && !fields.city) {
                return this.wrong_input('input[name="city"]', '(*) Field city is required');
            } else {
                this.passed_input('input[name="city"]');
            }
            if (this.pos.config.required_email && !fields.email) {
                return this.wrong_input('input[name="email"]', '(*) Field email is required');
            } else {
                this.passed_input('input[name="email"]');
            }
            if (this.pos.config.required_phone && !fields.phone) {
                return this.wrong_input('input[name="phone"]', '(*) Field phone is required');
            } else {
                this.passed_input('input[name="phone"]');
            }
            if (this.pos.config.required_mobile && !fields.mobile) {
                return this.wrong_input('input[name="mobile"]', '(*) Field mobile is required');
            } else {
                this.passed_input('input[name="mobile"]');
            }
            if (this.pos.config.required_birthday && !fields.birthday_date) {
                return this.wrong_input('input[name="birthday_date"]', '(*) Field birthday_date is required');
            } else {
                this.passed_input('input[name="birthday_date"]');
            }
            if (this.pos.config.required_pricelist && !fields.property_product_pricelist) {
                return this.wrong_input('select[name="property_product_pricelist"]', '(*) Field Pricelist is required');
            } else {
                this.passed_input('select[name="property_product_pricelist"]');
            }
            if (this.uploaded_picture) {
                fields.image_1920 = this.uploaded_picture;
            }
            if (fields['property_product_pricelist']) {
                fields['property_product_pricelist'] = parseInt(fields['property_product_pricelist'])
            }
            if (this.pos.config.pos_branch_id) {
                fields['pos_branch_id'] = this.pos.config.pos_branch_id[0]
            }
            if (this.pos.config.check_duplicate_email && fields['email']) {
                var is_duplicated = this._check_is_duplicate(fields['email'], 'email', false);
                if (is_duplicated) {
                    return this.wrong_input('input[name="email"]', '(*) Field email is unique, this email used another client');
                } else {
                    this.passed_input('input[name="email"]');
                }
            }
            if (this.pos.config.check_duplicate_phone && fields['phone']) {
                var is_duplicated_phone = this._check_is_duplicate(fields['phone'], 'phone', false);
                var is_duplicated_mobile = this._check_is_duplicate(fields['phone'], 'mobile', false);
                if (is_duplicated_phone || is_duplicated_mobile) {
                    return this.wrong_input('input[name="phone"]', fields['phone'] + _t(' already have the phone/mobile number you have entered. Kindly enter a different number'));
                } else {
                    this.passed_input('input[name="phone"]');
                }
            }
            if (this.pos.config.check_duplicate_phone && fields['mobile']) {
                var is_duplicated_phone = this._check_is_duplicate(fields['mobile'], 'phone', false);
                var is_duplicated_mobile = this._check_is_duplicate(fields['mobile'], 'mobile', false);
                if (is_duplicated_phone || is_duplicated_mobile) {
                    return this.wrong_input('input[name="mobile"]', fields['mobile'] + _t(' already have the phone/mobile number you have entered. Kindly enter a different number'));
                } else {
                    this.passed_input('input[name="mobile"]');
                }
            }
            this.pos.gui.close_popup();
            return rpc.query({
                model: 'res.partner',
                method: 'create_from_ui',
                args: [fields]
            }).then(function (partner_id) {
                var pushing = self.pos._search_read_by_model_and_id('res.partner', [partner_id]);
                pushing.then(function (datas) {
                    if (datas.length == 0) {
                        return;
                    }
                    self.pos.sync_with_backend('res.partner', datas, true);
                    var partner_id = datas[0]['id'];
                    var client = self.pos.db.get_partner_by_id(partner_id);
                    var order = self.pos.get_order();
                    if (client && order) {
                        order.set_client(client);
                        self.pos.gui.show_popup('dialog', {
                            title: 'Great job',
                            body: 'Set ' + client['name'] + ' to current order',
                            color: 'success'
                        })
                    }
                })
            }, function (err) {
                self.pos.query_backend_fail(err);
            });
        },
        load_image_file: function (file, callback) {
            var self = this;
            if (!file) {
                return;
            }
            if (file.type && !file.type.match(/image.*/)) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Unsupported File Format, Only web-compatible Image formats such as .png or .jpeg are supported',
                });
            }

            var reader = new FileReader();
            reader.onload = function (event) {
                var dataurl = event.target.result;
                var img = new Image();
                img.src = dataurl;
                self.resize_image_to_dataurl(img, 600, 400, callback);
            };
            reader.onerror = function () {
                return self.pos.gui.show_popup('dialog', {
                    title: 'Error',
                    body: 'Could Not Read Image, The provided file could not be read due to an unknown error',
                });
            };
            reader.readAsDataURL(file);
        },
        resize_image_to_dataurl: function (img, maxwidth, maxheight, callback) {
            img.onload = function () {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var ratio = 1;

                if (img.width > maxwidth) {
                    ratio = maxwidth / img.width;
                }
                if (img.height * ratio > maxheight) {
                    ratio = maxheight / img.height;
                }
                var width = Math.floor(img.width * ratio);
                var height = Math.floor(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                var dataurl = canvas.toDataURL();
                callback(dataurl);
            };
        }
    });
    gui.define_popup({name: 'popup_create_customer', widget: popup_create_customer});

    screens.ClientListScreenWidget.include({
        init: function (parent, options) {
            this._super(parent, options);
            var self = this;
            this.pos.bind('client:save_changes', function () {
                self.save_changes();
            });
            this.search_handler = function (event) {
                if (event.keyCode === 46 || event.keyCode === 8) {
                    clearTimeout(search_timeout);
                    var searchbox = this;
                    var search_timeout = setTimeout(function () {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 200);
                }
            };
        },
        perform_search: function (query, associate_result) {
            this._super(query, associate_result);
            this.pos.last_query_client = query;
        },
        renderElement: function () {
            var self = this;
            this._super();
            this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);
            this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);
            this._sort_clients_list();
            this.$('.back').click(function () {
                self.pos.trigger('back:order');
            });
            this.$('.next').click(function () {
                self.pos.trigger('back:order');
            });
        },
        display_client_details: function (visibility, partner, clickpos) { // TODO: we add input type date to box birth day of client edit
            var self = this;
            if (partner) {
                var orders = this.pos.db.get_pos_orders().filter(function (order) {
                    return order.partner_id && order.partner_id[0] == partner['id']
                });
                partner.orders_count = orders.length;
            }
            this._super(visibility, partner, clickpos);
            this.$("input[name='birthday_date']").datetimepicker({
                format: 'DD-MM-YYYY',
                calendarWeeks: true,
                icons: {
                    time: 'fa fa-clock-o',
                    date: 'fa fa-calendar',
                    next: 'fa fa-chevron-right',
                    previous: 'fa fa-chevron-left',
                    up: 'fa fa-chevron-up',
                    down: 'fa fa-chevron-down',
                    close: 'fa fa-times',
                },
                // locale: moment.locale(),
            });
            if (visibility == 'show' && partner && this.el.querySelector('.purchased-histories')) {
                this.el.querySelector('.purchased-histories').addEventListener('click', function (event) {
                    self.pos.show_purchased_histories(partner);
                })
            }
            var contents = this.$('.client-details-contents');
            contents.off('click', '.print_card');
            contents.on('click', '.print_card', function () {
                self.print_client_card(partner);
            });
            // todo 1: if pos user search customer not found and click to add new
            // todo 2: auto add value of search box and full fill to field (ex: mobile, name ....)
            if (visibility == 'edit' && !partner['id']) {
                var search_customer_not_found_auto_fill_to_field = this.pos.config.search_customer_not_found_auto_fill_to_field;
                var el_field = this.$("input[name='" + search_customer_not_found_auto_fill_to_field + "']");
                if (el_field.length == 1) {
                    el_field[0].value = this.pos.last_query_client
                }
            }
        },
        image_by_group_url: function (id) {
            return '/web/image?model=res.partner.group&id=' + id + '&field=image';
        },
        print_client_card: function (partner) {
            var self = this;
            var list = [];
            for (var i = 0; i < partner.group_ids.length; i++) {
                var group_id = partner.group_ids[i];
                var group = this.pos.membership_group_by_id[group_id];
                if (group) {
                    list.push({
                        'label': group.name,
                        'item': group
                    });
                }
            }
            if (list.length == 0) {
                return this.pos.gui.show_popup('dialog', {
                    title: 'Warning',
                    body: 'Your POS config not add any membership/group. Please go to POS Config / Clients Screen Tab and config again'
                })
            }
            this.gui.show_popup('selection', {
                title: _t('Select one Group'),
                list: list,
                confirm: function (group) {
                    var vals = {
                        widget: self,
                        partner: partner,
                        group: group,
                        image: 'data:image/png;base64,' + group.image,
                    };
                    self.pos.report_html = qweb.render('membership_card_xml', vals);
                    self.gui.show_screen('report');
                    self.$('img[id="barcode"]').removeClass('oe_hidden');
                    try {
                        JsBarcode("#barcode", partner['barcode'], {
                            format: "EAN13",
                            displayValue: true,
                            fontSize: 14
                        });
                    } catch (ex) {
                        console.warn(ex)
                    }

                }
            });

        },
        show: function () {
            this.search_partners = [];
            this._super();
        },
        _sort_clients_list: function () {
            var self = this;
            this.$('.sort_by_id').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('id', self.reverse, parseInt));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('id', self.reverse, parseInt));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_name').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_address').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('name', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_birthdate').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('birthdate', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('birthdate', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_pos_loyalty_point').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('pos_loyalty_point', self.reverse, parseInt));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('pos_loyalty_point', self.reverse, parseInt));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_balance').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('balance', self.reverse, parseInt));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('balance', self.reverse, parseInt));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_phone').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('phone', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('phone', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
            this.$('.sort_by_mobile').click(function () {
                if (self.search_partners.length == 0) {
                    var partners = self._get_partners().sort(self.pos.sort_by('mobile', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(partners);
                    self.reverse = !self.reverse;
                } else {
                    self.search_partners = self.search_partners.sort(self.pos.sort_by('mobile', self.reverse, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                    self.render_list(self.search_partners);
                    self.reverse = !self.reverse;
                }
            });
        },
        _get_partners: function () {
            if (this.partners_list) {
                return this.partners_list
            } else {
                return this.pos.db.get_partners_sorted(1000)
            }
        },
        render_list: function (partners) {
            this.partners_list = partners;
            this._super(partners);
            var self = this;
            if (this.pos.config.quickly_search_client) {
                var $search_box = this.$('.searchbox >input');
                $search_box.autocomplete({
                    source: this.pos.db._parse_partners_for_autocomplete(partners),
                    minLength: this.pos.config.min_length_search,
                    select: function (event, ui) {
                        if (ui && ui['item'] && ui['item']['value']) {
                            var partner = self.pos.db.partner_by_id[parseInt(ui['item']['value'])];
                            if (partner) {
                                self.pos.get_order().set_client(partner);
                                self.pos.gui.back();
                            }
                            setTimeout(function () {
                                self.clear_search()
                            }, 2000);

                        }
                    }
                });
            }

        },
        clear_search: function () {
            this._super();
            this.last_query_client = null;
        },
        save_client_details: function (partner) {
            var self = this;
            var id = partner.id || false;
            var fields = {};
            this.$('.client-details-contents .detail').each(function (idx, el) {
                fields[el.name] = el.value || false;
            });
            if (!fields['name']) {
                return this.wrong_input('input[name="name"]', '(*) Field name is required');
            } else {
                this.passed_input('input[name="name"]');
            }
            if (this.pos.config.check_duplicate_email && fields['email']) {
                var is_duplicated = this._check_is_duplicate(fields['email'], 'email', id);
                if (is_duplicated) {
                    return this.wrong_input('input[name="email"]', '(*) Field email is unique, this email used another client');
                } else {
                    this.passed_input('input[name="email"]');
                }
            }
            if (this.pos.config.check_duplicate_phone && fields['phone']) {
                var is_duplicated_phone = this._check_is_duplicate(fields['phone'], 'phone', id);
                var is_duplicated_mobile = this._check_is_duplicate(fields['phone'], 'mobile', id);
                if (is_duplicated_phone || is_duplicated_mobile) {
                    return this.wrong_input('input[name="phone"]', fields['phone'] + _t(' already have the phone/mobile number you have entered. Kindly enter a different number'));
                } else {
                    this.passed_input('input[name="phone"]');
                }
            }
            if (this.pos.config.check_duplicate_phone && fields['mobile']) {
                var is_duplicated_phone = this._check_is_duplicate(fields['mobile'], 'phone', id);
                var is_duplicated_mobile = this._check_is_duplicate(fields['mobile'], 'mobile', id);
                if (is_duplicated_phone || is_duplicated_mobile) {
                    return this.wrong_input('input[name="mobile"]', fields['mobile'] + _t(' already have the phone/mobile number you have entered. Kindly enter a different number'));
                } else {
                    this.passed_input('input[name="mobile"]');
                }
            }
            this.$('.client-details-contents .detail').each(function (idx, el) {
                if (el.type == 'checkbox') {
                    if (el.checked) {
                        el.value = true
                    } else {
                        el.value = false
                    }
                }
            });
            if (this.pos.config.required_title && !fields.title) {
                return this.wrong_input('select[name="title"]', '(*) Field title is required');
            } else {
                this.passed_input('select[name="title"]');
            }
            if (this.pos.config.required_street && !fields.street) {
                return this.wrong_input('input[name="street"]', '(*) Field street is required');
            } else {
                this.passed_input('input[name="street"]');
            }
            if (this.pos.config.required_city && !fields.city) {
                return this.wrong_input('input[name="city"]', '(*) Field city is required');
            } else {
                this.passed_input('input[name="city"]');
            }
            if (this.pos.config.required_email && !fields.email) {
                return this.wrong_input('input[name="email"]', '(*) Field email is required');
            } else {
                this.passed_input('input[name="email"]');
            }
            if (this.pos.config.required_phone && !fields.phone) {
                return this.wrong_input('input[name="phone"]', '(*) Field phone is required');
            } else {
                this.passed_input('input[name="phone"]');
            }
            if (this.pos.config.required_mobile && !fields.mobile) {
                return this.wrong_input('input[name="mobile"]', '(*) Field mobile is required');
            } else {
                this.passed_input('input[name="mobile"]');
            }
            if (this.pos.config.required_birthday && !fields.birthday_date) {
                return this.wrong_input('input[name="birthday_date"]', '(*) Field birthday_date is required');
            } else {
                this.passed_input('input[name="birthday_date"]');
            }
            if (this.pos.config.required_pricelist && !fields.property_product_pricelist) {
                return this.wrong_input('select[name="property_product_pricelist"]', '(*) Field Pricelist is required');
            } else {
                this.passed_input('select[name="property_product_pricelist"]');
            }
            return this._super(partner);
        },
        saved_client_details: function (partner_id) {
            var self = this;
            this._super(partner_id);
            if (partner_id && this.pos.config.pos_branch_id) {
                rpc.query({
                    model: 'res.partner',
                    method: 'update_branch_to_partner',
                    args: [[partner_id], {'pos_branch_id': this.pos.config.pos_branch_id[0]}],
                }).then(function (result) {
                    console.log('update branch to partner success')
                }, function (err) {
                    self.pos.query_backend_fail(err);
                })
            }
        },
        reload_partners: function (partner_id) {
            var self = this;
            return this.pos.load_new_partners(partner_id).then(function () {
                self.partner_cache = new screens.DomCache();
                self.render_list(self._get_partners());
                var curr_client = self.pos.get_order().get_client();
                if (curr_client) {
                    self.pos.get_order().set_client(self.pos.db.get_partner_by_id(curr_client.id));
                }
                if (self.new_client) {
                    self.display_client_details('show', self.new_client);
                }
            });
        },
    });

    models.PosModel = models.PosModel.extend({
        load_new_partners: function (partner_id) {
            // TODO 1: we force method odoo because we only need load new partner with partner_id, not check write_date
            // TODO 2: so if you need reuse, you call can this method without partner_id
            var self = this;
            var fields = _.find(this.models, function (model) {
                return model.model === 'res.partner';
            }).fields;
            if (partner_id) {
                var domain = [['id', '=', partner_id]];
            } else {
                var domain = [['write_date', '>', this.db.get_partner_write_date()]];
            }
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'res.partner',
                    method: 'search_read',
                    args: [domain, fields],
                }, {
                    timeout: 3000,
                    shadow: true,
                }).then(function (partners) {
                    for (var i = 0; i < partners.length; i++) {
                        var partner = partners[i];
                        if (partner['birthday_date']) {
                            partner['birthday_date'] = self.db._format_date(partner['birthday_date'])
                        }
                    }
                    if (self.db.add_partners(partners)) {   // check if the partners we got were real updates
                        resolve()
                    } else {
                        reject();
                    }
                }, function (type, err) {
                    reject();
                });
            })
        },

    })
});
