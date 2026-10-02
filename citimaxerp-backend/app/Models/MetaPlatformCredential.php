<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\Casts\Attribute;

class MetaPlatformCredential extends Model {

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'additional_config' => 'array',
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $hidden = [
        'access_token',
        'app_secret',
        'webhook_verify_token',
    ];

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    // Relationships
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'platform', 'platform')
                    ->where('company_id', $this->company_id);
    }

    // Accessors & Mutators
    protected function accessToken(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? decrypt($value) : null,
            set: fn ($value) => $value ? encrypt($value) : null,
        );
    }

    protected function appSecret(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? decrypt($value) : null,
            set: fn ($value) => $value ? encrypt($value) : null,
        );
    }

    protected function webhookVerifyToken(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ? decrypt($value) : null,
            set: fn ($value) => $value ? encrypt($value) : null,
        );
    }

    // Scopes

    public function scopeForPlatform($query, $platform)
    {
        return $query->where('platform', $platform);
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    // Helper Methods
    public function isTokenExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function isValid(): bool
    {
        return $this->is_active && !$this->isTokenExpired();
    }

    public function getPlatformSpecificId(): ?string
    {
        return match($this->platform) {
            'whatsapp' => $this->phone_number_id,
            'instagram', 'messenger' => $this->page_id,
            default => null,
        };
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

    // Scopes for PostgreSQL boolean queries
    public function scopeActive($query)
    {
        // Use explicit cast for PostgreSQL boolean compatibility
        return $query->whereRaw('is_active::boolean = true');
    }

}
