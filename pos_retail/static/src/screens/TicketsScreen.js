"use strict";
odoo.define('pos_retail.TicketsScreen', function (require) {
    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var PopupWidget = require('point_of_sale.popups');
    var _t = core._t;
    var gui = require('point_of_sale.gui');
    var chrome = require('point_of_sale.chrome');
    var rpc = require('pos.rpc');
    var qweb = core.qweb;

    var TicketsScreen = screens.ScreenWidget.extend({ // products screen
        template: 'TicketsScreen',
        init: function (parent, options) {
            var self = this;
            this._super(parent, options);
            this.ticket_by_sequence_number = {};
            this.ticket_search_string = '';
            this.ticket_search_string_by_sequence_number = {};
            this.limit = 100;
            this.pos.bind('refresh.tickets', function () {
                self.refresh_screen()
            });
        },
        _ticket_search_string: function (ticket) {
            var str = ticket.name;
            str += '|' + ticket.created_time;
            str += '|' + ticket.created_date;
            if (ticket.get_client()) {
                str += '|' + ticket.get_client().name;
                var partner = this.pos.db.partner_by_id[ticket.get_client().id]
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
            if (ticket.note) {
                str += '|' + ticket.note;
            }
            str = '' + ticket['sequence_number'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        save_tickets: function (tickets) {
            for (var i = 0; i < tickets.length; i++) {
                var ticket = tickets[i];
                this.ticket_by_sequence_number[ticket['sequence_number']] = ticket;
                this.ticket_search_string_by_sequence_number[ticket['sequence_number']] = this._ticket_search_string(ticket);
            }
            this.ticket_search_string = "";
            for (var sequence_number in this.ticket_search_string_by_sequence_number) {
                this.ticket_search_string += this.ticket_search_string_by_sequence_number[sequence_number];
            }
        },
        search_tickets: function (query) {
            var ticket_ids = []
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var tickets = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.ticket_search_string);
                if (r && r[1]) {
                    var sequence_number = r[1];
                    if (this.ticket_by_sequence_number[sequence_number] !== undefined && ticket_ids.indexOf(sequence_number) == -1) {
                        tickets.push(this.ticket_by_sequence_number[sequence_number]);
                        ticket_ids.push(sequence_number)
                    }
                } else {
                    break;
                }
            }
            return tickets;
        },
        refresh_screen: function () {
            console.log('{POS Ticket} refresh_screen()');
            var selected_order = this.pos.get_order();
            var orders = this.pos.get('orders').models;
            if (selected_order && selected_order.table) {
                orders = _.filter(orders, function (o) {
                    return o.table && o.table.id == selected_order.table.id
                })
            }
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                order.created_date = order.creation_date.toString()
                if (order.get_client()) {
                    order.client_name = order.get_client().name
                } else {
                    order.client_name = 'N/A'
                }
                order.total_items = order.orderlines.length
                order.amount_total = order.get_total_with_tax()
            }
            this.save_tickets(orders)
            this.render_list(orders);
        },
        renderElement: function () {
            var self = this;
            this.search_handler = function (event) {
                if (event.type == "keypress" || event.keyCode === 46 || event.keyCode === 8) {
                    var searchbox = this;
                    setTimeout(function () {
                        self.perform_search(searchbox.value, event.which === 13);
                    }, 70);
                }
            };
            this._super();
            this.$('.back').click(function () {
                self.pos.gui.show_screen('products');
            });
            this.$('.add_new_ticket').click(function () {
                if (self.pos.config.validate_new_order) {
                    return self.pos._validate_by_manager('this.pos.add_new_order()', 'Add new Order')
                }
                return self.pos.add_new_order();
            });
            this.$('.searchbox .search-clear').click(function () {
                self.clear_search();
            });
            this.$('.client-list-contents').delegate('.product_row', 'click', function (event) {
                self.select_ticket(event, $(this), $(this).data('id'));
            });
            this.$('.client-list-contents').delegate('.remove_ticket', 'click', function (event) {
                self.selected_order_uid = $(this).parent().data('id')
                setTimeout(function () {
                    self.remove_ticket(event, $(this), self.selected_order_uid);
                }, 70)
            });
            this.el.querySelector('.searchbox input').addEventListener('keypress', this.search_handler);
            this.el.querySelector('.searchbox input').addEventListener('keydown', this.search_handler);
            this.$('.searchbox .search-product').click(function () {
                self.clear_search();
            });
            this.$('.sort_by_order_time').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('created_time', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_date').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('created_date', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_sequence').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('sequence_number', self.reverse, parseInt));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_ref').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_client').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('client_name', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_note').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('note', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_total').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('amount_total', self.reverse, parseInt));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
            this.$('.sort_by_order_status').click(function () {
                var orders = self.orders.sort(self.pos.sort_by('status', self.reverse, function (a) {
                    if (!a) {
                        a = 'N/A';
                    }
                    return a.toUpperCase()
                }));
                self.render_list(orders);
                self.reverse = !self.reverse;
            });
        },
        show: function () {
            var self = this;
            this._super();
            this.refresh_screen();
        },
        hide: function () {
            this._super();
        },
        perform_search: function (query, associate_result) {
            var tickets = this.search_tickets(query);
            this.render_list(tickets);
        },
        clear_search: function () {
            this.refresh_screen()
            var $input_search = this.$('.search-product input');
            if ($input_search.length) {
                this.$('.search-product input')[0].value = '';
            }
        },
        render_list: function (orders) {
            var contents = this.$el[0].querySelector('.client-list-contents');
            if (!contents) {
                return true;
            }
            contents.innerHTML = "";
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var order_html = qweb.render('Ticket', {widget: this, order: order});
                var order_tag = document.createElement('tbody');
                order_tag.innerHTML = order_html;
                order_tag = order_tag.childNodes[1];
                contents.appendChild(order_tag);
            }
            this.orders = orders;
        },
        select_ticket: function (event, $line, id) {
            if (this.selected_order_uid) {
                return true;
            }
            var order = _.find(this.pos.get('orders').models, function (o) {
                return o.uid == id
            })
            if (order) {
                this.pos.set('selectedOrder', order);
                this.pos.gui.show_screen('products');
            }
        },
        remove_ticket: function (event, $line, id) {
            this.selected_order_uid = null;
            var self = this;
            var order = _.find(this.pos.get('orders').models, function (o) {
                return o.uid == id
            })
            if (order) {
                if (this.pos.config.validate_remove_order) {
                    return this.pos._validate_by_manager('this.pos.delete_current_order()', 'Delete Selected Order')
                }
                if (!order.is_empty()) {
                    this.pos.gui.show_popup('confirm', {
                        'title': _t('Destroy Current Order ?'),
                        'body': _t('You will lose any data associated with the current order'),
                        confirm: function () {
                            self.pos.delete_current_order();
                        },
                    });
                } else {
                    this.pos.delete_current_order();
                }
            }
        },
    });
    gui.define_screen({name: 'tickets', widget: TicketsScreen});

    return {
        TicketsScreen: TicketsScreen
    }
});
