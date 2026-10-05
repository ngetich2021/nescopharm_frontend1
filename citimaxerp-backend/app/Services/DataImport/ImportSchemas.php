<?php

namespace App\Services\DataImport;

/**
 * The column layout of every migration sheet, used for three things at once: generating the blank
 * template the user downloads, rendering the "accepted format" reference on the Data Import page,
 * and matching the headings back to fields when the filled sheet is uploaded. Keeping one copy is
 * what stops the template and the importer drifting apart.
 */
class ImportSchemas
{
    public static function all(): array
    {
        return [
            'suppliers' => self::suppliers(),
            'customers' => self::customers(),
            'opening_stock' => self::openingStock(),
            'purchase_order_items' => self::purchaseOrderItems(),
            'product_receipt_items' => self::productReceiptItems(),
        ];
    }

    public static function get(string $entity): ?array
    {
        return self::all()[$entity] ?? null;
    }

    /** Headings are matched on letters and digits only, so spacing, case and punctuation don't matter. */
    public static function normalize(string $heading): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower($heading));
    }

    /**
     * Map each schema field to the column index it was found at in the sheet's heading row.
     * A field matches its label, its key, or any alias.
     */
    public static function mapHeadings(array $schema, array $headingRow): array
    {
        $columns = [];
        foreach ($headingRow as $index => $heading) {
            $normalized = self::normalize((string) $heading);
            if ($normalized === '') {
                continue;
            }
            foreach ($schema['columns'] as $column) {
                if (isset($columns[$column['key']])) {
                    continue;
                }
                $candidates = array_map(
                    [self::class, 'normalize'],
                    array_merge([$column['label'], $column['key']], $column['aliases'] ?? [])
                );
                if (in_array($normalized, $candidates, true)) {
                    $columns[$column['key']] = $index;
                }
            }
        }
        return $columns;
    }

    /** Required fields whose column is missing from the sheet entirely. */
    public static function missingRequired(array $schema, array $columns): array
    {
        return array_values(array_map(
            fn ($c) => $c['label'],
            array_filter(
                $schema['columns'],
                fn ($c) => !empty($c['required']) && !isset($columns[$c['key']])
            )
        ));
    }

    private static function suppliers(): array
    {
        return [
            'key' => 'suppliers',
            'label' => 'Suppliers',
            'order' => 1,
            'description' => 'Everyone you buy from. Import these before purchase orders, which refer to suppliers by name.',
            'matching' => 'Matched on Supplier Name. An existing supplier with the same name is updated; anything else is created.',
            'permission' => 'can_create_suppliers',
            'columns' => [
                ['key' => 'name', 'label' => 'Supplier Name', 'type' => 'text', 'required' => true, 'example' => 'Acme Distributors Ltd', 'help' => 'Must be unique. This is the name purchase orders refer to.'],
                ['key' => 'email', 'label' => 'Email', 'type' => 'text', 'example' => 'accounts@acme.co.ke'],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'text', 'example' => '+254712345678'],
                ['key' => 'contact_person', 'label' => 'Contact Person', 'type' => 'text', 'example' => 'Jane Mwangi'],
                ['key' => 'address', 'label' => 'Address', 'type' => 'text', 'example' => 'P.O. Box 1234, Nairobi'],
                ['key' => 'payment_terms_type', 'label' => 'Terms Type', 'type' => 'choice', 'choices' => ['Net', 'Due', 'Immediate'], 'example' => 'Net'],
                ['key' => 'payment_terms_days', 'label' => 'Terms Days', 'type' => 'number', 'example' => '30', 'help' => 'Number of days for Net or Due terms.'],
                ['key' => 'payment_terms_description', 'label' => 'Terms Notes', 'type' => 'text', 'example' => '30 days from invoice date'],
                ['key' => 'bank_name', 'label' => 'Bank Name', 'type' => 'text', 'example' => 'KCB Bank'],
                ['key' => 'bank_account_number', 'label' => 'Bank Account Number', 'type' => 'text', 'example' => '1234567890'],
                ['key' => 'bank_branch', 'label' => 'Bank Branch', 'type' => 'text', 'example' => 'Westlands'],
                ['key' => 'bank_swift_code', 'label' => 'Bank Swift Code', 'type' => 'text', 'example' => 'KCBLKENX'],
                ['key' => 'notes', 'label' => 'Notes', 'type' => 'text', 'example' => 'Preferred packaging supplier'],
                ['key' => 'is_active', 'label' => 'Active', 'type' => 'yesno', 'example' => 'Yes', 'help' => 'Yes or No. Blank counts as Yes for a new supplier.'],
            ],
        ];
    }

    private static function customers(): array
    {
        return [
            'key' => 'customers',
            'label' => 'Customers',
            'order' => 2,
            'description' => 'Everyone you sell to. Imported customers come in already approved, so they can be invoiced straight away.',
            'matching' => 'Matched on Customer Number when you provide one, otherwise on Customer Name. Leave Customer Number blank and the system assigns one.',
            'permission' => 'can_create_customers',
            'columns' => [
                ['key' => 'customer_number', 'label' => 'Customer Number', 'type' => 'text', 'example' => '', 'help' => 'Your old system\'s code, if you want to keep it. Leave blank to have one assigned.'],
                ['key' => 'name', 'label' => 'Customer Name', 'type' => 'text', 'required' => true, 'example' => 'Bidii Pharmacy'],
                ['key' => 'business_name', 'label' => 'Business Name', 'type' => 'text', 'example' => 'Bidii Pharmacy Limited'],
                ['key' => 'customer_type', 'label' => 'Customer Type', 'type' => 'text', 'example' => 'Retail'],
                ['key' => 'email', 'label' => 'Email', 'type' => 'text', 'example' => 'info@bidii.co.ke'],
                ['key' => 'phone', 'label' => 'Phone', 'type' => 'text', 'example' => '+254722000111'],
                ['key' => 'telephone', 'label' => 'Telephone', 'type' => 'text', 'example' => '020-2000111'],
                ['key' => 'pin_number', 'label' => 'KRA PIN', 'type' => 'text', 'example' => 'P051234567X'],
                ['key' => 'address', 'label' => 'Address', 'type' => 'text', 'example' => 'Moi Avenue, Shop 4'],
                ['key' => 'city', 'label' => 'City', 'type' => 'text', 'example' => 'Nairobi'],
                ['key' => 'county', 'label' => 'County', 'type' => 'text', 'example' => 'Nairobi'],
                ['key' => 'region', 'label' => 'Region', 'type' => 'text', 'example' => 'Central'],
                ['key' => 'country', 'label' => 'Country', 'type' => 'text', 'example' => 'Kenya'],
                ['key' => 'postal_code', 'label' => 'Postal Code', 'type' => 'text', 'example' => '00100'],
                ['key' => 'contact_person_name', 'label' => 'Contact Person', 'type' => 'text', 'example' => 'Peter Otieno'],
                ['key' => 'contact_person_designation', 'label' => 'Contact Designation', 'type' => 'text', 'example' => 'Pharmacist'],
                ['key' => 'contact_person_phone', 'label' => 'Contact Phone', 'type' => 'text', 'example' => '+254733444555'],
                ['key' => 'contact_person_email', 'label' => 'Contact Email', 'type' => 'text', 'example' => 'peter@bidii.co.ke'],
                ['key' => 'payment_method', 'label' => 'Payment Method', 'type' => 'text', 'example' => 'Cash'],
                ['key' => 'status', 'label' => 'Status', 'type' => 'choice', 'choices' => ['active', 'inactive'], 'example' => 'active'],
                ['key' => 'notes', 'label' => 'Notes', 'type' => 'text', 'example' => 'Long-standing account'],
            ],
        ];
    }

    private static function openingStock(): array
    {
        return [
            'key' => 'opening_stock',
            'label' => 'Opening Stock',
            'order' => 4,
            'description' => 'The quantity on hand the day you switch over. Import your products first, then bring their balances across with this sheet.',
            'matching' => 'Matched on Item No. and Size. This sets the balance to the quantity you give (it does not add to it) and records a stock movement so the change is traceable.',
            'permission' => 'can_adjust_closing_stock',
            'columns' => [
                ['key' => 'item_no', 'label' => 'Item No.', 'type' => 'text', 'required' => true, 'example' => '164', 'help' => 'The item number shown on the Products page.'],
                ['key' => 'size', 'label' => 'Size', 'type' => 'text', 'example' => '', 'help' => 'Leave blank for an item without sizes. For a sized item, put one row per size.'],
                ['key' => 'quantity', 'label' => 'Quantity On Hand', 'type' => 'number', 'required' => true, 'example' => '250', 'help' => 'The closing balance from your old system.'],
                ['key' => 'unit_cost', 'label' => 'Unit Cost', 'type' => 'number', 'example' => '1200.00', 'help' => 'Optional. Updates the item\'s cost if given.'],
                ['key' => 'store', 'label' => 'Store', 'type' => 'text', 'example' => '', 'help' => 'Optional. Blank uses your main store.'],
                ['key' => 'notes', 'label' => 'Notes', 'type' => 'text', 'example' => 'Opening balance migrated'],
            ],
        ];
    }

    /**
     * One purchase order per sheet, filled into the New Purchase Order form rather than saved
     * directly: the supplier and dates are read from the first row and the items from every row,
     * so a buyer who works in Excel can load an order instead of typing each line into the form.
     */
    private static function purchaseOrderItems(): array
    {
        return [
            'key' => 'purchase_order_items',
            'label' => 'Purchase Order',
            'order' => 5,
            'context' => 'purchase_order_form',
            'description' => 'Fill a new purchase order from a spreadsheet instead of typing it in.',
            'matching' => 'One row per item. Items are matched on their name, ignoring spacing, case and punctuation, so "2ml syringe without needle" finds "2 Ml Syringe Without Needle". The supplier and dates are taken from the first row; repeat them or leave them blank on the rest. Everything lands in the form for you to check before you save.',
            'permission' => 'can_create_purchase_orders',
            'columns' => [
                ['key' => 'supplier', 'label' => 'Supplier Name', 'type' => 'text', 'example' => 'Acme Distributors Ltd', 'help' => 'Optional. Must match an existing supplier; otherwise pick one in the form.'],
                ['key' => 'order_date', 'label' => 'Order Date', 'type' => 'date', 'example' => '2026-01-15', 'help' => 'Optional. Use YYYY-MM-DD. Dates written with slashes are read day first, so 02/03/2026 means 2 March.'],
                ['key' => 'delivery_date', 'label' => 'Delivery Date', 'type' => 'date', 'example' => '2026-01-29', 'help' => 'Optional.'],
                ['key' => 'comments', 'label' => 'Comments', 'type' => 'text', 'example' => 'Urgent - confirm before dispatch', 'help' => 'Optional.'],
                ['key' => 'item_name', 'label' => 'Item Name & Description', 'type' => 'text', 'required' => true, 'example' => '2 Ml Syringe Without Needle', 'aliases' => ['item', 'itemdescription', 'description', 'productname', 'product', 'name'], 'help' => 'Spacing, case and punctuation are ignored when matching. For a sized item you can write the full description including the size, or put the size in its own column.'],
                ['key' => 'size', 'label' => 'Size', 'type' => 'text', 'example' => '', 'help' => 'Leave blank for an item without sizes, or when the size is already part of the description above.'],
                ['key' => 'quantity', 'label' => 'Quantity', 'type' => 'number', 'required' => true, 'example' => '100'],
                ['key' => 'unit_price', 'label' => 'Unit Price', 'type' => 'number', 'example' => '1200.00', 'help' => 'Cost per unit. Blank uses the item\'s current purchase cost, which you can still change in the form.'],
            ],
        ];
    }

    /**
     * What actually arrived against a purchase order, filled into the Create Product Receipt form.
     * Only items already on the chosen order can appear, so the sheet is matched against that
     * order's outstanding lines rather than the whole catalogue.
     */
    private static function productReceiptItems(): array
    {
        return [
            'key' => 'product_receipt_items',
            'label' => 'Product Receipt',
            'order' => 6,
            'context' => 'product_receipt_form',
            'description' => 'Record a delivery from a spreadsheet instead of typing it in.',
            'matching' => 'Pick the purchase order, download it as Excel and it arrives already listing what is still outstanding. Change the quantities to what actually came, fill in batch numbers and expiry dates, delete any line that did not arrive, then upload it back. Two rows for the same item become two batch lines. Everything lands in the form for you to check before you save.',
            'permission' => 'can_create_product_receipts',
            'columns' => [
                ['key' => 'reference_number', 'label' => 'Reference Number', 'type' => 'text', 'example' => 'DOC-REF-001', 'help' => 'Optional. Taken from the first row.'],
                ['key' => 'shipping_cost', 'label' => 'Shipping Cost', 'type' => 'number', 'example' => '0', 'help' => 'Optional. Taken from the first row.'],
                ['key' => 'logistics_cost', 'label' => 'Logistics Cost', 'type' => 'number', 'example' => '0', 'help' => 'Optional. Taken from the first row.'],
                ['key' => 'item_name', 'label' => 'Item Name & Description', 'type' => 'text', 'required' => true, 'example' => '2 Ml Syringe Without Needle', 'aliases' => ['item', 'itemdescription', 'description', 'productname', 'product', 'name'], 'help' => 'Spacing, case and punctuation are ignored when matching. Must be an item on the purchase order.'],
                ['key' => 'size', 'label' => 'Size', 'type' => 'text', 'example' => '', 'help' => 'Leave blank for an item without sizes, or when the size is already part of the description above.'],
                ['key' => 'quantity', 'label' => 'Quantity Received', 'type' => 'number', 'required' => true, 'example' => '100', 'help' => 'How much arrived. Cannot exceed what is still outstanding on the order.'],
                ['key' => 'batch_number', 'label' => 'Batch Number', 'type' => 'text', 'example' => 'B-2026-001'],
                ['key' => 'lot_number', 'label' => 'Lot Number', 'type' => 'text', 'example' => 'LOT-44'],
                ['key' => 'manufacture_date', 'label' => 'Manufacture Date', 'type' => 'date', 'example' => '2026-01-02', 'help' => 'Use YYYY-MM-DD. Dates written with slashes are read day first.'],
                ['key' => 'expiry_date', 'label' => 'Expiry Date', 'type' => 'date', 'example' => '2028-01-02'],
                ['key' => 'unit_price', 'label' => 'Unit Price', 'type' => 'number', 'example' => '', 'help' => 'Optional. Blank uses the price on the purchase order line.'],
                ['key' => 'notes', 'label' => 'Notes', 'type' => 'text', 'example' => ''],
            ],
        ];
    }
}
