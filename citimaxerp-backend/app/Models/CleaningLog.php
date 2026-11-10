<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * One line of the cleaning services sheet: when it was cleaned, which areas, by whom - recorded by the
 * store manager (prepared by) and confirmed with a comment by the person they picked (checked by).
 */
class CleaningLog extends Model
{
    protected $table = 'cleaning_logs';
    public $incrementing = false;
    protected $keyType = 'string';

    public const STATUS_PENDING = 'pending';
    public const STATUS_CHECKED = 'checked';

    protected $fillable = [
        'id', 'company_id', 'cleaning_date', 'start_time', 'end_time', 'areas', 'cleaned_by', 'remarks',
        'prepared_by_user_id', 'prepared_by_name', 'checker_user_id', 'checker_name',
        'status', 'checker_comment', 'checked_at',
    ];

    protected $casts = [
        'cleaning_date' => 'date:Y-m-d',
        'checked_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }
}
