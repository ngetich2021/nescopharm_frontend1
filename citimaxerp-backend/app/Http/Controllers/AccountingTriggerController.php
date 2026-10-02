<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\AccountingTriggerConfig;
use App\Models\AccountingTriggerCategory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AccountingTriggerController extends Controller
{
    /**
     * Get all trigger categories with their triggers
     */
    public function categories(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $categories = AccountingTriggerCategory::getForCompanyWithTriggers($companyId);

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * Get all available triggers for the company
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $categoryCode = $request->query('category');
        $includeInactive = $request->boolean('include_inactive', false);

        $query = AccountingTriggerConfig::forCompany($companyId)
            ->with('category');

        if (!$includeInactive) {
            $query->active();
        }

        if ($categoryCode) {
            $query->inCategoryCode($categoryCode, $companyId);
        }

        $triggers = $query->orderBy('sort_order')->get();

        // Group by category for better organization
        $grouped = $triggers->groupBy('category.code');

        return response()->json([
            'success' => true,
            'data' => [
                'triggers' => $triggers,
                'grouped' => $grouped,
            ],
        ]);
    }

    /**
     * Get a single trigger configuration
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $trigger = AccountingTriggerConfig::forCompany($companyId)
            ->with('category')
            ->find($id);

        if (!$trigger) {
            return response()->json([
                'success' => false,
                'message' => 'Trigger configuration not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $trigger,
        ]);
    }

    /**
     * Create a new trigger configuration
     */
    public function store(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $validator = Validator::make($request->all(), [
            'category_code' => 'required|string',
            'trigger_key' => 'required|string|max:50',
            'trigger_name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'event_class' => 'nullable|string|max:255',
            'model_class' => 'nullable|string|max:255',
            'model_status' => 'nullable|string|max:50',
            'conditions' => 'nullable|array',
            'journal_type' => 'nullable|string|max:50',
            'debit_accounts' => 'nullable|array',
            'credit_accounts' => 'nullable|array',
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        // Check for duplicate trigger_key within company/category
        $category = AccountingTriggerCategory::getByCode($request->category_code, $companyId);
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Category not found',
            ], 422);
        }

        $existingTrigger = AccountingTriggerConfig::forCompany($companyId)
            ->where('category_id', $category->id)
            ->where('trigger_key', $request->trigger_key)
            ->first();

        if ($existingTrigger) {
            return response()->json([
                'success' => false,
                'message' => 'A trigger with this key already exists in this category',
            ], 422);
        }

        DB::beginTransaction();
        try {
            // If setting as default, unset other defaults in this category
            if ($request->is_default) {
                AccountingTriggerConfig::forCompany($companyId)
                    ->where('category_id', $category->id)
                    ->whereRaw('is_default = true')
                    ->update(['is_default' => DB::raw('false')]);
            }

            // Create the trigger
            $trigger = AccountingTriggerConfig::createForCompany(
                $companyId,
                $request->category_code,
                $request->only([
                    'trigger_key',
                    'trigger_name',
                    'description',
                    'event_class',
                    'model_class',
                    'model_status',
                    'conditions',
                    'journal_type',
                    'debit_accounts',
                    'credit_accounts',
                    'is_active',
                    'is_default',
                    'sort_order',
                ])
            );

            DB::commit();

            $trigger->load('category');

            return response()->json([
                'success' => true,
                'message' => 'Trigger configuration created successfully',
                'data' => $trigger,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create trigger configuration',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a trigger configuration
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $trigger = AccountingTriggerConfig::forCompany($companyId)->find($id);

        if (!$trigger) {
            return response()->json([
                'success' => false,
                'message' => 'Trigger configuration not found',
            ], 404);
        }

        // System triggers can only have is_active and is_default toggled
        if ($trigger->is_system) {
            $validator = Validator::make($request->all(), [
                'is_active' => 'boolean',
                'is_default' => 'boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'message' => $validator->errors(), 'errors' => $validator->errors(),
                ], 422);
            }

            DB::beginTransaction();
            try {
                // If setting as default, unset other defaults in this category
                if ($request->is_default) {
                    AccountingTriggerConfig::forCompany($companyId)
                        ->where('category_id', $trigger->category_id)
                        ->where('id', '!=', $trigger->id)
                        ->whereRaw('is_default = true')
                        ->update(['is_default' => DB::raw('false')]);
                }

                $updateData = [];
                if ($request->has('is_active')) {
                    $updateData['is_active'] = DB::raw($request->is_active ? 'true' : 'false');
                }
                if ($request->has('is_default')) {
                    $updateData['is_default'] = DB::raw($request->is_default ? 'true' : 'false');
                }

                if (!empty($updateData)) {
                    $trigger->update($updateData);
                    $trigger->refresh();
                }

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'System trigger updated successfully',
                    'data' => $trigger,
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to update trigger',
                    'error' => $e->getMessage(),
                ], 500);
            }
        }

        // Company triggers can be fully updated
        $validator = Validator::make($request->all(), [
            'trigger_key' => 'string|max:50',
            'trigger_name' => 'string|max:100',
            'description' => 'nullable|string',
            'event_class' => 'nullable|string|max:255',
            'model_class' => 'nullable|string|max:255',
            'model_status' => 'nullable|string|max:50',
            'conditions' => 'nullable|array',
            'journal_type' => 'nullable|string|max:50',
            'debit_accounts' => 'nullable|array',
            'credit_accounts' => 'nullable|array',
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        // Check for duplicate trigger_key if changing it
        if ($request->has('trigger_key') && $request->trigger_key !== $trigger->trigger_key) {
            $existingTrigger = AccountingTriggerConfig::forCompany($companyId)
                ->where('category_id', $trigger->category_id)
                ->where('trigger_key', $request->trigger_key)
                ->where('id', '!=', $id)
                ->first();

            if ($existingTrigger) {
                return response()->json([
                    'success' => false,
                    'message' => 'A trigger with this key already exists in this category',
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // If setting as default, unset other defaults in this category
            if ($request->is_default) {
                AccountingTriggerConfig::forCompany($companyId)
                    ->where('category_id', $trigger->category_id)
                    ->where('id', '!=', $trigger->id)
                    ->whereRaw('is_default = true')
                    ->update(['is_default' => DB::raw('false')]);
            }

            // Build update array with proper boolean handling
            $updateData = $request->only([
                'trigger_key',
                'trigger_name',
                'description',
                'event_class',
                'model_class',
                'model_status',
                'conditions',
                'journal_type',
                'debit_accounts',
                'credit_accounts',
                'sort_order',
            ]);

            if ($request->has('is_active')) {
                $updateData['is_active'] = DB::raw($request->is_active ? 'true' : 'false');
            }
            if ($request->has('is_default')) {
                $updateData['is_default'] = DB::raw($request->is_default ? 'true' : 'false');
            }

            $trigger->update($updateData);
            $trigger->refresh();

            DB::commit();

            $trigger->load('category');

            return response()->json([
                'success' => true,
                'message' => 'Trigger configuration updated successfully',
                'data' => $trigger,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update trigger',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a trigger configuration
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $trigger = AccountingTriggerConfig::where('company_id', $companyId)->find($id);

        if (!$trigger) {
            return response()->json([
                'success' => false,
                'message' => 'Trigger configuration not found',
            ], 404);
        }

        if (!$trigger->canBeDeleted()) {
            return response()->json([
                'success' => false,
                'message' => 'System triggers cannot be deleted',
            ], 403);
        }

        $trigger->delete();

        return response()->json([
            'success' => true,
            'message' => 'Trigger configuration deleted successfully',
        ]);
    }

    /**
     * Set a trigger as the default for its category
     */
    public function setDefault(Request $request, string $id): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $trigger = AccountingTriggerConfig::forCompany($companyId)->find($id);

        if (!$trigger) {
            return response()->json([
                'success' => false,
                'message' => 'Trigger configuration not found',
            ], 404);
        }

        DB::beginTransaction();
        try {
            // Unset other defaults in this category
            AccountingTriggerConfig::forCompany($companyId)
                ->where('category_id', $trigger->category_id)
                ->whereRaw('is_default = true')
                ->update(['is_default' => DB::raw('false')]);

            // Set this trigger as default
            $trigger->update(['is_default' => DB::raw('true')]);
            $trigger->refresh();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Trigger set as default successfully',
                'data' => $trigger,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to set default trigger',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get available trigger keys for dropdown selections
     */
    public function availableTriggerKeys(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $categoryCode = $request->query('category');

        $query = AccountingTriggerConfig::forCompany($companyId)
            ->active()
            ->select('id', 'trigger_key', 'trigger_name', 'category_id', 'is_default', 'is_system');

        if ($categoryCode) {
            $query->inCategoryCode($categoryCode, $companyId);
        }

        $triggers = $query->orderBy('sort_order')->get();

        return response()->json([
            'success' => true,
            'data' => $triggers->map(function ($trigger) {
                return [
                    'value' => $trigger->trigger_key,
                    'label' => $trigger->trigger_name,
                    'id' => $trigger->id,
                    'is_default' => $trigger->is_default,
                    'is_system' => $trigger->is_system,
                ];
            }),
        ]);
    }

    /**
     * Get default triggers for each category
     */
    public function defaults(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $categories = AccountingTriggerCategory::forCompany($companyId)
            ->active()
            ->get();

        $defaults = [];
        foreach ($categories as $category) {
            $defaultTrigger = AccountingTriggerConfig::forCompany($companyId)
                ->where('category_id', $category->id)
                ->default()
                ->active()
                ->first();

            $defaults[$category->code] = [
                'category' => $category,
                'default_trigger' => $defaultTrigger,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $defaults,
        ]);
    }

    /**
     * Bulk update trigger status (enable/disable)
     */
    public function bulkUpdateStatus(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $validator = Validator::make($request->all(), [
            'trigger_ids' => 'required|array',
            'trigger_ids.*' => 'required|uuid',
            'is_active' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        $updated = AccountingTriggerConfig::forCompany($companyId)
            ->whereIn('id', $request->trigger_ids)
            ->update(['is_active' => DB::raw($request->is_active ? 'true' : 'false')]);

        return response()->json([
            'success' => true,
            'message' => "Updated {$updated} trigger(s)",
            'updated_count' => $updated,
        ]);
    }
}
