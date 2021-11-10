# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import logging

_logger = logging.getLogger(__name__)

class PosBranch(models.Model):
    _inherit = "hr.employee"

    barcode = fields.Char(string="Badge ID", help="ID used for employee identification.", groups="base.group_user", copy=False)