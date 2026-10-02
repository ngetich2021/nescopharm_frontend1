<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountingTriggerConfig extends Model
{
    use HasUuids;

    protected $table = 'accounting_trigger_configs';

    protected $fillable = [
        'company_id',
        'category_id',
        'trigger_key',
        'trigger_name',
        'description',
        'event_class',
        'model_class',
        'model_status',
        'conditions',
        'journal_type',
        'debit_accounts',
        'credit_accounts',
        'is_system',
        'is_active',
        'is_default',
        'sort_order',
    ];

    protected $casts = [
        'conditions' => 'array',
        'debit_accounts' => 'array',
        'credit_accounts' => 'array',
        'is_system' => 'boolean',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'sort_order' => 'integer',
    ];

    // =========================================
    // RELATIONSHIPS
    // =========================================

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AccountingTriggerCategory::class, 'category_id');
    }

    // =========================================
    // SCOPES
    // =========================================

    /**
     * Get system-wide triggers (available to all companies)
     */
    public function scopeSystem($query)
    {
        return $query->whereRaw('is_system = true');
    }

    /**
     * Get triggers for a specific company (including system-wide)
     */
    public function scopeForCompany($query, string $companyId)
    {
        return $query->where(function ($q) use ($companyId) {
            $q->whereRaw('is_system = true')
              ->orWhere('company_id', $companyId);
        });
    }

    /**
     * Get company-specific triggers only
     */
    public function scopeCompanySpecific($query, string $companyId)
    {
        return $query->where('company_id', $companyId)
            ->whereRaw('is_system = false');
    }

    /**
     * Get only active triggers
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    /**
     * Get default triggers
     */
    public function scopeDefault($query)
    {
        return $query->whereRaw('is_default = true');
    }

    /**
     * Get triggers by category
     */
    public function scopeInCategory($query, string $categoryId)
    {
        return $query->where('category_id', $categoryId);
    }

    /**
     * Get triggers by category code
     */
    public function scopeInCategoryCode($query, string $categoryCode, ?string $companyId = null)
    {
        $categoryQuery = AccountingTriggerCategory::where('code', $categoryCode);
        
        if ($companyId) {
            $categoryQuery->forCompany($companyId);
        }
        
        $category = $categoryQuery->first();
        
        if (!$category) {
            return $query->whereRaw('1 = 0'); // Return empty
        }
        
        return $query->where('category_id', $category->id);
    }

    // =========================================
    // HELPER METHODS
    // =========================================

    /**
     * Check if this trigger can be deleted
     */
    public function canBeDeleted(): bool
    {
        // System triggers cannot be deleted
        return !$this->is_system;
    }

    /**
     * Check if this trigger can be edited
     */
    public function canBeEdited(): bool
    {
        // System triggers can only have is_active toggled
        // Company triggers can be fully edited
        return !$this->is_system;
    }

    /**
     * Check if this trigger matches a given model and status
     */
    public function matches(string $modelClass, ?string $status = null): bool
    {
        if ($this->model_class !== $modelClass) {
            return false;
        }

        if ($status !== null && $this->model_status !== null) {
            return $this->model_status === $status;
        }

        return true;
    }

    // =========================================
    // STATIC METHODS
    // =========================================

    /**
     * Find trigger by key
     */
    public static function findByKey(string $triggerKey, ?string $companyId = null): ?self
    {
        $query = static::where('trigger_key', $triggerKey)->active();

        if ($companyId) {
            // First try company-specific
            $companyTrigger = (clone $query)
                ->where('company_id', $companyId)
                ->first();
            
            if ($companyTrigger) {
                return $companyTrigger;
            }

            // Fall back to system trigger
            return $query->system()->first();
        }

        return $query->system()->first();
    }

    /**
     * Get all available triggers for a company
     */
    public static function getAvailableForCompany(string $companyId): \Illuminate\Database\Eloquent\Collection
    {
        return static::forCompany($companyId)
            ->active()
            ->with('category')
            ->orderBy('sort_order')
            ->get();
    }

    /**
     * Get triggers grouped by category for a company
     */
    public static function getGroupedByCategory(string $companyId): array
    {
        $triggers = static::getAvailableForCompany($companyId);
        
        return $triggers->groupBy('category.code')->toArray();
    }

    /**
     * Get the default trigger for a category
     */
    public static function getDefaultForCategory(string $categoryCode, ?string $companyId = null): ?self
    {
        $query = static::inCategoryCode($categoryCode, $companyId)->default()->active();

        if ($companyId) {
            $query->forCompany($companyId);
        }

        return $query->first();
    }

    /**
     * Create a new company-specific trigger
     */
    public static function createForCompany(
        string $companyId,
        string $categoryCode,
        array $data
    ): self {
        $category = AccountingTriggerCategory::getByCode($categoryCode, $companyId);
        
        if (!$category) {
            throw new \InvalidArgumentException("Category '{$categoryCode}' not found");
        }

        $maxOrder = static::forCompany($companyId)
            ->where('category_id', $category->id)
            ->max('sort_order') ?? 0;

        // Use raw insert for PostgreSQL boolean compatibility
        $id = \Illuminate\Support\Str::uuid()->toString();
        $now = now();
        
        \Illuminate\Support\Facades\DB::table('accounting_trigger_configs')->insert([
            'id' => $id,
            'company_id' => $companyId,
            'category_id' => $category->id,
            'trigger_key' => $data['trigger_key'],
            'trigger_name' => $data['trigger_name'] ?? $data['name'] ?? null,
            'description' => $data['description'] ?? null,
            'event_class' => $data['event_class'] ?? null,
            'model_class' => $data['model_class'] ?? null,
            'model_status' => $data['model_status'] ?? null,
            'conditions' => isset($data['conditions']) ? json_encode($data['conditions']) : null,
            'journal_type' => $data['journal_type'] ?? 'standard',
            'debit_accounts' => isset($data['debit_accounts']) ? json_encode($data['debit_accounts']) : null,
            'credit_accounts' => isset($data['credit_accounts']) ? json_encode($data['credit_accounts']) : null,
            'is_system' => \Illuminate\Support\Facades\DB::raw('false'),
            'is_active' => \Illuminate\Support\Facades\DB::raw(($data['is_active'] ?? true) ? 'true' : 'false'),
            'is_default' => \Illuminate\Support\Facades\DB::raw(($data['is_default'] ?? false) ? 'true' : 'false'),
            'sort_order' => $data['sort_order'] ?? ($maxOrder + 1),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return static::find($id);
    }
}
