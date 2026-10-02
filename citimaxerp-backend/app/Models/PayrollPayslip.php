<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollPayslip extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'payroll_run_id',
        'employee_id',
        'company_id',
        'gross_pay',
        'insurance_relief_premium',
        'allowances_json',
        'total_allowances',
        'deductions_json',
        'total_custom_deductions',
        'nssf_tier1',
        'nssf_tier2',
        'nssf_employee',
        'nssf_employer',
        'taxable_pay',
        'paye_before_relief',
        'personal_relief',
        'insurance_relief',
        'paye',
        'shif',
        'housing_levy_employee',
        'housing_levy_employer',
        'salary_advance_deduction',
        'other_deductions',
        'other_deductions_note',
        'total_deductions',
        'net_pay',
    ];

    protected $casts = [
        'gross_pay' => 'decimal:2',
        'insurance_relief_premium' => 'decimal:2',
        'allowances_json' => 'array',
        'total_allowances' => 'decimal:2',
        'deductions_json' => 'array',
        'total_custom_deductions' => 'decimal:2',
        'nssf_tier1' => 'decimal:2',
        'nssf_tier2' => 'decimal:2',
        'nssf_employee' => 'decimal:2',
        'nssf_employer' => 'decimal:2',
        'taxable_pay' => 'decimal:2',
        'paye_before_relief' => 'decimal:2',
        'personal_relief' => 'decimal:2',
        'insurance_relief' => 'decimal:2',
        'paye' => 'decimal:2',
        'shif' => 'decimal:2',
        'housing_levy_employee' => 'decimal:2',
        'housing_levy_employer' => 'decimal:2',
        'salary_advance_deduction' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'other_deductions_note' => 'string',
        'total_deductions' => 'decimal:2',
        'net_pay' => 'decimal:2',
    ];

    /**
     * Get the payroll run this payslip belongs to.
     */
    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    /**
     * Get the employee this payslip belongs to.
     */
    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the company this payslip belongs to.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
