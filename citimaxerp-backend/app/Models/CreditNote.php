<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CreditNote extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'credit_note_number',
        'company_id',
        'customer_id',
        'invoice_id',
        'created_by',
        'status',
        'credit_note_date',
        'expiry_date',
        'reason',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'total_amount',
        'amount_applied',
        'amount_refunded',
        'balance_amount',
        'currency',
        'notes',
        'metadata',
        'issued_at',
        'applied_at',
        'refunded_at',
        'voided_at',
        'etims_requested',
        'etims_sale_id',
        'etims_status',
        'etims_signature',
        'etims_qr_url',
        'etims_trader_invoice_number',
        'etims_submitted_at',
        'etims_synced_at',
        'etims_last_error',
        'etims_client_request_id',
        'etims_lock_state',
        'etims_lock_acquired_at',
        'etims_receipt_number',
        'etims_serial_number',
        'etims_invoice_number',
        'etims_receipt_date',
        'etims_receipt_time',
        'etims_internal_data',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'amount_applied' => 'decimal:2',
        'amount_refunded' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'credit_note_date' => 'date',
        'expiry_date' => 'date',
        'issued_at' => 'datetime',
        'applied_at' => 'datetime',
        'refunded_at' => 'datetime',
        'voided_at' => 'datetime',
        'metadata' => 'array',
        'etims_requested' => 'boolean',
        'etims_submitted_at' => 'datetime',
        'etims_synced_at' => 'datetime',
        'etims_lock_acquired_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * PostgreSQL expects a native boolean when eTIMS credit notes are queued.
     */
    public function setEtimsRequestedAttribute($value): void
    {
        $this->attributes['etims_requested'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            if (empty($model->credit_note_number)) {
                $model->credit_note_number = static::generateCreditNoteNumber($model->company_id);
            }

            // Initialise balance
            $model->balance_amount = $model->total_amount - $model->amount_applied - $model->amount_refunded;
        });

        static::updating(function ($model) {
            // Keep balance in sync when totals change
            if ($model->isDirty('total_amount') || $model->isDirty('amount_applied') || $model->isDirty('amount_refunded')) {
                $model->balance_amount = $model->total_amount - $model->amount_applied - $model->amount_refunded;

                // Auto-mark as applied when fully consumed
                if ($model->balance_amount <= 0 && $model->status === 'issued') {
                    $model->status = 'applied';
                    if (!$model->applied_at) {
                        $model->applied_at = now();
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lineItems()
    {
        return $this->hasMany(CreditNoteLineItem::class);
    }

    public function refunds()
    {
        return $this->hasMany(CreditNoteRefund::class);
    }

    // -------------------------------------------------------------------------
    // Helper methods
    // -------------------------------------------------------------------------

    /**
     * Recalculate totals from line items and persist.
     */
    public function calculateTotals(): void
    {
        $subtotal = 0;
        $discountTotal = 0;
        $taxTotal = 0;

        foreach ($this->lineItems as $item) {
            $base = $item->quantity * $item->unit_price;
            $subtotal += $base;
            $discountTotal += $item->discount_amount;
            $taxTotal += $item->tax_amount;
        }

        $this->subtotal = (string) $subtotal;
        $this->discount_amount = (string) $discountTotal;
        $this->tax_amount = (string) $taxTotal;
        $this->total_amount = (string) ($subtotal - $discountTotal + $taxTotal);
        $this->balance_amount = (string) ($this->total_amount - $this->amount_applied - $this->amount_refunded);
        $this->save();
    }

    public function isVoid(): bool
    {
        return $this->status === 'void';
    }

    public function isIssued(): bool
    {
        return $this->status === 'issued';
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function hasRemainingCredit(): bool
    {
        return $this->balance_amount > 0;
    }

    // -------------------------------------------------------------------------
    // Static helpers
    // -------------------------------------------------------------------------

    public static function generateCreditNoteNumber(string $companyId): string
    {
        $last = static::where('company_id', $companyId)
            ->orderByRaw("CAST(SUBSTRING(credit_note_number FROM '[0-9]+$') AS INTEGER) DESC NULLS LAST")
            ->value('credit_note_number');

        if ($last && preg_match('/(\d+)$/', $last, $m)) {
            $next = (int) $m[1] + 1;
        } else {
            $next = 1;
        }

        return 'CN-' . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByInvoice($query, string $invoiceId)
    {
        return $query->where('invoice_id', $invoiceId);
    }

    public function scopeByCustomer($query, string $customerId)
    {
        return $query->where('customer_id', $customerId);
    }
}
