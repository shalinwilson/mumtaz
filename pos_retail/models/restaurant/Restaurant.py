# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from itertools import groupby

from odoo import api, fields, models

import logging

_logger = logging.getLogger(__name__)

class RestaurantTable(models.Model):
    _inherit = "restaurant.table"

    locked = fields.Boolean('Locked (Reservation)')
    user_ids = fields.Many2many(
        'res.users',
        'restaurant_table_res_users_rel',
        'table_id',
        'user_id',
        string='Assign Users',
        help='Only Users assigned here only see tables assigned on POS Tables Screen'
    )

    def lock_table(self, vals):
        return self.write(vals)
