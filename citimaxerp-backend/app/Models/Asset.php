<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Asset extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'category',
        'serial_number',
        'location',
        'quantity',
        'purchase_cost',
        'notes',
        'is_active',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'purchase_cost' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // PostgreSQL rejects integer->boolean coercion, so store/read is_active as
    // the native boolean string, mirroring the Supplier model.
    public function setIsActiveAttribute($value)
    {
        if ($value === null) {
            $this->attributes['is_active'] = 'true';
        } else {
            $this->attributes['is_active'] = $value ? 'true' : 'false';
        }
    }

    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }
}
