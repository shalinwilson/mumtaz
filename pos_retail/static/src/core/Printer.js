odoo.define('pos_retail.printer', function (require) {
    var Printer = require('point_of_sale.Printer');
    var chrome = require('point_of_sale.chrome');
    var core = require('web.core');
    var _t = core._t;
    var screens = require('point_of_sale.screens');
    var qweb = core.qweb;
    var BarcodeReader = require('point_of_sale.BarcodeReader');

    BarcodeReader.include({
        connect_to_proxy: function () {
            var self = this;
            this.remote_scanning = true;
            if (this.remote_active >= 1) {
                return;
            }
            this.remote_active = 1;

            function waitforbarcode() {
                return self.proxy.connection.rpc('/hw_proxy/scanner', {}, {shadow: true, timeout: 7500})
                    .then(function (barcode) {
                        console.log('POS Box 17 called /hw_proxy/scanner get barcode: ' + barcode)
                        if (!self.remote_scanning) {
                            self.remote_active = 0;
                            return;
                        }
                        self.scan(barcode);
                        waitforbarcode();
                    }, function () {
                        if (!self.remote_scanning) {
                            self.remote_active = 0;
                            return;
                        }
                        setTimeout(waitforbarcode, 5000);
                    });
            }

            waitforbarcode();
        },
    })
    Printer.Printer.include({
        _onIoTActionResult: function (data) {
            try {
                this._super(data)
            } catch (e) {
                return this.pos.gui.show_popup('dialog', {
                    title: _t('Error'),
                    body: _t('Your POS connection lose to Kitchen Printer, please your pos profile or your internet connection')
                })
            }
        },
        print_receipt: function (receipt) {
            // TODO: if proxy_id is added, it meaning posbox installed else it meaning iotbox
            if (!this.pos.config.iface_printer_id && this.pos.config.proxy_ip && this.pos.config.iface_print_via_proxy && receipt) {
                return this.print_direct_receipt(receipt);
            }
            this._super(receipt)
        },
        print_direct_receipt: function (receipt) {
            return this.connection.rpc('/hw_proxy/print_xml_receipt', {
                receipt: receipt,
            });
        },
        open_cashbox: function () {
            if (this.pos.config.proxy_ip) {
                return this.connection.rpc('/hw_proxy/open_cashbox', {}).then(function (result) {
                    console.log('POS Box 17 open cashbox');
                })
            } else {
                this._super();
            }
        },
        send_printing_job: function (img) {
            if (this.pos.config.proxy_ip) {
                return false
            } else {
                this._super();
            }
        },
    });

    chrome.ProxyStatusWidget.include({
        init: function (parent, options) {
            if (parent.pos) {
                this.pos = parent.pos;
                this.pos.bind('change:status-device', function (state, message) {
                    self.set_status(state, message)
                })
            }
            var self = this;
            this._super(arguments[0], {});
        },
        set_smart_status: function (status) {
            if (!this.pos.config.proxy_ip && this.pos.config.iface_print_via_proxy) {
                return this._super(status)
            } else {
                if (status.status === 'connected') {
                    var warning = false;
                    var msg = '';
                    if (this.pos.config.iface_scan_via_proxy) {
                        // todo: no need change status of scanner posbox 20.02
                        var scanner = status.drivers.scanner ? status.drivers.scanner.status : false;
                        if (scanner != 'connected' && scanner != 'connecting') {
                            warning = true;
                            msg += _t('Scanner');
                        }
                    }
                    if (this.pos.config.iface_print_via_proxy || this.pos.config.iface_cashdrawer) {
                        var printer = status.drivers.printer ? status.drivers.printer.status : false;
                        if (!printer) {
                            printer = status.drivers.escpos ? status.drivers.escpos.status : false;
                        }
                        if (printer == 'disconnected' && status.drivers.escpos && status.drivers.escpos['status']) {
                            printer = status.drivers.escpos ? status.drivers.escpos.status : false;
                        }
                        if (printer != 'connected' && printer != 'connecting') {
                            warning = true;
                            msg = msg ? msg + ' & ' : msg;
                            msg += _t('Printer');
                        }
                    }
                    if (this.pos.config.iface_electronic_scale) {
                        // todo: no need change status of scale posbox 20.02
                        var scale = status.drivers.scale ? status.drivers.scale.status : false;
                        if (scale != 'connected' && scale != 'connecting') {
                            warning = true;
                            msg = msg ? msg + ' & ' : msg;
                            msg += _t('Scale');
                        }
                    }

                    msg = msg ? msg + ' ' + _t('Offline') : msg;
                    this.set_status(warning ? 'warning' : 'connected', msg);
                } else {
                    this.set_status(status.status, status.msg || '');
                }
                if (status.status == 'connecting') {
                    this.set_status(status.status, status.msg || '');
                }
            }
        },
        _bind_posbox: function () {
            var self = this;
            return this.pos.connect_to_proxy().then(function (status) {
                setTimeout(_.bind(self._bind_posbox, self), 30000);
            }, function (err) {
                console.error(err);
                setTimeout(_.bind(self._bind_posbox, self), 30000);
            })
        },
        // todo: auto bind and check status of posbox
        start: function () {
            this._super();
            if (this.pos.config.proxy_ip) {
                this._bind_posbox()
            }
            this.$el.click(function () {
                self.pos.connect_to_proxy();
            });
        },
    });

    screens.ReceiptScreenWidget.include({
        print_html: function () {
            // TODO: if proxy_id is added, it meaning posbox installed else it meaning iotbox
            if (!this.pos.config.iface_printer_id && this.pos.config.proxy_ip && this.pos.config.iface_print_via_proxy) {
                var receipt = qweb.render('XmlReceipt', this.get_receipt_render_env());
                this.pos.proxy.printer.print_receipt(receipt);
                this.pos.get_order()._printed = true;
            } else {
                this._super();
            }
        },
    });
})
;
