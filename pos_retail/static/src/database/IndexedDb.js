odoo.define('pos_retail.indexedDB', function (require) {
    "use strict";

    var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
    if (!indexedDB) {
        window.alert("Your browser doesn't support a stable version of IndexedDB.")
    }
    var Backbone = window.Backbone;

    var multi_database = Backbone.Model.extend({
        initialize: function (pos) {
            var self = this;
            this.pos = pos;
        },
        init: function (table_name, sequence) {
            var self = this;
            this.pos = this.pos || self.posmodel;
            return new Promise(function (resolve, reject) {
                var request = indexedDB.open(self.pos.session.db + '_' + sequence, 1);
                request.onerror = function (ev) {
                    reject(ev);
                };
                request.onupgradeneeded = function (ev) {
                    var db = ev.target.result;
                    var os_product = db.createObjectStore('product.product', {keyPath: "id"});
                    os_product.createIndex('bc_index', 'barcode', {unique: false});
                    os_product.createIndex('dc_index', 'default_code', {unique: false});
                    os_product.createIndex('name_index', 'name', {unique: false});
                    var os_partner = db.createObjectStore('res.partner', {keyPath: "id"});
                    os_partner.createIndex('barcode_index', 'barcode', {unique: false});
                    os_partner.createIndex('mobile_index', 'mobile', {unique: false});
                    os_partner.createIndex('phone_index', 'phone', {unique: false});
                    os_partner.createIndex('email_index', 'email', {unique: false});
                    db.createObjectStore('cached', {keyPath: "id"});
                };
                request.onsuccess = function (ev) {
                    var db = ev.target.result;
                    var transaction = db.transaction([table_name], "readwrite");
                    transaction.oncomplete = function () {
                        db.close();
                    };
                    if (!transaction) {
                        reject('Cannot create transaction with ' + table_name)
                    }
                    var store = transaction.objectStore(table_name);
                    if (!store) {
                        reject('Cannot get object store with ' + table_name)
                    }
                    resolve(store)
                };
            })
        },
        write: function (table_name, items, cached) {
            console.log('{IndexedDb.js} write table: [' + table_name + '] with total rows ' + items.length);
            items = _.filter(items, function (item) {
                return !item['deleted']
            });
            var self = this;
            var max_id = items[items.length - 1]['id'];
            var sequence = Math.floor(max_id / 100000);
            if (cached) {
                sequence = 0
            }
            this.init(table_name, sequence).then(function (store) {
                var request = indexedDB.open(self.pos.session.db + '_' + sequence, 1);
                request.onsuccess = function (ev) {
                    var db = ev.target.result;
                    var transaction = db.transaction([table_name], "readwrite");
                    transaction.oncomplete = function () {
                        db.close();
                    };
                    if (!transaction) {
                        return;
                    }
                    var store = transaction.objectStore(table_name);
                    if (!store) {
                        return;
                    }
                    _.each(items, function (item) {
                        var status = store.put(item);
                        status.onerror = function (e) {
                            console.error(e)
                        };
                        status.onsuccess = function (ev) {
                        };
                    });
                };
            });
        },
        unlink: function (table_name, item) {
            console.warn('deleted id ' + item['id'] + ' of table ' + table_name);
            var sequence = Math.floor(item['id'] / 100000);
            return this.init(table_name, sequence).then(function (store) {
                try {
                    store.delete(item.id).onerror = function (e) {
                        console.error(e);
                    };
                } catch (e) {
                    console.error(e);
                }
            })
        },
        search_by_index: function (table_name, max_sequence, index_list, value) {
            var self = this;
            var loaded = new Promise(function (resolve, reject) {
                function load_data(sequence) {
                    self.init(table_name, sequence).then(function (object_store) {
                        for (var i = 0; i < index_list.length; i++) {
                            var index = index_list[i];
                            var idb_index = object_store.index(index);
                            var request = idb_index.get(value);
                            request.onsuccess = function (ev) {
                                var item = ev.target.result || {};
                                if (item['id']) {
                                    resolve(item)
                                }
                            };
                            request.onerror = function (error) {
                                console.error(error);
                                reject(error)
                            };
                        }
                    }, function (error) {
                        reject(error)
                    }).then(function () {
                        sequence += 1;
                        load_data(sequence);
                    });
                };
                load_data(0);
            });
            return loaded
        },
        search_read: function (table_name, sequence) {
            var self = this;
            return new Promise(function (resolve, reject) {
                self.init(table_name, sequence).then(function (store) {
                    var request = store.getAll();
                    request.onsuccess = function (ev) {
                        var items = ev.target.result || [];
                        resolve(items)
                    };
                    request.onerror = function (error) {
                        reject(error)
                    };
                });
            })
        },
        get_datas: function (pos, model, max_sequence) {
            this.pos = pos;
            var self = this;
            if (model != 'cached') {
                var loaded = new Promise(function (resolve, reject) {
                    function load_data(sequence) {
                        if (sequence < max_sequence) {
                            self.search_read(model, sequence).then(function (results) {
                                if (results.length > 0) {
                                    self.pos.save_results(model, results);
                                }
                            }).then(function () {
                                sequence += 1;
                                load_data(sequence);
                            });
                        } else {
                            resolve();
                        }
                    };
                    load_data(0);
                });
                return loaded;
            } else {
                var loaded = new Promise(function (resolve, reject) {
                    function load_data(sequence) {
                        if (sequence < max_sequence) {
                            self.search_read(model, sequence).then(function (results) {
                                resolve(results)
                            }).then(function () {
                                sequence += 1;
                                load_data(sequence);
                            });
                        } else {
                            resolve(null);
                        }
                    };
                    load_data(0);
                });
                return loaded;
            }

        },
    });

    return multi_database;
});
