<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SubscriptionPlanController extends Controller
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

    /**
     * Get all subscription plans.
     */
    public function index(Request $request)
    {
        try {
            $query = SubscriptionPlan::query();

            // Filter by active status only if explicitly requested
            if ($request->has('active_only') && $request->input('active_only')) {
                $query->whereRaw('is_active = true');
            }

            $plans = $query->orderBy('price', 'asc')->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription plans retrieved successfully.',
                'data' => $plans,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve subscription plans', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve subscription plans: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get specific subscription plan.
     */
    public function show(Request $request, $planId)
    {
        try {
            $plan = SubscriptionPlan::with(['companySubscriptions', 'activeSubscriptions'])->find($planId);

            if (!$plan) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Subscription plan not found.',
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription plan retrieved successfully.',
                'data' => $plan,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve subscription plan', ['error' => $e->getMessage(), 'plan_id' => $planId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve subscription plan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create new subscription plan (System Admin only).
     */
    public function store(Request $request)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:subscription_plans,slug',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency' => 'required|string|size:3',
            'billing_cycle' => 'required|in:monthly,quarterly,semi_annual,annual',
            'max_users' => 'nullable|integer|min:1',
            'max_companies' => 'required|integer|min:1',
            'is_active' => 'boolean',
            'is_popular' => 'boolean',
            'features' => 'nullable|array',
            'limitations' => 'nullable|array',
            'trial_days' => 'required|integer|min:0|max:365',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $plan = SubscriptionPlan::create([
                'id' => Str::uuid(),
                'name' => $request->input('name'),
                'slug' => $request->input('slug'),
                'description' => $request->input('description'),
                'price' => $request->input('price'),
                'currency' => $request->input('currency'),
                'billing_cycle' => $request->input('billing_cycle'),
                'max_users' => $request->input('max_users'),
                'max_companies' => $request->input('max_companies', 1),
                'is_active' => filter_var($request->input('is_active', true), FILTER_VALIDATE_BOOLEAN),
                'is_popular' => filter_var($request->input('is_popular', false), FILTER_VALIDATE_BOOLEAN),
                'features' => $request->input('features', []),
                'limitations' => $request->input('limitations', []),
                'trial_days' => $request->input('trial_days', 14),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription plan created successfully.',
                'data' => $plan,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create subscription plan', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create subscription plan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update subscription plan (System Admin only).
     */
    public function update(Request $request, $planId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255|unique:subscription_plans,slug,' . $planId,
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|size:3',
            'billing_cycle' => 'sometimes|in:monthly,quarterly,semi_annual,annual',
            'max_users' => 'nullable|integer|min:1',
            'max_companies' => 'sometimes|integer|min:1',
            'is_active' => 'boolean',
            'is_popular' => 'boolean',
            'features' => 'nullable|array',
            'limitations' => 'nullable|array',
            'trial_days' => 'sometimes|integer|min:0|max:365',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $plan = SubscriptionPlan::find($planId);

            if (!$plan) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Subscription plan not found.',
                ], 404);
            }

            $updateData = $validator->validated();

            // Handle boolean values properly
            if (isset($updateData['is_active'])) {
                $updateData['is_active'] = filter_var($updateData['is_active'], FILTER_VALIDATE_BOOLEAN);
            }

            if (isset($updateData['is_popular'])) {
                $updateData['is_popular'] = filter_var($updateData['is_popular'], FILTER_VALIDATE_BOOLEAN);
            }

            $plan->update($updateData);

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription plan updated successfully.',
                'data' => $plan->fresh(),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update subscription plan', ['error' => $e->getMessage(), 'plan_id' => $planId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update subscription plan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete subscription plan (System Admin only).
     */
    public function destroy(Request $request, $planId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        try {
            $plan = SubscriptionPlan::with('companySubscriptions')->find($planId);

            if (!$plan) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Subscription plan not found.',
                ], 404);
            }

            // Check if plan has active subscriptions
            if ($plan->companySubscriptions()->whereIn('status', ['active', 'trial'])->count() > 0) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot delete subscription plan with active subscriptions. Please deactivate the plan instead.',
                ], 400);
            }

            $plan->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription plan deleted successfully.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete subscription plan', ['error' => $e->getMessage(), 'plan_id' => $planId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete subscription plan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Activate/Deactivate subscription plan (System Admin only).
     */
    public function toggleStatus(Request $request, $planId)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $plan = SubscriptionPlan::find($planId);

            if (!$plan) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Subscription plan not found.',
                ], 404);
            }

            $isActive = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN);
            $plan->update(['is_active' => $isActive]);

            return response()->json([
                'status' => 'success',
                'message' => $isActive ? 'Subscription plan activated successfully.' : 'Subscription plan deactivated successfully.',
                'data' => $plan,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to toggle subscription plan status', ['error' => $e->getMessage(), 'plan_id' => $planId]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update subscription plan status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get subscription plan statistics (System Admin only).
     */
    public function getStatistics(Request $request)
    {
        if (!$this->hasSystemAdminPermission($request)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized. System admin access required.',
            ], 403);
        }

        try {
            $stats = [];

            $plans = SubscriptionPlan::with(['companySubscriptions', 'activeSubscriptions'])->get();

            foreach ($plans as $plan) {
                $stats[] = [
                    'plan_id' => $plan->id,
                    'plan_name' => $plan->name,
                    'price' => $plan->price,
                    'currency' => $plan->currency,
                    'total_subscriptions' => $plan->companySubscriptions->count(),
                    'active_subscriptions' => $plan->activeSubscriptions->count(),
                    'trial_subscriptions' => $plan->companySubscriptions()->where('status', 'trial')->count(),
                    'is_active' => $plan->is_active,
                    'is_popular' => $plan->is_popular,
                ];
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Subscription plan statistics retrieved successfully.',
                'data' => $stats,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve subscription plan statistics', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve statistics: ' . $e->getMessage(),
            ], 500);
        }
    }
}
