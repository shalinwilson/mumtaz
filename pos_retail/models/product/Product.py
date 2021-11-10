# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from datetime import datetime
import logging
import json

_logger = logging.getLogger(__name__)


class pos_sale_extra(models.Model):
    _name = "pos.sale.extra"
    _description = "Sale extra items base on core product"

    product_tmpl_id = fields.Many2one('product.template', 'Base Product', required=1,
                                      domain=[('available_in_pos', '=', True)])
    product_id = fields.Many2one('product.product', 'Product extra', required=1,
                                 domain=[('available_in_pos', '=', True)])
    quantity = fields.Float('Default Qty', default=1, required=1)
    list_price = fields.Float('List Price', required=1)

    @api.model
    @api.onchange('product_id')
    def onchange_product_id(self):
        self.list_price = self.product_id.list_price


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    pos_combo_item_ids = fields.One2many('pos.combo.item', 'product_combo_id', string='Combo Items')
    is_combo = fields.Boolean(
        'Combo Bundle/Pack',
        help='Active it and see to tab Combo/Pack and adding Items for Combo Future'
    )
    is_combo_item = fields.Boolean(
        'Dynamic Combo Item',
        help='Allow this product become item combo of Another Product'
    )
    combo_limit = fields.Integer(
        'Combo Item Limit',
        help='Limit combo items can allow cashier add / combo')
    is_credit = fields.Boolean('Is Credit', default=False)
    multi_category = fields.Boolean('Multi Category')
    pos_categ_ids = fields.Many2many(
        'pos.category',
        string='POS Multi Category')
    multi_uom = fields.Boolean('Multi Unit')
    price_uom_ids = fields.One2many(
        'product.uom.price',
        'product_tmpl_id',
        string='Price by Sale Unit')
    multi_variant = fields.Boolean('Multi Variant and Attribute')
    pos_variant_ids = fields.One2many(
        'product.variant',
        'product_tmpl_id',
        string='Variants and Attributes of Product')
    cross_selling = fields.Boolean('Cross Selling')
    cross_ids = fields.One2many(
        'product.cross',
        'product_tmpl_id',
        string='Cross Selling Items')
    supplier_barcode = fields.Char(
        'Supplier Barcode', copy=False,
        help="Supplier Barcode Product, You can Input here and scan on POS")
    barcode_ids = fields.One2many(
        'product.barcode',
        'product_tmpl_id',
        string='Multi Barcode')
    pack_ids = fields.One2many(
        'product.quantity.pack',
        'product_tmpl_id',
        string='Quantities Pack')
    pos_sequence = fields.Integer('POS Sequence')
    is_voucher = fields.Boolean('Is Voucher', default=0)
    sale_extra = fields.Boolean(string='Active Sale Extra')
    sale_extra_item_ids = fields.One2many(
        'pos.sale.extra',
        'product_tmpl_id',
        'Sale Extra Items')
    minimum_list_price = fields.Float('Min Sales Price', default=0)
    sale_with_package = fields.Boolean('Sale with Package')
    price_unit_each_qty = fields.Boolean('Active Sale Price each Quantity')
    product_price_quantity_ids = fields.One2many(
        'product.price.quantity',
        'product_tmpl_id',
        'Price each Quantity')
    qty_warning_out_stock = fields.Float('Qty Warning out of Stock', default=10)
    combo_price = fields.Float(
        'Combo Item Price',
        help='This Price will replace public price and include to Line in Cart'
    )
    combo_limit_ids = fields.One2many(
        'pos.combo.limit',
        'product_tmpl_id',
        'Combo Limited Items by Category'
    )
    name_second = fields.Char(
        'Second Name',
        help='If you need print pos receipt Arabic,Chinese...language\n'
             'Input your language here, and go to pos active Second Language')
    special_name = fields.Char('Special Name')
    uom_ids = fields.Many2many('uom.uom', string='Units the same category', compute='_get_uoms_the_same_category')
    note_ids = fields.Many2many(
        'pos.note',
        'product_template_note_rel',
        'product_tmpl_id',
        'note_id',
        string='Notes Fixed'
    )
    tag_ids = fields.Many2many(
        'pos.tag',
        'product_template_tag_rel',
        'product_tmpl_id',
        'tag_id',
        string='Tags'
    )
    pos_branch_id = fields.Many2one('pos.branch', string='Branch')
    commission_rate = fields.Float(
        'Commission Rate',
        default=50,
        help='Commission Rate (%) for sellers'
    )
    cycle = fields.Integer(
        'Cycle',
        help='Total cycle times, customer can use in Spa Business'
    )

    def add_barcode(self):
        for product in self:
            format_code = "%s%s%s" % ('777', product.id, datetime.now().strftime("%d%m%y%H%M"))
            barcode = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            product.write({'barcode': barcode})
        return True

    def random_barcode(self):
        for product in self:
            format_code = "%s%s%s" % ('333', product.id, datetime.now().strftime("%d%m%y%H%M"))
            barcode = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            product.write({'supplier_barcode': barcode})
        return True

    @api.model
    def create(self, vals):
        if not vals.get('pos_branch_id'):
            vals.update({'pos_branch_id': self.env['pos.branch'].sudo().get_default_branch()})
        product_tmpl = super(ProductTemplate, self).create(vals)
        return product_tmpl

    @api.onchange('uom_id')
    def onchange_uom_id(self):
        if self.uom_id:
            uoms = self.env['uom.uom'].search([('category_id', '=', self.uom_id.category_id.id)])
            self.uom_ids = [(6, 0, [uom.id for uom in uoms])]

    def _get_uoms_the_same_category(self):
        for product in self:
            uoms = self.env['uom.uom'].search([('category_id', '=', product.uom_id.category_id.id)])
            product.uom_ids = [(6, 0, [uom.id for uom in uoms])]

    def write(self, vals):
        res = super(ProductTemplate, self).write(vals)
        for product_temp in self:
            products = self.env['product.product'].search([('product_tmpl_id', '=', product_temp.id)])
            for product in products:
                if not product.available_in_pos or not product.active:
                    self.env['pos.cache.database'].remove_record('product.product', product.id)
        return res

    def unlink(self):
        for product_temp in self:
            products = self.env['product.product'].search([('product_tmpl_id', '=', product_temp.id)])
            for product in products:
                self.env['pos.cache.database'].remove_record('product.product', product.id)
        return super(ProductTemplate, self).unlink()

class product_product(models.Model):
    _inherit = 'product.product'

    def write(self, vals):
        res = super(product_product, self).write(vals)
        for product in self:
            if not product.available_in_pos or not product.active:
                self.env['pos.cache.database'].remove_record(self._inherit, product.id)
        return res

    def unlink(self):
        for product in self:
            self.env['pos.cache.database'].remove_record(self._inherit, product.id)
        return super(product_product, self).unlink()

    def add_barcode(self):
        for product in self:
            format_code = "%s%s%s" % ('777', product.id, datetime.now().strftime("%d%m%y%H%M"))
            barcode = self.env['barcode.nomenclature'].sanitize_ean(format_code)
            product.write({'barcode': barcode})
        return True


class ProductTemplateAttribute(models.Model):
    _inherit = "product.template.attribute.value"

    def write(self, vals):
        res = super(ProductTemplateAttribute, self).write(vals)
        if vals.get('price_extra', None):
            sessions_opened = self.env['pos.session'].sudo().search([('state', '=', 'opened')])
            sessions_opened.write({
                'required_reinstall_cache': True
            })
        return res
