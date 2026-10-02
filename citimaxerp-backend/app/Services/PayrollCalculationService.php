<?php

namespace App\Services;

use App\Models\PayrollConfiguration;
use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class PayrollCalculationService
{
    private $config;
    
    public function __construct()
    {
        // Load configuration from database; warn and fall back to built-in defaults
        // if no active configuration record exists.
        $this->config = PayrollConfiguration::getCurrentConfig();
        if (!$this->config) {
            Log::warning(
                'No active PayrollConfiguration found in the database. ' .
                'Payroll calculations are using built-in default rates. ' .
                'Please create a configuration record via the Payroll Configuration management page.'
            );
            $this->config = $this->getDefaultConfig();
        }
    }

    private function getDefaultConfig()
    {
        return (object) [
            'tax_bands' => [
                ['lower_limit' => 0, 'upper_limit' => 24000, 'rate' => 0.10],
                ['lower_limit' => 24000, 'upper_limit' => 35000, 'rate' => 0.20],
                ['lower_limit' => 35000, 'upper_limit' => 50000, 'rate' => 0.25],
                ['lower_limit' => 50000, 'upper_limit' => 80000, 'rate' => 0.30],
                ['lower_limit' => 80000, 'upper_limit' => 500000, 'rate' => 0.325],
                ['lower_limit' => 500000, 'upper_limit' => null, 'rate' => 0.35]
            ],
            'personal_relief' => 2400,
            'nssf_tiers' => [
                'tier1' => ['limit' => 7000, 'rate' => 0.06],
                'tier2' => ['limit' => 36000, 'rate' => 0.06]
            ],
            'shif_rates' => [
                'standard' => 0.0275,
                'minimum' => 300
            ],
            'overtime_rates' => [
                'regular' => 1.5,
                'weekend' => 2.0,
                'holiday' => 2.5
            ],
            'minimum_wages' => [
                'nairobi' => [
                    'unskilled' => 15120,
                    'semi_skilled' => 18275,
                    'skilled' => 28000
                ],
                'other' => [
                    'unskilled' => 13572,
                    'semi_skilled' => 16425,
                    'skilled' => 25200
                ]
            ]
        ];
    }

    public function calculatePAYE($taxableIncome, $employeeStatutoryDetails = null)
    {
        $tax = 0;
        $remainingIncome = $taxableIncome;

        // Handle both object and array config formats
        $taxBands = is_object($this->config) ? $this->config->tax_bands : $this->config['tax_bands'];
        
        foreach ($taxBands as $band) {
            if ($remainingIncome <= 0) break;
            
            $upperLimit = $band['upper_limit'] ?? PHP_FLOAT_MAX;
            $taxableAmount = min(
                $remainingIncome, 
                $upperLimit - ($band['lower_limit'] ?? 0)
            );
            
            $tax += $taxableAmount * $band['rate'];
            $remainingIncome -= $taxableAmount;
        }

        // Apply personal relief and other tax benefits
        $relief = is_object($this->config) ? $this->config->personal_relief : $this->config['personal_relief'];
        
        if ($employeeStatutoryDetails) {
            // Add disability exemption if applicable
            if (isset($employeeStatutoryDetails->disability_exemption_certificate) && $employeeStatutoryDetails->disability_exemption_certificate) {
                $relief += $employeeStatutoryDetails->disability_exemption_amount ?? 0;
            }
        }

        return max(0, $tax - $relief);
    }

    public function calculateNSSF($basicSalary)
    {
        $tiers = is_object($this->config) ? $this->config->nssf_tiers : $this->config['nssf_tiers'];
        
        $tierI = min(
            $tiers['tier1']['limit'], 
            $basicSalary * $tiers['tier1']['rate']
        );
        
        $tierII = min(
            $tiers['tier2']['limit'],
            $basicSalary * $tiers['tier2']['rate']
        );
        
        return [
            'tier1' => $tierI,
            'tier2' => $tierII,
            'total' => $tierI + $tierII,
            'employer_contribution' => $tierI + $tierII // Equal contribution
        ];
    }

    public function calculateSHIF($grossPay)
    {
        $shifRates = is_object($this->config) ? $this->config->shif_rates : $this->config['shif_rates'];
        $rate = $shifRates['standard'];
        $minimum = $shifRates['minimum'];
        
        return max($minimum, $grossPay * $rate);
    }

    public function calculateOvertime($hours, $regularRate, $type = 'regular')
    {
        $overtimeRates = is_object($this->config) ? $this->config->overtime_rates : $this->config['overtime_rates'];
        $multiplier = $overtimeRates[$type] ?? $overtimeRates['regular'];
                     
        return $hours * $regularRate * $multiplier;
    }

    public function calculateGrossPay($basicSalary, $allowances, $overtimeDetails = null)
    {
        $gross = $basicSalary;

        // Add allowances
        foreach ($allowances as $allowance) {
            $gross += $allowance['amount'];
        }

        // Add overtime if provided
        if ($overtimeDetails) {
            $overtimeRates       = is_object($this->config) ? $this->config->overtime_rates : $this->config['overtime_rates'];
            $standardMonthlyHours = (float) ($overtimeRates['standard_monthly_hours'] ?? 176);
            $hourlyRate = $basicSalary / $standardMonthlyHours;
            $overtime = $this->calculateOvertime(
                $overtimeDetails['hours'],
                $hourlyRate,
                $overtimeDetails['type']
            );
            $gross += $overtime;
        }

        return $gross;
    }

    public function calculateNetPay($grossPay, $employee, $additionalDeductions = [])
    {
        $statutoryDetails = $employee->statutoryDetails;
        
        // Calculate statutory deductions
        $paye = $this->calculatePAYE($grossPay, $statutoryDetails);
        $nssf = $this->calculateNSSF($employee->basic_salary)['total'];
        $shif = $this->calculateSHIF($grossPay);
        
        $totalDeductions = $paye + $nssf + $shif;

        // Add any additional deductions
        foreach ($additionalDeductions as $deduction) {
            $totalDeductions += $deduction['amount'];
        }

        return $grossPay - $totalDeductions;
    }

    public function validateMinimumWage($salary, $region, $skillLevel)
    {
        $minimumWages = is_object($this->config) ? $this->config->minimum_wages : $this->config['minimum_wages'];
        $minimumWage = $minimumWages[$region][$skillLevel] ?? null;
        
        if (!$minimumWage) {
            throw new \Exception("No minimum wage defined for {$region} - {$skillLevel}");
        }
        
        return $salary >= $minimumWage;
    }

    public function getPayrollSummary($employee, $payPeriod)
    {
        $basicSalary = $employee->basic_salary;
        $allowances = $employee->allowances;
        $grossPay = $this->calculateGrossPay($basicSalary, $allowances);
        
        $statutoryDetails = $employee->statutoryDetails;
        $paye = $this->calculatePAYE($grossPay, $statutoryDetails);
        $nssf = $this->calculateNSSF($basicSalary);
        $shif = $this->calculateSHIF($grossPay);
        
        return [
            'pay_period' => $payPeriod,
            'employee_id' => $employee->id,
            'basic_salary' => $basicSalary,
            'allowances' => $allowances,
            'gross_pay' => $grossPay,
            'deductions' => [
                'paye' => $paye,
                'nssf' => $nssf,
                'shif' => $shif,
                'total' => $paye + $nssf['total'] + $shif
            ],
            'net_pay' => $grossPay - ($paye + $nssf['total'] + $shif),
            'employer_contributions' => [
                'nssf' => $nssf['employer_contribution'],
                'shif' => $shif // Assuming equal contribution
            ]
        ];
    }
}