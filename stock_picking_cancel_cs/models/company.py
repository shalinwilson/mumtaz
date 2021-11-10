from odoo import api, fields, models
class ResCompany(models.Model):
    _inherit = "res.company"

    cancel_done_picking = fields.Boolean(string='Cancel Done Delivery?')
