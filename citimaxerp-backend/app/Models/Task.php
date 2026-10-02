<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $table = 'tasks';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'id',
        'customer_id',
        'title',
        'description',
        'due_date',
        'checklist',
        'status',
        'activity_type',
        'start_time',
        'end_time',
        'company_id',
    ];

    protected $casts = [
        'id' => 'string',
        'customer_id' => 'string',
        'company_id' => 'string',
        'checklist' => 'array',
        'due_date' => 'date',
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