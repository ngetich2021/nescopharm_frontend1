<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockCount extends Model

{
    protected $table = 'stock_counts';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'company_id',
        'store_id',
        'count_number',
        'name',
        'description',
        'count_type',
        'status',
        'location',
        'category_filter',
        'scheduled_date',
        'started_at',
        'completed_at',
        'approved_at',
        'created_by',
        'assigned_to',
        'approved_by',
        'total_products_expected',
        'total_products_counted',
        'total_variances',
        'total_variance_value',
    ];

    protected $casts = [
        'id' => 'string',
        'company_id' => 'string',
        'store_id' => 'string',
        'count_type' => 'string',
        'status' => 'string',
        'scheduled_date' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'approved_at' => 'datetime',
        'total_products_expected' => 'integer',
        'total_products_counted' => 'integer',
        'total_variances' => 'integer',
        'total_variance_value' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
 
        /**
     * Always return the short stock count number when accessing count_number
     */
    public function getCountNumberAttribute($value)
    {
        // If count_number is like SC-853b296e-0074, return SC-0074
        if (preg_match('/^(SC)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }
    
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function items()
    {
        return $this->hasMany(StockCountItem::class, 'stock_count_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'email');
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_to', 'email');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by', 'email');
    }
}