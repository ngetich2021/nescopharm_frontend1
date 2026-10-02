<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class CreateEmployeeRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        $rules = [
            // Basic Information
            'employee_number' => 'nullable|string|max:50|unique:employees,employee_number',
            'first_name' => 'nullable|string|max:100',
            'last_name' => 'nullable|string|max:100',
            'email' => 'nullable|email|unique:employees,email',
            'phone' => 'nullable|string|max:50',
            'date_of_birth' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'national_id' => 'nullable|string|max:50',
            
            // Employment Details
            'hire_date' => 'nullable|date',
            'termination_date' => 'nullable|date',
            'employment_type' => 'nullable|in:full_time,part_time,contract,intern',
            'payment_frequency' => 'nullable|in:weekly,bi_weekly,monthly',
            'basic_salary' => 'nullable|numeric|min:0',
            'hourly_rate' => 'nullable|numeric|min:0',
            'department' => 'nullable|string|max:100',
            'position' => 'nullable|string|max:100',
            'supervisor_id' => 'nullable|uuid|exists:employees,id',
            'is_active' => 'sometimes|boolean',
            'employment_status' => 'sometimes|in:active,inactive,terminated',
            
            // Address Information
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            
            // Banking Information
            'bank_name' => 'nullable|string|max:100',
            'bank_account' => 'nullable|string|max:50',
            'bank_branch' => 'nullable|string|max:100',
            
            // Statutory Information
            'statutory_details' => 'nullable|array',
            'statutory_details.kra_pin' => 'nullable|string|max:20|unique:employee_statutory_details,kra_pin',
            'statutory_details.nssf_number' => 'nullable|string|max:50|unique:employee_statutory_details,nssf_number',
            'statutory_details.shif_number' => 'nullable|string|max:50|unique:employee_statutory_details,shif_number',
            'statutory_details.has_disability' => 'sometimes|boolean',
            'statutory_details.disability_exemption_amount' => 'required_if:statutory_details.has_disability,true|numeric|min:0',
            'statutory_details.has_insurance_relief' => 'sometimes|boolean',
            'statutory_details.insurance_relief_amount' => 'required_if:statutory_details.has_insurance_relief,true|numeric|min:0|max:5000',
            'statutory_details.disability_exemption_certificate' => 'required_if:statutory_details.has_disability,true|string',
            
            // Additional Information
            'allowances' => 'nullable|array',
            'deductions' => 'nullable|array'
        ];

        if (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'leave_approver_id')) {
            $rules['leave_approver_id'] = 'nullable|uuid|exists:users,id';
        }

        if (\Illuminate\Support\Facades\Schema::hasColumn('employees', 'salary_advance_approver_id')) {
            $rules['salary_advance_approver_id'] = 'nullable|uuid|exists:users,id';
        }

        return $rules;
    }

    public function messages()
    {
        return [
            'statutory_details.disability_exemption_certificate.required_if' => 'Disability exemption certificate is required when disability status is enabled',
            'statutory_details.disability_exemption_amount.required_if' => 'Disability exemption amount is required when disability status is enabled',
            'statutory_details.insurance_relief_amount.required_if' => 'Insurance relief amount is required when insurance relief is enabled'
        ];
    }

    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(response()->json([
            'status' => 'failed',
            'message' => 'The given data was invalid.' . $validator->errors()->first(),
            'errors' => $validator->errors()
        ], 422));
    }
}
