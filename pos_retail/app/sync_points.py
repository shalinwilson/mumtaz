import time
from threading import Thread, Lock
import time
import json
import requests
import logging
import threading
import platform  # For getting the operating system name
import subprocess  # For executing a shell command

try:
    from queue import Queue
except ImportError:
    from Queue import Queue  # pylint: disable=deprecated-module

_logger = logging.getLogger(__name__)

from flask import Flask
from flask import Response, json, render_template, jsonify
from flask import request, jsonify
from flask_cors import CORS

app = Flask(__name__)

cors = CORS(app, resources={r"/pos/*": {"origins": "*"}})


class SyncDrive(Thread):

    def __init__(self):
        _logger.info('{__init__} starting')
        self.chef_login = {}
        self.lock = Lock()
        self.sync_datas = {}

    def register_point(self, database, config_ids):
        _logger.info('{register_point} %s' % database)
        if not self.sync_datas.get(database, None):
            self.sync_datas[database] = {}
            for config_id in config_ids:
                if not self.sync_datas[database].get(config_id, None):
                    self.sync_datas[database][config_id] = Queue()
        return True

    def save_notification(self, database, send_from_config_id, config_ids, message):
        _logger.info('{save_notification} %s' % database)
        database_datas = self.sync_datas.get(database)
        if not database_datas:
            self.register_point(database, config_ids)
        databases = self.sync_datas.get(database)
        for config_id, values in databases.items():
            if config_id != send_from_config_id:
                databases[config_id].put((time.time(), config_id, message))
        return True

    def get_notifications(self, database, config_id):
        _logger.info('{get_notifications} %s' % database)
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
        return result_list


driver = SyncDrive()


@app.route("/<name>")  # at the end point /<name>
def hello_name(name):  # call method hello_name
    return "Hello " + name  # which returns "hello + name


@app.route("/")  # at the end point /<name>
def index():  # call method hello_name
    return "Hello Guy"


@app.route('/pos/register/sync', methods=['GET', 'POST'])
def register_sync():
    params = request.json.get('params', {})
    driver.register_point(params.get('database'), params.get('config_ids'))
    values = driver.get_notifications(params.get('database'), params.get('config_id'))
    return Response(json.dumps({'state': 'succeed', 'values': values}), mimetype='application/json')

@app.route('/pos/save/sync', methods=['GET', 'POST'])
def save_sync(database=None, send_from_config_id=None, config_ids=[], message=None, sync_multi_session_offline=False):
    params = request.json.get('params', {})
    driver.save_notification(params.get('database'), params.get('send_from_config_id'), params.get('config_ids'),
                             params.get('message'))
    return Response(json.dumps({'state': 'succeed', 'values': {}}), mimetype='application/json')


@app.route('/pos/passing/login')
def pos_login():
    print('----------------------')
    return "ping"


@app.route('/hello')
def hello_odooo():
    print('----------------------')
    return "hello"


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000)
