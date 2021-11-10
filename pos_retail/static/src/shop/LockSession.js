odoo.define('pos_retail.lock_session', function (require) {
    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');
    var PopupWidget = require('point_of_sale.popups');
    var rpc = require('pos.rpc');
    var core = require('web.core');
    var _t = core._t;

    chrome.Chrome.include({
        unlock_pos_screen: function () {
            return this.pos.gui.close_popup();
        },
        locked_pos_screen: function () {
            this.pos.set('lock_status', {state: 'connecting', pending: 0});
            this.pos.gui.show_popup('popup_lock_page', {
                title: _t('Locked'),
                body: _t('Your session have locked, please input POS Pass Pin of User Login Odoo')
            });
        },
        build_widgets: function () {
            var self = this;
            this._super();
            if (this.pos.config.allow_lock_screen || this.pos.pos_session.lock_state == 'locked') {
                setTimeout(function () {
                    self.locked_pos_screen();
                }, 500);
            }
            if (!(this.pos.config.allow_lock_screen || this.pos.pos_session.lock_state == 'locked') && this.pos.config.validate_login_pos) {
                setTimeout(function () {
                    return self.pos._validate_by_manager("self.chrome.unlock_pos_screen()", _t('Open POS Screen'));
                }, 500)
            }
        }
    });

    var popup_lock_page = PopupWidget.extend({
        template: 'popup_lock_page',
        login: function () {
            var self = this;
            var pos_security_pin = this.$('.input_form').val();
            if (pos_security_pin != this.pos.user.pos_security_pin) {
                var message = _t('Input could not blank or your pos pass pin not correct');
                return this.wrong_input("input[class='input_form']", message);
            }
            if (!this.pos.user.pos_security_pin) {
                var message = _t('User ') + this.pos.user['name'] + _t(' not set pos pass pin. Please go to Setting / Users / Point of sale tab and input');
                return this.wrong_input("input[class='input_form']", message);
            }
            return rpc.query({
                model: 'pos.session',
                method: 'lock_session',
                args: [[parseInt(this.pos.pos_session.id)], {
                    lock_state: 'unlock'
                }]
            }).then(function () {
                self.pos.set('lock_status', {state: 'connected', pending: 0});
                self.pos.gui.close_popup()
                $('.screens').removeClass('oe_hidden');
            }, function (err) {
                self.pos.query_backend_fail(err)
            });
        },
        show: function (options) {
            var self = this;
            options = options || {};
            this._super(options);
            this.$('#password').focus();
            this.$('#password').value = "";
            this.$('.login').click(function () {
                self.login()
            });
            this.$('.logout').click(function () {
                self.gui._close();
            });
            $('.screens').addClass('oe_hidden');
        }
    });
    gui.define_popup({name: 'popup_lock_page', widget: popup_lock_page});

    var lock_session_widget = chrome.StatusWidget.extend({
        template: 'lock_session_widget',
        lock_session: function () {
            this.pos.gui.show_popup('popup_lock_page', {
                title: _t('Locked'),
                body: _t('Your POS is locked now, you can use POS Security Pin (User setting) for unlock')
            });
        },
        start: function () {
            var self = this;
            this.pos.bind('change:lock_status', function (pos, datas) {
                self.set_status(datas.state, datas.pending);
            });
            this.$el.click(function () {
                self.pos.set('lock_status', {state: 'connecting', pending: 0});
                rpc.query({
                    model: 'pos.session',
                    method: 'lock_session',
                    args: [[parseInt(self.pos.pos_session.id)], {
                        lock_state: 'locked'
                    }]
                }).then(function () {
                    self.lock_session();
                }, function (err) {
                    self.pos.query_backend_fail(err)
                });
            });
        },
    });

    chrome.Chrome.include({
        build_widgets: function () {
            this.widgets.push(
                {
                    'name': 'lock_session_widget',
                    'widget': lock_session_widget,
                    'append': '.pos-rightheader',
                }
            );
            this._super();
        }
    });
});