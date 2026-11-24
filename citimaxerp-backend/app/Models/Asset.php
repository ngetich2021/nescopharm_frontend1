<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Asset extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    /**
     * Straight-line book rates by asset class, from the Fixed Asset Register's Rates sheet
     * (24/11/2026): rate % a year, useful life in years, residual %, and the Asset ID prefix.
     */
    public const CLASSES = [
        'Computers & Laptops' => ['rate' => 33.3333, 'life' => 3, 'residual' => 0, 'prefix' => 'CMP'],
        'Printers' => ['rate' => 25, 'life' => 4, 'residual' => 0, 'prefix' => 'PRN'],
        'Furniture & Fittings' => ['rate' => 12.5, 'life' => 8, 'residual' => 0, 'prefix' => 'FUR'],
        'Office Equipment' => ['rate' => 12.5, 'life' => 8, 'residual' => 0, 'prefix' => 'OEQ'],
        'Machinery & Equipment' => ['rate' => 12.5, 'life' => 8, 'residual' => 0, 'prefix' => 'MCH'],
        'Material Handling Equipment' => ['rate' => 20, 'life' => 5, 'residual' => 0, 'prefix' => 'MHE'],
        'Security Equipment' => ['rate' => 20, 'life' => 5, 'residual' => 0, 'prefix' => 'SEC'],
        'Leasehold Improvements' => ['rate' => 10, 'life' => 10, 'residual' => 0, 'prefix' => 'LHI'],
    ];

    /**
     * Trading began 01/10/2025; assets bought before then depreciate from that date (the later of
     * purchase date and commencement), per the register's policy.
     */
    public const COMMENCEMENT_DATE = '2025-10-01';

    public const STATUSES = ['In Use', 'In Store', 'Under Repair', 'Missing', 'Disposed', 'Written Off'];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        // Line cost and per-piece cost stay consistent; class rates fill in what was left blank.
        static::saving(function (Asset $a) {
            $qty = max(1, (int) ($a->quantity ?: 1));
            if ($a->total_cost === null || $a->total_cost === ''
                || ($a->exists && $a->isDirty('purchase_cost') && !$a->isDirty('total_cost'))) {
                // Only a per-piece cost given (or changed): the line cost follows it.
                $a->total_cost = round((float) $a->purchase_cost * $qty, 2);
            } elseif ($a->isDirty(['total_cost', 'quantity']) || !$a->exists) {
                $a->purchase_cost = round((float) $a->total_cost / $qty, 2);
            }
            $class = self::CLASSES[$a->category] ?? null;
            if ($class) {
                if ($a->useful_life_years === null || $a->useful_life_years === '') {
                    $a->useful_life_years = $class['life'];
                }
                if ($a->depreciation_rate === null || $a->depreciation_rate === '') {
                    $a->depreciation_rate = $class['rate'];
                }
            }
            if (!$a->depreciation_start_date && $a->purchase_date) {
                $a->depreciation_start_date = max(Carbon::parse($a->purchase_date)->toDateString(), self::COMMENCEMENT_DATE);
            }
            $a->status = $a->status ?: 'In Use';
            $a->depreciation_method = $a->depreciation_method ?: 'straight_line';
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
        'asset_code',
        'tag_number',
        'assigned_to',
        'supplier',
        'invoice_number',
        'purchase_date',
        'date_basis',
        'total_cost',
        'depreciation_method',
        'depreciation_rate',
        'useful_life_years',
        'residual_percent',
        'depreciation_start_date',
        'status',
        'original_category',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'purchase_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'depreciation_rate' => 'decimal:4',
        'useful_life_years' => 'decimal:2',
        'residual_percent' => 'decimal:2',
        'purchase_date' => 'date:Y-m-d',
        'depreciation_start_date' => 'date:Y-m-d',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Straight-line depreciation as at a date: a full month is charged in the month depreciation
     * starts, and it stops once the asset is fully depreciated (Rates sheet policy).
     */
    public function depreciationAsAt($asAt = null): array
    {
        $asAt = $asAt ? Carbon::parse($asAt) : Carbon::today();
        $cost = (float) ($this->total_cost ?? ((float) $this->purchase_cost * max(1, (int) $this->quantity)));
        $residual = $cost * ((float) $this->residual_percent) / 100;
        $depreciable = max(0, $cost - $residual);
        $lifeMonths = (int) round(((float) $this->useful_life_years) * 12);
        $start = $this->depreciation_start_date ? Carbon::parse($this->depreciation_start_date) : null;

        $monthly = $lifeMonths > 0 ? $depreciable / $lifeMonths : 0;
        $months = 0;
        if ($start && $lifeMonths > 0 && $asAt->gte($start->copy()->startOfMonth())) {
            $months = min($lifeMonths, ($asAt->year - $start->year) * 12 + ($asAt->month - $start->month) + 1);
        }
        $accumulated = min($depreciable, $monthly * $months);
        $disposed = in_array($this->status, ['Disposed', 'Written Off'], true);

        return [
            'total_cost' => round($cost, 2),
            'depreciable_amount' => round($depreciable, 2),
            'annual_depreciation' => round($monthly * 12, 2),
            'monthly_depreciation' => round($monthly, 2),
            'months_depreciated' => $months,
            'accumulated_depreciation' => round($accumulated, 2),
            'net_book_value' => $disposed ? 0.0 : round($cost - $accumulated, 2),
            'fully_depreciated' => $lifeMonths > 0 && $months >= $lifeMonths,
            'as_at' => $asAt->toDateString(),
        ];
    }

    /** The asset with its depreciation figures as at a date, for the API. */
    public function withDepreciation($asAt = null): array
    {
        return array_merge($this->toArray(), $this->depreciationAsAt($asAt));
    }

    /** The next free Asset ID for a class, e.g. FUR-038. */
    public static function nextCode(string $companyId, ?string $category): ?string
    {
        $prefix = self::CLASSES[$category]['prefix'] ?? null;
        if (!$prefix) {
            return null;
        }
        $max = self::where('company_id', $companyId)->where('asset_code', 'like', "{$prefix}-%")->pluck('asset_code')
            ->map(fn ($c) => (int) substr($c, strlen($prefix) + 1))->max() ?? 0;
        return sprintf('%s-%03d', $prefix, $max + 1);
    }

    // PostgreSQL rejects integer->boolean coercion, so store/read is_active as
    // the native boolean string, mirroring the Supplier model.
    public function setIsActiveAttribute($value)
    {
        if ($value === null) {
            $this->attributes['is_active'] = 'true';
        } else {
            $this->attributes['is_active'] = $value ? true : false;
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
