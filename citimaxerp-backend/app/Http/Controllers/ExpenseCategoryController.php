<?php

namespace App\Http\Controllers;

use App\Models\ExpenseCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpenseCategoryController extends Controller
{
    /**
     * Initialize the controller with middleware for authentication.
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
     * Check if the user can manage a specific company.
     *
     * @param Request $request
     * @param string $companyId
     * @return bool
     */
    // Removed canManageCompany, now handled by hasPermission

    /**
     * Display a listing of the expense categories.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view expense categories.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = ExpenseCategory::query();

            // Filter by company
            if (!$this->hasPermission($request, 'can_manage_system')) {
                $query->where('company_id', $user->company_id);
            } else if ($request->filled('company_id')) {
                $query->where('company_id', $request->input('company_id'));
            }

            // Filter by active status
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            // Search by name
            if ($request->filled('search')) {
                $query->where('name', 'ilike', '%' . $request->input('search') . '%');
            }

            // Apply sorting
            $sortField = $request->input('sort_by', 'name');
            $sortDirection = $request->input('sort_direction', 'asc');
            $query->orderBy($sortField, $sortDirection);

            $categories = $query->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Expense categories retrieved successfully.',
                'categories' => $categories,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve expense categories', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve expense categories: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created expense category in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create expense categories.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $companyId = $user->company_id;

            // Check if the company exists and user has permission
            if (!$companyId) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'User is not associated with a company.',
                ], 400);
            }

            // Check if a category with the same name already exists for this company
            $existingCategory = ExpenseCategory::where('company_id', $companyId)
                ->where('name', $request->input('name'))
                ->first();

            if ($existingCategory) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'An expense category with this name already exists for your company.',
                ], 409);
            }

            // Create the expense category
            $category = ExpenseCategory::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $request->input('name'),
                'description' => $request->input('description'),
                'color' => $request->input('color', '#6B7280'),
                'is_active' => $request->input('is_active', true),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Expense category created successfully.',
                'category' => $category,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create expense category', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create expense category: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified expense category.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $category = ExpenseCategory::find($id);
        if (!$category) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Expense category not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $category->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view expense category.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = ExpenseCategory::where('id', $id);

            if (!$this->hasPermission($request, 'can_manage_all_expenses')) {
                $query->where('company_id', $user->company_id);
            }

            $category = $query->first();

            if (!$category) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense category not found or not authorized to view.',
                ], 404);
            }

            // Optionally load related expenses count
            if ($request->has('with_stats')) {
                $category->expenses_count = $category->expenses()->count();
                $category->total_expenses = $category->expenses()->sum('amount');
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Expense category retrieved successfully.',
                'category' => $category,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve expense category', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve expense category: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified expense category in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $category = ExpenseCategory::find($id);
        if (!$category) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Expense category not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $category->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update expense category.',
            ], 403);
        }


        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7|regex:/^#[a-fA-F0-9]{6}$/',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();

            // Find the category
            $category = ExpenseCategory::find($id);
            if (!$category) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense category not found.',
                ], 404);
            }

            // Check authorization

            // Check for duplicate name within the same company
            if ($request->has('name') && $request->input('name') !== $category->name) {
                $existingCategory = ExpenseCategory::where('company_id', $category->company_id)
                    ->where('name', $request->input('name'))
                    ->where('id', '<>', $id)
                    ->first();

                if ($existingCategory) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'An expense category with this name already exists for your company.',
                    ], 409);
                }
            }

            // Update the category
            $category->update($request->only([
                'name',
                'description',
                'color',
                'is_active',
            ]));

            return response()->json([
                'status' => 'success',
                'message' => 'Expense category updated successfully.',
                'category' => $category->fresh(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update expense category', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update expense category: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified expense category from storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $category = ExpenseCategory::find($id);
        if (!$category) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Expense category not found.',
            ], 404);
        }
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $category->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete expense category.',
            ], 403);
        }


        try {
            $user = $request->user();

            // Find the category
            $category = ExpenseCategory::find($id);
            if (!$category) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Expense category not found.',
                ], 404);
            }

            // Check authorization

            // Check if there are any expenses using this category
            $expensesCount = $category->expenses()->count();
            if ($expensesCount > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => "Cannot delete this category because it is used by {$expensesCount} expenses. Reassign these expenses to another category first.",
                    'expenses_count' => $expensesCount
                ], 409);
            }

            // Delete the category
            $category->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Expense category deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete expense category', ['error' => $e->getMessage(), 'id' => $id]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete expense category: ' . $e->getMessage(),
            ], 500);
        }
    }
}
