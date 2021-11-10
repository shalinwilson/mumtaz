{
    #Module information
    'name': 'Emipro Theme Product Slider',
    'category': 'eCommerce',
    'summary': 'This app contains the part of product category carousel for Emipro eCommerce Themes.',
    'version': '1.0.0',
    'license': 'OPL-1',
    'depends':['emipro_theme_base'],

    'data': [
        'views/slider.xml',
        'views/slider_filter.xml',
        'security/ir.model.access.csv',
        'templates/assets.xml'
    ],

    #Odoo Store Specific
    'images': [
	'static/description/emipro_theme_product_carousel.jpg',
    ],

    # Author
    'author': 'Emipro Technologies Pvt. Ltd.',
    'website': 'https://www.emiprotechnologies.com',
    'maintainer': 'Emipro Technologies Pvt. Ltd.',

    # Technical
    'installable': True,
    'auto_install': False,
    'price': 0.00,
    'currency': 'EUR',
}
