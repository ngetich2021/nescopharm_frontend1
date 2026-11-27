<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * One month's posted depreciation journal (DEP/YYYY/MM), the Posting Log of the Monthly
 * Depreciation Journal workbook. A month is corrected by reversing the whole journal (status
 * reversed) and posting it again; only one posted run per month can exist.
 */
class DepreciationRun extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'company_id', 'period_end', 'posting_date', 'reference', 'narration', 'status', 'total_charge',
        'classes', 'assets', 'journal_entry_id', 'created_by', 'prepared_by_name', 'reviewed_by_name',
        'posted_at', 'reversed_by', 'reversed_at', 'reversal_reason',
    ];

    protected $casts = [
        'period_end' => 'date:Y-m-d',
        'posting_date' => 'date:Y-m-d',
        'total_charge' => 'decimal:2',
        'classes' => 'array',
        'assets' => 'array',
        'posted_at' => 'datetime',
        'reversed_at' => 'datetime',
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

    public function journalEntry()
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function reversedByUser()
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }
}
