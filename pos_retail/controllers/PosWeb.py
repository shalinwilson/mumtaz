# -*- coding: utf-8 -*
from odoo.http import request
from odoo.addons.point_of_sale.controllers.main import PosController
import json
import werkzeug.utils
from odoo import http, _
from odoo.addons.web.controllers.main import ensure_db, Home, Session, WebClient
from passlib.context import CryptContext

crypt_context = CryptContext(schemes=['pbkdf2_sha512', 'plaintext'], deprecated=['plaintext'])
from datetime import datetime
import odoo
from odoo.osv.expression import AND
import timeit

import os
import jinja2

path = os.path.realpath(os.path.join(os.path.dirname(__file__), '../views'))
loader = jinja2.FileSystemLoader(path)

jinja_env = jinja2.Environment(loader=loader, autoescape=True)
jinja_env.filters["json"] = json.dumps

pos_display_template = jinja_env.get_template('pos_display.html')

version_info = odoo.release.version_info[0]

datetime.strptime('2012-01-01', '%Y-%m-%d')

import logging

_logger = logging.getLogger(__name__)


class pos_controller(PosController):

    @http.route(['/point_of_sale/display', '/point_of_sale/display/<string:display_identifier>'], type='http',
                auth='none')
    def display(self, display_identifier=None):
        cust_js = None
        parent_path = os.path.abspath(__file__ + "/../../")
        with open(parent_path + "/static/src/shop/Worker.js") as js:
            cust_js = js.read()

        display_ifaces = []
        return pos_display_template.render({
            'title': "Odoo -- Point of Sale",
            'breadcrumb': 'POS Client display',
            'cust_js': cust_js,
        })

    @http.route('/pos/web', type='http', auth='user')
    def pos_web(self, config_id=False, **k):
        start = timeit.default_timer()
        domain = [
            ('state', '=', 'opened'),
            ('user_id', '=', request.session.uid),
            ('rescue', '=', False)
        ]
        if config_id:
            domain = AND([domain, [('config_id', '=', int(config_id))]])
        pos_session = request.env['pos.session'].sudo().search(domain, limit=1)
        # assign request.env.user.pos_config_id.id to config_id, because when login /web/login if user have set pos_config_id
        # module automatic forward to /pos/web?config_id=%s
        if not pos_session and config_id:
            _logger.info('{POS} Session of Config %s not exist before, will create new' % config_id)
            try:
                pos_session = request.env['pos.session'].create({
                    'user_id': request.env.user.id,
                    'config_id': int(config_id),
                })
                pos_session.action_pos_session_open()
            except Exception as ex:
                _logger.error('{POS} Exception %s' % ex)
                return werkzeug.utils.redirect('/web#action=point_of_sale.action_client_pos_menu')
        else:
            _logger.info('{POS} Session of Config %s existed before' % config_id)
            vals = {
                'start_time': start,
                'close_session': True,
                'session_id': pos_session.id,
                'config_id': pos_session.config_id.id,
                'database': request.env.cr.dbname
            }
            request.env['bus.bus'].sendmany(
                [[(request.env.cr.dbname, 'pos.remote_sessions', pos_session.user_id.id), json.dumps(vals)]])
        if not pos_session or not config_id:
            return werkzeug.utils.redirect('/web#action=point_of_sale.action_client_pos_menu')
        # The POS only work in one company, so we enforce the one of the session in the context
        session_info = request.env['ir.http'].session_info()
        session_info['model_ids'] = {
            'product.product': {
                'min_id': 0,
                'max_id': 0,
            },
            'res.partner': {
                'min_id': 0,
                'max_id': 0
            },
        }
        request.env.cr.execute("select max(id) from product_product")
        product_max_ids = request.env.cr.fetchall()
        request.env.cr.execute("select count(id) from product_product")
        count_products = request.env.cr.fetchall()
        session_info['model_ids']['product.product']['max_id'] = product_max_ids[0][0] if len(
            product_max_ids) == 1 else 1
        session_info['model_ids']['product.product']['count'] = count_products[0][0] if len(
            count_products) == 1 else None
        request.env.cr.execute("select max(id) from res_partner")
        partner_max_ids = request.env.cr.fetchall()
        session_info['model_ids']['res.partner']['max_id'] = partner_max_ids[0][0] if len(partner_max_ids) == 1 else 10
        request.env.cr.execute("select count(id) from res_partner")
        count_partners = request.env.cr.fetchall()
        session_info['model_ids']['res.partner']['count'] = count_partners[0][0] if len(count_partners) == 1 else None
        session_info['user_context']['allowed_company_ids'] = pos_session.company_id.ids
        session_info['company_currency_id'] = request.env.user.company_id.currency_id.id
        session_info['big_datas_turbo'] = pos_session.config_id.big_datas_turbo
        session_info['license'] = request.env['ir.config_parameter'].sudo().get_param('license')
        if session_info['license']:
            license = session_info['license'].split(' ')[0]
            session_info['license'] = crypt_context.verify_and_update(request.env.cr.dbname, license)[0]
            if not session_info['license']:
                session_info['license'] = crypt_context.verify_and_update('saas_license', license)[0]
        session_info['config_id'] = config_id
        session_info['products_name'] = None
        session_info['partners_name'] = None
        session_info['start_time'] = start
        session_info['pos_retail'] = True
        if pos_session.config_id.translate_products_name and pos_session.config_id.set_product_name_from_field:  # TODO: supported multi language products
            session_info['products_name'] = {}
            values = request.env['product.product'].sudo().search_read([
                ('available_in_pos', '=', True),
                ('%s' % pos_session.config_id.set_product_name_from_field, '!=', None),
            ], [pos_session.config_id.set_product_name_from_field])
            for val in values:
                session_info['products_name'][val['id']] = val[pos_session.config_id.set_product_name_from_field]
        if pos_session.config_id.replace_partners_name and pos_session.config_id.set_partner_name_from_field != 'name':
            session_info['partners_name'] = {}
            values = request.env['res.partner'].sudo().search_read([
                ('%s' % pos_session.config_id.set_partner_name_from_field, '!=', None),
            ], [pos_session.config_id.set_partner_name_from_field])
            for val in values:
                session_info['partners_name'][val['id']] = val[pos_session.config_id.set_partner_name_from_field]
        session_info['user_context']['pos_session_company_ids'] = pos_session.company_id.ids
        context = {
            'session_info': session_info,
            'login_number': pos_session.login(),
        }
        _logger.info(
            '========== *** POS starting with loaded times: %s *** =========' % (timeit.default_timer() - start))
        return request.render('point_of_sale.index', qcontext=context)


class web_login(Home):  # TODO: auto go directly POS when login

    def iot_login(self, db, login, password):
        try:
            request.session.authenticate(db, login, password)
            request.params['login_success'] = True
            return http.local_redirect('/pos/web/')
        except:
            return False

    @http.route()
    def web_login(self, *args, **kw):
        ensure_db()
        response = super(web_login, self).web_login(*args, **kw)
        if request.httprequest.method == 'GET' and kw.get('database', None) and kw.get('login', None) and kw.get(
                'password', None) and kw.get('iot_pos', None):
            return self.iot_login(kw.get('database', None), kw.get('login', None), kw.get('password', None))
        if request.session.uid:
            user = request.env['res.users'].browse(request.session.uid)
            pos_config = user.pos_config_id
            if pos_config:
                return http.local_redirect('/pos/web?config_id=%s' % int(pos_config.id))
        return response
