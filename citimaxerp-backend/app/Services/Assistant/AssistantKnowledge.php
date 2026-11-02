<?php

namespace App\Services\Assistant;

/**
 * What the assistant knows about finding its way around the app: each area, the permission that
 * opens it (as in the sidebar), and how its common tasks are done. Only the areas a user can open
 * are given to the assistant, so it never explains screens they cannot reach.
 */
class AssistantKnowledge
{
    /**
     * [area, path, any of these permissions, what it is and how to use it, and optionally the steps
     * only some roles have: "permission|or another" => text, given only to users with one of them]
     */
    public const AREAS = [
        ['Dashboard', '/dashboard', ['can_view_dashboard_menu'],
            'Overview of sales, receipts, stock and alerts for the company.'],
        ['Customers (CRM)', '/customers', ['can_view_customers_menu'],
            'Customer list. Add one with "Add Customer" (business name, contacts, KRA PIN, region/county/town, payment method; credit customers fill the credit application). Click a customer to open their profile: Orders, Invoices, Account (balance, open invoices, unapplied payments, pending cheques), Statement and Notes. Customers > Accounts lists credit accounts and limits. A customer statement is on the profile\'s Statement button; choose the period, then Download (Excel/PDF/CSV) or Print.'],
        ['Quotes', '/sales/quotes', ['can_view_quotes_menu'],
            'Sales > Quotes. "New Quote": pick the customer, add products (price list price is filled in), save. Open a quote to view/print its document; "Convert to Order" turns an accepted quote into an order.'],
        ['Orders', '/sales/orders', ['can_view_sales_menu'],
            'Sales > Orders. "New Order": choose customer, order date, payment type (cash/credit), add products and quantities (prices come from the customer\'s price list), save. An order is approved into an invoice (numbered NSK/####). From an order you can create the dispatch. Past orders (dated on or before 31 Oct 2026) do not move stock.'],
        ['Invoices', '/sales/invoices', ['can_view_sales_menu'],
            'Sales > Invoices. Invoices are made from approved orders and numbered NSK/#### (from 2 Nov 2026 the series starts at NSK/0432). Open one to see lines, payments and balance; "View Document" shows the printable invoice with its delivery note; row menu > Download gives Excel/PDF/CSV.'],
        ['Credit Notes', '/sales/credit-notes', ['can_view_sales_menu'],
            'Sales > Credit Notes. "New Credit Note": pick the invoice, the items/quantities returned and the Credit Note Date. Issuing it returns the goods to the batches they came from and reduces what the customer owes.'],
        ['Cheques', '/sales/cheques', ['can_view_sales_menu'],
            'Sales > Cheques: post-dated cheques received, their maturity, clearing or bouncing (a bounced cheque re-opens the invoices and can add a charge invoice).'],
        ['Receipts (customer payments)', '/payments', ['can_view_payments_menu'],
            'Receipts: money received from customers. "Receive Payment": customer, amount, method (cash, M-Pesa, bank, cheque), reference, then allocate it to their open invoices (oldest first by default). Unallocated money stays as credit on the customer\'s account.'],
        ['Dispatch', '/dispatch', ['can_view_inventory_menu'],
            'Dispatch: deliveries of orders and requisitions. Create a dispatch from an order, choose transporter/zone (delivery rates set the cost per carton), approve it, then print the delivery note. Delivery invoices from transporters are paid under Sales > Invoices > Delivery.'],
        ['Requisitions', '/requisitions', ['can_view_requisitions_menu'],
            '"Create New Requisition", add products, submit for approval; an approved requisition can be dispatched.'],
        ['Products', '/inventory/products', ['can_view_inventory_menu'],
            'Inventory > Products. To add a product: click "Add Product", enter the item description, unit of measure, cost price, tax status (VAT 16%/zero rated/exempt), reorder level, and its prices per price list (NSPV, NSPH, NSPO, NSPD, each with its item code), add sizes if it comes in several, then save. Many at once: "Import" with the Excel template (Export gives the same sheet to edit and re-import). Stock is the total of the product\'s batches.'],
        ['Price Lists', '/inventory/price-lists', ['can_create_products'],
            'Inventory > Price Lists: choose a list (NSPV, NSPH, NSPO, NSPD or a new one), "Download current" to edit prices in Excel, upload it, Preview, then Import. Importing NSPV also sets each product\'s default price.'],
        ['Batches', '/inventory/batches', ['can_view_inventory_menu'],
            'Inventory > Batches: each batch\'s number, expiry, quantity received/available and cost. Stock comes from batches; goods come in through Product Receipts.'],
        ['Product Receipts (goods received)', '/product-receipt', ['can_view_product_receipt_menu'],
            '"Create Receipt": supplier, store, document type and reference (supplier invoice/delivery note no.), then each product with batch number, expiry, quantity and unit cost; import costs (duty, clearing, transport) are spread over the units. Receiving against a purchase order: open the PO and click "Receive goods".'],
        ['Stock Counts', '/inventory/stock-counts', ['can_view_inventory_menu'],
            '"New Stock Count", count the items, submit; approving it records the variances.'],
        ['Stock Adjustments', '/inventory/stock-adjustments', ['can_view_inventory_menu'],
            'Adjust a batch\'s quantity (damage, expiry, correction) with a reason; adjustments are approved before they change stock.'],
        ['Suppliers', '/suppliers', ['can_view_suppliers_menu'],
            '"Add Supplier" with contacts, payment terms, bank details and KRA PIN; Import/Template for many at once. A supplier\'s statement shows bills and payments.'],
        ['Purchase Orders', '/purchase-orders', ['can_view_purchase_orders_menu'],
            '"New Purchase Order": supplier, store, order date, products with quantities and cost. It is approved ("Approve"), then goods are received against it ("Receive goods" creates the product receipt). Row menu: View Details, Download, Return to supplier.'],
        ['Supplier Payments', '/supplier-payments', ['can_view_payments_menu'],
            '"Record Supplier Payment": supplier, amount, date, method and reference (and the PO if it is for one).'],
        ['Expenses', '/expenses', ['can_view_expenses_menu'],
            '"Add Expense": category, description, amount, date, payment method and receipt; expenses are approved. Categories are managed on the same page. Export gives Excel/PDF/CSV.'],
        ['Filing', '/filing', ['can_view_filing'],
            'Every invoice by customer with the File No its printed copy is filed under (NSK number). File numbers can be typed in or filled in the exported Excel and imported back.'],
        ['Finance', '/finance', ['can_view_finance_menu'],
            'Finance: Chart of Accounts, Journal Entries, General Ledger (per account, filter by date/account/customer, Download), Trial Balance, Balance Sheet, Income Statement (profit and loss), Cash Flow, Financial Ratios, Aging, Bank Accounts (withdrawals/transfers), Budgets, Tax Rates, Account Mappings.'],
        ['Sales Reports', '/reports/sales', ['can_view_reports_menu'],
            'Reports > Sales: pick the period, then tabs Sales Accounts (ledger, with "Show receipts"), Orders, Products, Customers, By Region, By County, By Town, By Sales Rep, Daily Log. Every table has Export (Excel/PDF/CSV).'],
        ['Inventory Reports', '/reports/inventory', ['can_view_reports_menu'],
            'Reports > Inventory: Stock Balance, Low and Out of Stock, Stock Movement, Stock Management (closing stock value, gross profit, reorder alerts). Export gives Excel/PDF/CSV.'],
        ['CRM Reports > Customer Stats', '/reports/customers?tab=stats', ['can_view_reports_menu'],
            'Reports > CRM Reports (Customer Reports): two tabs. Customer Growth = new customers per day (chart and table). Customer Stats = every customer with S/No, Customer, Customer No., Phone, Orders, Order Value, Invoices, Invoiced, Paid, Balance, Last Order; customers with no orders show 0 and 0.00. Pick From/To dates to count only that period (blank = all time); Search by customer name, number or phone; Show all / with orders / without orders; click a column heading to sort (again to reverse); 20/50/250/All per page; Export gives Excel/PDF/CSV with totals.'],
        ['Procurement / CRM / Logistics Reports', '/reports', ['can_view_reports_menu'],
            'Reports menu: Procurement (purchases by supplier), CRM (customers), Logistics (deliveries), eTIMS Compliance (KRA submissions).'],
        ['HR & Payroll > Employees (add employee)', '/hr/employees', ['can_view_employees_menu'],
            'HR & Payroll > Employees: the staff list (Total/Active Employees at the top; search by name or email; Export for Excel/PDF/CSV). Click an employee to see their details. To add an employee: click "Add New Employee" and fill in Personal Information (Employee Number, Hire Date, First Name, Last Name, Email, Phone, Date of Birth, Gender, National ID), Address Information, Employment Information (Employment Type, Status, Department, Position, Supervisor, Leave Approver, Salary Advance Approver, and Connect User Account to link their login), Financial Information (Payment Frequency, Basic Salary, Bank Name/Account/Branch), Statutory Details (KRA PIN, NSSF Number, SHIF Number, disability exemption, insurance relief) and any allowances or deductions, then click "Save Employee". The new employee is then in the list and in payroll. Row menu: View, Edit Employee, Delete Employee; a leaver is set to Status Terminated with a Termination Date.'],
        ['HR & Payroll > Payroll', '/hr/payroll', ['can_view_payroll_menu'],
            'HR & Payroll > Payroll: "Create Payroll Run" for a month (choose the employees in Employee Selection), review the Payroll Summary (gross, PAYE, NSSF, SHIF, Housing Levy, net), approve it, then open each employee\'s Payslip; Export gives the payroll sheet and the KRA P10. Payroll configuration holds the tax bands.'],
        ['HR & Payroll > Leave Management', '/hr/leave-management', ['can_view_leave_management_menu'],
            'HR & Payroll > Leave Management: all leave requests. "Create Leave Request" records leave for an employee; open a request to approve or reject it. Employees apply for their own leave in the Employee Portal.'],
        ['HR & Payroll > Salary Advance', '/hr/salary-advance', ['can_view_salary_advance_menu'],
            'HR & Payroll > Salary Advance: all advance requests. "Create Salary Advance Request" for an employee; open one to approve or reject it. Employees request their own in the Employee Portal.'],
        ['HR & Payroll > Allowances', '/hr/allowances', ['can_view_employees_menu'],
            'HR & Payroll > Allowances: allowances paid to employees, including those disbursed outside payroll.'],
        ['HR & Payroll > Time Management', '/hr/time-management', ['can_view_time_management_menu'],
            'HR & Payroll > Time Management: staff time entries. "Create Time Entry" to record one; row menu to view, edit or delete.'],
        ['HR & Payroll > Daily Reports (review staff daily work reports)', '/hr/daily-reports', ['can_view_daily_reports_menu'],
            'HR & Payroll > Daily Reports: the daily work reports staff submitted from the Employee Portal - Date, Employee, Position, Approver, Status (pending/approved/rejected). Filter by Date and by Status; row menu > View Details shows the Work / Activity Log, Key Achievements and Pending Work / Challenges.',
            ['can_approve_daily_reports' => 'On a pending report, row menu or View Details > Approve (optional Approval Remarks) or Reject (give the Rejection Reason).']],
        ['Employee Portal (my leave, salary advance, daily work report)', '/employee-portal', ['can_view_employee_portal_menu'],
            'Employee Portal: your own HR self-service. The top shows your Employment Summary (Employee Number, Department, Position, Basic Salary) and Approval Routing (your Leave, Salary Advance and Daily Report approvers). Tabs: Leave - "Apply for Leave" (see days left per leave type), then "Submit Leave Request"; Salary Advance - enter Amount, Request Date and Reason, then "Submit Salary Advance Request"; Daily Reports - the "Submit Daily Work Report" form is open right on the tab (there is no "New Report" button); to write today\'s report: pick the Date, fill the Work / Activity Log for each time slot, Today\'s Key Achievements and Pending Work / Challenges; "Save Draft" keeps it to finish later, and "Submit Daily Work Report" appears once every part is filled (an unsubmitted report is auto-submitted at 8:00 PM; Sundays need no report). Your own reports are listed beside the form under Recent Daily Reports (filter by date) with their status; a pending one can be edited and resubmitted there. Your Daily Report approver (shown under Approval Routing) approves or rejects it on their own screen.'],
        ['Assets (asset register)', '/assets', ['can_view_assets_menu', 'can_view_assets'],
            'Assets Register: the top shows Total Assets, Total Quantity, Total Value and Categories. The table lists each asset: Asset Name/Description, Category, Serial/Model No., Location/Department, Qty and Purchase Cost (Ksh). Search with "Search assets...", choose a category in "Filter by category", click a column heading to sort, and click a row (or row menu > View) to see its details and notes. Export gives Excel/PDF/CSV. The register records cost and location; it does not calculate depreciation.',
            ['can_create_assets|can_manage_assets' => 'To add one: "Add Asset", fill Asset Name / Description (required), Category, Serial / Model Number, Location/Department, Quantity (Pcs), Purchase Cost (Ksh) and Notes, then save. Many at once: "Template" downloads the Excel sheet; fill it and click "Import", check the Import Preview (rows with errors are skipped), then confirm.',
             'can_update_assets|can_manage_assets' => 'Row menu > Edit changes an asset.',
             'can_delete_assets|can_manage_assets' => 'Row menu > Delete removes one.']],
        ['Users & Roles', '/users', ['can_manage_users_and_roles'],
            'Users: invite users and give them a role; a role\'s permissions decide which menus and data they see.'],
    ];

    protected static function open(callable $can): \Illuminate\Support\Collection
    {
        return collect(self::AREAS)->filter(fn ($a) => collect($a[2])->contains(fn ($p) => $can($p)))->values();
    }

    /** Names and paths of the areas this user can open (the steps come from howTo, to keep prompts small). */
    public static function areaList(callable $can): string
    {
        return self::open($can)->map(fn ($a) => '[' . trim(preg_replace('/\s*\(.*\)$/', '', $a[0])) . "]({$a[1]})")->implode('; ');
    }

    /** An area's guide text for this user: the shared steps plus the ones their role allows. */
    protected static function guide(callable $can, array $area): string
    {
        $allowed = collect($area[4] ?? [])
            ->filter(fn ($text, $perms) => collect(explode('|', $perms))->contains(fn ($p) => $can($p)));
        $denied = count($area[4] ?? []) - $allowed->count();

        return trim($area[3] . ' ' . $allowed->implode(' '))
            . ($denied ? ' (This user\'s role cannot do the other actions here, such as adding, changing or approving; an administrator or approver does those.)' : '');
    }

    /** The guide text of the open areas that best match a question, e.g. "add product". */
    public static function howTo(callable $can, string $topic): array
    {
        $words = collect(preg_split('/\W+/', strtolower($topic)))->filter(fn ($w) => strlen($w) > 2)
            ->map(fn ($w) => rtrim($w, 's'));
        $scored = self::open($can)->map(function ($a) use ($words, $can) {
            $name = strtolower($a[0]);
            $text = strtolower($a[3] . ' ' . implode(' ', $a[4] ?? []));
            $score = $words->sum(fn ($w) => (str_contains($name, $w) ? 3 : 0) + (str_contains($text, $w) ? 1 : 0));
            // The screen's name without the hint in brackets: "[HR & Payroll > Employees](/hr/employees)".
            $label = trim(preg_replace('/\s*\(.*\)$/', '', $a[0]));
            return ['score' => $score, 'area' => $a[0], 'link' => "[{$label}]({$a[1]})", 'how' => self::guide($can, $a)];
        })->filter(fn ($a) => $a['score'] > 0)->sortByDesc('score')->take(3)->values();

        return $scored->isEmpty()
            ? ['note' => 'No matching area the user can open. Areas: ' . self::areaList($can)]
            : ['areas' => $scored->map(fn ($a) => collect($a)->except('score'))->all()];
    }

    /** The path of the screen a text names ("Inventory Reports > Stock Balance" is /reports/inventory), the most specific name first. */
    public static function pathFor(string $text): ?string
    {
        $text = strtolower(str_replace(['→', '›'], '>', $text));
        return collect(self::AREAS)
            ->map(fn ($a) => ['label' => strtolower(trim(preg_replace('/\s*\(.*\)$/', '', $a[0]))), 'path' => $a[1]])
            ->filter(fn ($a) => str_contains($text, $a['label']))
            ->sortByDesc(fn ($a) => strlen($a['label']))
            ->first()['path'] ?? null;
    }

    /** Area names this user cannot open, so the assistant can say so instead of guessing. */
    public static function closedAreas(callable $can): array
    {
        return collect(self::AREAS)
            ->reject(fn ($a) => collect($a[2])->contains(fn ($p) => $can($p)))
            ->map(fn ($a) => trim(preg_replace('/\s*\(.*\)$/', '', $a[0])))->all();
    }
}
