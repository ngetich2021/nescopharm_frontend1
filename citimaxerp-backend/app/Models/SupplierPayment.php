<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SupplierPayment extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'supplier_id',
        'purchase_order_id',
        'payment_number',
        'amount',
        'payment_date',
        'payment_method',
        'transaction_reference',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }

            if (empty($model->payment_number)) {
                $model->payment_number = self::generatePaymentNumber($model->company_id);
            }
        });
    }

    public static function generatePaymentNumber($companyId)
    {
        $prefix = 'PV-' . date('Y'); // Payment Voucher
        $lastPayment = self::where('company_id', $companyId)
            ->where('payment_number', 'like', $prefix . '%')
            ->orderBy('payment_number', 'desc')
            ->first();

        if ($lastPayment) {
            $number = intval(substr($lastPayment->payment_number, -4)) + 1;
        } else {
            $number = 1;
        }

        return $prefix . '-' . str_pad($number, 4, '0', STR_PAD_LEFT);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }
}
