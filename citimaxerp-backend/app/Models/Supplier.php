<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) \Illuminate\Support\Str::uuid();
            }
        });
    }

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'email',
        'phone',
        'address',
        'contact_person',
        'notes',
        'is_active',
        'bank_name',
        'bank_account_number',
        'bank_branch',
        'bank_swift_code',
        'payment_terms_type',
        'payment_terms_days',
        'payment_terms_description',
    ];

    // Ensure proper casting for PostgreSQL booleans & integers
    protected $casts = [
        'is_active' => 'boolean',
        'payment_terms_days' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Always return the short supplier code when accessing supplier_code
     */
    public function getSupplierCodeAttribute($value)
    {
        // If supplier_code is like SUP-853b296e-0074, return SUP-0074
        if (preg_match('/^(SUP)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
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
     * Get is_active as boolean when retrieving
     */
    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    // Relationships
    public function purchases()
    {
        return $this->hasMany(PurchaseOrder::class, 'supplier_id', 'id');
    }

    public function returns()
    {
        return $this->hasMany(PurchaseOrderReturn::class, 'supplier_id', 'id');
    }
}
