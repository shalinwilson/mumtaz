from odoo import models, fields, api
from io import BytesIO
import base64
try:
    from odoo.tools.misc import xlsxwriter
except ImportError:
    import xlsxwriter

REPORT_TYPES = {
    'vat_return': 'VAT Summary',
    'vat_statement': 'VAT Statement',
}

TYPES = {
    'sale': 'Sales (Outwards)',
    'purchase': 'Purchases (Inwards)',
}

TAX_TYPE = {
    'sale': 'Sales',
    'purchase': 'Purchases',
    'none': 'None',
}

DOCUMENT_TYPE = {
    'out_invoice': 'Customer Invoice',
    'in_invoice': 'Vendor Bill',
    'out_refund': 'Customer Credit Note',
    'in_refund': 'Vendor Credit Note',
    'payment': 'TAX Payment',
    'refund': 'TAX Refund',
    'adjustment': 'Misc Adjustment',
    'other_adjustment': 'Other Adjustment',
    'entry': 'Journal Entry',
}


class VATReportWizard(models.TransientModel):
    _name = 'vat.report.wizard'

    date_from = fields.Date('Date From', required=True)
    date_to = fields.Date('Date To', required=True)
    target_move = fields.Selection([('posted', 'All Posted Entries'), ('all', 'All Entries')], string='Target Moves', required=True, default='posted')
    report_type = fields.Selection([('vat_return', 'VAT Summary'), ('vat_statement', 'VAT Statement')], string='Report Type', default='vat_return')
    tax_payment_included = fields.Boolean(string='Include Tax Payment', default=True)
    tax_refund_included = fields.Boolean(string='Include Tax Refund', default=True)
    misc_adj_included = fields.Boolean(string='Include Misc. Adj', default=True)
    tax_group_ids = fields.Many2many('account.tax.group', string='Tax Groups')
    type_tax_use = fields.Selection([('sale', 'Sales'), ('purchase', 'Purchases'), ('none', 'None')], string='Tax Scope')
    tax_ids = fields.Many2many('account.tax', string='Taxes')

    def action_generate_vat_report(self):
        data = {
            'report_type': self.report_type,
            'date_from': self.date_from,
            'date_to': self.date_to,
            'target_move': self.target_move,
            'tax_payment_included': self.tax_payment_included,
            'tax_refund_included': self.tax_refund_included,
            'misc_adj_included': self.misc_adj_included,
            'tax_group_ids': self.tax_group_ids.ids,
            'tax_ids': self.tax_ids.ids,
            'type_tax_use': self.type_tax_use,
        }
        return self.generate_xlsx_report(data)

    def add_company_address(self, sheet):
        row = 3
        company_id = self.env.user.company_id
        sheet.merge_range('A{row}:B{row}'.format(row=row), company_id.name)
        row += 1
        if company_id.street:
            sheet.merge_range('A{row}:B{row}'.format(row=row), company_id.street)
            row += 1
        if company_id.street2:
            sheet.merge_range('A{row}:B{row}'.format(row=row), company_id.street2)
            row += 1
        if company_id.city or company_id.state_id or company_id.zip:
            addr = '{city}, {state}, {zip}'.format(city=company_id.city, state=company_id.state_id.name, zip=company_id.zip)
            sheet.merge_range('A{row}:B{row}'.format(row=row), addr)
            row += 1
        if company_id.country_id:
            sheet.merge_range('A{row}:B{row}'.format(row=row), company_id.country_id.name)
        return row

    def _sql_from_amls_one(self):
        sql = """SELECT "account_move_line".tax_line_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0), 
                    (SELECT tax_group_id from account_tax where id="account_move_line".tax_line_id)
                    FROM %s
                    WHERE %s AND "account_move_line".tax_exigible GROUP BY "account_move_line".tax_line_id"""
        return sql

    def _sql_from_amls_two(self):
        sql = """SELECT r.account_tax_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0),
                 (SELECT tax_group_id from account_tax where id=r.account_tax_id)
                 FROM %s
                 INNER JOIN account_move_line_account_tax_rel r ON ("account_move_line".id = r.account_move_line_id)
                 INNER JOIN account_tax t ON (r.account_tax_id = t.id)
                 WHERE %s AND "account_move_line".tax_exigible GROUP BY r.account_tax_id"""
        return sql

    def _compute_from_amls(self, options, taxes):
        #compute the tax amount
        sql = self._sql_from_amls_one()
        tables, where_clause, where_params = self.env['account.move.line']._query_get()
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] in taxes:
                taxes[result[0]]['tax'] = abs(result[1])

        #compute the net amount
        sql2 = self._sql_from_amls_two()
        query = sql2 % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] in taxes:
                taxes[result[0]]['net'] = abs(result[1])

    @api.model
    def get_lines(self, options):
        taxes = {}
        for tax in self.env['account.tax'].search([('type_tax_use', '!=', 'none')]):
            if tax.children_tax_ids:
                for child in tax.children_tax_ids:
                    if child.type_tax_use != 'none':
                        continue
                    taxes[child.id] = {'tax': 0, 'net': 0, 'name': child.name, 'type': tax.type_tax_use}
            else:
                taxes[tax.id] = {'tax': 0, 'net': 0, 'name': tax.name, 'type': tax.type_tax_use, 'tax_group_id': tax.tax_group_id.id}
        self.with_context(date_from=options['date_from'], date_to=options['date_to'], state=options.get('target_move'), strict_range=True)._compute_from_amls(options, taxes)
        tax_group_ids = self.env['account.tax.group'].search([]).ids
        groups = dict((tp, dict([(tg, []) for tg in tax_group_ids])) for tp in ['sale', 'purchase'])
        for tax in taxes.values():
            for tax_group_id in tax_group_ids:
                if tax['tax'] and tax['tax_group_id'] == tax_group_id:
                    groups[tax['type']][tax_group_id].append(tax)
        return groups

    def compute_tax_payment_refund_adjustment(self, data, tax_type=None):
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        target_move = data.get('target_move', 'draft')
        query = """
            SELECT SUM(aml.debit - aml.credit) as balance FROM account_move_line as aml, account_account as ac, account_move as am WHERE 
            aml.account_id = ac.id AND ac.is_a_vat_account = true
            AND aml.date BETWEEN '%s' AND '%s'
            AND aml.move_id = am.id AND am.type = 'entry'
        """ % (date_from, date_to)
        if target_move == 'posted':
            query += " AND am.state = '%s'" % target_move
        if tax_type is None:
            query += " AND aml.vat_payment_adj_type is NULL;"
        else:
            query += " AND aml.vat_payment_adj_type = '%s';" % tax_type

        self.env.cr.execute(query)
        results = self.env.cr.fetchall()
        return results

    def generate_xlsx_report(self, data):
        filename = 'VAT report''.xlsx'
        output = BytesIO()
        workbook = xlsxwriter.Workbook(output)
        report_name = REPORT_TYPES[data.get('report_type')]
        sheet = workbook.add_worksheet(report_name)
        title_format = workbook.add_format({'bold': True, 'align': 'center', 'font_size': 16})
        bold = workbook.add_format({'bold': True, 'fg_color': '#c6d9f0', 'border': 1})
        style1 = workbook.add_format({'bold': True, 'font_size': 11, 'fg_color': '#dfe4e4'})
        style2 = workbook.add_format({'bold': True})
        money = workbook.add_format({'num_format': '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)'})
        date_format = workbook.add_format({'num_format': 'm/d/yyyy'})
        money_bold = workbook.add_format({'num_format': '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', 'bold': True, 'fg_color': '#dfe4e4'})
        money_style1 = workbook.add_format({'num_format': '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)', 'bold': True, 'fg_color': '#c6d9f0'})
        merge_format = workbook.add_format({
            'bold': 1, 'border': 1, 'align': 'center', 'valign': 'vcenter', 'fg_color': '#c6d9f0', 'font_size': 11})
        sheet.merge_range('A1:D1', report_name, merge_format)
        row = self.add_company_address(sheet)
        row += 2

        # Filters
        date_string = '{date_from} to {date_to}'.format(date_from=data.get('date_from', ''), date_to=data.get('date_to', ''))
        sheet.merge_range('A{row}:B{row}'.format(row=row), date_string)

        col = 0
        row += 3
        if data.get('report_type') == 'vat_return':
            return self.generate_vat_return_report(sheet, workbook, output, row, col, bold, style1, style2, money_style1, money, money_bold, data)
        else:
            return self.generate_vat_summary_report(sheet, workbook, output, row, col, bold, style1, style2, money, money_bold, data, date_format)

    def generate_vat_return_report(self, sheet, workbook, output, row, col, bold, style1, style2, money_style1, money, money_bold, data):
        results = self.get_lines(data)
        sheet.write(row - 1, col, 'Particular', bold)
        sheet.write(row - 1, col+1, 'Taxable Value', bold)
        sheet.write(row - 1, col+2, '', bold)
        sheet.set_column(col+1, col+1, 13)
        sheet.set_column(col+2, col+2, 0.75)
        sheet.write(row - 1, col+3, 'Tax Amount', bold)
        sheet.set_column(col+3, col+3, 13)

        total_tax_payable_refundable = 0.0
        for group in results:
            total_net_amount = 0
            total_tax_amount = 0
            type_row = row
            sheet.write(row, col, TYPES[group], style1)
            sheet.write(row, col+2, '', style1)
            sheet.set_column(col, col, 34.43)
            sheet.conditional_format('A{row}:D{row}'.format(row=row + 1), {
                'type': 'formula', 'criteria': 'True',
                'format': workbook.add_format({'bottom': 1, 'top': 1})
            })
            row += 1
            groups = results.get(group)
            for tax_group in groups:
                taxes = groups.get(tax_group)
                if taxes:
                    tax_group_name = self.env['account.tax.group'].browse(tax_group).name
                    group_col = col
                    group_row = row
                    sheet.write(row, col, tax_group_name, style2)
                    sheet.conditional_format('A{}:D{}'.format(row + 1, row + 1), {
                        'type': 'formula', 'criteria': 'True',
                        'format': workbook.add_format({'bottom': 1})
                    })
                    row += 1
                    for tax in taxes:
                        total_net_amount += tax.get('net')
                        total_tax_amount += tax.get('tax')
                        sheet.write(row, col, tax.get('name'))
                        sheet.write(row, col + 1, tax.get('net'), money)
                        sheet.write(row, col + 3, tax.get('tax'), money)
                        row += 1
                    # Group total
                    formula1 = '=SUM(B{}:B{})'.format(group_row + 2, row)
                    sheet.write(group_row, group_col + 1, formula1, money)
                    formula2 = '=SUM(D{}:D{})'.format(group_row + 2, row)
                    sheet.write(group_row, group_col + 3, formula2, money)
            # Total Tax type
            sheet.write(type_row, col + 1, total_net_amount, money_bold)
            sheet.write(type_row, col + 3, total_tax_amount, money_bold)
            row += 1
            if group == 'sale':
                total_tax_payable_refundable += total_tax_amount
            else:
                total_tax_payable_refundable -= total_tax_amount

        sheet.write(row, col, 'Tax Payable / (Refundable )', style1)
        sheet.conditional_format('A{}:D{}'.format(row + 1, row + 1), {
            'type': 'formula', 'criteria': 'True',
            'format': workbook.add_format({'bottom': 1, 'top': 1})
        })
        sheet.write(row, col + 1, '', style1)
        sheet.write(row, col + 2, '', style1)
        sheet.write(row, col + 3, total_tax_payable_refundable, money_bold)
        row += 1

        row += 1
        sheet.merge_range('A{}:D{}'.format(row + 1, row + 1), 'Payment & Adjustments', style1)
        sheet.conditional_format('A{}:D{}'.format(row + 1, row + 1), {
            'type': 'formula', 'criteria': 'True',
            'format': workbook.add_format({'bottom': 1, 'top': 1})
        })
        row += 1

        tax_payment = 0.0
        if data.get('tax_payment_included', False):
            if self.compute_tax_payment_refund_adjustment(data, 'payment')[0][0] is not None:
                tax_payment = self.compute_tax_payment_refund_adjustment(data, 'payment')[0][0]
            sheet.write(row, col, 'Less: TAX Payment')
            sheet.write(row, col + 3, tax_payment, money)
            row += 1

        tax_refund = 0.0
        if data.get('tax_refund_included', False):
            if self.compute_tax_payment_refund_adjustment(data, 'refund')[0][0] is not None:
                tax_refund = self.compute_tax_payment_refund_adjustment(data, 'refund')[0][0]
            sheet.write(row, col, 'Add: TAX Refund')
            sheet.write(row, col + 3, tax_refund, money)
            row += 1

        tax_adjustment = 0.0
        if self.compute_tax_payment_refund_adjustment(data, 'adjustment')[0][0] is not None:
            tax_adjustment = self.compute_tax_payment_refund_adjustment(data, 'adjustment')[0][0]
        sheet.write(row, col, 'Add/Less: Adjustment to Invoices')
        sheet.write(row, col + 3, tax_adjustment, money)
        row += 1

        misc_adj = 0.0
        if data.get('misc_adj_included', False):
            if self.compute_tax_payment_refund_adjustment(data)[0][0] is not None:
                misc_adj = self.compute_tax_payment_refund_adjustment(data)[0][0]
            sheet.write(row, col, 'Other Misc. Adjustment')
            sheet.write(row, col + 3, misc_adj, money)
            row += 1

        vat_paid_adj = tax_payment + tax_refund + tax_adjustment + misc_adj
        sheet.write(row, col, 'Total Payment & Adjustment', style1)
        sheet.write(row, col + 1, '', style1)
        sheet.write(row, col + 2, '', style1)
        sheet.write(row, col + 3, vat_paid_adj, money_bold)
        row += 1

        balance_vat_payable = vat_paid_adj - total_tax_payable_refundable
        sheet.write(row, col, 'Balance VAT (Payable)/ Refundable', bold)
        sheet.write(row, col + 1, '', bold)
        sheet.write(row, col + 2, '', bold)
        sheet.write(row, col + 3, balance_vat_payable, money_style1)
        sheet.conditional_format('A{}:D{}'.format(row + 1, row + 1), {
            'type': 'formula', 'criteria': 'True',
            'format': workbook.add_format({'bottom': 1, 'top': 1})
        })
        workbook.close()
        vat_report_id = self.env['od.vat.report.download'].create({'excel_file': base64.encodestring(output.getvalue()), 'file_name': 'vat_report.xlsx'})
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/binary/download_xlsx_report/%s' % vat_report_id.id,
            'target': 'new',
        }

    def _sql_from_amls_one_statement(self):
        sql = """SELECT "account_move_line".tax_line_id, "account_move_line".move_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0), "account_move_line".name, 
                    (SELECT tax_group_id from account_tax where id="account_move_line".tax_line_id)
                    FROM %s
                    WHERE %s AND "account_move_line".tax_exigible GROUP BY "account_move_line".id, "account_move_line".tax_line_id"""
        return sql

    def _sql_from_amls_two_statement(self):
        sql = """SELECT r.account_tax_id, "account_move_line".move_id, COALESCE(SUM("account_move_line".debit-"account_move_line".credit), 0), "account_move_line".name,
                 (SELECT tax_group_id from account_tax where id=r.account_tax_id)
                 FROM %s
                 INNER JOIN account_move_line_account_tax_rel r ON ("account_move_line".id = r.account_move_line_id)
                 INNER JOIN account_tax t ON (r.account_tax_id = t.id)
                 WHERE %s AND "account_move_line".tax_exigible GROUP BY "account_move_line".id, r.account_tax_id"""
        return sql

    def _compute_from_amls_statement(self, options, moves):
        # compute the tax amount
        sql = self._sql_from_amls_one_statement()
        tables, where_clause, where_params = self.env['account.move.line']._query_get()
        query = sql % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] and result[1] in moves:
                if moves[result[1]].get(result[0]):
                    moves[result[1]][result[0]]['move_id'] = result[1]
                    moves[result[1]][result[0]]['tax'] = result[2]
                    moves[result[1]][result[0]]['description'] = result[3]

        # compute the net amount
        sql2 = self._sql_from_amls_two_statement()
        query = sql2 % (tables, where_clause)
        self.env.cr.execute(query, where_params)
        results = self.env.cr.fetchall()
        for result in results:
            if result[0] and result[1] in moves:
                if moves[result[1]].get(result[0]):
                    moves[result[1]][result[0]]['move_id'] = result[1]
                    moves[result[1]][result[0]]['net'] = result[2]
                    moves[result[1]][result[0]]['description'] = result[3]

    @api.model
    def get_lines_statement(self, options):
        moves = {}
        results = []
        tax_domain = [('type_tax_use', '!=', None)]
        if options.get('tax_group_ids'):
            tax_domain.append(('tax_group_id', 'in', options.get('tax_group_ids')))
        if options.get('tax_ids'):
            tax_domain.append(('id', 'in', options.get('tax_ids')))
        if options.get('type_tax_use'):
            tax_domain.append(('type_tax_use', '=', options.get('type_tax_use')))
        for move in self.env['account.move'].search([]):
            if any(line.tax_ids for line in move.invoice_line_ids):
                moves[move.id] = {}
                for tax in self.env['account.tax'].search(tax_domain):
                    moves[move.id][tax.id] = {
                        'tax': 0,
                        'net': 0,
                        'name': move.name,
                        'type': move.type,
                        'date': move.invoice_date,
                        'partner': move.partner_id.name,
                        'tax_number': move.partner_id.vat,
                        'tax_group': tax.tax_group_id.name,
                        'tax_type': tax.type_tax_use,
                        'amount_untaxed': move.amount_untaxed,
                        'amount_total': move.amount_total,
                    }
        self.with_context(date_from=options['date_from'], date_to=options['date_to'], state=options.get('target_move'), strict_range=True)._compute_from_amls_statement(options, moves)
        for vals in moves.values():
            for val in vals.values():
                if val.get('move_id'):
                    results.append(val)

        domain = [('account_id.is_a_vat_account', '=', True), ('move_id.type', '=', 'entry')]
        if options.get('date_from'):
            domain.append(('move_id.date', '>=', options.get('date_from')))
        if options.get('date_to'):
            domain.append(('move_id.date', '<=', options.get('date_to')))
        if options.get('target_move') == 'posted':
            domain.append(('move_id.state', '=', 'posted'))
        moves_lines = self.env['account.move.line'].search(domain)
        for move_line in moves_lines:
            total = move_line.debit - move_line.credit
            if move_line.vat_payment_adj_type:
                document_type = move_line.vat_payment_adj_type
            else:
                document_type = 'other_adjustment'
            vals = {
                'tax': total,
                'net': 0,
                'name': move_line.move_id.name,
                'description': move_line.name,
                'type': document_type,
                'date': move_line.move_id.date,
                'partner': move_line.partner_id.name,
                'tax_number': move_line.partner_id.vat,
                'tax_group': '/',
                'tax_type': 'none',
                'amount_untaxed': 0.0,
                'amount_total': 0.0,
            }
            results.append(vals)
        return results

    def generate_vat_summary_report(self, sheet, workbook, output, row, col, bold, style1, style2, money, money_bold, data, date_format):
        results = self.get_lines_statement(data)
        sheet.write(row - 1, col, 'Date', style1)
        sheet.write(row - 1, col + 1, 'Partner', style1)
        sheet.write(row - 1, col + 2, 'Tax Group', style1)
        sheet.write(row - 1, col + 3, 'Tax Type', style1)
        sheet.write(row - 1, col + 4, 'Document Type', style1)
        sheet.write(row - 1, col + 5, 'Document No', style1)
        sheet.write(row - 1, col + 6, 'Tax No', style1)
        sheet.write(row - 1, col + 7, 'Description', style1)
        sheet.write(row - 1, col + 8, 'Base Amount', style1)
        sheet.write(row - 1, col + 9, 'Amount without VAT', style1)
        sheet.write(row - 1, col + 10, 'VAT Amount', style1)
        sheet.write(row - 1, col + 11, 'Amount with VAT', style1)
        sheet.conditional_format('A{}:L{}'.format(row, row), {
            'type': 'formula', 'criteria': 'True',
            'format': workbook.add_format({'bottom': 2, 'top': 2})
        })
        sheet.set_column(0, 11, 22.29)

        start_row = row
        for res in results:
            sign = res.get('tax') / abs(res.get('tax')) if res.get('tax') else 1
            net = abs(res.get('net')) * sign
            amount_untaxed = res.get('amount_untaxed') * sign
            tax = res.get('tax')
            amount_total = res.get('amount_total') * sign
            date = res.get('date') if res.get('date') else ''
            partner = res.get('partner') if res.get('partner') else ''
            description = res.get('description') if res.get('description') else ''
            sheet.write(row, col, date, date_format)
            sheet.write(row, col + 1, partner)
            sheet.write(row, col + 2, res.get('tax_group'))
            sheet.write(row, col + 3, TAX_TYPE[res.get('tax_type')])
            sheet.write(row, col + 4, DOCUMENT_TYPE[res.get('type')])
            sheet.write(row, col + 5, res.get('name'))
            sheet.write(row, col + 6, res.get('tax_number', '') or '')
            sheet.write(row, col + 7, description)
            sheet.write(row, col + 8, net, money)
            sheet.write(row, col + 9, amount_untaxed, money)
            sheet.write(row, col + 10, tax, money)
            sheet.write(row, col + 11, amount_total, money)
            row += 1

        sheet.conditional_format('I{}:L{}'.format(row, row), {
            'type': 'formula', 'criteria': 'True',
            'format': workbook.add_format({'bottom': 2})
        })
        net_formula = "=SUM(I{}:I{})".format(start_row + 1, row)
        sheet.write(row, col + 8, net_formula, money_bold)
        untaxed_formula = "=SUM(J{}:J{})".format(start_row + 1, row)
        sheet.write(row, col + 9, untaxed_formula, money_bold)
        vat_formula = "=SUM(K{}:K{})".format(start_row + 1, row)
        sheet.write(row, col + 10, vat_formula, money_bold)
        total_formula = "=SUM(L{}:L{})".format(start_row + 1, row)
        sheet.write(row, col + 11, total_formula, money_bold)

        workbook.close()
        vat_report_id = self.env['od.vat.report.download'].create({'excel_file': base64.encodestring(output.getvalue()), 'file_name': 'vat_report.xlsx'})
        return {
            'type': 'ir.actions.act_url',
            'url': '/web/binary/download_xlsx_report/%s' % vat_report_id.id,
            'target': 'new',
        }


class ODVATReportDownload(models.TransientModel):
    _name = 'od.vat.report.download'
    _description = "VAT report Excel File"

    excel_file = fields.Binary('Download Report :- ')
    file_name = fields.Char('Excel File', size=64)
