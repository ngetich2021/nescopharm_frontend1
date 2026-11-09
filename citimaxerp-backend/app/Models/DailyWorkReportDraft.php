<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DailyWorkReportDraft extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['company_id', 'employee_id', 'user_id', 'report_date', 'entries', 'key_achievements', 'pending_work'];

    protected $casts = [
        'report_date' => 'date',
        'entries' => 'array',
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

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /** Whether anything has been typed in it. */
    public function hasContent(): bool
    {
        $typed = collect($this->entries ?? [])->contains(fn ($e) => trim((string) ($e['activity'] ?? '')) !== '');
        return $typed || trim((string) $this->key_achievements) !== '' || trim((string) $this->pending_work) !== '';
    }
}
