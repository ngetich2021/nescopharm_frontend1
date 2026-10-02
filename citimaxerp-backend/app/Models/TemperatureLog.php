<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class TemperatureLog extends Model
{
    protected $table = 'temperature_logs';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'thermometer_name',
        'area_room',
        'acceptance_max_celsius',
        'log_date',
        'morning_temp',
        'afternoon_temp',
        'checked_by',
        'remarks',
        'created_by',
    ];

    protected $casts = [
        'log_date' => 'date',
        'acceptance_max_celsius' => 'decimal:2',
        'morning_temp' => 'decimal:2',
        'afternoon_temp' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['is_out_of_range'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    /**
     * Whether either reading breached the acceptance ceiling.
     */
    public function getIsOutOfRangeAttribute(): bool
    {
        if ($this->acceptance_max_celsius === null) {
            return false;
        }

        return ($this->morning_temp !== null && (float) $this->morning_temp > (float) $this->acceptance_max_celsius)
            || ($this->afternoon_temp !== null && (float) $this->afternoon_temp > (float) $this->acceptance_max_celsius);
    }
}
