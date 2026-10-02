<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class JournalEntryItem extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'journal_entry_id',
        'account_id',
        'company_id',
        'description',
        'debit_amount',
        'credit_amount',
        'contact_id',
        'contact_type',
        'reference',
        'metadata',
    ];

    protected $casts = [
        'debit_amount' => 'decimal:2',
        'credit_amount' => 'decimal:2',
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
    public function journalEntry()
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function account()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    public function chartOfAccount()
    {
        return $this->belongsTo(ChartOfAccount::class, 'account_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function contact()
    {
        return $this->morphTo();
    }

    // Helper methods
    public function getAmountAttribute()
    {
        return $this->debit_amount ?: $this->credit_amount;
    }

    public function getTypeAttribute()
    {
        return $this->debit_amount > 0 ? 'debit' : 'credit';
    }

    // Scopes
    public function scopeDebits($query)
    {
        return $query->where('debit_amount', '>', 0);
    }

    public function scopeCredits($query)
    {
        return $query->where('credit_amount', '>', 0);
    }

    public function scopeByAccount($query, $accountId)
    {
        return $query->where('account_id', $accountId);
    }

    public function scopeByContact($query, $contactId, $contactType = null)
    {
        $query = $query->where('contact_id', $contactId);
        
        if ($contactType) {
            $query->where('contact_type', $contactType);
        }
        
        return $query;
    }
}
