# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import RedirectWarning, UserError, ValidationError, AccessError
import logging

_logger = logging.getLogger(__name__)

class AccountMove(models.Model):

    _inherit = "account.move"

    add_credit = fields.Boolean(
        'Add Credit',
        help='If checked, Credit Note Amount total will plus to customer credit card'
    )
    origin = fields.Char('Source Origin')
    pos_branch_id = fields.Many2one('pos.branch', string='Branch')
    pos_session_id = fields.Many2one('pos.session', string='POS Session', readonly=1)

    @api.model
    def create(self, vals):
        context = self._context.copy()
        if context.get('pos_session_id', None):
            vals.update({
                'pos_session_id': context.get('pos_session_id'),
                'origin': 'Point Of Sale'
            })
            session = self.env['pos.session'].sudo().browse(context.get('pos_session_id'))
            if session and session.config_id and session.config_id.pos_branch_id:
                vals.update({
                    'pos_branch_id': session.config_id.pos_branch_id.id
                })
        if not vals.get('pos_branch_id'):
            vals.update({'pos_branch_id': self.env['pos.branch'].sudo().get_default_branch()})
        if not vals.get('company_id', None):
            vals.update({'company_id': self.env.user.company_id.id})
        move = super(AccountMove, self).create(vals)
        for move_line in move.line_ids:
            if move.pos_session_id and move.pos_session_id.config_id and move.pos_session_id.config_id.analytic_account_id:
                move_line.write({
                    'analytic_account_id': move.pos_session_id.config_id.analytic_account_id.id
                })
        return move

    def write(self, vals):
        credit_object = self.env['res.partner.credit']
        for invoice in self:
            if invoice.add_credit and vals.get('state', None) == 'posted':
                credit = credit_object.create({
                    'name': invoice.name,
                    'type': 'plus',
                    'amount': invoice.amount_total,
                    'move_id': invoice.id,
                    'partner_id': invoice.partner_id.id,
                })
                self.env['pos.cache.database'].insert_data('res.partner', credit.partner_id.id)
            if vals.get('state', None) in ['draft', 'cancel']:
                credit_object.search([('move_id', '=', invoice.id)]).write({'active': False})
            for move_line in invoice.line_ids:
                if invoice.pos_session_id and invoice.pos_session_id.config_id and invoice.pos_session_id.config_id.analytic_account_id:
                    move_line.write({
                        'analytic_account_id': invoice.pos_session_id.config_id.analytic_account_id.id
                    })
        res = super(AccountMove, self).write(vals)
        return res


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    pos_branch_id = fields.Many2one(
        'pos.branch',
        string='Branch',
        related='move_id.pos_branch_id',
        store=True,
        readonly=1
    )

    # TODO: why could not call create ??? If we remove comments here, pos session could not closing
    # TODO: dont reopen-comments codes
    # @api.model
    # def create(self, vals):
    #     if not vals.get('pos_branch_id'):
    #         vals.update({'pos_branch_id': self.env['pos.branch'].sudo().get_default_branch()})
    #     move_line = super(AccountMoveLine, self).create(vals)
    #     return move_line