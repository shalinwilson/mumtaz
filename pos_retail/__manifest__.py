# -*- coding: utf-8 -*-
# License: Odoo Proprietary License v1.0
{
    'name': "POS All-In-One (PRO Version)",
    'version': '2.2.7.3',
    'category': 'Point of Sale',
    'author': 'TL Technology',
    'summary': '1ST Solution of Point Of Sale\n'
               ', Supported Enterprise and Community\n'
               ', Included 300+ features of POS... \n',
    'description': '1ST Solution of Point Of Sale\n'
                   ', Supported Enterprise and Community\n'
                   ', Included 300+ features of POS... \n',
    'live_test_url': 'http://posodoo.com/saas/public/1',
    'price': '550',
    'website': 'http://posodoo.com',
    'sequence': 0,
    'depends': [
        'sale_stock',
        'account',
        'sale_management',
        'hr',
        'bus',
        'stock_account',
        'purchase',
        'product',
        'product_expiry',
        'pos_restaurant',
        'pos_discount',
        'mail',
        'mail_bot',
        'im_livechat',
        'mrp',
        'base_geolocalize',
    ],
    'demo': ['demo/demo_data.xml'],
    'data': [
        'security/ir.model.access.csv',
        'security/group.xml',
        'security/ir_rule.xml',
        'views/Menu.xml',
        'reports/pos_lot_barcode.xml',
        'reports/pos_sale_analytic.xml',
        'reports/report_pos_order.xml',
        'reports/pos_sale_report_template.xml',
        'reports/pos_sale_report_view.xml',
        'reports/pos_order_report.xml',
        'datas/product.xml',
        'datas/schedule.xml',
        'datas/email_template.xml',
        'datas/customer.xml',
        'datas/res_partner_type.xml',
        'datas/barcode_rule.xml',
        'datas/pos_loyalty_category.xml',
        'datas/sequence.xml',
        'import/ImportLibraties.xml',
        # TODO: views
        'views/MrpProduction.xml',
        'views/AccountBankStatement.xml',
        'views/PosConfig.xml',
        'views/PosConfigImage.xml',
        'views/PosSession.xml',
        'views/ProductTemplate.xml',
        'views/ProductVariant.xml',
        'views/ProductBarcode.xml',
        'views/ProductGenericOption.xml',
        'views/ProductPricelist.xml',
        'views/PosOrder.xml',
        'views/PosPackOperationLot.xml',
        'views/PosPayment.xml',
        'views/SaleOrder.xml',
        'views/PosLoyalty.xml',
        'views/ResPartnerCredit.xml',
        'views/ResPartnerGroup.xml',
        'views/ResPartnerType.xml',
        'views/ResPartner.xml',
        'views/Restaurant.xml',
        'views/ResUsers.xml',
        'views/PosPromotion.xml',
        'views/AccountJournal.xml',
        'views/AccountMove.xml',
        'views/AccountPayment.xml',
        'views/PosVoucher.xml',
        'views/PosBranch.xml',
        'views/PosTag.xml',
        'views/PosNote.xml',
        'views/PosComboItem.xml',
        'views/StockProductionLot.xml',
        'views/StockPicking.xml',
        'views/PosQuicklyPayment.xml',
        'views/PosGlobalDiscount.xml',
        'views/PurchaseOrder.xml',
        'views/MedicalInsurance.xml',
        'views/PosCallLog.xml',
        'views/PosCategory.xml',
        'views/PosCacheDatabase.xml',
        'views/SaleExtra.xml',
        'views/ProductPackaging.xml',
        'views/PosIot.xml',
        'views/PosSyncSessionLog.xml',
        'views/PosServiceCharge.xml',
        'views/PosUi.xml',
        'views/StockInventory.xml',
        'views/StockLocation.xml',
        'views/StockMove.xml',
        'views/StockWarehouse.xml',
        # TODO: wizard
        'wizards/RemovePosOrder.xml',
        'wizards/PosRemoteSession.xml',
        'wizards/PosBox.xml',
    ],
    'qweb': [
        'static/src/xml/screens/*.xml',
        'static/src/xml/receipts/*.xml',
        'static/src/xml/mobiles/*.xml',
        'static/src/xml/*.xml',
        'static/src/xml/design_ui/*.xml',
    ],
    "currency": 'EUR',
    'installable': True,
    'application': True,
    'images': ['static/description/icon.png'],
    'support': 'thanhchatvn@gmail.com',
    "license": "Other proprietary",
    'post_init_hook': '_auto_clean_cache_when_installed',
}
