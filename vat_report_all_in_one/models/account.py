from odoo import models, fields, api


class AccountAccount(models.Model):
    _inherit = 'account.account'

    is_a_vat_account = fields.Boolean('VAT Account')
