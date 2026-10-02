<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Customer extends Model
{
    use HasFactory, SoftDeletes, HasUuids;

    public function documents()
    {
        return $this->morphMany(Document::class, 'documentable');
    }

    protected $dates = ['deleted_at'];

    // Always append total_spend and total_orders to model output
    protected $appends = ['total_spend', 'total_orders'];

    /**
     * Get the total spend for the customer (sum of all order total_amount).
     * @return string
     */
    public function getTotalSpendAttribute(): string
    {
        $sum = $this->ordersForTotals()->sum(function ($order) {
            return (float) $order->total_amount;
        });
        return number_format($sum, 2, '.', '');
    }

    /**
     * Get the total number of orders for the customer.
     * @return int
     */
    public function getTotalOrdersAttribute(): int
    {
        return $this->ordersForTotals()->count();
    }

    private $ordersForTotalsCache = null;

    // Cached outside the relation so the orders list isn't added to serialized output.
    private function ordersForTotals()
    {
        if ($this->relationLoaded('orders')) {
            return $this->orders;
        }
        return $this->ordersForTotalsCache ??= $this->orders()->get();
    }

    protected $table = 'customers';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'account_id',
        'customer_number',
        'name',
        'email',
        'phone',
        'status',
        'approval_status',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'notes',
        'tags',
        'preferred_communication_channel',
        'last_contact_date',
        'customer_type',
        'payment_method',
        'contact_person_name',
        'contact_person_phone',
        'contact_person_email',
        'contact_person_designation',
        'business_name',
        'trading_name',
        'business_type',
        'registration_number',
        'ppb_license_number',
        'website',
        'telephone',
        'region',
        'county',
        'accounts_contact_name',
        'accounts_contact_designation',
        'accounts_contact_phone',
        'accounts_contact_email',
        'pending_credit_application',
        'nature_of_business',
        'pin_number',
        'total_spend',
        'total_orders',
        'loyalty_points',
        'timestamp',
        'created_by',
    ];

    /**
     * Get the name attribute in Title Case
     */
    public function getNameAttribute($value)
    {
        return $value ? ucwords(strtolower($value)) : null;
    }

    /**
     * Set the name attribute to Title Case
     */
    public function setNameAttribute($value)
    {
        $this->attributes['name'] = $value ? ucwords(strtolower($value)) : null;
    }

    /**
     * Get the business_name attribute in Title Case
     */
    public function getBusinessNameAttribute($value)
    {
        return $value ? ucwords(strtolower($value)) : null;
    }

    /**
     * Set the business_name attribute to Title Case
     */
    public function setBusinessNameAttribute($value)
    {
        $this->attributes['business_name'] = $value ? ucwords(strtolower($value)) : null;
    }

    /**
     * Get the email attribute in lowercase
     */
    public function getEmailAttribute($value)
    {
        return $value ? strtolower($value) : null;
    }

    /**
     * Set the email attribute to lowercase
     */
    public function setEmailAttribute($value)
    {
        $this->attributes['email'] = $value ? strtolower($value) : null;
    }

    public function getCustomerNumberAttribute($value)
    {
        // If customer_number is like CUST-853b296e-0074, return CUST-0074
        if (preg_match('/^(CUST)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Relationship with CustomerAccount (if customer has an account)
     */
    public function account()
    {
        return $this->belongsTo(CustomerAccount::class, 'account_id');
    }

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'tags' => 'array',
        'pending_credit_application' => 'array',
        'last_contact_date' => 'datetime',
        'total_spend' => 'decimal:2',
        'total_orders' => 'integer',
        'loyalty_points' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Two-stage credit-approval log for rep-created customers.
     */
    public function approvals()
    {
        return $this->hasMany(CustomerApproval::class, 'customer_id');
    }

    public function latestApproval()
    {
        // NOT ->latestOfMany(): see App\Models\Order::latestOrderDispatch()
        // for why - same uuid-primary-key incompatibility.
        return $this->hasOne(CustomerApproval::class, 'customer_id')->latest('created_at');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id', 'id');
    }

    /**
     * Relationship with Orders.
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    /**
     * Relationship with Customer Notes.
     */
    public function notes()
    {
        return $this->hasMany(CustomerNote::class);
    }

    /**
     * Relationship with Tasks.
     */
    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    /**
     * Relationship with Quotes.
     */
    public function quotes()
    {
        return $this->hasMany(Quote::class);
    }

    /**
     * Relationship with Payments.
     */
    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Relationship with Conversations (for chat system).
     */
    public function conversations()
    {
        return $this->hasMany(Conversation::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get WhatsApp phone number for this customer
     */
    public function getWhatsAppPhone(): ?string
    {
        // Check if phone exists
        if ($this->phone) {
            return $this->phone;
        }

        // Check tags for WhatsApp phone
        $tags = $this->tags ?? [];
        foreach ($tags as $tag) {
            if (str_starts_with($tag, 'whatsapp_phone:')) {
                return substr($tag, 15); // Remove 'whatsapp_phone:' prefix
            }
        }

        return null;
    }

    /**
     * Get Instagram ID for this customer
     */
    public function getInstagramId(): ?string
    {
        $tags = $this->tags ?? [];
        foreach ($tags as $tag) {
            if (str_starts_with($tag, 'instagram_id:')) {
                return substr($tag, 13); // Remove 'instagram_id:' prefix
            }
        }

        return null;
    }

    /**
     * Get Instagram username for this customer
     */
    public function getInstagramUsername(): ?string
    {
        $tags = $this->tags ?? [];
        foreach ($tags as $tag) {
            if (str_starts_with($tag, 'instagram_username:')) {
                return substr($tag, 19); // Remove 'instagram_username:' prefix
            }
        }

        return null;
    }

    /**
     * Get Messenger PSID for this customer
     */
    public function getMessengerPsid(): ?string
    {
        $tags = $this->tags ?? [];
        foreach ($tags as $tag) {
            if (str_starts_with($tag, 'messenger_psid:')) {
                return substr($tag, 15); // Remove 'messenger_psid:' prefix
            }
        }

        return null;
    }

    /**
     * Check if customer has conversations on a specific platform
     */
    public function hasConversationOnPlatform(string $platform): bool
    {
        return $this->conversations()->where('platform', $platform)->exists();
    }

    /**
     * Get all platforms this customer has conversations on
     */
    public function getPlatforms(): array
    {
        return $this->conversations()
            ->distinct('platform')
            ->pluck('platform')
            ->toArray();
    }

    /**
     * Get customer's last conversation on a platform
     */
    public function getLastConversationOnPlatform(string $platform): ?Conversation
    {
        return $this->conversations()
            ->where('platform', $platform)
            ->orderBy('last_message_at', 'desc')
            ->first();
    }

    /**
     * Check if customer is active on any platform
     */
    public function isActiveOnAnyPlatform(): bool
    {
        return $this->conversations()
            ->where('status', 'active')
            ->exists();
    }
}