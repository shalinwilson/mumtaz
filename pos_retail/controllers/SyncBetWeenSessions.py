# -*- coding: utf-8 -*
from odoo.http import request
import time
from threading import Thread, Lock
from odoo import http, _
import os
from odoo import api, fields, models, _
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
try:
    from xmlrpc import client as xmlrpclib
except ImportError:
    import xmlrpclib

try:
    from queue import Queue
except ImportError:
    from Queue import Queue  # pylint: disable=deprecated-module

# TODO: chef screens
from odoo.addons.web.controllers import main as web

import json
import logging

_logger = logging.getLogger(__name__)


class SyncDrive(Thread):

    """
    Any datas sync between session stored to Queue and by config_id
    period 2 seconds, pos sessions auto call to this controller and get new updates datas
    Key point of queue is Database
    Each Database have config ID and Arrays Datas
    Example:
        Queue = {
            'db1': {
                'config_1': [data1, data2 ....etc],
                'config_2': [data1, data2 ....etc],
            },
            'db2': {
                'config_1': [data1, data2 ....etc],
                'config_2': [data1, data2 ....etc],
            }
        }
    Each POS Config save total maximum 2000 datas, if bigger than or equal 2000, we remove datas for reduce RAM
    TODO: If Odoo-Server restart: all datas sync will lose (*****)
    """

    def __init__(self):
        Thread.__init__(self)
        self.chef_login = {}
        self.lock = Lock()
        self.sync_datas = {}
        self.total_notification_by_config_id = {}

    def register_point(self, database, config_ids):
        if not self.sync_datas.get(database, None):
            self.sync_datas[database] = {}
            self.total_notification_by_config_id[database] = {}
            for config_id in config_ids:
                if not self.sync_datas[database].get(config_id, None):
                    self.sync_datas[database][config_id] = Queue()
                    self.total_notification_by_config_id[database][config_id] = 0
        return True

    def save_notification(self, database, send_from_config_id, config_ids, message):
        database_datas = self.sync_datas.get(database)
        if not database_datas:
            self.register_point(database, config_ids)
        databases = self.sync_datas.get(database)
        for config_id, values in databases.items():
            if config_id != send_from_config_id:
                databases[config_id].put((time.time(), config_id, message))
                _logger.info('{sync} save notification to config_id %s' % config_id)
                if not self.total_notification_by_config_id.get(database, None):
                    self.total_notification_by_config_id[database] = {}
                if not self.total_notification_by_config_id[database].get(config_id, None):
                    self.total_notification_by_config_id[database][config_id] = 0
                self.total_notification_by_config_id[database][config_id] += 1
                # TODO: if total notifications of config_id bigger than 2000, we clear data for reduce RAM of system
                if self.total_notification_by_config_id[database][config_id] >= 2000:
                    self.sync_datas[database][config_id].get()
        return True

    def get_notifications(self, database, config_id):
        result_list = []
        if not self.sync_datas.get(database, None):
            self.sync_datas[database] = {}
            self.sync_datas[database][config_id] = Queue()
            return []
        else:
            if not self.sync_datas[database].get(config_id):
                self.sync_datas[database][config_id] = Queue()
            while not self.sync_datas[database][config_id].empty():
                result_list.append(self.sync_datas[database][config_id].get())
            if not self.total_notification_by_config_id.get(database, None):
                self.total_notification_by_config_id[database] = {}
            if not self.total_notification_by_config_id[database].get(config_id, None):
                self.total_notification_by_config_id[database][config_id] = 0
            self.total_notification_by_config_id[database][config_id] -= len(result_list)
        return result_list

driver = SyncDrive()

class SyncController(web.Home):

    @http.route('/pos/register/sync', type="json", auth='none', cors='*')
    def register_sync(self, order_uid, database, config_id, session_id, config_ids, sync_multi_session_offline):
        values = []
        driver.register_point(database, config_ids)
        values = driver.get_notifications(database, config_id)
        return json.dumps({'state': 'succeed', 'values': values})

    @http.route('/pos/save/sync', type="json", auth='none', cors='*')
    def save_sync(self, order_uid, database, send_from_config_id, config_ids, message, sync_multi_session_offline, sync_tracking_activities_user=None):
        driver.save_notification(database, send_from_config_id, config_ids, message)
        if sync_tracking_activities_user:
            try:
                request.env.cr.execute("select id from pos_session where config_id=%s and state='opened'" % (send_from_config_id.split('_')[0]))
                send_from_sessions = request.env.cr.fetchall()
                config_ids = [config_id.split('_')[0] for config_id in config_ids]
                if len(config_ids) <= 1:
                    config_ids.append(0)
                request.env.cr.execute("SELECT id, user_id FROM pos_session where config_id in %s AND state = 'opened'", (tuple(config_ids),))
                send_to_sessions = request.env.cr.fetchall()
                send_to_session_ids = [val[0] for val in send_to_sessions]
                if request.env.context.get('uid', None) and len(send_from_sessions) >= 1 and len(send_to_session_ids) >= 1:
                    send_from_session_id = send_from_sessions[0][0]
                    action = message.get('action', None) if message.get('action', None) else 'Null'
                    user_id = request.env.context.get('uid', None) if request.env.context.get('uid', None) else 'Null'
                    create_date = fields.Datetime.now().strftime(DEFAULT_SERVER_DATETIME_FORMAT)
                    create_uid = user_id
                    sql_from = "INSERT INTO " \
                               "pos_sync_session_log (" \
                               "send_from_session_id, " \
                               "create_date, "\
                               "create_uid, " \
                               "order_uid, " \
                               "user_id, " \
                               "state, " \
                               "action, " \
                               "logs) " \
                               "VALUES (%s, '%s', %s, '%s', %s,'ready', '%s', '%s')" % (
                                   send_from_session_id,
                                   create_date,
                                   create_uid,
                                   order_uid,
                                   user_id,
                                   action,
                                   json.dumps(message)
                               )
                    request.env.cr.execute(sql_from)
                    for send_to_session in send_to_sessions:
                        user_receive_id = send_to_session[1]
                        send_to_session_id = send_to_session[0]
                        sql_to = "INSERT INTO " \
                                 "pos_sync_session_log (" \
                                 "send_from_session_id, " \
                                 "create_date, "\
                                 "create_uid, " \
                                 "user_receive_id, " \
                                 "order_uid, " \
                                 "send_to_session_id, " \
                                 "user_id, " \
                                 "state, " \
                                 "action, " \
                                 "logs) " \
                                 "VALUES (%s, '%s', %s, %s, '%s', %s, %s, 'ready', '%s', '%s')" % (
                                     send_from_session_id,
                                     create_date,
                                     create_uid,
                                     user_receive_id,
                                     order_uid,
                                     send_to_session_id,
                                     user_id,
                                     action,
                                     json.dumps(message)
                                 )
                        request.env.cr.execute(sql_to)
                        request.env.cr.commit()
                        _logger.info('{Sync} sending to session ID %s action %s' % (send_to_session_id, action))
            except Exception as ex:
                _logger.error('{Error} sync %s' % ex)
        return json.dumps({'state': 'succeed', 'values': {}})

    @http.route('/pos/passing/login', type='json', auth='none', cors='*')
    def pos_login(self):
        return "ping"

    @http.route('/pos/display-chef-screen', type="json", auth='none', cors='*')
    def display_chef_screen(self, link, database, login, password):
        try:
            driver.xmlrpc_url = url_8 = '%s/xmlrpc/2/' % link
            driver.xmlrpc_common = xmlrpclib.ServerProxy(url_8 + 'common')
            driver.xmlrpc_object = xmlrpclib.ServerProxy(url_8 + 'object')
            driver.uid = driver.xmlrpc_common.login(database, login, password)
            if driver.uid:
                driver.chef_login['link'] = link
                driver.chef_login['database'] = database
                driver.chef_login['login'] = login
                driver.chef_login['password'] = password
                return json.dumps({'state': 'succeed', 'values': driver.uid})
            else:
                return json.dumps({'state': 'fail', 'values': 'login fail'})
        except:
            return json.dumps({'state': 'fail', 'values': 'login fail'})

    @http.route('/pos/get-login-chef', type='json', auth='none')
    def get_login_chef_screen(self):
        return driver.chef_login

    @http.route('/pos/reboot', type='json', auth='none', cors='*')
    def reboot(self):
        os.system('sudo reboot now')
        return json.dumps({'state': 'succeed', 'values': 'OK'})
