<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpenseCategory extends Model
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

    /**
     * Get the company that owns the expense category.
     */
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the expenses for the category.
     */
    public function expenses()
    {
        return $this->hasMany(Expense::class, 'category_id');
    }

    // Boolean mutators for PostgreSQL compatibility
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

}
