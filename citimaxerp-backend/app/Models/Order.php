<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Order extends Model
{
    use HasFactory, SoftDeletes, HasUuids;

    // Always append item_count to model output
    protected $appends = ['item_count'];

    /**
     * Get the count of items in the order.
     * @return int
     */
    public function getItemCountAttribute(): int
    {
        // Use loaded orderItems if available, otherwise query
        // Number of lines. Summing quantities mixed packs and pieces (one order read "22000 items").
        return $this->relationLoaded('orderItems') ? $this->orderItems->count() : $this->orderItems()->count();
    }

    protected $dates = ['deleted_at'];

    /**
     * Always return the short order number when accessing order_number
     */
    public function getOrderNumberAttribute($value)
    {
        // If order_number is like ORD-853b296e-0074, return ORD-0074
        if (preg_match('/^(ORD)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
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
        $this->attributes['below_minimum_price'] = $value ? true : false;
    }

    /**
     * Handle requires_approval boolean conversion for PostgreSQL
     */
    public function setRequiresApprovalAttribute($value)
    {
        $this->attributes['requires_approval'] = $value ? true : false;
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
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'order_number',
        'customer_id',
        'sales_rep_id',
        'payment_type',
        'credit_terms_days',
        'total_amount',
        'status',
        'company_id',
        'notes',
        'discount',
        'tax',
        'final_amount',
        'delivery_location_id',
        'tracking_number',
        'amount_paid',
        'currency',
        'payment_status',
        'dispatch_status',
        'below_minimum_price',
        'requires_approval',
        'created_at',
        'updated_at',
        'order_date',
        'invoice_approved_by',
        'invoice_approved_at',
        'invoice_approval_comment',
        'invoice_contact_person',
        'invoice_contact_phone',
        'is_historical',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'credit_terms_days' => 'integer',
        'below_minimum_price' => 'boolean',
        'requires_approval' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'order_date' => 'datetime',
        'stock_deducted_at' => 'datetime',
        'invoice_approved_at' => 'datetime',
        'is_historical' => 'boolean',
    ];

    // Forms send order_date: null when the field is left blank, and sales reports
    // filter on it, so an order must never be saved without one.
    protected static function booted(): void
    {
        static::saving(function (Order $order) {
            if (empty($order->order_date)) {
                $order->order_date = $order->getOriginal('order_date') ?? $order->created_at ?? now();
            }
        });
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    /** Go-live: sales dated before this were made in the previous system, so they never move stock. */
    public const HISTORICAL_CUTOFF = '2026-10-17';

    public static function isHistoricalDate($date): bool
    {
        return !empty($date) && \Carbon\Carbon::parse($date)->toDateString() < self::HISTORICAL_CUTOFF;
    }

    // Only the GM, a Director or the Warehouse Manager may sign an order off for invoicing.
    public const INVOICE_APPROVER_ROLES = ['gm', 'general manager', 'director', 'directors', 'managing director', 'warehouse manager'];

    public static function canApproveInvoices(?User $user): bool
    {
        return in_array(strtolower(trim((string) $user?->role?->name)), self::INVOICE_APPROVER_ROLES, true);
    }

    public function isInvoiceApproved(): bool
    {
        // A past (pre-go-live) sale already happened, so there is nothing left to approve.
        return (bool) $this->invoice_approved_at || (bool) $this->is_historical;
    }

    public function invoiceApprover()
    {
        return $this->belongsTo(User::class, 'invoice_approved_by');
    }

    public function salesRep()
    {
        return $this->belongsTo(User::class, 'sales_rep_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function invoice()
    {
        return $this->hasOne(Invoice::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }

    public function deliveryLocation()
    {
        return $this->belongsTo(DeliveryLocation::class);
    }

    public function deliveryDetails()
    {
        return $this->hasMany(DeliveryDetail::class, 'order_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function orderDispatches()
    {
        return $this->hasMany(OrderDispatch::class, 'order_id');
    }

    public function latestOrderDispatch()
    {
        // NOT ->latestOfMany(): Eloquent's ofMany() always adds a MAX(id)
        // tiebreak internally even when another column is specified, and id
        // is a native Postgres uuid column with no MAX() aggregate defined -
        // that throws "function max(uuid) does not exist" for any order
        // that actually has a dispatch. hasOne()->latest() is the older,
        // pre-ofMany() idiom for "latest related row" and doesn't hit this,
        // since it's a plain ORDER BY rather than an aggregate subquery.
        return $this->hasOne(OrderDispatch::class, 'order_id')->latest('created_at');
    }

    /**
     * Get the short order number (e.g., ORD-0074)
     */
    public function getShortOrderNumberAttribute()
    {
        // If order_number is like ORD-853b296e-0074, return ORD-0074
        if (preg_match('/^(ORD)-(?:[\w-]+)-(\d{4})$/', $this->order_number, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $this->order_number;
    }
}