<?php

namespace App\Http\Controllers;

use App\Models\EmployeeAllowance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class EmployeeAllowanceController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    // -------------------------------------------------------------------------
    // GET /employees/{employeeId}/allowances
    // -------------------------------------------------------------------------

    public function index(Request $request, string $employeeId): JsonResponse
    {
        try {
            $allowances = EmployeeAllowance::where('employee_id', $employeeId)
                ->orderByDesc('created_at')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowances retrieved successfully.',
                'data' => $allowances,
            ]);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@index: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve employee allowances.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // POST /employees/{employeeId}/allowances
    // -------------------------------------------------------------------------

    public function store(Request $request, string $employeeId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'type' => 'required|in:allowance,deduction',
            'amount' => 'required|numeric|min:0',
            'frequency' => 'required|string',
            'is_taxable' => 'required|boolean',
            'effective_from' => 'required|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        try {
            $companyId = $request->user()->company_id;

            $allowance = EmployeeAllowance::create(array_merge(
                $validator->validated(),
                [
                    'employee_id' => $employeeId,
                    'company_id' => $companyId,
                    'is_active' => true,
                ]
            ));

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowance created successfully.',
                'data' => $allowance,
            ], 201);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@store: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create employee allowance.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // PUT /employees/{employeeId}/allowances/{id}
    // -------------------------------------------------------------------------

    public function update(Request $request, string $employeeId, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'type' => 'sometimes|required|in:allowance,deduction',
            'amount' => 'sometimes|required|numeric|min:0',
            'frequency' => 'sometimes|required|string',
            'is_taxable' => 'sometimes|required|boolean',
            'effective_from' => 'sometimes|required|date',
            'effective_to' => 'nullable|date|after_or_equal:effective_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 400);
        }

        try {
            $allowance = EmployeeAllowance::where('employee_id', $employeeId)
                ->where('id', $id)
                ->first();

            if (!$allowance) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Employee allowance not found.',
                ], 404);
            }

            $allowance->update($validator->validated());

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowance updated successfully.',
                'data' => $allowance->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@update: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update employee allowance.',
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // DELETE /employees/{employeeId}/allowances/{id}
    // -------------------------------------------------------------------------

    public function destroy(string $employeeId, string $id): JsonResponse
    {
        try {
            $allowance = EmployeeAllowance::where('employee_id', $employeeId)
                ->where('id', $id)
                ->first();

            if (!$allowance) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Employee allowance not found.',
                ], 404);
            }

            $allowance->update(['is_active' => false]);

            return response()->json([
                'status' => 'success',
                'message' => 'Employee allowance deactivated successfully.',
                'data' => $allowance->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error('EmployeeAllowanceController@destroy: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to deactivate employee allowance.',
            ], 500);
        }
    }
}
