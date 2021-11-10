# -*- coding: utf-8 -*-
from odoo import api, models, fields, registry
import json
import logging

_logger = logging.getLogger(__name__)

class PosBackUpOrders(models.Model):
    _name = "pos.backup.orders"
    _description = "This is table save all orders on POS Session, if POS Session Crash. POS Users can restore back all Orders"

    config_id = fields.Many2one('pos.config', required=1)
    unpaid_orders = fields.Text('UnPaid Orders')

    def automation_backup_orders(self, vals):
        old_backups = self.search([
            ('config_id', '=', vals.get('config_id'))
        ])
        if old_backups:
            old_backups.write({
                'unpaid_orders': json.dumps(vals.get('unpaid_orders'))
            })
            return old_backups[0].id
        else:
            return self.create({
                'config_id': vals.get('config_id'),
                'unpaid_orders': json.dumps(vals.get('unpaid_orders'))
            }).id

    def get_unpaid_orders(self, vals):
        old_backups = self.search([
            ('config_id', '=', vals.get('config_id'))
        ])
        if old_backups:
            return old_backups[0].unpaid_orders
        else:
            return []