<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerActivity extends Model
{
    protected $table = 'customer_activities';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'id',
        'customer_id',
        'company_id',
        'created_by',
        'activity_type',
        'title',
        'description',
        'start_time',
        'end_time',
        'location',
        'status',
        'assigned_to',
        'additional_info',
    ];

    protected $casts = [
        'id' => 'string',
        'customer_id' => 'string',
        'company_id' => 'string',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}