# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import logging

_logger = logging.getLogger(__name__)

class pos_category(models.Model):
    _inherit = "pos.category"

    is_category_combo = fields.Boolean(
        'Is Combo Category',
        help='If it checked, \n'
             'When Pop-Up combo items show on POS Screen\n'
             'Pop-Up Only show POS Categories have Is Combo Category checked'
    )
    sale_limit_time = fields.Boolean('Sale Limit Time')
    from_time = fields.Float('From Time')
    to_time = fields.Float('To Time')
    submit_all_pos = fields.Boolean('Submit all Point Of Sale')
    pos_branch_ids = fields.Many2many(
        'pos.branch',
        'pos_category_branch_rel',
        'categ_id',
        'branch_id',
        string='Branches Applied')
    pos_config_ids = fields.Many2many(
        'pos.config',
        'pos_category_config_rel',
        'categ_id',
        'config_id',
        string='Point Of Sale Applied')

    @api.model
    def create(self, vals):
        category = super(pos_category, self).create(vals)
        self.env['pos.cache.database'].insert_data(self._inherit, category.id)
        return category

    def write(self, vals):
        res = super(pos_category, self).write(vals)
        for category in self:
            self.env['pos.cache.database'].insert_data(self._inherit, category.id)
        return res

    def unlink(self):
        for category in self:
            self.env['pos.cache.database'].remove_record(self._inherit, category.id)
        return super(pos_category, self).unlink()
