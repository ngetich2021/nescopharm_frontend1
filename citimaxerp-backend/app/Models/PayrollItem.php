<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PayrollItem extends Model
{
    use HasFactory;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'payroll_record_id',
        'employee_id',
        'company_id',
        'basic_salary',
        'allowances',
        'overtime_amount',
        'bonus_amount',
        'gross_pay',
        'paye_amount',
        'nssf_amount',
        'shif_amount',
        'other_deductions',
        'total_deductions',
        'net_pay',
        'hours_worked',
        'overtime_hours',
        'days_worked',
        'leave_days',
        'allowance_breakdown',
        'deduction_breakdown',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'basic_salary' => 'decimal:2',
        'allowances' => 'decimal:2',
        'overtime_amount' => 'decimal:2',
        'bonus_amount' => 'decimal:2',
        'gross_pay' => 'decimal:2',
        'paye_amount' => 'decimal:2',
        'nssf_amount' => 'decimal:2',
        'shif_amount' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'net_pay' => 'decimal:2',
        'hours_worked' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'days_worked' => 'decimal:2',
        'leave_days' => 'decimal:2',
        'allowance_breakdown' => 'array',
        'deduction_breakdown' => 'array',
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
    public function payrollRecord()
    {
        return $this->belongsTo(PayrollRecord::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Helper methods
    public function calculateGrossPay()
    {
        $gross = $this->basic_salary + $this->allowances + $this->overtime_amount + $this->bonus_amount;
        $this->gross_pay = $gross;
        return $gross;
    }

    public function calculateDeductions()
    {
        $employee = $this->employee;
        $grossPay = $this->gross_pay;

        // Calculate statutory deductions
        $this->paye_amount = $employee->calculatePAYE($grossPay);
        $this->nssf_amount = $employee->calculateNSSF($grossPay);
        $this->shif_amount = $employee->calculateSHIF($grossPay);

        // Add other deductions
        $this->total_deductions = $this->paye_amount + $this->nssf_amount + 
                                 $this->shif_amount + $this->other_deductions;

        return $this->total_deductions;
    }

    public function calculateNetPay()
    {
        $this->net_pay = $this->gross_pay - $this->total_deductions;
        return $this->net_pay;
    }

    public function calculateAll()
    {
        $this->calculateGrossPay();
        $this->calculateDeductions();
        $this->calculateNetPay();
        $this->save();
    }

    public function generatePayslip()
    {
        return [
            'employee' => $this->employee,
            'payroll_period' => [
                'start' => $this->payrollRecord->pay_period_start,
                'end' => $this->payrollRecord->pay_period_end,
                'pay_date' => $this->payrollRecord->pay_date,
            ],
            'earnings' => [
                'basic_salary' => $this->basic_salary,
                'allowances' => $this->allowances,
                'overtime' => $this->overtime_amount,
                'bonus' => $this->bonus_amount,
                'gross_pay' => $this->gross_pay,
            ],
            'deductions' => [
                'paye' => $this->paye_amount,
                'nssf' => $this->nssf_amount,
                'shif' => $this->shif_amount,
                'other' => $this->other_deductions,
                'total' => $this->total_deductions,
            ],
            'net_pay' => $this->net_pay,
            'company' => $this->company,
        ];
    }

    // Scopes
    public function scopeByEmployee($query, $employeeId)
    {
        return $query->where('employee_id', $employeeId);
    }

    public function scopeByPayrollRecord($query, $payrollRecordId)
    {
        return $query->where('payroll_record_id', $payrollRecordId);
    }

    public function scopeByCompany($query, $companyId)
    {
        return $query->where('company_id', $companyId);
    }
}
