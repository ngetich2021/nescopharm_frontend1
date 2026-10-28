<?php

namespace App\Services\DataImport;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The filled-in first row of each import template, taken from the company's own records so people see
 * real names, codes and amounts in the right format. A row copied from an existing record imports as
 * "unchanged". When the company has no such record yet, the row is assembled from real pieces (a real
 * transporter, customer, product...) and marked EXAMPLE_MARK in its notes, which the importer skips.
 */
class ImportSamples
{
    public const EXAMPLE_MARK = 'EXAMPLE ROW - replace with your own data or delete';

    public static function for(string $key, string $companyId): ?array
    {
        try {
            $row = match ($key) {
                'suppliers' => self::supplier($companyId),
                'supplier_payments' => self::supplierPayment($companyId),
                'delivery_invoices' => self::deliveryInvoice($companyId),
                'customers' => self::customer($companyId),
                'opening_stock' => self::openingStock($companyId),
                'purchase_order_items' => self::purchaseOrderItem($companyId),
                'product_receipt_items' => self::productReceiptItem($companyId),
                'past_invoices' => self::pastInvoice($companyId),
                default => null,
            };
        } catch (\Throwable $e) {
            // A sample is a convenience: never let it break the template download.
            report($e);
            return null;
        }

        return $row ? array_map(fn ($v) => $v === null ? '' : $v, $row) : null;
    }

    private static function date($value): string
    {
        return $value ? Carbon::parse($value)->format('d/m/Y') : '';
    }

    private static function money($value): ?float
    {
        return $value === null ? null : round((float) $value, 2);
    }

    private const METHODS = ['bank_transfer' => 'Bank Transfer', 'cash' => 'Cash', 'mpesa' => 'M-Pesa', 'cheque' => 'Cheque'];

    private static function supplier(string $companyId): ?array
    {
        $s = DB::table('suppliers')->where('company_id', $companyId)->where('is_active', true)
            ->orderByRaw('(email is not null)::int + (phone is not null)::int + (address is not null)::int + (bank_name is not null)::int desc')
            ->orderByDesc('created_at')->first();
        if (!$s) {
            return null;
        }
        return [
            'name' => $s->name, 'email' => $s->email, 'phone' => $s->phone, 'contact_person' => $s->contact_person,
            'address' => $s->address, 'payment_terms_type' => $s->payment_terms_type, 'payment_terms_days' => $s->payment_terms_days,
            'payment_terms_description' => $s->payment_terms_description, 'bank_name' => $s->bank_name,
            'bank_account_number' => $s->bank_account_number, 'bank_branch' => $s->bank_branch, 'bank_swift_code' => $s->bank_swift_code,
            'tax_information' => $s->tax_information ?? null, 'notes' => $s->notes, 'is_active' => 'Yes',
        ];
    }

    private static function supplierPayment(string $companyId): ?array
    {
        $p = DB::table('supplier_payments as p')->join('suppliers as s', 's.id', '=', 'p.supplier_id')
            ->leftJoin('purchase_orders as po', 'po.id', '=', 'p.purchase_order_id')
            ->where('p.company_id', $companyId)->where('p.status', 'completed')
            ->orderByDesc('p.payment_date')->orderByDesc('p.created_at')
            ->select('p.*', 's.name as supplier_name', 'po.order_number')->first();
        if ($p) {
            return [
                'payment_number' => $p->payment_number, 'supplier' => $p->supplier_name, 'payment_date' => self::date($p->payment_date),
                'amount' => self::money($p->amount), 'payment_method' => self::METHODS[$p->payment_method] ?? $p->payment_method,
                'reference' => $p->transaction_reference, 'po_number' => $p->order_number, 'status' => ucfirst($p->status), 'notes' => $p->notes,
            ];
        }
        $supplier = DB::table('suppliers')->where('company_id', $companyId)->where('is_active', true)->orderBy('name')->value('name');
        return $supplier ? [
            'supplier' => $supplier, 'payment_date' => self::date(now()), 'amount' => 10000, 'payment_method' => 'Bank Transfer',
            'reference' => 'Bank ref / voucher no.', 'status' => 'Completed', 'notes' => self::EXAMPLE_MARK,
        ] : null;
    }

    private static function deliveryInvoice(string $companyId): ?array
    {
        $d = DB::table('delivery_invoices as d')
            ->leftJoin('order_dispatches as od', 'od.id', '=', 'd.order_dispatch_id')
            ->leftJoin('orders as o', 'o.id', '=', 'od.order_id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->where('d.company_id', $companyId)->where('d.status', '!=', 'cancelled')
            ->orderByDesc('d.created_at')->select('d.*', 'o.order_number', 'c.name as customer_name')->first();
        if ($d) {
            $paid = $d->status === 'paid';
            return [
                'invoice_number' => $d->invoice_number, 'invoice_date' => self::date($d->invoice_date ?? $d->created_at),
                'transporter' => $d->transporter_name, 'transporter_invoice_number' => $d->transporter_invoice_number,
                'order_number' => $d->order_number, 'customer' => $d->customer_name ?? $d->order_reference,
                'zone' => $d->zone ? ucfirst($d->zone) : null, 'cartons' => $d->number_of_cartons, 'rate' => self::money($d->rate_per_carton),
                'amount' => self::money($d->total_amount), 'status' => $paid ? 'Paid' : 'Unpaid',
                'payment_date' => $paid ? self::date($d->payment_date) : null,
                'payment_method' => $paid ? (self::METHODS[$d->payment_method] ?? $d->payment_method) : null,
                'payment_reference' => $paid ? $d->payment_reference : null, 'notes' => $d->notes,
            ];
        }
        // None yet: a real approved transporter rate and a real customer, marked as an example.
        $rate = DB::table('delivery_rates')->where('company_id', $companyId)->orderByRaw("(status = 'approved') desc")->orderByDesc('created_at')->first();
        $customer = DB::table('customers')->where('company_id', $companyId)->whereNull('deleted_at')
            ->select('name', 'city', 'county')->orderByDesc('created_at')->first();
        $cartons = 10;
        $perCarton = $rate ? (float) $rate->rate_per_carton : 290;
        return [
            'invoice_date' => self::date(now()), 'transporter' => $rate->transporter_name ?? 'Transporter name',
            'transporter_invoice_number' => 'Their invoice no.',
            'customer' => $customer ? trim(($customer->city ?: $customer->county ?: '') . ' - ' . $customer->name, ' -') : 'Customer / destination',
            'zone' => $rate?->zone ? ucfirst($rate->zone) : 'Upcountry', 'cartons' => $cartons, 'rate' => $perCarton,
            'amount' => round($cartons * $perCarton, 2), 'status' => 'Paid', 'payment_date' => self::date(now()),
            'payment_method' => 'M-Pesa', 'payment_reference' => 'M-Pesa code', 'notes' => self::EXAMPLE_MARK,
        ];
    }

    private static function customer(string $companyId): ?array
    {
        $c = DB::table('customers')->where('company_id', $companyId)->whereNull('deleted_at')
            ->orderByRaw('(email is not null)::int + (phone is not null)::int + (pin_number is not null)::int + (contact_person_name is not null)::int desc')
            ->orderByDesc('created_at')->first();
        if (!$c) {
            return null;
        }
        return [
            // The short number people see (CUST-0089), as the model shows it.
            'customer_number' => \App\Models\Customer::withTrashed()->find($c->id)?->customer_number ?? $c->customer_number, 'name' => $c->name, 'business_name' => $c->business_name,
            'customer_type' => $c->customer_type, 'email' => $c->email, 'phone' => $c->phone, 'telephone' => $c->telephone,
            'pin_number' => $c->pin_number, 'address' => $c->address, 'city' => $c->city, 'county' => $c->county, 'region' => $c->region,
            'country' => $c->country, 'postal_code' => $c->postal_code, 'contact_person_name' => $c->contact_person_name,
            'contact_person_designation' => $c->contact_person_designation, 'contact_person_phone' => $c->contact_person_phone,
            'contact_person_email' => $c->contact_person_email, 'payment_method' => $c->payment_method,
            'status' => $c->status ? ucfirst($c->status) : null, 'notes' => $c->notes,
        ];
    }

    /** The item's stock as it stands now, so re-importing this row changes nothing. */
    private static function openingStock(string $companyId): ?array
    {
        $p = DB::table('products as p')->leftJoin('stores as st', 'st.id', '=', 'p.store_id')
            ->where('p.company_id', $companyId)->whereNull('p.deleted_at')->where('p.is_active', true)
            ->where('p.stock_quantity', '>', 0)->where(fn ($q) => $q->whereNull('p.has_variations')->orWhere('p.has_variations', false))
            ->orderBy('p.item_number')->select('p.item_number', 'p.stock_quantity', 'p.unit_cost', 'st.name as store_name')->first();
        if (!$p) {
            return null;
        }
        return [
            'item_no' => $p->item_number, 'size' => null, 'quantity' => (float) $p->stock_quantity,
            'unit_cost' => self::money($p->unit_cost), 'store' => $p->store_name, 'notes' => null,
        ];
    }

    /** Fills the New Purchase Order form only; nothing is saved from the sheet itself. */
    private static function purchaseOrderItem(string $companyId): ?array
    {
        $i = DB::table('purchase_order_items as i')->join('purchase_orders as po', 'po.id', '=', 'i.purchase_order_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'po.supplier_id')->leftJoin('products as p', 'p.id', '=', 'i.product_id')
            ->leftJoin('product_variants as v', 'v.id', '=', 'i.variant_id')
            ->where('po.company_id', $companyId)->orderByDesc('po.created_at')
            ->select('s.name as supplier_name', 'po.order_date', 'po.delivery_date', 'po.comments', 'p.name as product_name',
                'v.name as size', 'i.quantity', 'i.unit_price')->first();
        if (!$i) {
            return null;
        }
        return [
            'supplier' => $i->supplier_name, 'order_date' => self::date($i->order_date), 'delivery_date' => self::date($i->delivery_date),
            'comments' => $i->comments, 'item_name' => $i->product_name, 'size' => $i->size,
            'quantity' => (float) $i->quantity, 'unit_price' => self::money($i->unit_price),
        ];
    }

    /** Fills the Receive Goods form only; nothing is saved from the sheet itself. */
    private static function productReceiptItem(string $companyId): ?array
    {
        $i = DB::table('product_receipt_items as i')->join('product_receipts as r', 'r.id', '=', 'i.product_receipt_id')
            ->leftJoin('products as p', 'p.id', '=', 'i.product_id')->leftJoin('product_variants as v', 'v.id', '=', 'i.variant_id')
            ->where('r.company_id', $companyId)->orderByDesc('r.created_at')
            ->select('r.reference_number', 'r.shipping_cost', 'r.logistics_cost', 'p.name as product_name', 'v.name as size', 'i.quantity',
                'i.batch_number', 'i.lot_number', 'i.manufacture_date', 'i.expiry_date', 'i.unit_price', 'i.notes')->first();
        if (!$i) {
            return null;
        }
        return [
            'reference_number' => $i->reference_number, 'shipping_cost' => self::money($i->shipping_cost),
            'logistics_cost' => self::money($i->logistics_cost), 'item_name' => $i->product_name, 'size' => $i->size,
            'quantity' => (float) $i->quantity, 'batch_number' => $i->batch_number, 'lot_number' => $i->lot_number,
            'manufacture_date' => self::date($i->manufacture_date), 'expiry_date' => self::date($i->expiry_date),
            'unit_price' => self::money($i->unit_price), 'notes' => $i->notes,
        ];
    }

    /**
     * A past invoice already in the system (dated before the cut-off, as the import requires): the
     * import skips a number it already has, so this row is harmless. With none, a marked example.
     */
    private static function pastInvoice(string $companyId): ?array
    {
        $cutoff = ImportSchemas::PAST_INVOICE_CUTOFF;
        $l = DB::table('invoice_line_items as l')->join('invoices as inv', 'inv.id', '=', 'l.invoice_id')
            ->join('customers as c', 'c.id', '=', 'inv.customer_id')
            ->leftJoin('products as p', 'p.id', '=', 'l.product_id')->leftJoin('product_variants as v', 'v.id', '=', 'l.variant_id')
            ->where('inv.company_id', $companyId)->whereNotIn('inv.status', ['cancelled'])->whereNotNull('l.product_id')
            ->where('inv.invoice_date', '<', $cutoff)
            ->orderByDesc('inv.invoice_date')->orderBy('l.line_seq')
            ->select('inv.id as invoice_id', 'inv.invoice_number', 'inv.invoice_date', 'inv.due_date', 'inv.amount_paid', 'inv.paid_at', 'inv.mode_of_payment',
                'c.name as customer_name', 'p.name as product_name', 'v.name as size', 'l.description', 'l.quantity', 'l.unit_price',
                'l.tax_rate', 'l.discount_amount')->first();
        if (!$l) {
            $customer = DB::table('customers')->where('company_id', $companyId)->whereNull('deleted_at')->orderBy('name')->value('name');
            $product = DB::table('products')->where('company_id', $companyId)->whereNull('deleted_at')->where('is_active', true)
                ->orderBy('item_number')->first(['name', 'price']);
            return $customer && $product ? [
                'invoice_number' => 'OLD-0001', 'invoice_date' => self::date(Carbon::parse($cutoff)->subMonth()), 'customer' => $customer,
                'due_date' => self::date(Carbon::parse($cutoff)), 'item_name' => $product->name, 'quantity' => 1,
                'unit_price' => self::money($product->price), 'vat_rate' => 0, 'notes' => self::EXAMPLE_MARK,
            ] : null;
        }
        return [
            // The short number people see (INV-0372), which is what the import compares against.
            'invoice_number' => \App\Models\Invoice::find($l->invoice_id)?->invoice_number ?? $l->invoice_number,
            'invoice_date' => self::date($l->invoice_date), 'customer' => $l->customer_name,
            'due_date' => self::date($l->due_date), 'item_name' => $l->product_name ?? $l->description, 'size' => $l->size,
            'quantity' => (float) $l->quantity, 'unit_price' => self::money($l->unit_price),
            'vat_rate' => $l->tax_rate !== null ? (float) $l->tax_rate : null, 'discount' => self::money($l->discount_amount),
            'amount_paid' => self::money($l->amount_paid), 'payment_date' => (float) $l->amount_paid > 0 ? self::date($l->paid_at) : null,
            'payment_method' => (float) $l->amount_paid > 0 ? $l->mode_of_payment : null, 'notes' => null,
        ];
    }
}
