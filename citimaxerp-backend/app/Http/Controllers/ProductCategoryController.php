<?php

namespace App\Http\Controllers;

use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductCategoryController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Ensure the user is authenticated.
     * Returns JSON error response if not authenticated.
     */
    protected function ensureAuthenticated(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please provide a valid authentication token.'
            ], 401);
        }
        return null;
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        if (!$user) {
            return false;
        }
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

    protected function canManageCompany(Request $request, $resourceCompanyId)
    {
        $user = $request->user();
        if (!$user) {
            return false;
        }
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            return $user->company_id === $resourceCompanyId;
        }
        return false;
    }

    public function index(Request $request)
    {
        // Ensure user is authenticated
        if ($authError = $this->ensureAuthenticated($request)) {
            return $authError;
        }

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_product_categories', $user->company_id)) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view product categories.'], 403);
        }
        try {
            $query = ProductCategory::query();
            $query->where('company_id', $user->company_id);
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active') ? 'true' : 'false');
            }
            if ($request->filled('search')) {
                $query->where('name', 'ilike', '%' . $request->input('search') . '%');
            }
            $query->orderBy($request->input('sort_by', 'name'), $request->input('sort_direction', 'asc'));
            $categories = $query->get();
            return response()->json(['status' => 'success', 'message' => 'Product categories retrieved successfully.', 'categories' => $categories], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve product categories', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to retrieve product categories: ' . $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        // Ensure user is authenticated
        if ($authError = $this->ensureAuthenticated($request)) {
            return $authError;
        }

        if (!$this->hasPermission($request, 'can_create_product_categories')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to create product categories.'], 403);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
            'is_active' => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }
        try {
            $user = $request->user();
            $companyId = $user->company_id;
            if (!$companyId) {
                return response()->json(['status' => 'failed', 'message' => 'User is not associated with a company.'], 400);
            }
            $existing = ProductCategory::where('company_id', $companyId)->where('name', $request->input('name'))->first();
            if ($existing) {
                return response()->json(['status' => 'failed', 'message' => 'A product category with this name already exists for your company.'], 409);
            }
            $category = ProductCategory::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'color' => $request->input('color', '#6B7280'),
                'is_active' => $request->input('is_active', true),
            ]);
            return response()->json(['status' => 'success', 'message' => 'Product category created successfully.', 'category' => $category], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create product category', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to create product category: ' . $e->getMessage()], 500);
        }
    }

    public function show(Request $request, $id)
    {
        // Ensure user is authenticated
        if ($authError = $this->ensureAuthenticated($request)) {
            return $authError;
        }

        if (!$this->hasPermission($request, 'can_view_product_categories')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view product categories.'], 403);
        }
        try {
            $user = $request->user();
            $query = ProductCategory::where('id', $id);
            if (!$this->hasPermission($request, 'can_manage_all_products')) {
                $query->where('company_id', $user->company_id);
            }
            $category = $query->first();
            if (!$category) {
                return response()->json(['status' => 'failed', 'message' => 'Product category not found or not authorized to view.'], 404);
            }
            return response()->json(['status' => 'success', 'message' => 'Product category retrieved successfully.', 'category' => $category], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve product category', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to retrieve product category: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        // Ensure user is authenticated
        if ($authError = $this->ensureAuthenticated($request)) {
            return $authError;
        }

        if (!$this->hasPermission($request, 'can_update_product_categories')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update product categories.'], 403);
        }
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
            'is_active' => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }
        try {
            $user = $request->user();
            $category = ProductCategory::find($id);
            if (!$category) {
                return response()->json(['status' => 'failed', 'message' => 'Product category not found.'], 404);
            }
            if (!$this->canManageCompany($request, $category->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized to update this product category.'], 403);
            }
            if ($request->has('name') && $request->input('name') !== $category->name) {
                $existing = ProductCategory::where('company_id', $category->company_id)
                    ->where('name', $request->input('name'))
                    ->where('id', '<>', $id)
                    ->first();
                if ($existing) {
                    return response()->json(['status' => 'failed', 'message' => 'A product category with this name already exists for your company.'], 409);
                }
            }
            $category->update($request->only(['name', 'description', 'color', 'is_active']));
            return response()->json(['status' => 'success', 'message' => 'Product category updated successfully.', 'category' => $category->fresh()], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update product category', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to update product category: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        // Ensure user is authenticated
        if ($authError = $this->ensureAuthenticated($request)) {
            return $authError;
        }

        if (!$this->hasPermission($request, 'can_delete_product_categories')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete product categories.'], 403);
        }
        try {
            $user = $request->user();
            $category = ProductCategory::find($id);
            if (!$category) {
                return response()->json(['status' => 'failed', 'message' => 'Product category not found.'], 404);
            }
            if (!$this->canManageCompany($request, $category->company_id)) {
                return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete this product category.'], 403);
            }
            // Protect categories linked to products
            $productsCount = $category->products()->count();
            if ($productsCount > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => "Cannot delete this category because it is used by {$productsCount} products. Reassign these products to another category first.",
                    'products_count' => $productsCount
                ], 409);
            }
            $category->delete();
            return response()->json(['status' => 'success', 'message' => 'Product category deleted successfully.'], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete product category', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to delete product category: ' . $e->getMessage()], 500);
        }
    }
}
