<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SupplierPayment extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'supplier_id',
        'purchase_order_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_method',
        'transaction_reference',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            if (empty($model->payment_number)) {
                $model->payment_number = self::generatePaymentNumber($model->company_id);
            }
        });

        // The invoices it pays follow the payment: paid once it is completed (a cheque when it clears),
        // unpaid again if it is cancelled, fails or is deleted.
        static::updated(function (self $model) {
            if ($model->wasChanged('status')) {
                $model->status === 'completed' ? $model->applyAllocations() : $model->unapplyAllocations();
            }
        });
        static::deleting(function (self $model) {
            $model->unapplyAllocations();
        });
    }

    public function allocations()
    {
        return $this->hasMany(SupplierPaymentAllocation::class);
    }

    public function applyAllocations(): void
    {
        if ($this->status === 'completed') {
            $this->allocations()->whereNull('applied_at')->get()->each->apply();
        }
    }

    public function unapplyAllocations(): void
    {
        $this->allocations()->whereNotNull('applied_at')->get()->each->unapply();
    }

    /** The invoices it pays, for screens: [{type, id, number, date, total, amount}]. */
    public function allocationSummary(): array
    {
        return $this->allocations->map(function (SupplierPaymentAllocation $a) {
            $invoice = $a->invoice();
            return [
                'type' => $a->invoice_type,
                'id' => $a->invoice_id,
                'number' => SupplierPaymentAllocation::label($invoice) ?? '(deleted)',
                'date' => $invoice?->invoice_date?->toDateString(),
                'description' => $invoice instanceof DeliveryInvoice ? $invoice->order_reference : $invoice?->description,
                'total' => $invoice ? round((float) $invoice->total_amount, 2) : null,
                'amount' => round((float) $a->amount, 2),
                'applied' => (bool) $a->applied_at,
            ];
        })->sortBy('date')->values()->all();
    }

    public static function generatePaymentNumber($companyId)
    {
        $prefix = 'PV-' . date('Y'); // Payment Voucher
        $lastPayment = self::where('company_id', $companyId)
            ->where('payment_number', 'like', $prefix . '%')
            ->orderBy('payment_number', 'desc')
            ->first();

        if ($lastPayment) {
            $number = intval(substr($lastPayment->payment_number, -4)) + 1;
        } else {
            $number = 1;
        }

        return $prefix . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }
}
