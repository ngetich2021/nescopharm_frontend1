<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingTriggerCategory extends Model
{
    use HasUuids;

    protected $table = 'accounting_trigger_categories';

    protected $fillable = [
        'company_id',
        'code',
        'name',
        'description',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    // =========================================
    // RELATIONSHIPS
    // =========================================

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function triggers(): HasMany
    {
        return $this->hasMany(AccountingTriggerConfig::class, 'category_id')
            ->orderBy('sort_order');
    }

    public function activeTriggers(): HasMany
    {
        return $this->hasMany(AccountingTriggerConfig::class, 'category_id')
            ->whereRaw('is_active = true')
            ->orderBy('sort_order');
    }

    // =========================================
    // SCOPES
    // =========================================

    /**
     * Get system-wide categories (available to all companies)
     */
    public function scopeSystem($query)
    {
        return $query->whereNull('company_id');
    }

    /**
     * Get categories for a specific company (including system-wide)
     */
    public function scopeForCompany($query, string $companyId)
    {
        return $query->where(function ($q) use ($companyId) {
            $q->whereNull('company_id')
              ->orWhere('company_id', $companyId);
        });
    }

    /**
     * Get only active categories
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    // =========================================
    // STATIC METHODS
    // =========================================

    /**
     * Get all categories with their triggers for a company
     */
    public static function getForCompanyWithTriggers(string $companyId): \Illuminate\Database\Eloquent\Collection
    {
        return static::forCompany($companyId)
            ->active()
            ->with(['activeTriggers' => function ($query) use ($companyId) {
                $query->forCompany($companyId);
            }])
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * Get a category by code
     */
    public static function getByCode(string $code, ?string $companyId = null): ?self
    {
        $query = static::where('code', $code)->active();
        
        if ($companyId) {
            $query->forCompany($companyId);
        } else {
            $query->system();
        }

        return $query->first();
    }
}
