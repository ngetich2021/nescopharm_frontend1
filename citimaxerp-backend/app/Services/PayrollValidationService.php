<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PayrollConfiguration;

class PayrollValidationService
{
    private $config;
    
    public function __construct()
    {
        $this->config = PayrollConfiguration::getCurrentConfig();
    }

    public function validateEmployeeStatutoryCompliance(Employee $employee)
    {
        $statutoryDetails = $employee->statutoryDetails;
        
        if (!$statutoryDetails) {
            return [
                'is_compliant' => false,
                'issues' => ['Statutory details not found']
            ];
        }

        $issues = [];
        
        if (empty($statutoryDetails->kra_pin)) {
            $issues[] = 'KRA PIN is missing';
        }
        
        if (empty($statutoryDetails->nssf_number)) {
            $issues[] = 'NSSF number is missing';
        }
        
        if (empty($statutoryDetails->shif_number)) {
            $issues[] = 'SHIF number is missing';
        }

        return [
            'is_compliant' => empty($issues),
            'issues' => $issues
        ];
    }

    public function validatePayrollPeriod($startDate, $endDate, Employee $employee)
    {
        $issues = [];
        
        // Check for overlapping pay periods
        $existingPayroll = $employee->payrollRecords()
            ->where(function ($query) use ($startDate, $endDate) {
                $query->whereBetween('pay_period_start', [$startDate, $endDate])
                    ->orWhereBetween('pay_period_end', [$startDate, $endDate]);
            })
            ->first();

        if ($existingPayroll) {
            $issues[] = 'Overlapping pay period found';
        }

        return [
            'is_valid' => empty($issues),
            'issues' => $issues
        ];
    }

    public function validateWorkingHours($regularHours, $overtimeHours)
    {
        $issues = [];
        $maxRegularHours = 52 * 4; // Maximum regular hours per month (52 hours per week * 4 weeks)
        
        if ($regularHours > $maxRegularHours) {
            $issues[] = "Regular hours exceed maximum allowed ({$maxRegularHours} hours per month)";
        }

        if ($overtimeHours > ($maxRegularHours / 2)) {
            $issues[] = 'Overtime hours exceed 50% of regular working hours';
        }

        return [
            'is_valid' => empty($issues),
            'issues' => $issues
        ];
    }

    public function validateDeductions($grossPay, $totalDeductions)
    {
        $issues = [];
        
        // Ensure deductions don't exceed 2/3 of gross pay as per Employment Act
        $maxDeductions = $grossPay * (2/3);
        
        if ($totalDeductions > $maxDeductions) {
            $issues[] = 'Total deductions exceed 2/3 of gross pay';
        }

        return [
            'is_valid' => empty($issues),
            'issues' => $issues
        ];
    }

    public function validateAllowances($allowances)
    {
        $issues = [];
        $allowedTypes = ['housing', 'transport', 'meal', 'medical', 'other'];
        
        foreach ($allowances as $allowance) {
            if (!isset($allowance['name']) || !isset($allowance['amount'])) {
                $issues[] = 'Invalid allowance format';
                continue;
            }
            
            if ($allowance['amount'] < 0) {
                $issues[] = 'Negative allowance amount not allowed';
            }
        }

        return [
            'is_valid' => empty($issues),
            'issues' => $issues
        ];
    }

    public function performFullValidation(Employee $employee, array $payrollData)
    {
        $issues = [];
        
        // Statutory compliance
        $statutoryCheck = $this->validateEmployeeStatutoryCompliance($employee);
        if (!$statutoryCheck['is_compliant']) {
            $issues['statutory'] = $statutoryCheck['issues'];
        }
        
        // Pay period
        $periodCheck = $this->validatePayrollPeriod(
            $payrollData['pay_period_start'],
            $payrollData['pay_period_end'],
            $employee
        );
        if (!$periodCheck['is_valid']) {
            $issues['period'] = $periodCheck['issues'];
        }
        
        // Working hours
        $hoursCheck = $this->validateWorkingHours(
            $payrollData['regular_hours'] ?? 0,
            $payrollData['overtime_hours'] ?? 0
        );
        if (!$hoursCheck['is_valid']) {
            $issues['hours'] = $hoursCheck['issues'];
        }
        
        // Allowances
        $allowancesCheck = $this->validateAllowances($payrollData['allowances'] ?? []);
        if (!$allowancesCheck['is_valid']) {
            $issues['allowances'] = $allowancesCheck['issues'];
        }

        return [
            'is_valid' => empty($issues),
            'issues' => $issues
        ];
    }
}