<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Company extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'companies';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'description',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'primary_country_code',
        'postal_code',
        'website',
        'logo_url',
        'letterhead_url',
        'bank_name',
        'bank_account_name',
        'bank_account_number',
        'bank_branch',
        'mpesa_paybill',
        'mpesa_account_number',
        'is_active',
        'is_first_time',
        'current_subscription_id',
    ];

    protected $casts = [
        'id' => 'string',
        'is_active' => 'boolean',
        'is_first_time' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function users()
    {
        return $this->hasMany(User::class, 'company_id', 'id');
    }

    public function settings()
    {
        return $this->hasMany(CompanySetting::class);
    }

    public function metaPlatformCredentials()
    {
        return $this->hasMany(MetaPlatformCredential::class);
    }

    public function conversations()
    {
        return $this->hasMany(Conversation::class);
    }

    public function messageTemplates()
    {
        return $this->hasMany(MessageTemplate::class);
    }

    public function customers()
    {
        return $this->hasMany(Customer::class);
    }

    public function currentSubscription()
    {
        return $this->belongsTo(CompanySubscription::class, 'current_subscription_id');
    }

    public function subscriptions()
    {
        return $this->hasMany(CompanySubscription::class);
    }

    public function subscriptionPayments()
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /**
     * Check if company has an active subscription.
     */
    public function hasActiveSubscription()
    {
        return $this->currentSubscription && $this->currentSubscription->isActive();
    }

    /**
     * Check if company is in trial period.
     */
    public function isInTrial()
    {
        return $this->currentSubscription && $this->currentSubscription->isInTrial();
    }

    /**
     * Check if company subscription has expired.
     */
    public function hasExpiredSubscription()
    {
        return $this->currentSubscription && $this->currentSubscription->isExpired();
    }



    /**
     * Handle is_active boolean conversion for PostgreSQL
     */
    public function setIsActiveAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean
        if ($value === null) {
            $this->attributes['is_active'] = 'true'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_active'] = $value ? 'true' : 'false';
        }
    }

    /**
     * Handle is_first_time boolean conversion for PostgreSQL
     */
    public function setIsFirstTimeAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean
        if ($value === null) {
            $this->attributes['is_first_time'] = 'true'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_first_time'] = $value ? 'true' : 'false';
        }
    }

    /**
     * Get is_active as boolean when retrieving
     */
    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    /**
     * Get is_first_time as boolean when retrieving
     */
    public function getIsFirstTimeAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function isHolding(): bool
    {
        return false;
    }

    /**
     * Append a cache-busting version (the asset file's own mtime) to
     * logo/letterhead URLs, so replacing the file on disk is picked up by
     * every consumer immediately instead of waiting out the asset route's
     * Cache-Control max-age or a browser's cached copy of the old bytes.
     */
    public function getLogoUrlAttribute($value)
    {
        return $this->withAssetCacheBuster($value);
    }

    public function getLetterheadUrlAttribute($value)
    {
        return $this->withAssetCacheBuster($value);
    }

    protected function withAssetCacheBuster(?string $url): ?string
    {
        if (!$url || !str_contains($url, '/api/company-assets/')) {
            return $url;
        }

        $filename = basename(parse_url($url, PHP_URL_PATH));
        $path = storage_path('app/company-assets/' . $filename);
        if (!is_file($path)) {
            return $url;
        }

        $separator = str_contains($url, '?') ? '&' : '?';
        return $url . $separator . 'v=' . filemtime($path);
    }

    /**
     * Inline the asset as a data URI for dompdf: it can't fetch remote URLs,
     * and `php artisan serve` can't answer its own request mid-render anyway.
     */
    public function assetDataUri(?string $url): ?string
    {
        if (!$url) {
            return null;
        }

        $filename = basename(parse_url($url, PHP_URL_PATH) ?? '');
        $path = storage_path('app/company-assets/' . $filename);
        if (!$filename || !is_file($path)) {
            return null;
        }

        $mime = mime_content_type($path) ?: 'image/jpeg';
        return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
    }

}
