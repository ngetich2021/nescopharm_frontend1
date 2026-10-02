<?php

namespace App\Http\Controllers;

use App\Models\FixedAsset;
use App\Models\AssetDepreciation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class FixedAssetController extends Controller
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
        if (!$this->hasPermission($request, 'can_view_fixed_assets', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view fixed assets.',
            ], 403);
        }
        $query = FixedAsset::with(['company', 'depreciations']);
        $query->where('company_id', $user->company_id);

        // Filters
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('location')) {
            $query->where('location', 'ilike', '%' . $request->input('location') . '%');
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('asset_name', 'ilike', '%' . $search . '%')
                  ->orWhere('asset_tag', 'ilike', '%' . $search . '%')
                  ->orWhere('serial_number', 'ilike', '%' . $search . '%')
                  ->orWhere('description', 'ilike', '%' . $search . '%');
            });
        }

        $assets = $query->orderBy('asset_tag')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Fixed assets retrieved successfully.',
            'assets' => $assets,
        ], 200);
    }

    public function show(Request $request, $id)
    {
        $asset = FixedAsset::with(['company', 'depreciations'])->find($id);

        if (!$asset) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Fixed asset not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $asset->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this fixed asset.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Fixed asset retrieved successfully.',
            'asset' => $asset,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'asset_name' => 'required|string|max:255',
            'asset_tag' => 'required|string|max:100|unique:fixed_assets,asset_tag',
            'category' => 'required|in:building,equipment,furniture,vehicle,technology,other',
            'description' => 'nullable|string',
            'serial_number' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:100',
            'purchase_date' => 'required|date',
            'purchase_cost' => 'required|numeric|min:0',
            'useful_life_years' => 'required|integer|min:1',
            'depreciation_method' => 'required|in:straight_line,declining_balance,units_of_production',
            'salvage_value' => 'nullable|numeric|min:0',
            'location' => 'nullable|string|max:255',
            'custodian' => 'nullable|string|max:255',
            'warranty_expiry' => 'nullable|date',
            'insurance_policy' => 'nullable|string|max:100',
            'status' => 'required|in:active,disposed,sold,lost,maintenance',
            'company_id' => 'nullable|uuid|exists:companies,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_fixed_assets')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create fixed assets.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $asset = FixedAsset::create([
                'id' => (string) Str::uuid(),
                'company_id' => $request->input('company_id', $user->company_id),
                'asset_name' => $request->input('asset_name'),
                'asset_tag' => $request->input('asset_tag'),
                'category' => $request->input('category'),
                'description' => $request->input('description'),
                'serial_number' => $request->input('serial_number'),
                'model' => $request->input('model'),
                'manufacturer' => $request->input('manufacturer'),
                'purchase_date' => $request->input('purchase_date'),
                'purchase_cost' => $request->input('purchase_cost'),
                'useful_life_years' => $request->input('useful_life_years'),
                'depreciation_method' => $request->input('depreciation_method'),
                'salvage_value' => $request->input('salvage_value', 0),
                'accumulated_depreciation' => 0,
                'current_book_value' => $request->input('purchase_cost'),
                'location' => $request->input('location'),
                'custodian' => $request->input('custodian'),
                'warranty_expiry' => $request->input('warranty_expiry'),
                'insurance_policy' => $request->input('insurance_policy'),
                'status' => $request->input('status'),
            ]);

            DB::commit();

            $asset->load(['company', 'depreciations']);

            return response()->json([
                'status' => 'success',
                'message' => 'Fixed asset created successfully.',
                'asset' => $asset,
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error creating fixed asset', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create fixed asset.',
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $asset = FixedAsset::find($id);

        if (!$asset) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Fixed asset not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $asset->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this fixed asset.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_update_fixed_assets')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to edit fixed assets.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'asset_name' => 'sometimes|required|string|max:255',
            'asset_tag' => 'sometimes|required|string|max:100|unique:fixed_assets,asset_tag,' . $id,
            'category' => 'sometimes|required|in:building,equipment,furniture,vehicle,technology,other',
            'description' => 'nullable|string',
            'serial_number' => 'nullable|string|max:100',
            'model' => 'nullable|string|max:100',
            'manufacturer' => 'nullable|string|max:100',
            'purchase_date' => 'sometimes|required|date',
            'purchase_cost' => 'sometimes|required|numeric|min:0',
            'useful_life_years' => 'sometimes|required|integer|min:1',
            'depreciation_method' => 'sometimes|required|in:straight_line,declining_balance,units_of_production',
            'salvage_value' => 'nullable|numeric|min:0',
            'location' => 'nullable|string|max:255',
            'custodian' => 'nullable|string|max:255',
            'warranty_expiry' => 'nullable|date',
            'insurance_policy' => 'nullable|string|max:100',
            'status' => 'sometimes|required|in:active,disposed,sold,lost,maintenance',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $asset->update($request->only([
                'asset_name', 'asset_tag', 'category', 'description', 'serial_number',
                'model', 'manufacturer', 'purchase_date', 'purchase_cost',
                'useful_life_years', 'depreciation_method', 'salvage_value',
                'location', 'custodian', 'warranty_expiry', 'insurance_policy', 'status'
            ]));

            DB::commit();

            $asset->load(['company', 'depreciations']);

            return response()->json([
                'status' => 'success',
                'message' => 'Fixed asset updated successfully.',
                'asset' => $asset,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error updating fixed asset', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update fixed asset.',
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $asset = FixedAsset::find($id);

        if (!$asset) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Fixed asset not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $asset->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this fixed asset.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_delete_fixed_assets')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete fixed assets.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Check if asset has depreciation records
            if ($asset->depreciations()->count() > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete fixed asset with existing depreciation records.',
                ], 400);
            }

            $asset->delete();

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Fixed asset deleted successfully.',
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error deleting fixed asset', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete fixed asset.',
            ], 500);
        }
    }

    public function calculateDepreciation(Request $request, $id)
    {
        $asset = FixedAsset::find($id);

        if (!$asset) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Fixed asset not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $asset->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to calculate depreciation for this asset.',
            ], 403);
        }

        if (!$this->hasPermission($request, 'can_calculate_depreciation')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to calculate depreciation.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'depreciation_date' => 'required|date',
            'depreciation_type' => 'required|in:monthly,annual,adjustment',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::beginTransaction();

            $depreciationDate = Carbon::parse($request->input('depreciation_date'));
            $depreciationType = $request->input('depreciation_type');

            // Calculate depreciation amount based on method
            $depreciationAmount = $this->calculateDepreciationAmount($asset, $depreciationType);

            if ($depreciationAmount <= 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Asset is fully depreciated.',
                ], 400);
            }

            $newAccumulatedDepreciation = $asset->accumulated_depreciation + $depreciationAmount;
            $newBookValue = $asset->purchase_cost - $newAccumulatedDepreciation;

            // Ensure book value doesn't go below salvage value
            if ($newBookValue < $asset->salvage_value) {
                $depreciationAmount = $asset->current_book_value - $asset->salvage_value;
                $newAccumulatedDepreciation = $asset->accumulated_depreciation + $depreciationAmount;
                $newBookValue = $asset->salvage_value;
            }

            // Create depreciation record
            $depreciation = AssetDepreciation::create([
                'id' => (string) Str::uuid(),
                'fixed_asset_id' => $asset->id,
                'company_id' => $asset->company_id,
                'depreciation_date' => $depreciationDate,
                'depreciation_amount' => $depreciationAmount,
                'accumulated_depreciation' => $newAccumulatedDepreciation,
                'book_value' => $newBookValue,
                'depreciation_type' => $depreciationType,
            ]);

            // Update asset
            $asset->update([
                'accumulated_depreciation' => $newAccumulatedDepreciation,
                'current_book_value' => $newBookValue,
            ]);

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Depreciation calculated successfully.',
                'depreciation' => $depreciation,
                'updated_asset' => $asset->fresh(),
            ], 201);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error calculating depreciation', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to calculate depreciation.',
            ], 500);
        }
    }

    private function calculateDepreciationAmount($asset, $depreciationType)
    {
        $depreciableAmount = $asset->purchase_cost - $asset->salvage_value;
        $remainingValue = $asset->current_book_value - $asset->salvage_value;

        if ($remainingValue <= 0) {
            return 0;
        }

        switch ($asset->depreciation_method) {
            case 'straight_line':
                if ($depreciationType === 'monthly') {
                    return $depreciableAmount / ($asset->useful_life_years * 12);
                } elseif ($depreciationType === 'annual') {
                    return $depreciableAmount / $asset->useful_life_years;
                }
                break;

            case 'declining_balance':
                $rate = 2 / $asset->useful_life_years; // Double declining balance
                if ($depreciationType === 'monthly') {
                    return $asset->current_book_value * ($rate / 12);
                } elseif ($depreciationType === 'annual') {
                    return $asset->current_book_value * $rate;
                }
                break;

            case 'units_of_production':
                // This would require additional usage data
                return $depreciableAmount / ($asset->useful_life_years * 12);
        }

        return 0;
    }

    public function getCategories(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_fixed_assets')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view asset categories.',
            ], 403);
        }

        $categories = [
            'building' => 'Building',
            'equipment' => 'Equipment',
            'furniture' => 'Furniture',
            'vehicle' => 'Vehicle',
            'technology' => 'Technology',
            'other' => 'Other',
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Asset categories retrieved successfully.',
            'categories' => $categories,
        ], 200);
    }

    public function getDepreciationMethods(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_fixed_assets')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view depreciation methods.',
            ], 403);
        }

        $methods = [
            'straight_line' => 'Straight Line',
            'declining_balance' => 'Declining Balance',
            'units_of_production' => 'Units of Production',
        ];

        return response()->json([
            'status' => 'success',
            'message' => 'Depreciation methods retrieved successfully.',
            'methods' => $methods,
        ], 200);
    }
}
