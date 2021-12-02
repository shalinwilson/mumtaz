from odoo import models, fields, api


class AccountTax(models.Model):
    _inherit = 'account.tax'

    show_on_both = fields.Boolean('Reverse Charge', default=False)
    reverse_amount = fields.Float(required=True, digits=(16, 4))
    amount = fields.Float(required=True, digits=(16, 4))

    @api.onchange('reverse_amount', 'type_tax_use', 'show_on_both')
    def _compute_reverse_tax_amount(self):
        if self.show_on_both is True:
            self.amount = self.reverse_amount * -1
        else:
            self.amount = self.amount
