<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DeliveryInvoice extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'company_id',
        'order_dispatch_id',
        'delivery_rate_id',
        'invoice_number',
        'transporter_invoice_number',
        'transporter_name',
        'zone',
        'number_of_cartons',
        'rate_per_carton',
        'total_amount',
        'status',
        'payment_method',
        'payment_reference',
        'payment_date',
        'cheque_number',
        'bank_name',
        'cheque_maturity_date',
        'amount_paid',
        'paid_by',
        'notes',
        'created_by',
        'supplier_id',
        'invoice_date',
        'supplier_payment_id',
        'order_reference',
    ];

    protected $casts = [
        'rate_per_carton' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'invoice_date' => 'date',
        'payment_date' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function orderDispatch()
    {
        return $this->belongsTo(OrderDispatch::class);
    }

    public function deliveryRate()
    {
        return $this->belongsTo(DeliveryRate::class);
    }

    public function logistic()
    {
        return $this->hasOne(Logistic::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function paidBy()
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function supplierPayment()
    {
        return $this->belongsTo(SupplierPayment::class);
    }

    protected static function booted(): void
    {
        // Every transporter is a supplier: the invoice is a bill on that supplier's account.
        static::saving(function (DeliveryInvoice $invoice) {
            if (!$invoice->supplier_id && $invoice->transporter_name) {
                $invoice->supplier_id = self::transporterSupplier($invoice->company_id, $invoice->transporter_name)->id;
            }
            if (!$invoice->invoice_date) {
                $invoice->invoice_date = ($invoice->created_at ?? now())->toDateString();
            }
        });
    }

    /** Next DI-00001 style number: one above the highest in use (safe when many are created at once). */
    public static function nextInvoiceNumber(string $companyId): string
    {
        $max = (int) self::where('company_id', $companyId)->where('invoice_number', 'like', 'DI-%')
            ->selectRaw("max(nullif(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '')::bigint) as n")->value('n');
        return 'DI-' . str_pad((string) ($max + 1), 5, '0', STR_PAD_LEFT);
    }

    /** The supplier record for a transporter, matched on the name and created the first time it is used. */
    public static function transporterSupplier(string $companyId, string $name): Supplier
    {
        $name = trim($name);
        return Supplier::where('company_id', $companyId)->whereRaw('lower(trim(name)) = ?', [mb_strtolower($name)])->first()
            ?? Supplier::create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'company_id' => $companyId,
                'name' => $name,
                'is_active' => true,
                'notes' => 'Transporter (delivery invoices)',
            ]);
    }

    /**
     * Settle the invoice: it is marked paid and a supplier payment is recorded for the transporter, so
     * it shows under Payments, on the transporter's statement and in the books (Payables against Bank/Cash).
     */
    public function recordPayment(?string $userId, string $method, ?string $reference = null, $date = null, array $cheque = []): SupplierPayment
    {
        $date = \Carbon\Carbon::parse($date ?? now())->toDateString();
        $payment = $this->supplier_payment_id ? SupplierPayment::find($this->supplier_payment_id) : null;
        $fields = [
            'supplier_id' => $this->supplier_id ?: self::transporterSupplier($this->company_id, $this->transporter_name)->id,
            'amount' => $this->total_amount,
            'payment_date' => $date,
            'payment_method' => $method,
            'transaction_reference' => trim("Delivery invoice {$this->invoice_number}" . ($reference ? " - {$reference}" : '')),
            'status' => 'completed',
            'notes' => $this->transporter_invoice_number ? "Transporter invoice {$this->transporter_invoice_number}" : null,
        ];
        $payment ? $payment->update($fields) : $payment = SupplierPayment::create($fields + [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'company_id' => $this->company_id,
        ]);

        $this->update([
            'status' => 'paid',
            'payment_method' => $method,
            'payment_reference' => $reference,
            'payment_date' => $date,
            'cheque_number' => $cheque['cheque_number'] ?? null,
            'bank_name' => $cheque['bank_name'] ?? null,
            'cheque_maturity_date' => $cheque['cheque_maturity_date'] ?? null,
            'amount_paid' => $this->total_amount,
            'paid_by' => $userId,
            'supplier_payment_id' => $payment->id,
        ]);

        return $payment;
    }

    public function markAsPaid($userId, $paymentMethod, $paymentReference = null, $paymentDate = null)
    {
        $this->recordPayment($userId, $paymentMethod, $paymentReference, $paymentDate);
    }

    /** Cancelling also cancels its payment, which takes both back out of the books. */
    public function cancel()
    {
        if ($this->supplier_payment_id) {
            SupplierPayment::whereKey($this->supplier_payment_id)->first()?->update(['status' => 'cancelled']);
        }
        $this->update(['status' => 'cancelled']);
    }
}
