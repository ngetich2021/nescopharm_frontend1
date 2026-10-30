<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Carbon\Carbon;

class Invoice extends Model
{
    // An invoice carried over from the old system is known by its old number, kept as its File No:
    // File No 54 is NSK/0054.
    public const LEGACY_PREFIX = 'NSK/';

    /**
     * The number as printed: NSK/0054 when the invoice has a File No, otherwise the short form
     * (INV-853b296e-0074 is INV-0074). The stored number never changes, so the INV sequence holds.
     * Queries that pick columns must include file_number for the NSK form.
     */
    public function getInvoiceNumberAttribute($value)
    {
        return self::printedNumber($value, $this->attributes['file_number'] ?? null);
    }

    public static function printedNumber(?string $stored, $fileNumber = null): ?string
    {
        $fileNumber = trim((string) $fileNumber);
        if (preg_match('/^\d+$/', $fileNumber)) {
            return self::LEGACY_PREFIX . str_pad(ltrim($fileNumber, '0') ?: '0', 4, '0', STR_PAD_LEFT);
        }

        return self::shortNumber($stored);
    }

    public static function nextFileNumber(string $companyId): int
    {
        return 1 + (int) self::where('company_id', $companyId)
            ->whereRaw("file_number ~ '^[0-9]+$'")
            ->max(\Illuminate\Support\Facades\DB::raw('file_number::int'));
    }

    /**
     * Invoices whose number matches a search, as printed or as typed: "NSK/0427", "nsk 427",
     * "NSK427" and "0427" all find NSK/0427 (File No 427); "INV-0074" finds INV-...-0074.
     */
    public function scopeWhereNumberMatches($query, string $term)
    {
        $term = trim($term);
        $query->where(function ($q) use ($term) {
            $q->where('invoice_number', 'ilike', "%{$term}%")
                ->orWhereRaw("file_number ~ '^[0-9]+$' AND ? || lpad(ltrim(file_number, '0'), 4, '0') ilike ?", [self::LEGACY_PREFIX, "%{$term}%"]);
            if (preg_match('/^(?:nsk\s*[\/\-]?\s*)?0*(\d+)$/i', $term, $m)) {
                $q->orWhereRaw("file_number ~ '^[0-9]+$' AND file_number::int = ?", [(int) $m[1]]);
            }
        });

        return $query;
    }

    // INV-853b296e-0074 is INV-0074.
    public static function shortNumber(?string $stored): ?string
    {
        return $stored && preg_match('/^(INV)-(?:[\w-]+)-(\d{4})$/', $stored, $matches) ? $matches[1] . '-' . $matches[2] : $stored;
    }

    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'invoice_number',
        'company_id',
        'customer_id',
        'sales_rep_id',
        'payment_type',
        'credit_terms_days',
        'order_id',
        'payment_id',
        'file_number',
        'filed_at',
        'filed_by',
        'type',
        'status',
        'invoice_date',
        'due_date',
        'subtotal',
        'tax_amount',
        'discount_amount',
        'total_amount',
        'amount_paid',
        'amount_credited',
        'balance_amount',
        'currency',
        'exchange_rate',
        'payment_terms',
        'notes',
        'terms_and_conditions',
        'delivery_note_number',
        'delivery_note_date',
        'reference_number',
        'reference_date',
        'other_references',
        'buyers_order_no',
        'buyers_order_date',
        'dispatch_doc_no',
        'dispatched_through',
        'destination',
        'terms_of_delivery',
        'mode_of_payment',
        'line_items',
        'metadata',
        'etims_requested',
        'etims_sale_id',
        'etims_status',
        'etims_signature',
        'etims_qr_url',
        'etims_trader_invoice_number',
        'etims_receipt_number',
        'etims_serial_number',
        'etims_invoice_number',
        'etims_receipt_date',
        'etims_receipt_time',
        'etims_internal_data',
        'etims_submitted_at',
        'etims_synced_at',
        'etims_last_error',
        'etims_client_request_id',
        'etims_lock_state',
        'etims_lock_acquired_at',
        'sent_at',
        'viewed_at',
        'paid_at',
        'created_by',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'amount_credited' => 'decimal:2',
        'balance_amount' => 'decimal:2',
        'exchange_rate' => 'decimal:4',
        'credit_terms_days' => 'integer',
        'invoice_date' => 'date',
        'due_date' => 'date',
        'delivery_note_date' => 'date',
        'reference_date' => 'date',
        'buyers_order_date' => 'date',
        'sent_at' => 'datetime',
        'viewed_at' => 'datetime',
        'paid_at' => 'datetime',
        'line_items' => 'array',
        'metadata' => 'array',
        'etims_requested' => 'boolean',
        'etims_submitted_at' => 'datetime',
        'etims_synced_at' => 'datetime',
        'etims_lock_acquired_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['days_remaining'];

    /**
     * PostgreSQL expects a native boolean. PDO may otherwise bind booleans as
     * 0/1 integers when an invoice is queued for eTIMS.
     */
    public function setEtimsRequestedAttribute($value): void
    {
        $this->attributes['etims_requested'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? true : false;
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            // Set balance amount
            $model->balance_amount = $model->outstanding();

            // An order's invoice is numbered NSK/0429, NSK/0430...: the next File No after the
            // highest in use (other invoices, e.g. bounced cheque charges, keep their INV number).
            if ($model->order_id && blank($model->file_number) && $model->company_id) {
                $model->file_number = (string) self::nextFileNumber($model->company_id);
            }
        });

        static::updating(function ($model) {
            // Callers pass their own balance and status (often from amount_paid alone), so both are
            // always re-derived here, with credit counted apart from money received.
            if (!$model->isDirty(['amount_paid', 'amount_credited', 'total_amount', 'balance_amount', 'status'])) {
                return;
            }
            $model->balance_amount = $model->outstanding();
            if (in_array($model->status, ['cancelled', 'void'], true)) {
                return;
            }

            $paid = (float) $model->amount_paid;
            $credited = (float) $model->amount_credited;
            if ($model->balance_amount <= 0.005) {
                // Cleared at least partly by a credit note: "Credited", not "Paid".
                $model->status = $credited > 0.005 && $paid < (float) $model->total_amount - 0.005 ? 'credited' : 'paid';
                if (!$model->paid_at) {
                    $model->paid_at = now();
                }
            } elseif ($paid + $credited > 0.005) {
                $model->status = $model->isOverdue() ? 'overdue' : 'partially_paid';
            } elseif (in_array($model->status, ['paid', 'partially_paid', 'credited'], true)) {
                // Its receipts or credit were removed: it is owed again.
                $model->status = $model->isOverdue() ? 'overdue' : 'sent';
                $model->paid_at = null;
            } else {
                $model->status = $model->isOverdue() ? 'overdue' : $model->status;
            }
        });
    }

    /** What is still owed: the total less money received and credit notes applied. */
    public function outstanding(): float
    {
        return round((float) $this->total_amount - (float) $this->amount_paid - (float) $this->amount_credited, 2);
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function salesRep()
    {
        return $this->belongsTo(User::class, 'sales_rep_id');
    }

    public function lineItems()
    {
        // line_seq: the order the lines were entered in.
        return $this->hasMany(InvoiceLineItem::class)->orderBy('line_seq');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class, 'invoice_id');
    }

    /**
     * Get all payment allocations for this invoice
     */
    public function paymentAllocations()
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    /**
     * Get all credit notes issued against this invoice
     */
    public function creditNotes()
    {
        return $this->hasMany(CreditNote::class);
    }

    /**
     * Get the total credit amount applied to this invoice from credit notes
     */
    public function getTotalCreditsApplied(): float
    {
        return (float) $this->creditNotes()->whereIn('status', ['issued', 'applied'])->sum('amount_applied');
    }

    /**
     * Get all payments allocated to this invoice via allocations
     */
    public function allocatedPayments()
    {
        return $this->belongsToMany(Payment::class, 'payment_allocations')
            ->withPivot('amount_allocated', 'allocated_date', 'notes')
            ->withTimestamps();
    }

    /**
     * Get total amount allocated to this invoice from all payments
     */
    public function getTotalAllocatedAttribute()
    {
        return $this->paymentAllocations()->sum('amount_allocated');
    }

    /**
     * Get total amount allocated to this invoice (method version)
     */
    public function getTotalAllocatedAmount()
    {
        return $this->paymentAllocations()->sum('amount_allocated') ?? 0;
    }

    // Helper methods
    public function isOverdue()
    {
        return $this->due_date < now() && $this->balance_amount > 0;
    }

    public function getDaysOverdueAttribute()
    {
        if (!$this->isOverdue()) {
            return 0;
        }

        return now()->diffInDays($this->due_date);
    }

    /**
     * Days until due_date (negative once overdue). Null once there's nothing left
     * to collect, since it's no longer relevant for credit follow-up.
     */
    public function getDaysRemainingAttribute(): ?int
    {
        if ($this->balance_amount <= 0 || !$this->due_date) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays($this->due_date->copy()->startOfDay(), false);
    }

    public function markAsSent()
    {
        $this->update([
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }

    public function markAsViewed()
    {
        if (!$this->viewed_at) {
            $this->update([
                'status' => 'viewed',
                'viewed_at' => now(),
            ]);
        }
    }

    public function markAsPaid($amount = null, $paymentDate = null)
    {
        $paymentAmount = $amount ?? $this->balance_amount;
        $this->amount_paid += $paymentAmount;

        if ($this->balance_amount <= 0) {
            $this->status = 'paid';
            $this->paid_at = $paymentDate ?? now();
        }

        $this->save();
    }

    public function calculateTotals()
    {
        // Calculate line items base amounts (before tax and discounts)
        $lineItemsSubtotal = 0;
        $lineItemsDiscounts = 0;
        $lineItemsTax = 0;

        foreach ($this->lineItems as $lineItem) {
            $baseAmount = $lineItem->quantity * $lineItem->unit_price;
            $lineItemsSubtotal += $baseAmount;
            $lineItemsDiscounts += $lineItem->discount_amount;
            $lineItemsTax += $lineItem->tax_amount;
        }

        // Set invoice totals
        $this->subtotal = $lineItemsSubtotal; // Total before discounts and tax
        $this->discount_amount = $lineItemsDiscounts; // Sum of all line item discounts
        $this->tax_amount = $lineItemsTax; // Sum of all line item tax (calculated after discounts)
        $this->total_amount = $this->subtotal - $this->discount_amount + $this->tax_amount;
        $this->balance_amount = $this->outstanding();
        $this->save();
    }

    // Scopes
    public function scopeOverdue($query)
    {
        return $query->where('due_date', '<', now())
            ->where('balance_amount', '>', 0);
    }

    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    public function scopeByCustomer($query, $customerId)
    {
        return $query->where('customer_id', $customerId);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('invoice_date', [$startDate, $endDate]);
    }

    public function scopeUnpaid($query)
    {
        return $query->where('balance_amount', '>', 0);
    }
}
