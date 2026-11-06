<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
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
        // A bounced cheque debit is always DEB-001, never an NSK number.
        if ($stored && str_starts_with($stored, self::DEBIT_PREFIX)) {
            return self::shortNumber($stored);
        }
        $fileNumber = trim((string) $fileNumber);
        if (preg_match('/^\d+$/', $fileNumber)) {
            return self::LEGACY_PREFIX . str_pad(ltrim($fileNumber, '0') ?: '0', 4, '0', STR_PAD_LEFT);
        }

        return self::shortNumber($stored);
    }

    // Invoices dated from 2 Nov 2026 run from NSK/0432 upwards; earlier ones continue the old series.
    public const NEW_SERIES_FROM = '2026-11-02';
    public const NEW_SERIES_START = 432;

    // A bounced cheque's KES 2,000 charge is a debit in its own series, stored DEB-9b267ea3-001 and
    // printed DEB-001, so it takes no number from the invoices.
    public const DEBIT_PREFIX = 'DEB-';

    public static function nextDebitNumber(string $companyId): string
    {
        $prefix = self::DEBIT_PREFIX . substr($companyId, 0, 8) . '-';
        $last = \Illuminate\Support\Facades\DB::table('invoices')
            ->where('invoice_number', 'like', $prefix . '%')
            // The longest first: DEB-...-1000 comes after DEB-...-999.
            ->orderByRaw('length(invoice_number) desc, invoice_number desc')
            ->lockForUpdate()
            ->value('invoice_number');
        $next = $last ? (int) substr($last, strlen($prefix)) + 1 : 1;

        return $prefix . str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public static function nextFileNumber(string $companyId, $invoiceDate = null): int
    {
        $date = \Illuminate\Support\Carbon::parse($invoiceDate ?? now('Africa/Nairobi'))->toDateString();
        $newSeries = $date >= self::NEW_SERIES_FROM;
        $asInt = \Illuminate\Support\Facades\DB::raw('file_number::int');
        $numbered = fn () => self::where('company_id', $companyId)->whereRaw("file_number ~ '^[0-9]+$'");

        $next = max(
            $newSeries ? self::NEW_SERIES_START : 1,
            1 + (int) $numbered()->where('invoice_date', $newSeries ? '>=' : '<', self::NEW_SERIES_FROM)->max($asInt),
        );
        // Never a File No another invoice already has (one filed by hand on the Filing page).
        $taken = $numbered()->where($asInt, '>=', $next)->pluck('file_number')->map(fn ($n) => (int) $n)->flip();
        while (isset($taken[$next])) {
            $next++;
        }

        return $next;
    }

    /**
     * Invoices whose number matches a search, as printed or as typed: "NSK/0427", "nsk 427",
     * "NSK427" and "0427" all find NSK/0427 (File No 427); "INV-0074" finds INV-...-0074;
     * "DEB-001" and "deb 1" find the debit DEB-001.
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
            if (preg_match('/^deb\s*[\/\-]?\s*0*(\d+)$/i', $term, $m)) {
                $q->orWhere('invoice_number', 'like', self::DEBIT_PREFIX . '%-' . str_pad($m[1], 3, '0', STR_PAD_LEFT));
            }
        });

        return $query;
    }

    /**
     * Lines that saved an invoice's number with its id (a cheque's allocation plan) show the
     * number as printed now, e.g. NSK/0427 once the invoice has a File No.
     */
    public static function withCurrentNumbers(?array $lines): ?array
    {
        $ids = collect($lines ?? [])->pluck('invoice_id')->filter()->unique()->values();
        if ($ids->isEmpty()) {
            return $lines;
        }
        $now = self::whereIn('id', $ids)->get(['id', 'invoice_number', 'file_number'])->pluck('invoice_number', 'id');

        return array_map(function ($line) use ($now) {
            if (is_array($line) && isset($line['invoice_id'], $now[$line['invoice_id']])) {
                $line['invoice_number'] = $now[$line['invoice_id']];
            }
            return $line;
        }, $lines);
    }

    // INV-853b296e-0074 is INV-0074; DEB-853b296e-001 is DEB-001.
    public static function shortNumber(?string $stored): ?string
    {
        return $stored && preg_match('/^(INV|DEB)-(?:[\w-]+)-(\d{3,})$/', $stored, $matches) ? $matches[1] . '-' . $matches[2] : $stored;
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

        // The customer's Credit Period decides when an invoice is due, whichever screen or import saved it.
        static::saving(function ($model) {
            if (!$model->exists || $model->isDirty(['invoice_date', 'customer_id', 'due_date', 'credit_terms_days', 'payment_terms'])) {
                $model->applyCreditPeriod();
            }
        });

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            // Set balance amount
            $model->balance_amount = $model->outstanding();

            // An order's invoice is numbered NSK/0429, NSK/0430...: the next File No in its date's
            // series - from NSK/0432 for invoices dated 2 Nov 2026 on (other invoices keep their INV
            // number; bounced cheque debits are DEB-001, DEB-002...). It is filed under that number straight away;
            // if the old system already used it, the number is changed on the Filing page.
            if ($model->order_id && blank($model->file_number) && $model->company_id) {
                $model->file_number = (string) self::nextFileNumber($model->company_id, $model->invoice_date);
                $model->filed_at = now();
                $model->filed_by = auth()->id();
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

    /**
     * Due = invoice date + the customer's Credit Period. A bounced cheque debit stays due on receipt,
     * and a customer with no Credit Period keeps the invoice's own terms, never due before they run out.
     */
    private function applyCreditPeriod(): void
    {
        if ($this->type === 'credit_note' || str_starts_with((string) $this->invoice_number, self::DEBIT_PREFIX)) {
            return;
        }

        $period = $this->customer_id ? CustomerAccount::creditPeriodFor($this->customer_id) : null;
        if ($period === null) {
            $earliest = $this->termsDueDate();
            if ($earliest && (!$this->due_date || $this->due_date->copy()->startOfDay()->lt($earliest))) {
                $this->due_date = $earliest->toDateString();
            }
            return;
        }

        if ($this->invoice_date) {
            $this->due_date = Carbon::parse($this->invoice_date)->addDays($period)->toDateString();
            $this->credit_terms_days = $period;
            if (!preg_match('/^\s*paid/i', (string) $this->payment_terms) || (float) $this->outstanding() > 0.005) {
                $this->payment_terms = "Net {$period}";
            }
        }
    }

    /**
     * Puts existing invoices on their customer's Credit Period (one customer's, or everyone's),
     * without touching the ledger. Returns how many moved.
     */
    public static function syncCreditPeriods(?string $customerId = null): int
    {
        if (DB::getDriverName() !== 'pgsql') {
            return 0;
        }

        $due = 'i.invoice_date::date + p.days';
        $terms = "CASE WHEN COALESCE(i.balance_amount, 0) <= 0.005 AND i.payment_terms ILIKE 'paid%' THEN i.payment_terms ELSE 'Net ' || p.days END";

        return DB::update("
            WITH p AS (
                SELECT DISTINCT ON (customer_id) customer_id,
                       COALESCE(credit_days, substring(credit_period_required::text from '^\s*([0-9]{1,4})\s*(?:[Dd][Aa][Yy][Ss]?)?\s*$')::int) AS days
                FROM customer_accounts
                ORDER BY customer_id, updated_at DESC NULLS LAST
            )
            UPDATE invoices i
            SET due_date = {$due},
                credit_terms_days = p.days,
                payment_terms = {$terms},
                status = CASE
                    WHEN i.status IN ('overdue', 'sent', 'partially_paid') AND COALESCE(i.balance_amount, 0) > 0.005 THEN
                        CASE WHEN {$due} < CURRENT_DATE THEN 'overdue'
                             WHEN COALESCE(i.amount_paid, 0) + COALESCE(i.amount_credited, 0) > 0.005 THEN 'partially_paid'
                             ELSE 'sent' END
                    ELSE i.status
                END
            FROM p
            WHERE p.customer_id = i.customer_id
              AND p.days IS NOT NULL
              AND i.invoice_date IS NOT NULL
              AND i.status <> 'cancelled'
              AND COALESCE(i.type, '') <> 'credit_note'
              AND COALESCE(i.invoice_number, '') NOT LIKE '" . self::DEBIT_PREFIX . "%'
              AND (i.customer_id = ? OR ? IS NULL)
              AND (i.due_date IS NULL OR i.due_date::date <> {$due}
                   OR i.credit_terms_days IS DISTINCT FROM p.days
                   OR i.payment_terms IS DISTINCT FROM {$terms})
        ", [$customerId, $customerId]);
    }

    /** The invoice date plus its credit terms (credit_terms_days, or "Net 30"); null when it has none. */
    public function termsDueDate(): ?Carbon
    {
        $days = (int) $this->credit_terms_days;
        if ($days <= 0 && preg_match('/^\s*net\s+(\d{1,4})\s*$/i', (string) $this->payment_terms, $m)) {
            $days = (int) $m[1];
        }

        return $days > 0 && $this->invoice_date
            ? Carbon::parse($this->invoice_date)->startOfDay()->addDays($days)
            : null;
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
