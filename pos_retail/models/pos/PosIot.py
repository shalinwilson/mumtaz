# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import logging

_logger = logging.getLogger(__name__)


class PosIoT(models.Model):
    _name = "pos.iot"
    _description = "Pos IoT Box"

    name = fields.Char('Name', required=1)
    proxy = fields.Char(
        'Proxy',
        required=1,
        help='Example: http://192.168.1.6 or https://192.168.1.6')
    port = fields.Char(
        'Port',
        required=0,
        help='If posbox setup base on SSL (https), dont input anything here, set default is Null')
    product_ids = fields.Many2many(
        'product.product',
        'iot_product_rel',
        'iot_box_id',
        'product_id',
        string='Products',
        domain=[('available_in_pos', '=', True)],
        help='Products will send to IoT box')
    screen_kitchen = fields.Boolean('Direct Screen', help='IoT Screen of Kitchen/Bar Session')
    login_kitchen = fields.Char('Login of Screen', help='Login Account of Kitchen/Bar Screen')
    password_kitchen = fields.Char('Password of Screen', help='Password of Kitchen/Bar Screen')
    database = fields.Char('Your Odoo Database')
    odoo_public_proxy = fields.Char('Your Odoo Public Proxy',
                                    help='Example: http://192.168.1.7:8069 or Your Odoo Domain')
