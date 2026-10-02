<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class AssetDepreciation extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'fixed_asset_id',
        'company_id',
        'depreciation_date',
        'depreciation_amount',
        'accumulated_depreciation',
        'book_value',
        'depreciation_type',
        'notes',
        'journal_entry_id',
    ];

    protected $casts = [
        'depreciation_date' => 'date',
        'depreciation_amount' => 'decimal:2',
        'accumulated_depreciation' => 'decimal:2',
        'book_value' => 'decimal:2',
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
    public function fixedAsset()
    {
        return $this->belongsTo(FixedAsset::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function journalEntry()
    {
        return $this->belongsTo(JournalEntry::class);
    }

    // Scopes
    public function scopeByAsset($query, $assetId)
    {
        return $query->where('fixed_asset_id', $assetId);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('depreciation_date', [$startDate, $endDate]);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('depreciation_type', $type);
    }
}
