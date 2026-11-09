<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Part of a supplier payment put on one supplier invoice: a bill (AccountsPayable) or a transporter's
 * DeliveryInvoice. apply()/unapply() move the amount on and off the invoice; the books are not touched
 * here (the bill and the payment each post on their own).
 */
class SupplierPaymentAllocation extends Model
{
    public const BILL = 'bill';
    public const DELIVERY_INVOICE = 'delivery_invoice';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'company_id', 'supplier_payment_id', 'invoice_type', 'invoice_id', 'amount', 'applied_at'];

    protected $casts = [
        'amount' => 'decimal:2',
        'applied_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            $model->id ??= (string) Str::uuid();
        });
    }

    public function payment()
    {
        return $this->belongsTo(SupplierPayment::class, 'supplier_payment_id');
    }

    /** Set by preloadInvoices() so a list of payments looks invoices up in two queries, not one each. */
    public AccountsPayable|DeliveryInvoice|null $preloadedInvoice = null;

    public static function preloadInvoices($allocations): void
    {
        $bills = AccountsPayable::whereIn('id', $allocations->where('invoice_type', self::BILL)->pluck('invoice_id'))->get()->keyBy('id');
        $deliveries = DeliveryInvoice::whereIn('id', $allocations->where('invoice_type', self::DELIVERY_INVOICE)->pluck('invoice_id'))->get()->keyBy('id');
        foreach ($allocations as $a) {
            $a->preloadedInvoice = ($a->invoice_type === self::BILL ? $bills : $deliveries)->get($a->invoice_id);
        }
    }

    public function invoice(): AccountsPayable|DeliveryInvoice|null
    {
        if ($this->preloadedInvoice) {
            return $this->preloadedInvoice;
        }
        return $this->invoice_type === self::BILL
            ? AccountsPayable::find($this->invoice_id)
            : DeliveryInvoice::find($this->invoice_id);
    }

    /** What an invoice is called on screen: the bill's number, or DI-00012 (transporter invoice no.). */
    public static function label(AccountsPayable|DeliveryInvoice|null $invoice): ?string
    {
        if ($invoice instanceof DeliveryInvoice) {
            return $invoice->invoice_number . ($invoice->transporter_invoice_number ? " ({$invoice->transporter_invoice_number})" : '');
        }
        return $invoice?->invoice_number;
    }

    public function apply(): void
    {
        if ($this->applied_at) {
            return;
        }
        $this->move((float) $this->amount);
        $this->update(['applied_at' => now()]);
    }

    public function unapply(): void
    {
        if (!$this->applied_at) {
            return;
        }
        $this->move(-(float) $this->amount);
        $this->update(['applied_at' => null]);
    }

    private function move(float $amount): void
    {
        $invoice = $this->invoice();
        if (!$invoice) {
            return;
        }
        $payment = $this->payment;

        if ($invoice instanceof AccountsPayable) {
            $paid = round(max(0, (float) $invoice->paid_amount + $amount), 2);
            $invoice->paid_amount = $paid;
            if ($paid <= 0) {
                // The model's own hook only handles part/fully paid.
                $invoice->balance_amount = max(0, (float) $invoice->total_amount - (float) ($invoice->metadata['debited'] ?? 0));
                $invoice->status = 'approved';
            }
            $invoice->save();
            return;
        }

        $paid = round(max(0, (float) $invoice->amount_paid + $amount), 2);
        $full = $paid >= round((float) $invoice->total_amount, 2);
        $invoice->update($full
            ? ['amount_paid' => $paid, 'status' => 'paid', 'payment_date' => $payment?->payment_date, 'payment_method' => $payment?->payment_method,
                'payment_reference' => $payment?->payment_number, 'supplier_payment_id' => $payment?->id]
            : ['amount_paid' => $paid, 'status' => $invoice->status === 'cancelled' ? 'cancelled' : 'pending', 'payment_date' => null,
                'supplier_payment_id' => $invoice->supplier_payment_id === $payment?->id ? null : $invoice->supplier_payment_id]);
    }
}
