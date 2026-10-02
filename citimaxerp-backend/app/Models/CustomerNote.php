<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CustomerNote extends Model
{
    protected $table = 'customer_notes';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = [
        'id',
        'customer_id',
        'note_content',
        'created_by',
        'company_id',
    ];

    protected $casts = [
        'id' => 'string',
        'customer_id' => 'string',
        'company_id' => 'string',
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