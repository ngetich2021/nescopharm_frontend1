<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryLocation extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'customer_id',
        'house_number',
        'estate',
        'city',
        'street',
        'country',
        'is_default',
        'location_note',
        'landmark',
        'company_id',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'is_default' => 'boolean',
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

    public function orders()
    {
        return $this->hasMany(Order::class, 'delivery_location_id');
    }

    public function deliveryDetails()
    {
        return $this->hasMany(DeliveryDetail::class, 'delivery_location_id');
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsDefaultAttribute($value)
    {
        $this->attributes['is_default'] = $value === true || $value === 'true' || $value === 1 || $value === '1';
    }

}
