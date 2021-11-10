"use strict";
odoo.define('pos_retail.polling', function (require) {

    var Backbone = window.Backbone;
    var session = require('web.session');
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var _t = core._t;
    var exports = {};

    exports.Polling_Connection = Backbone.Model.extend({
        initialize: function (pos) {
            this.pos = pos;
        },
        polling_on: function () {
            this.pos.set('sync_backend', {state: 'connected', pending: 0});
        },
        polling_off: function (error) {
            if (this.pos.config.sync_multi_session) {
                if (!this.pos.config.user_id) {
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Alert'),
                        body: _t('Please set assign user for Sync Between Session feature')
                    })
                } else {
                    this.pos.gui.show_popup('dialog', {
                        title: _t('Alert'),
                        body: _t('Your odoo not setup polling correct, please try setup longpolling via nginx or apache')
                    })
                }
            }
            this.pos.set('sync_backend', {state: 'disconnected', pending: 1});
        },
        ping: function () {
            var self = this;
            var params = {
                pos_id: this.pos.config.id,
                messages: 'Hello polling master',
            };
            var sending = session.rpc("/pos/test/polling", params, {
                shadow: true,
            }, function (error) {
                self.polling_off(error);
                console.warn('{PollingVerify.js} ping error. Odoo server not active bus.bus');
            });
            return sending.then(function () {
                console.log('{PollingVerify.js} ping OK');
                self.polling_on();
            })
        }
    });

    var _super_PosModel = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        load_server_data: function () {
            var self = this;
            return _super_PosModel.load_server_data.apply(this, arguments).then(function () {
                self.polling = new exports.Polling_Connection(self);
                return true;
            }).then(function () {
                setTimeout(function () {
                    self.polling.ping();
                }, 5000);
            })
        }
    })
});
