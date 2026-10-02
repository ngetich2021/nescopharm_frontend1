<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeStatutoryDetail;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class EmployeeService
{
    public function createEmployee(array $data, $companyId = null, $createdBy = null)
    {
        return DB::transaction(function () use ($data, $companyId, $createdBy) {
            // Set company_id from parameter if provided
            if ($companyId) {
                $data['company_id'] = $companyId;
            }
            // Create employee record
            $employeeId = (string) Str::uuid();
            $employeeNumber = $data['employee_number'] ?? null;
            if (empty($employeeNumber)) {
                $employeeNumber = $this->generateEmployeeNumber($data['company_id']);
            }
            
            $employmentStatus = $data['employment_status'] ?? null;
            $isActive = array_key_exists('is_active', $data)
                ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN)
                : true;

            if ($employmentStatus === 'inactive') {
                $isActive = false;
            }

            if ($employmentStatus === 'terminated') {
                $isActive = false;
                $data['termination_date'] = $data['termination_date'] ?? now()->toDateString();
            }

            $employeePayload = [
                'id' => $employeeId,
                'company_id' => $data['company_id'],
                'employee_number' => $employeeNumber,
                'first_name' => $data['first_name'] ?? null,
                'last_name' => $data['last_name'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'gender' => $data['gender'] ?? null,
                'national_id' => $data['national_id'] ?? null,
                'address' => $data['address'] ?? null,
                'city' => $data['city'] ?? null,
                'state' => $data['state'] ?? null,
                'postal_code' => $data['postal_code'] ?? null,
                'hire_date' => $data['hire_date'] ?? null,
                'termination_date' => $data['termination_date'] ?? null,
                'employment_type' => $data['employment_type'] ?? null,
                'payment_frequency' => $data['payment_frequency'] ?? null,
                'basic_salary' => $data['basic_salary'] ?? null,
                'hourly_rate' => $data['hourly_rate'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'bank_account' => $data['bank_account'] ?? null,
                'bank_branch' => $data['bank_branch'] ?? null,
                'is_active' => $isActive,
                'department' => $data['department'] ?? null,
                'position' => $data['position'] ?? null,
                'supervisor_id' => $data['supervisor_id'] ?? null,
                'allowances' => $data['allowances'] ?? [],
                'deductions' => $data['deductions'] ?? [],
                'created_by' => $createdBy,
            ];

            if ($this->hasEmployeeApproverColumns()) {
                $employeePayload['leave_approver_id'] = $data['leave_approver_id'] ?? null;
                $employeePayload['salary_advance_approver_id'] = $data['salary_advance_approver_id'] ?? null;
            }

            $employee = Employee::create($employeePayload);

            // Create statutory details
            $statutoryDetails = $data['statutory_details'] ?? null;
            if (is_array($statutoryDetails) && count(array_filter($statutoryDetails, fn ($value) => $value !== null && $value !== '')) > 0) {
                EmployeeStatutoryDetail::create([
                    'id' => (string) Str::uuid(),
                    'employee_id' => $employeeId,
                    'kra_pin' => $statutoryDetails['kra_pin'] ?? null,
                    'nssf_number' => $statutoryDetails['nssf_number'] ?? null,
                    'shif_number' => $statutoryDetails['shif_number'] ?? null,
                    'disability_exemption_certificate' => $statutoryDetails['disability_exemption_certificate'] ?? null,
                    'disability_exemption_amount' => $statutoryDetails['disability_exemption_amount'] ?? 0.00,
                ]);
            }

            return $employee->load('statutoryDetails');
        });
    }

    public function updateStatutoryDetails(Employee $employee, array $statutoryDetails)
    {
        return DB::transaction(function () use ($employee, $statutoryDetails) {
            $employee->statutoryDetails()->updateOrCreate(
                ['employee_id' => $employee->id],
                [
                    'kra_pin' => $statutoryDetails['kra_pin'] ?? null,
                    'nssf_number' => $statutoryDetails['nssf_number'] ?? null,
                    'shif_number' => $statutoryDetails['shif_number'] ?? null,
                    'disability_exemption_certificate' => $statutoryDetails['disability_exemption_certificate'] ?? null,
                    'disability_exemption_amount' => $statutoryDetails['disability_exemption_amount'] ?? 0.00,
                ]
            );

            return $employee->load('statutoryDetails');
        });
    }

    private function hasEmployeeApproverColumns(): bool
    {
        return Schema::hasColumn('employees', 'leave_approver_id')
            && Schema::hasColumn('employees', 'salary_advance_approver_id');
    }

    private function generateEmployeeNumber(string $companyId): string
    {
        $nextNumber = Employee::where('company_id', $companyId)->count() + 1;

        do {
            $employeeNumber = 'EMP-' . str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);
            $exists = Employee::where('company_id', $companyId)
                ->where('employee_number', $employeeNumber)
                ->exists();
            $nextNumber++;
        } while ($exists);

        return $employeeNumber;
    }
}
