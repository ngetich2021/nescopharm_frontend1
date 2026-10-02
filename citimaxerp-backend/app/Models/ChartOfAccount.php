<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ChartOfAccount extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'parent_id',
        'account_code',
        'account_name',
        'account_type',
        'account_subtype',
        'description',
        'is_active',
        'is_system_account',
        'opening_balance',
        'normal_balance',
        'tax_code',
        'level',
        'full_path',
    ];

    protected $casts = [
        'opening_balance' => 'decimal:2',
        'is_active' => 'boolean',
        'is_system_account' => 'boolean',
        'level' => 'integer',
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

        static::saving(function ($model) {
            // Update level and full_path when saving
            $model->updateHierarchyData();
        });
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function parent()
    {
        return $this->belongsTo(ChartOfAccount::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(ChartOfAccount::class, 'parent_id');
    }

    public function journalEntryItems()
    {
        return $this->hasMany(JournalEntryItem::class, 'account_id');
    }

    // Helper methods
    public function updateHierarchyData()
    {
        if ($this->parent_id) {
            $parent = $this->parent;
            $this->level = $parent->level + 1;
            $this->full_path = $parent->full_path . ' > ' . $this->account_name;
        } else {
            $this->level = 1;
            $this->full_path = $this->account_name;
        }
    }

    public function getFullAccountCodeAttribute()
    {
        return $this->parent_id ? $this->parent->account_code . '.' . $this->account_code : $this->account_code;
    }

    public function getCurrentBalance()
    {
        $totalDebits = $this->journalEntryItems()
            ->whereHas('journalEntry', function ($query) {
                $query->where('status', 'posted');
            })
            ->sum('debit_amount');

        $totalCredits = $this->journalEntryItems()
            ->whereHas('journalEntry', function ($query) {
                $query->where('status', 'posted');
            })
            ->sum('credit_amount');

        if ($this->normal_balance === 'debit') {
            return $this->opening_balance + $totalDebits - $totalCredits;
        } else {
            return $this->opening_balance + $totalCredits - $totalDebits;
        }
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('account_type', $type);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeTopLevel($query)
    {
        return $query->whereNull('parent_id');
    }

    // Boolean mutators for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean string
        if ($value === null) {
            $this->attributes['is_active'] = 'true'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_active'] = ($value === true || $value === 1 || $value === '1' || $value === 'true') ? 'true' : 'false';
        }
    }

    public function setIsSystemAccountAttribute($value)
    {
        // Convert any truthy/falsy value to actual PostgreSQL boolean string
        if ($value === null) {
            $this->attributes['is_system_account'] = 'false'; // Store as string for PostgreSQL
        } else {
            $this->attributes['is_system_account'] = ($value === true || $value === 1 || $value === '1' || $value === 'true') ? 'true' : 'false';
        }
    }

    // Get boolean values as actual booleans when retrieving
    public function getIsActiveAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    public function getIsSystemAccountAttribute($value)
    {
        return $value === 'true' || $value === true || $value === 1;
    }

    // Scopes for PostgreSQL boolean queries

    public function scopeForCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

}
