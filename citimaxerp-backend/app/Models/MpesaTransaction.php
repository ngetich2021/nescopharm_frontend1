<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MpesaTransaction extends Model
{
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'customer_id',
        'payment_id',
        'mpesa_code',
        'checkout_request_id',
        'merchant_request_id',
        'amount',
        'phone_number',
        'paybill_number',
        'till_number',
        'transaction_date',
        'transaction_type', // outgoing, incoming
        'status', // pending, completed, failed
        'description',
        'raw_response',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_date' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class, 'payment_id');
    }
}
