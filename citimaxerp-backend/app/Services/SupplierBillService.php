<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\ProductReceipt;
use App\Models\ProductReceiptItem;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Supplier invoices (bills, AccountsPayable). Goods received raise one automatically: its amount is
 * what the receipt posts to Payables (quantity x buying price, plus shipping/logistics, plus the PO's
 * VAT), its supplier invoice no. is the receipt's reference. Such a bill is marked ledger = receipt,
 * so the books are not posted twice (the receipt already posted DR Inventory / CR Payables).
 */
class SupplierBillService
{
    /** What the receipt owes the supplier, as LedgerPostingService::syncProductReceipt posts it. */
    public static function receiptTotal(ProductReceipt $receipt): float
    {
        $goods = round((float) ProductReceiptItem::where('product_receipt_id', $receipt->id)
            ->sum(DB::raw('COALESCE(quantity, 0) * COALESCE(unit_price, 0)')), 2);
        $landed = round((float) $receipt->shipping_cost + (float) $receipt->logistics_cost, 2);
        $vat = 0.0;
        if ($receipt->purchase_order_id) {
            $rate = (float) (PurchaseOrder::whereKey($receipt->purchase_order_id)->value('tax_rate') ?? 0);
            $vat = $rate > 0 ? round($goods * $rate / 100, 2) : 0.0;
        }

        return round($goods + $landed + $vat, 2);
    }

    public function billForReceipt(string $receiptId): ?AccountsPayable
    {
        return AccountsPayable::whereRaw("metadata::jsonb->>'receipt_id' = ?", [$receiptId])->first();
    }

    /**
     * Keep the receipt's supplier invoice in step with it: created on the first save, amount and
     * reference updated on edit, removed when the receipt goes (unless payments are already on it).
     */
    public function syncFromReceipt(ProductReceipt $receipt, bool $deleted = false): ?AccountsPayable
    {
        $bill = $this->billForReceipt($receipt->id);
        // A bill brought across from the old system and linked to this receipt is left exactly as it is.
        if ($bill && !str_starts_with((string) ($bill->metadata['source'] ?? ''), 'Goods received')) {
            return $bill;
        }
        $total = $deleted ? 0.0 : self::receiptTotal($receipt);

        if ($deleted || !$receipt->supplier_id || $total <= 0) {
            if ($bill && (float) $bill->paid_amount <= 0.005) {
                $bill->delete();
                return null;
            }
            return $bill;
        }

        $ref = $receipt->product_receipt_number ?: substr($receipt->id, 0, 8);
        $date = Carbon::parse($receipt->created_at ?? now());
        $fields = [
            'vendor_id' => $receipt->supplier_id,
            'vendor_invoice_number' => $receipt->reference_number ?: null,
            'invoice_date' => $date->toDateString(),
            'total_amount' => $total,
            'description' => "Goods received {$ref}",
            'purchase_order_id' => $receipt->purchase_order_id,
        ];

        if ($bill) {
            $bill->fill($fields);
            if ($bill->isDirty()) {
                $bill->balance_amount = round($total - (float) $bill->paid_amount, 2);
                $bill->save();
            }
            return $bill;
        }

        $terms = (int) (Supplier::whereKey($receipt->supplier_id)->value('payment_terms_days') ?: 30);

        return AccountsPayable::create($fields + [
            'company_id' => $receipt->company_id,
            'invoice_number' => $this->nextNumber($receipt->company_id),
            'due_date' => $date->copy()->addDays($terms)->toDateString(),
            'paid_amount' => 0,
            'balance_amount' => $total,
            'currency' => 'KES',
            'status' => 'approved',
            'created_by' => $this->userFor($receipt->company_id, $receipt->received_by ?? auth()->id()),
            'metadata' => ['kind' => 'bill', 'ledger' => 'receipt', 'receipt_id' => $receipt->id,
                'source' => "Goods received {$ref}", 'voucher_type' => 'Purchase'],
        ]);
    }

    /**
     * A bill typed in (services, rent, a bill brought across): posted on its own, DR the chosen
     * account (Inventory by default) / CR Payables, by LedgerPostingService::syncSupplierBill.
     */
    public function record(string $companyId, array $data, ?string $userId): AccountsPayable
    {
        $terms = (int) (Supplier::whereKey($data['supplier_id'])->value('payment_terms_days') ?: 30);
        $date = Carbon::parse($data['invoice_date']);
        $total = round((float) $data['amount'] + (float) ($data['tax_amount'] ?? 0), 2);
        $debitNote = ($data['kind'] ?? 'bill') === 'debit_note';

        return AccountsPayable::create([
            'company_id' => $companyId,
            'vendor_id' => $data['supplier_id'],
            'invoice_number' => $this->nextNumber($companyId, $debitNote ? 'DN' : 'PUR'),
            'vendor_invoice_number' => $data['supplier_invoice_number'] ?? null,
            'invoice_date' => $date->toDateString(),
            'due_date' => !empty($data['due_date']) ? $data['due_date'] : $date->copy()->addDays($terms)->toDateString(),
            'total_amount' => $total,
            'tax_amount' => round((float) ($data['tax_amount'] ?? 0), 2),
            'paid_amount' => 0,
            'balance_amount' => $total,
            'currency' => 'KES',
            'description' => $data['description'] ?? null,
            'status' => 'approved',
            'created_by' => $this->userFor($companyId, $userId),
            'metadata' => array_filter(['kind' => $debitNote ? 'debit_note' : 'bill', 'source' => $data['source'] ?? 'Recorded',
                'voucher_type' => $debitNote ? 'Debit Note' : 'Purchase',
                'debit_account_code' => $data['account_code'] ?? null]),
        ]);
    }

    /** A bill must name who made it: the given user if real, else someone of the company (backfills, imports). */
    private function userFor(string $companyId, ?string $userId): string
    {
        if ($userId && \App\Models\User::whereKey($userId)->exists()) {
            return $userId;
        }

        return (string) \App\Models\User::where('company_id', $companyId)->orderBy('created_at')->value('id');
    }

    /** Bills carry on from the old system's series (PUR-134 was its last, so next is PUR-135); debit notes from DN-. */
    public function nextNumber(string $companyId, string $prefix = 'PUR'): string
    {
        $last = (int) DB::table('accounts_payable')->where('company_id', $companyId)
            ->selectRaw("max(cast(substring(invoice_number from ?) as integer)) as n", ['^' . $prefix . '-([0-9]+)$'])->value('n');

        return $prefix . '-' . ($last + 1);
    }
}
