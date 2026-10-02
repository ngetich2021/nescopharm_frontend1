<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Employee extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_number',
        'first_name',
        'last_name',
        'email',
        'phone',
        'date_of_birth',
        'gender',
        'national_id',
        'kra_pin',
        'nssf_number',
        'shif_number',
        'address',
        'city',
        'state',
        'postal_code',
        'hire_date',
        'termination_date',
        'employment_type',
        'payment_frequency',
        'basic_salary',
        'hourly_rate',
        'bank_name',
        'bank_account',
        'bank_branch',
        'is_active',
        'department',
        'position',
        'supervisor_id',
        'leave_approver_id',
        'salary_advance_approver_id',
        'allowances',
        'deductions',
        'metadata',
        'created_by',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'hire_date' => 'date',
        'termination_date' => 'date',
        'basic_salary' => 'decimal:2',
        'hourly_rate' => 'decimal:2',
        // 'tax_dependents' => 'integer',
        'is_active' => 'boolean',
        'allowances' => 'array',
        'deductions' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = [
        'full_name',
        'employment_status',
    ];

    // Boolean mutator for PostgreSQL compatibility
    public function setIsActiveAttribute($value)
    {
        $this->attributes['is_active'] = $value === true || $value === 'true' || $value === 1 || $value === '1'
            ? 'true'
            : 'false';
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });

        static::saving(function ($model) {
            // Validate that termination_date is after hire_date
            if ($model->termination_date && $model->hire_date) {
                if ($model->termination_date < $model->hire_date) {
                    throw new \InvalidArgumentException(
                        "Termination date ({$model->termination_date}) cannot be before hire date ({$model->hire_date})"
                    );
                }
            }
        });
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

        public function statutoryDetails()
        {
            return $this->hasOne(EmployeeStatutoryDetail::class, 'employee_id');
        }

    // Relationships
    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function supervisor()
    {
        return $this->belongsTo(Employee::class, 'supervisor_id');
    }

    public function leaveApprover()
    {
        return $this->belongsTo(User::class, 'leave_approver_id');
    }

    public function salaryAdvanceApprover()
    {
        return $this->belongsTo(User::class, 'salary_advance_approver_id');
    }

    public function subordinates()
    {
        return $this->hasMany(Employee::class, 'supervisor_id');
    }

    public function payrollItems()
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function fixedAssets()
    {
        return $this->hasMany(FixedAsset::class, 'assigned_to');
    }

    // Helper methods
    public function getFullNameAttribute()
    {
        return trim(implode(' ', array_filter([$this->first_name, $this->last_name])));
    }

    public function getAgeAttribute()
    {
        return $this->date_of_birth ? $this->date_of_birth->age : null;
    }

    public function getTenureAttribute()
    {
        if (!$this->hire_date) {
            return null;
        }

        $endDate = $this->termination_date ?: now();
        return $this->hire_date->diffInDays($endDate);
    }

    public function calculatePAYE($grossPay, $personalRelief = 2400)
    {
        // Kenya PAYE rates for 2025
        $taxBands = [
            ['min' => 0, 'max' => 24000, 'rate' => 0.10],
            ['min' => 24001, 'max' => 32333, 'rate' => 0.25],
            ['min' => 32334, 'max' => 500000, 'rate' => 0.30],
            ['min' => 500001, 'max' => 800000, 'rate' => 0.325],
            ['min' => 800001, 'max' => PHP_INT_MAX, 'rate' => 0.35],
        ];

        $tax = 0;
        $remainingIncome = $grossPay;

        foreach ($taxBands as $band) {
            if ($remainingIncome <= 0) break;

            $taxableInBand = min($remainingIncome, $band['max'] - $band['min'] + 1);
            if ($grossPay >= $band['min']) {
                $tax += $taxableInBand * $band['rate'];
                $remainingIncome -= $taxableInBand;
            }
        }

        // Apply personal relief
        $tax = max(0, $tax - $personalRelief);

        return $tax;
    }

    public function calculateNSSF($grossPay)
    {
        // Kenya NSSF rates for 2025 - both employee and employer contribute
        $nssfRate = 0.06; // 6% each for employee and employer
        $maxNSSF = 2160; // Maximum monthly contribution
        
        return min($grossPay * $nssfRate, $maxNSSF);
    }

    public function calculateSHIF($grossPay)
    {
        // Kenya SHIF rates for 2025 based on actual salary bands (2.75% of gross salary)
        // SHIF is calculated as 2.75% of gross salary with defined bands
        $shifRates = [
            ['min' => 0, 'max' => 5999, 'amount' => 150],
            ['min' => 6000, 'max' => 7999, 'amount' => 300],
            ['min' => 8000, 'max' => 11999, 'amount' => 400],
            ['min' => 12000, 'max' => 14999, 'amount' => 500],
            ['min' => 15000, 'max' => 19999, 'amount' => 600],
            ['min' => 20000, 'max' => 24999, 'amount' => 750],
            ['min' => 25000, 'max' => 29999, 'amount' => 850],
            ['min' => 30000, 'max' => 34999, 'amount' => 950],
            ['min' => 35000, 'max' => 39999, 'amount' => 1000],
            ['min' => 40000, 'max' => 44999, 'amount' => 1100],
            ['min' => 45000, 'max' => 49999, 'amount' => 1200],
            ['min' => 50000, 'max' => 59999, 'amount' => 1300],
            ['min' => 60000, 'max' => 69999, 'amount' => 1400],
            ['min' => 70000, 'max' => 79999, 'amount' => 1500],
            ['min' => 80000, 'max' => 89999, 'amount' => 1600],
            ['min' => 90000, 'max' => 99999, 'amount' => 1700],
            ['min' => 100000, 'max' => PHP_INT_MAX, 'amount' => 1800],
        ];

        foreach ($shifRates as $band) {
            if ($grossPay >= $band['min'] && $grossPay <= $band['max']) {
                return $band['amount'];
            }
        }

        return 0;
    }

    public function terminate($terminationDate, $reason = null)
    {
        $this->update([
            'termination_date' => $terminationDate,
            'is_active' => false,
            'metadata' => array_merge($this->metadata ?? [], [
                'termination_reason' => $reason,
                'terminated_at' => now(),
            ]),
        ]);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->whereRaw('is_active = true');
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }

    public function scopeByDepartment($query, $department)
    {
        return $query->where('department', $department);
    }

    public function scopeByEmploymentType($query, $type)
    {
        return $query->where('employment_type', $type);
    }

    public function scopeBySupervisor($query, $supervisorId)
    {
        return $query->where('supervisor_id', $supervisorId);
    }

    /**
     * Always return the short employee number when accessing employee_number
     */
    public function getEmployeeNumberAttribute($value)
    {
        if (!$value) {
            return null;
        }

        // If employee_number is like EMP-853b296e-0074, return EMP-0074
        if (preg_match('/^(EMP)-(?:[\w-]+)-(\d{4})$/', $value, $matches)) {
            return $matches[1] . '-' . $matches[2];
        }
        // Fallback: return original
        return $value;
    }

    public function getEmploymentStatusAttribute(): string
    {
        if ($this->termination_date) {
            return 'terminated';
        }

        return $this->is_active ? 'active' : 'inactive';
    }
}
