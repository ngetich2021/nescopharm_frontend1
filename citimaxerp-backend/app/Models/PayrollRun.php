<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use HasFactory, HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'pay_month',
        'pay_year',
        'status',
        'notes',
        'created_by',
        'approved_by',
        'approved_at',
        'paid_by',
        'paid_at',
    ];

    protected $casts = [
        'pay_month' => 'integer',
        'pay_year' => 'integer',
        'approved_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    /**
     * Get the company that owns this payroll run.
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Get the user who created this payroll run.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the payslips for this payroll run.
     */
    public function payslips(): HasMany
    {
        return $this->hasMany(PayrollPayslip::class, 'payroll_run_id');
    }

    /**
     * Get the cached payslips count.
     */
    public function getPayslipsCountAttribute(): int
    {
        return $this->payslips()->count();
    }

    /**
     * Get aggregated totals from all payslips in this payroll run.
     */
    public function getTotalsAttribute(): array
    {
        $totals = $this->payslips()
            ->selectRaw('
                SUM(gross_pay) as gross,
                SUM(net_pay) as net,
                SUM(nssf_employee) as nssf_employee,
                SUM(nssf_employer) as nssf_employer,
                SUM(paye) as paye,
                SUM(shif) as shif,
                SUM(housing_levy_employee) as housing_levy,
                SUM(total_custom_deductions) as deductions,
                SUM(salary_advance_deduction) as advance_deductions
            ')
            ->first();

        return [
            'gross' => (float) ($totals->gross ?? 0),
            'net' => (float) ($totals->net ?? 0),
            'nssf_employee' => (float) ($totals->nssf_employee ?? 0),
            'nssf_employer' => (float) ($totals->nssf_employer ?? 0),
            'paye' => (float) ($totals->paye ?? 0),
            'shif' => (float) ($totals->shif ?? 0),
            'housing_levy' => (float) ($totals->housing_levy ?? 0),
            'deductions' => (float) ($totals->deductions ?? 0),
            'advance_deductions' => (float) ($totals->advance_deductions ?? 0),
        ];
    }
}
