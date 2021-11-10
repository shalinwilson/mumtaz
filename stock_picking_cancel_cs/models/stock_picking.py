from odoo import api, fields, models,exceptions
from odoo.tools.float_utils import float_round, float_compare, float_is_zero


class StockPicking(models.Model):
    _inherit = "stock.picking"

    cancel_done_picking = fields.Boolean(string='Cancel Done Delivery?', compute='check_cancel_done_picking')

    @api.model
    def check_cancel_done_picking(self):

        for picking in self:
            if picking.company_id.cancel_done_picking:
                picking.cancel_done_picking = True
            else:
                picking.cancel_done_picking = False

    def action_cancel(self):
        quant_obj= self.env['stock.quant']
        moves = self.env['account.move']
        return_picking_obj = self.env['stock.return.picking']
        account_move_obj=self.env['account.move']
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')
        for picking in self:
            if self.env.context.get('Flag',False) and picking.state =='done':
                account_moves = picking.move_lines
                for move in account_moves:
                    if move.state=='cancel':
                        continue
                    landed_cost_rec =[]
                    try:
                        landed_cost_rec= self.env['stock.landed.cost'].search(
                            [('picking_ids', '=', picking.id), ('state', '=', 'done')])
                    except :
                        pass

                    if landed_cost_rec:           
                        raise exceptions.Warning('This Delivery is set in landed cost record %s you need to delete it fisrt then you can cancel this Delivery'%','.join(landed_cost_rec.mapped('name')))

                    if move.state == "done" and move.product_id.type == "product":
                        for move_line in move.move_line_ids:
                            quantity = move_line.product_uom_id._compute_quantity(move_line.qty_done, move_line.product_id.uom_id)
                            quant_obj._update_available_quantity(move_line.product_id, move_line.location_id, quantity, move_line.lot_id)
                            quant_obj._update_available_quantity(move_line.product_id, move_line.location_dest_id, quantity * -1, move_line.lot_id)
                    if move.procure_method == 'make_to_order' and not move.move_orig_ids:
                        move.state = 'waiting'
                    elif move.move_orig_ids and not all(orig.state in ('done', 'cancel') for orig in move.move_orig_ids):
                        move.state = 'waiting'
                    else:
                        move.state = 'confirmed'
                    siblings_states = (move.move_dest_ids.mapped('move_orig_ids') - move).mapped('state')
                    if move.propagate_cancel:
                        if all(state == 'cancel' for state in siblings_states):
                            move.move_dest_ids._action_cancel()
                    else:
                        if all(state in ('done', 'cancel') for state in siblings_states):
                            move.move_dest_ids.write({'procure_method': 'make_to_stock'})
                        move.move_dest_ids.write({'move_orig_ids': [(3, move.id, 0)]})
                    move.write({'state': 'cancel', 'move_orig_ids': [(5, 0, 0)]})
                    acnt_moves = account_move_obj.search([('stock_move_id', '=', move.id)])
                    valuation = move.stock_valuation_layer_ids
                    valuation and valuation.sudo().unlink()
                    if acnt_moves:
                        for acnt_move in acnt_moves:
                            acnt_move.with_context({'force_delete': True}).line_ids.sudo().remove_move_reconcile()
                            acnt_move.with_context({'force_delete': True}).button_cancel()
                            acnt_move.with_context({'force_delete': True}).unlink()

        res = super(StockPicking,self).action_cancel()
        return res

    def action_draft(self):
        for res in self:
            if res.state =='cancel':
                res.state ='draft'

        return True