<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class DeliveryInvoice extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'company_id',
        'order_dispatch_id',
        'delivery_rate_id',
        'invoice_number',
        'transporter_invoice_number',
        'transporter_name',
        'zone',
        'number_of_cartons',
        'rate_per_carton',
        'total_amount',
        'status',
        'payment_method',
        'payment_reference',
        'payment_date',
        'cheque_number',
        'bank_name',
        'cheque_maturity_date',
        'amount_paid',
        'paid_by',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'payment_date' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function orderDispatch()
    {
        return $this->belongsTo(OrderDispatch::class);
    }

    public function deliveryRate()
    {
        return $this->belongsTo(DeliveryRate::class);
    }

    public function logistic()
    {
        return $this->hasOne(Logistic::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function paidBy()
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function markAsPaid($userId, $paymentMethod, $paymentReference = null, $paymentDate = null)
    {
        $this->update([
            'status' => 'paid',
            'payment_method' => $paymentMethod,
            'payment_reference' => $paymentReference,
            'payment_date' => $paymentDate ?? now(),
            'amount_paid' => $this->total_amount,
            'paid_by' => $userId,
        ]);
    }

    public function cancel()
    {
        $this->update(['status' => 'cancelled']);
    }
}
