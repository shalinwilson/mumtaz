from odoo import models, fields, api


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    vat_payment_adj_type = fields.Selection([('payment', 'Payment'), ('refund', 'Refund'), ('adjustment', 'Manaul Adjustment')], string='VAT Type')