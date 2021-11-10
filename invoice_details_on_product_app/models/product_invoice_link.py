# -*- coding: utf-8 -*-

from odoo import api, fields, models, _

class ProductProduct(models.Model):
    _inherit = "product.product"

    count_invoice_qty = fields.Integer('Invoice Quantity', compute='_count_incoming_invoice_qty')
    count_incoming_invoice_qty = fields.Integer('Incoming Invoice Qty', compute='_count_incoming_invoice_qty')
    count_invoice_amount = fields.Float('Invoice Amount', compute='_count_invoice_amount')
    count_incoming_invoice_amount  =  fields.Float('Incoming Invoice Amount', compute='_count_invoice_amount')

    def _count_incoming_invoice_qty(self):
        for product in self:
            account_move_line_ids = self.env['account.move.line'].search([('product_id','=',product.id)])
            customer_count = 0
            vendor_count = 0
            for line in account_move_line_ids:
                if line.move_id.type == "out_invoice" or line.move_id.type == "in_refund":
                    customer_count += line.quantity
                else:
                    vendor_count += line.quantity
            product.count_invoice_qty = customer_count
            product.count_incoming_invoice_qty = vendor_count


    def invoice_qty_button(self):
	    self.ensure_one()
	    return {
			'name': 'Invoice Lines',
			'type': 'ir.actions.act_window',
			'view_mode': 'tree,form',
			'res_model': 'account.move.line',
			'domain': [('product_id','=',self.id),('move_id.type','in',['out_invoice','in_refund'])],
		}


    def incoming_invoice_qty_button(self):
        self.ensure_one()
        return {
            'name': 'Incoming Invoice Lines',
            'type': 'ir.actions.act_window',
            'view_mode': 'tree,form',
            'res_model': 'account.move.line',
            'domain': [('product_id','=',self.id),('move_id.type','in',['in_invoice','out_refund'])],
        }

    def _count_invoice_amount(self):
        for product in self:
            account_move_line_ids = self.env['account.move.line'].search([('product_id','=',product.id)])
            customer_count = 0.0
            vendor_count = 0.0
            for line in account_move_line_ids:
                if line.move_id.type == "out_invoice" or line.move_id.type == "in_refund":
                    customer_count += line.price_subtotal
                else:
                    vendor_count += line.price_subtotal
            product.count_invoice_amount = customer_count
            product.count_incoming_invoice_amount = vendor_count


    def invoice_amount_button(self):
        self.ensure_one()
        return {
			'name': 'Invoice Amount',
			'type': 'ir.actions.act_window',
			'view_mode': 'tree,form',
			'res_model': 'account.move.line',
			'domain': [('product_id','=',self.id),('move_id.type','in',['out_invoice','in_refund'])],
		}


    def incoming_invoice_amount_button(self):
        self.ensure_one()
        return {
            'name': 'Incoming Invoice Amount',
            'type': 'ir.actions.act_window',
            'view_mode': 'tree,form',
            'res_model': 'account.move.line',
            'domain': [('product_id','=',self.id),('move_id.type','in',['in_invoice','out_refund'])],
        }

    # vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: