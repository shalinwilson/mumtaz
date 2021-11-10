# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class PosFoodPackage(models.Model):
    _name = "pos.food.package"
    _description = "Food Package"

    name = fields.Char('Name', required=1)
    product_ids = fields.Many2many(
        'Products',
        help='Products allow payment with food stamp',
        required=1
    )
    amount = fields.Float('Amount of Package', required=1)


class PosFoodStamp(models.Model):
    _name = "pos.food.stamp"
    _description = "Food Stamp"

    name = fields.Char('Barcode', readonly=1)
    food_package_id = fields.Many2one('pos.food.package', 'Food Package', required=1)
    amount = fields.Float('Amount of Package', required=1)
    partner_id = fields.Many2one('res.partner', 'Partner')
    used_date = fields.Datetime('Used Date')
    balance = fields.Float('Balance')

