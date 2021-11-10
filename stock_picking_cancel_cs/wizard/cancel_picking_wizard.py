from odoo import api, exceptions, fields, models, _


class CancelDeliveryWizard(models.TransientModel):
    _name = "cancel.picking.wizard"
    _description = "Cancel Picking"

    picking_ids = fields.Many2many('stock.picking','stock_pick_cancel_wizard','picking_id','wizard_id', string='Delivery Order')


    def clear_all_delivery(self):
        self.picking_ids = False
        return {"type": "ir.actions.do_nothing"}

    def cancel_selected_delivery_orders(self):

        if self.picking_ids:
           self.picking_ids.with_context({'Flag': True}).action_cancel()
           return self.action_view_delivery()

    def action_view_delivery(self):
        '''
        This function returns an action that display existing delivery orders
        of given sales order ids. It can either be a in a list or in a form
        view, if there is only one delivery order to show.
        '''
        action = self.env.ref('stock.action_picking_tree_all').read()[0]

        pickings = self.mapped('picking_ids')
        if len(pickings) > 1:
            action['domain'] = [('id', 'in', pickings.ids)]
        elif pickings:
            action['views'] = [(self.env.ref('stock.view_picking_form').id, 'form')]
            action['res_id'] = pickings.id
        return action
