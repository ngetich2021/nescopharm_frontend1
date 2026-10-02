<?php

namespace App\Http\Controllers;

use App\Models\Store;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class StoreController extends Controller
{
    /**
     * Initialize middleware for authentication and company scoping.
     */
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

    /**
     * Permissions whose owner needs to browse the store/location list as part
     * of their own workflow (picking a warehouse/branch on a purchase order,
     * expense, product receipt, stock count or product) even without full
     * Store Management rights.
     */
    protected const STORE_BROWSING_WORKFLOW_PERMISSIONS = [
        'can_view_stores',
        'can_create_purchase_orders',
        'can_update_purchase_orders',
        'can_create_product_receipts',
        'can_update_product_receipts',
        'can_create_stock_counts',
        'can_update_stock_counts',
        'can_create_expenses',
        'can_update_expenses',
        'can_create_products',
        'can_update_products',
    ];

    /**
     * List all active stores for the user's company.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $canBrowseStores = collect(self::STORE_BROWSING_WORKFLOW_PERMISSIONS)
            ->contains(fn ($permission) => $this->hasPermission($request, $permission, $user->company_id));

        if (!$canBrowseStores) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view stores.'
            ], 403);
        }
        $stores = Store::forCompany($user->company_id)
            ->active()
            ->with(['company'])
            ->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Stores retrieved successfully.',
            'stores' => $stores,
        ], 200);
    }

    /**
     * Create a new store.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'store_code' => 'nullable|string|max:50|unique:stores,store_code,NULL,id,company_id,' . $user->company_id,
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|regex:/^\+254[0-9]{9}$/',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'manager_name' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            return DB::transaction(function () use ($request, $user) {
                $store = Store::create([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'company_id' => $user->company_id, // Always use user's company_id
                    'name' => $request->input('name'),
                    'description' => $request->input('description'),
                    'store_code' => $request->input('store_code'),
                    'email' => $request->input('email'),
                    'phone' => $request->input('phone'),
                    'address' => $request->input('address'),
                    'city' => $request->input('city'),
                    'state' => $request->input('state'),
                    'country' => $request->input('country'),
                    'postal_code' => $request->input('postal_code'),
                    'manager_name' => $request->input('manager_name'),
                    'is_active' => $request->input('is_active', true),
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Store created successfully.',
                    'store' => $store->load('company'),
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create store', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create store: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing store.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $store = Store::find($id);
        if (!$store) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Store not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'store_code' => 'nullable|string|max:50|unique:stores,store_code,' . $store->id . ',id,company_id,' . $store->company_id,
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|regex:/^\+254[0-9]{9}$/',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'manager_name' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            return DB::transaction(function () use ($request, $store) {
                $store->update($request->only([
                    'name',
                    'description',
                    'store_code',
                    'email',
                    'phone',
                    'address',
                    'city',
                    'state',
                    'country',
                    'postal_code',
                    'manager_name',
                    'is_active',
                ]));

                return response()->json([
                    'status' => 'success',
                    'message' => 'Store updated successfully.',
                    'store' => $store->load('company'),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to update store', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update store: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Deactivate a store.
     *
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function deactivate($id)
    {
        $store = Store::find($id);
        if (!$store) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Store not found.',
            ], 404);
        }

        if (!$store->is_active) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Store is already deactivated.',
            ], 400);
        }

        try {
            return DB::transaction(function () use ($store) {
                $store->is_active = false;
                $store->save();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Store deactivated successfully.',
                    'store' => $store->load('company'),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to deactivate store', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to deactivate store: ' . $e->getMessage(),
            ], 500);
        }
    }
}
