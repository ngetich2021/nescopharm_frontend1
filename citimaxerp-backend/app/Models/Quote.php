<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quote extends Model
{
    use HasFactory, SoftDeletes;

    // Always append item_count to model output
    protected $appends = ['item_count'];

    /**
     * Get the count of items in the quote.
     * @return int
     */
    public function getItemCountAttribute(): int
    {
        // Use loaded quoteItems if available, otherwise query
        $items = $this->relationLoaded('quoteItems') ? $this->quoteItems : $this->quoteItems()->get();
        return $items->sum('quantity');
    }

    protected $dates = ['deleted_at'];

    /**
     * Always return the short quote number when accessing quote_number
     */
    public function getQuoteNumberAttribute($value)
    {
        // If quote_number is like QUO-853b296e-0074, return QUO-0074
        if (preg_match('/^(QUO)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Handle below_minimum_price boolean conversion for PostgreSQL
     */
    public function setBelowMinimumPriceAttribute($value)
    {
        $this->attributes['below_minimum_price'] = $value ? 'true' : 'false';
    }

    /**
     * Handle requires_approval boolean conversion for PostgreSQL
     */
    public function setRequiresApprovalAttribute($value)
    {
        $this->attributes['requires_approval'] = $value ? 'true' : 'false';
    }

    /**
     * Get below_minimum_price as boolean when retrieving
     */
    public function getBelowMinimumPriceAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    /**
     * Get requires_approval as boolean when retrieving
     */
    public function getRequiresApprovalAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'quote_number',
        'customer_id',
        'submitted_by_id',
        'submitted_at',
        'original_submitted_by_id',
        'sales_rep_id',
        'total_amount',
        'status',
        'company_id',
        'notes',
        'discount',
        'final_amount',
        'delivery_location_id',
        'currency',
        'below_minimum_price',
        'requires_approval',
        'valid_until',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'discount' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'below_minimum_price' => 'boolean',
        'requires_approval' => 'boolean',
        'valid_until' => 'date',
        'submitted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * When set, this quote was submitted directly by a Sales Rep from POS
     * rather than built by staff - shown as "From: {rep} - {time}" until a
     * can_create_quotes user opens and edits it, which clears this field.
     */
    public function submittedBy()
    {
        return $this->belongsTo(User::class, 'submitted_by_id');
    }

    /**
     * The rep who originally submitted this quote from POS, if any. Unlike
     * submitted_by_id (cleared on staff's first edit), this is stamped once
     * at creation and kept forever, so the quote can always be routed back
     * to its owner for the confirm/request-changes step.
     */
    public function originalSubmittedBy()
    {
        return $this->belongsTo(User::class, 'original_submitted_by_id');
    }

    public function salesRep()
    {
        return $this->belongsTo(User::class, 'sales_rep_id');
    }

    /**
     * Credit customers get their approved credit days (30 if none set, same
     * default as CustomerCreditTermsResolver); everyone else pays cash.
     */
    public function paymentTermsLabel(): string
    {
        $customer = $this->customer;
        if (!$customer || $customer->payment_method !== 'credit') {
            return 'Strictly cash';
        }

        $days = $customer->account?->credit_days ?? 30;
        return "Strictly {$days} days";
    }

    /**
     * Prices are before VAT; VAT is added on top. A quote-level discount
     * reduces the taxable base, so each line's VAT is scaled by the same
     * proportion the discount takes off the subtotal.
     *
     * @return array{subtotal: float, discount: float, vat: float, total: float, vat_lines: array<int, array{label: string, rate: float, taxable: float, amount: float}>}
     */
    public function vatBreakdown(): array
    {
        $subtotal = (float) $this->quoteItems->sum(fn (QuoteItem $item) => $item->netAmount());
        $discount = min((float) $this->discount, $subtotal);
        $factor = $subtotal > 0 ? ($subtotal - $discount) / $subtotal : 0.0;

        $vatLines = $this->quoteItems
            ->map(fn (QuoteItem $item) => ['tax' => $item->taxInfo(), 'net' => $item->netAmount() * $factor])
            ->filter(fn ($row) => $row['tax']['rate'] > 0)
            ->groupBy(fn ($row) => $row['tax']['code'])
            ->map(function ($rows) {
                $tax = $rows->first()['tax'];
                $taxable = (float) $rows->sum('net');
                return [
                    'label' => $tax['label'],
                    'rate' => $tax['rate'],
                    'taxable' => round($taxable, 2),
                    'amount' => round($taxable * $tax['rate'] / 100, 2),
                ];
            })
            ->sortByDesc('rate')
            ->values()
            ->all();

        $vat = round(array_sum(array_column($vatLines, 'amount')), 2);
        $subtotal = round($subtotal, 2);
        $discount = round($discount, 2);

        return [
            'subtotal' => $subtotal,
            'discount' => $discount,
            'vat' => $vat,
            'total' => round($subtotal - $discount + $vat, 2),
            'vat_lines' => $vatLines,
        ];
    }

    /**
     * Keep the stored final_amount (used by lists, credit checks and order
     * conversion) equal to the VAT-inclusive grand total.
     */
    public function syncTotals(): void
    {
        $this->loadMissing('quoteItems.product.vatCategory');
        $totals = $this->vatBreakdown();
        $this->forceFill([
            'total_amount' => $totals['subtotal'],
            'final_amount' => $totals['total'],
        ])->save();
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function quoteItems()
    {
        return $this->hasMany(QuoteItem::class, 'quote_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function deliveryLocation()
    {
        return $this->belongsTo(DeliveryLocation::class);
    }

    public function quoteNotes()
    {
        return $this->hasMany(QuoteNote::class, 'quote_id');
    }

    /**
     * Get the short quote number (e.g., QUO-0074)
     */
    public function getShortQuoteNumberAttribute()
    {
        // If quote_number is like QUO-853b296e-0074, return QUO-0074
        if (preg_match('/^(QUO)-(?:[\w-]+)-(\d{4})$/', $this->quote_number, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $this->quote_number;
    }

    /**
     * Mark the quote as sent
     */
    public function markAsSent()
    {
        // Update status to 'pending' if it's not already approved/rejected
        if ($this->status === 'pending') {
            $this->update([
                'status' => 'pending',
            ]);
        }
    }
}
