<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class JournalEntry extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'entry_number',
        'entry_date',
        'reference',
        'description',
        'total_debit',
        'total_credit',
        'status',
        'entry_type',
        'source_id',
        'source_type',
        'created_by',
        'posted_by',
        'posted_at',
        'reversed_by',
        'reversed_at',
        'reversal_reason',
        'metadata',
    ];

    protected $casts = [
        'entry_date' => 'date',
        'total_debit' => 'decimal:2',
        'total_credit' => 'decimal:2',
        'posted_at' => 'datetime',
        'reversed_at' => 'datetime',
        'metadata' => 'array',
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
        });
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function items()
    {
        return $this->hasMany(JournalEntryItem::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function postedBy()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    public function reversedBy()
    {
        return $this->belongsTo(User::class, 'reversed_by');
    }

    // Helper methods
    public function isBalanced()
    {
        return abs($this->total_debit - $this->total_credit) < 0.01;
    }

    public function post()
    {
        if ($this->status === 'posted') {
            throw new \Exception('Journal entry is already posted');
        }

        if (!$this->isBalanced()) {
            throw new \Exception('Journal entry is not balanced');
        }

        $this->update([
            'status' => 'posted',
            'posted_by' => auth()->id(),
            'posted_at' => now(),
        ]);
    }

    public function reverse($reason = null)
    {
        if ($this->status !== 'posted') {
            throw new \Exception('Only posted entries can be reversed');
        }

        $this->update([
            'status' => 'reversed',
            'reversed_by' => auth()->id(),
            'reversed_at' => now(),
            'reversal_reason' => $reason,
        ]);
    }

    // Scopes
    public function scopePosted($query)
    {
        return $query->where('status', 'posted');
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('entry_date', [$startDate, $endDate]);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('entry_type', $type);
    }
}
