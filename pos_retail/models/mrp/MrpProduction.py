# -*- coding: utf-8 -*-
from odoo import api, models, fields, _

class MrpProduction(models.Model):
    _inherit = "mrp.production"

    pos_order_id = fields.Many2one('pos.order', 'Pos Order', readonly=1)
    finished_lot_id = fields.Many2one(
        'stock.production.lot', string='Lot/Serial Number', check_company=True)

class MrpBomLine(models.Model):
    _inherit = "mrp.bom.line"

    price_extra = fields.Float(
        'Price Extra',
        help='Price Extra for recompute Price of Line on POS \n'
             'This price base on 1 unit of measure'
    )

    @api.onchange('product_id')
    def onchange_product_id(self):
        if self.product_id:
            self.price_extra = self.product_id.list_price