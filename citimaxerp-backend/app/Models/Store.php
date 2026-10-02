<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Store extends Model

{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'description',
        'store_code',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'manager_name',
        'is_active',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Boolean mutator for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        if ($value === null) {
            $this->attributes['is_active'] = 'false';
        } else {
            $this->attributes['is_active'] = ($value === true || $value === 'true' || $value === 1 || $value === '1') ? 'true' : 'false';
        }
    }

        /**
     * Always return the short store code when accessing store_code
     */
    public function getStoreCodeAttribute($value)
    {
        // If store_code is like STO-853b296e-0074, return STO-0074
        if (preg_match('/^(STO)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    /**
     * Scope a query to only include active stores.
     */
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    /**
     * Scope a query to only include stores for a specific company.
     */
    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'store_id');
    }
}