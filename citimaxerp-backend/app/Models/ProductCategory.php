<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductCategory extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'product_category_number',
        'description',
        'color',
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
        // Convert any truthy/falsy value to actual PostgreSQL boolean string
        if ($value === null) {
            $this->attributes['is_active'] = 'true'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_active'] = ($value === true || $value === 1 || $value === '1' || $value === 'true') ? 'true' : 'false';
        }
    }

    // Get boolean value as actual boolean when retrieving
    public function getIsActiveAttribute($value)
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

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }

    /**
     * Always return the short product category number when accessing product_category_number
     */
    public function getProductCategoryNumberAttribute($value)
    {
        // If product_category_number is like CAT-853b296e-0074, return CAT-0074
        if (preg_match('/^(CAT)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }
}
