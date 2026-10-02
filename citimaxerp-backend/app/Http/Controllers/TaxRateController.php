<?php

namespace App\Http\Controllers;

use App\Models\TaxRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TaxRateController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view tax rates.',
            ], 403);
        }

        $query = TaxRate::with('company');

        // Always default to user's company
        $companyId = $user->company_id;

        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }

        $query->where('company_id', $companyId);

        // Filters
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->input('is_active'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', '%' . $search . '%')
                    ->orWhere('code', 'ilike', '%' . $search . '%')
                    ->orWhere('description', 'ilike', '%' . $search . '%');
            });
        }

        $taxRates = $query->orderBy('code')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Tax rates retrieved successfully.',
            'tax_rates' => $taxRates,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $taxRate = TaxRate::with('company')->find($id);

        if (!$taxRate) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Tax rate not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $taxRate->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this tax rate.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Tax rate retrieved successfully.',
            'tax_rate' => $taxRate,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:tax_rates,code',
            'description' => 'nullable|string',
            'rate' => 'required|numeric|min:0|max:1',
            'type' => 'required|in:vat,sales_tax,service_tax,withholding_tax,excise_tax,other',
            'calculation_method' => 'required|in:percentage,fixed_amount,tiered',
            'calculation_rules' => 'nullable|array',
            'chart_of_account_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'is_active' => 'boolean',
            'effective_from' => 'required|date',
            'effective_to' => 'nullable|date|after:effective_from',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create tax rates.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $taxRate = TaxRate::create([
                'id' => (string) Str::uuid(),
                'company_id' => $request->input('company_id', $user->company_id),
                'name' => $request->input('name'),
                'code' => $request->input('code'),
                'description' => $request->input('description'),
                'rate' => $request->input('rate'),
                'type' => $request->input('type'),
                'calculation_method' => $request->input('calculation_method'),
                'calculation_rules' => $request->input('calculation_rules'),
                'chart_of_account_id' => $request->input('chart_of_account_id'),
                'is_active' => $request->input('is_active', true),
                'effective_from' => $request->input('effective_from'),
                'effective_to' => $request->input('effective_to'),
            ]);

            DB::commit();

            $taxRate->load('company');

            return response()->json([
                'status' => 'success',
                'message' => 'Tax rate created successfully.',
                'tax_rate' => $taxRate,
            ], 201);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating tax rate', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create tax rate.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $taxRate = TaxRate::find($id);

        if (!$taxRate) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Tax rate not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $taxRate->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this tax rate.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit tax rates.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|string|max:50|unique:tax_rates,code,' . $id,
            'description' => 'nullable|string',
            'rate' => 'sometimes|required|numeric|min:0|max:1',
            'type' => 'sometimes|required|in:vat,sales_tax,service_tax,withholding_tax,excise_tax,other',
            'calculation_method' => 'sometimes|required|in:percentage,fixed_amount,tiered',
            'calculation_rules' => 'nullable|array',
            'chart_of_account_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'is_active' => 'boolean',
            'effective_from' => 'sometimes|required|date',
            'effective_to' => 'nullable|date|after:effective_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $taxRate->update($request->only([
                'name',
                'code',
                'description',
                'rate',
                'type',
                'calculation_method',
                'calculation_rules',
                'chart_of_account_id',
                'is_active',
                'effective_from',
                'effective_to'
            ]));

            DB::commit();

            $taxRate->load('company');

            return response()->json([
                'status' => 'success',
                'message' => 'Tax rate updated successfully.',
                'tax_rate' => $taxRate,
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating tax rate', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update tax rate.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $taxRate = TaxRate::find($id);

        if (!$taxRate) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Tax rate not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, "can_manage_company", $taxRate->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this tax rate.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_delete_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete tax rates.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Check if tax rate is used in transactions
            // TODO: Add checks for chart of accounts, invoices, etc.

            $taxRate->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Tax rate deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting tax rate', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete tax rate.',
            ], 500);
        }
    }

    public function getTaxTypes(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view tax types.',
            ], 403);
        }

        $taxTypes = [
            'vat' => 'VAT',
            'sales_tax' => 'Sales Tax',
            'service_tax' => 'Service Tax',
            'withholding_tax' => 'Withholding Tax',
            'excise_tax' => 'Excise Tax',
            'other' => 'Other',
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Tax types retrieved successfully.',
            'tax_types' => $taxTypes,
        ], 200);
    }

    public function getByType(Request $request, $type)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view tax rates.',
            ], 403);
        }

        $validTypes = ['vat', 'sales_tax', 'service_tax', 'withholding_tax', 'excise_tax', 'other'];
        if (!in_array($type, $validTypes)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid tax type.',
            ], 400);
        }

        $query = TaxRate::where('type', $type)
            ->where('is_active', true);

        // Always default to user's company
        $companyId = $user->company_id;

        // If user has manage_all_finance permission and explicitly requests another company
        if ($this->hasPermission($request, 'can_manage_all_finance') && $request->filled('company_id')) {
            $companyId = $request->input('company_id');
        }

        $query->where('company_id', $companyId);

        $taxRates = $query->orderBy('code')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Tax rates retrieved successfully.',
            'tax_rates' => $taxRates,
        ], 200);
    }

    public function calculateTax(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tax_rate_id' => 'required|uuid|exists:tax_rates,id',
            'amount' => 'required|numeric|min:0',
            'calculation_details' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        if (!$this->hasPermission($request, 'can_view_tax_rates')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to calculate tax.',
            ], 403);
        }

        $taxRate = TaxRate::find($request->input('tax_rate_id'));
        $amount = $request->input('amount');

        if (!$this->hasPermission($request, "can_manage_company", $taxRate->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to use this tax rate.',
            ], 403);
        }

        $taxAmount = 0;

        switch ($taxRate->calculation_method) {
            case 'percentage':
                $taxAmount = $amount * $taxRate->rate;
                break;

            case 'fixed_amount':
                $taxAmount = $taxRate->rate;
                break;

            case 'tiered':
                // TODO: Implement tiered calculation based on calculation_rules
                $taxAmount = $amount * $taxRate->rate;
                break;
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Tax calculated successfully.',
            'calculation' => [
                'base_amount' => $amount,
                'tax_rate' => $taxRate->rate,
                'tax_amount' => round($taxAmount, 2),
                'total_amount' => round($amount + $taxAmount, 2),
                'tax_rate_details' => $taxRate,
            ],
        ], 200);
    }
}
