<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Debt extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'id',
        'customer_id',
        'order_id',
        'company_id',
        'amount',
        'status',
        'due_date',
        'notes',
        'payment_id',
    ];

    public $incrementing = false;
    protected $keyType = 'string';

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }
}
