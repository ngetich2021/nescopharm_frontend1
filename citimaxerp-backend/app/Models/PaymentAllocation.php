<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentAllocation extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'payment_id',
        'invoice_id',
        'amount_allocated',
        'allocated_date',
        'notes',
    ];

    protected $casts = [
        'amount_allocated' => 'decimal:2',
        'allocated_date' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Boot method to generate UUID for primary key
     */
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid();
            }
        });
    }

    /**
     * Get the payment that owns this allocation
     */
    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    /**
     * Get the invoice that this allocation belongs to
     */
    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }
}
