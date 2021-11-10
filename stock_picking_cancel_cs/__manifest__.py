# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name' : 'Cancel Stock Picking (Delivery Order) & Reset to Draft',
    'version' : '1.0',
    'author':'Craftsync Technologies',
    'category': 'Stock',
    'maintainer': 'Craftsync Technologies',    
    # 'summary': """Enable auto cancel transfered delivery or cancel stock picking. Auto Cancel Delivery Order and Auto Cancel Receivable products.""",
    'description': """
        delivery order cancel 
cancel picking
delivery cancel 
reverse delivery 
picking order cancel
Stock cancel reverse accounting 
Picking Cancel 
Cancel Order 
Cancel Picking 
Cancel Delivery 
Delivery Cancel 
Cancel Receipts 
Receipt Cancel 
Cancel Order 
Cancel shipment
reverse picking
stock picking cancel in odoo
shipment cancel 
stock picking cancel 
Cancel Delivery Order 
Cancel Outgoing picking 
Cancel Incoming Picking 
Reset Stock Move/Picking
Cancel move 
reset move 
return move 
Reset Delivery Order 
reverse Delivery Order 
Return Delivery Order 
return picking 
return delivery 
reverse move 
stock cancel 
return stock 
stock return 
Stock Picking Cancel 
Stock Picking cancel and Reverse 
cancel accounting entries 
reverse stock 
stock reverse 
reverse stock entries 
stock entry reverse 
return stock entry 
stock entry return
reset to draft
reset picking
reset to draft incoming shipment
reset to draft delivery order
reset incoming shipment
reset delivery order
reset picking/delivery
reset picking 
stock return 
stock return to warehouse
stock return to location
stock return to stock location
product return
product return to warehouse
product return to stock warehouse
product return to stock location
item return
item return to warehouse
item return to stock warehouse
item return to stock location
reset validate delivery
reset validate delivery order
reset validate incoming shipment
reset validate picking
reset validated picking
reset validated delivery
reset validated incoming shipment
cancel validate delivery
cancel validate delivery order
cancel validate incoming shipment
cancel validate picking
cancel validated picking
cancel validated delivery
cancel validated incoming shipment
cancel transfered delivery
cancel transfered delivery order
cancel transfered incoming shipment
cancel transfered picking
cancel transfer picking
cancel transfer delivery
cancel transfer incoming shipment
reset transfered delivery
reset transfered delivery order
reset transfered incoming shipment
reset transfered picking
reset transfer picking
reset transfer delivery
reset transfer incoming shipment
return transfered delivery
return transfered delivery order
return transfered incoming shipment
return transfered picking
return transfer picking
return transfer delivery
Return transfer incoming shipment
return validate delivery
return validate delivery order
return validate incoming shipment
return validate picking
return validated picking
return validated delivery
return validated incoming shipment
Reset to Draft
Reset Picking
Reset to Draft Incoming shipment
Reset to Draft Delivery Order
Reset Incoming shipment
Reset Delivery Order
Reset Picking/Delivery
Reset Picking 
picking reset
reset to new
cancel done stock
cancel done picking
    """,
    'website': 'https://www.craftsync.com/',
    'license': 'OPL-1',
    'support':'info@craftsync.com',
    'depends' : ['sale_management','purchase','sale_stock'],
    'data': [
        'views/stock_picking.xml',
        'views/res_config_settings_views.xml',
        'views/view_sale_order.xml',
        'views/view_purchase_order.xml',
        'wizard/view_cancel_delivery_wizard.xml',

    ],
    
    'installable': True,
    'application': True,
    'auto_install': False,
    'images': ['static/description/main_screen.png'],
    'price': 14.99,
    'currency': 'EUR',

}
