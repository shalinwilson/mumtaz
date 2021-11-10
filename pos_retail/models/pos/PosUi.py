# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class POSUI(models.Model):
    _name = "pos.ui"
    _description = "Design POS Layout"
    _rec_name = "tag"

    config_id = fields.Many2one(
        'pos.config',
        'Point Of Sale',
        required=1
    )
    tag = fields.Char('Tag', required=1)
    top = fields.Integer('Top')
    left = fields.Integer('Left')
    width = fields.Integer('Width')
    parent_with = fields.Integer('Parent With')
    height = fields.Integer('Height')
    parent_height = fields.Integer('Parent Height')
    background = fields.Char('BackGround Color')
    fontsize = fields.Integer('Font Size')
    lineheight = fields.Integer('Line Height')
    fontweight = fields.Integer('Font Weight')
    borderradius = fields.Integer('Border Radius')
    textalign = fields.Char('Text Align')
    invisible = fields.Boolean('Invisible')
    color = fields.Char('Color')
    padding = fields.Integer('Padding')
    margin = fields.Integer('Margin')
    display = fields.Char('Display')

    def save_design_ui_receipt(self, values):
        for value in values:
            element_exist = self.search([
                ('config_id', '=', value.get('config_id')),
                ('tag', '=', value.get('tag'))
            ])
            if element_exist:
                element_exist.write(value)
            else:
                self.create(value)
        return {'status': 'Updated New Design'}

    def remove_design_ui_receipt(self, config_id):
        return self.search([
            ('config_id', '=', config_id),
        ]).unlink()
