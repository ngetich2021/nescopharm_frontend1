<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class FixedAsset extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'asset_number',
        'asset_name',
        'description',
        'asset_category',
        'purchase_date',
        'purchase_cost',
        'residual_value',
        'useful_life_years',
        'depreciation_method',
        'depreciation_rate',
        'accumulated_depreciation',
        'book_value',
        'status',
        'disposal_date',
        'disposal_amount',
        'disposal_reason',
        'location',
        'serial_number',
        'model',
        'manufacturer',
        'warranty_expiry',
        'assigned_to',
        'created_by',
        'metadata',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'purchase_cost' => 'decimal:2',
        'residual_value' => 'decimal:2',
        'useful_life_years' => 'integer',
        'depreciation_rate' => 'decimal:2',
        'accumulated_depreciation' => 'decimal:2',
        'book_value' => 'decimal:2',
        'disposal_date' => 'date',
        'disposal_amount' => 'decimal:2',
        'warranty_expiry' => 'date',
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
            
            // Set initial book value
            $model->book_value = $model->purchase_cost;
        });
    }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function assignedTo()
    {
        return $this->belongsTo(Employee::class, 'assigned_to');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function depreciations()
    {
        return $this->hasMany(AssetDepreciation::class);
    }

    // Helper methods
    public function calculateMonthlyDepreciation()
    {
        if ($this->depreciation_method === 'straight_line') {
            return ($this->purchase_cost - $this->residual_value) / ($this->useful_life_years * 12);
        } elseif ($this->depreciation_method === 'reducing_balance') {
            $rate = $this->depreciation_rate / 100 / 12; // Monthly rate
            return $this->book_value * $rate;
        }
        
        return 0;
    }

    public function calculateAnnualDepreciation()
    {
        if ($this->depreciation_method === 'straight_line') {
            return ($this->purchase_cost - $this->residual_value) / $this->useful_life_years;
        } elseif ($this->depreciation_method === 'reducing_balance') {
            $rate = $this->depreciation_rate / 100;
            return $this->book_value * $rate;
        }
        
        return 0;
    }

    public function recordDepreciation($amount, $date = null, $type = 'monthly')
    {
        $date = $date ?: now()->format('Y-m-d');
        
        $depreciation = AssetDepreciation::create([
            'fixed_asset_id' => $this->id,
            'company_id' => $this->company_id,
            'depreciation_date' => $date,
            'depreciation_amount' => $amount,
            'accumulated_depreciation' => $this->accumulated_depreciation + $amount,
            'book_value' => $this->book_value - $amount,
            'depreciation_type' => $type,
        ]);

        // Update asset values
        $this->update([
            'accumulated_depreciation' => $this->accumulated_depreciation + $amount,
            'book_value' => $this->book_value - $amount,
        ]);

        return $depreciation;
    }

    public function dispose($disposalAmount, $disposalDate = null, $reason = null)
    {
        $disposalDate = $disposalDate ?: now()->format('Y-m-d');
        
        // Calculate gain/loss on disposal
        $gainLoss = $disposalAmount - $this->book_value;
        
        $this->update([
            'status' => 'disposed',
            'disposal_date' => $disposalDate,
            'disposal_amount' => $disposalAmount,
            'disposal_reason' => $reason,
            'metadata' => array_merge($this->metadata ?? [], [
                'gain_loss_on_disposal' => $gainLoss,
                'disposed_at' => now(),
            ]),
        ]);

        return $gainLoss;
    }

    public function getDepreciableAmountAttribute()
    {
        return $this->purchase_cost - $this->residual_value;
    }

    public function getRemainingLifeAttribute()
    {
        $monthsElapsed = now()->diffInMonths($this->purchase_date);
        $totalMonths = $this->useful_life_years * 12;
        return max(0, $totalMonths - $monthsElapsed);
    }

    public function getAgeInMonthsAttribute()
    {
        return now()->diffInMonths($this->purchase_date);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeByCategory($query, $category)
    {
        return $query->where('asset_category', $category);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeAssignedTo($query, $employeeId)
    {
        return $query->where('assigned_to', $employeeId);
    }

    public function scopeByLocation($query, $location)
    {
        return $query->where('location', $location);
    }

    /**
     * Always return the short asset number when accessing asset_number
     */
    public function getAssetNumberAttribute($value)
    {
        // If asset_number is like FA-853b296e-0074, return FA-0074
        if (preg_match('/^(FA)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }
}
