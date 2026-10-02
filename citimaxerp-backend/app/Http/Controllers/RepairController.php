<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksStockAvailability;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Repair;
use App\Models\RepairItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Log;

class RepairController extends Controller
{
    use ChecksStockAvailability;


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

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $repair = Repair::with('items')->where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_repairs'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$repair) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Repair not found or not accessible.'
            ], 404);
        }
        $companyId = $repair->company_id;
        if (!$this->hasPermission($request, 'can_update_repairs') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this repair.'
            ], 403);
        }
        try {
            $validated = $request->validate([
                'description' => 'nullable|string',
                'approver_id' => 'required|uuid|exists:users,id',
                'status' => 'nullable|string',
                'approval_status' => 'nullable|string',
                'items' => 'required|array|min:1',
                'items.*.id' => 'nullable|uuid',
                'items.*.product_id' => 'required|uuid|exists:products,id',
                'items.*.product_variant' => 'nullable|uuid|exists:product_variants,id',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.is_repairable' => 'boolean',
                'items.*.notes' => 'nullable|string',
                'items.*.status' => 'nullable|string',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($repair, $validated, $companyId) {
                // Update repair fields
                $repair->description = $validated['description'] ?? $repair->description;
                $repair->approver_id = $validated['approver_id'];
                if (isset($validated['status'])) {
                    $repair->status = $validated['status'];
                }
                if (isset($validated['approval_status'])) {
                    $repair->approval_status = $validated['approval_status'];
                }
                $repair->save();

                $existingItems = $repair->items->keyBy('id');
                $updatedItemIds = [];

                foreach ($validated['items'] as $itemData) {
                    // If id is present, update existing item
                    if (!empty($itemData['id']) && $existingItems->has($itemData['id'])) {
                        $item = $existingItems[$itemData['id']];
                        $item->product_id = $itemData['product_id'];
                        $item->product_variant = $itemData['product_variant'] ?? null;
                        $item->quantity = $itemData['quantity'];
                        $item->is_repairable = isset($itemData['is_repairable']) ? (in_array($itemData['is_repairable'], [true, 'true', '1', 1], true) ? 't' : 'f') : $item->is_repairable;
                        $item->notes = $itemData['notes'] ?? $item->notes;
                        if (isset($itemData['status'])) {
                            $item->status = $itemData['status'];
                        }
                        $item->save();
                        $updatedItemIds[] = $item->id;
                    } else {
                        // New item: create it
                        $uniqueIdentifier = $this->generateUniqueIdentifier($companyId);
                        $isRepairable = isset($itemData['is_repairable']) ? (in_array($itemData['is_repairable'], [true, 'true', '1', 1], true) ? 't' : 'f') : 't';
                        $status = $itemData['status'] ?? 'pending';
                        $newItem = RepairItem::create([
                            'id' => (string) Str::uuid(),
                            'company_id' => $companyId,
                            'repair_id' => $repair->id,
                            'product_id' => $itemData['product_id'],
                            'product_variant' => $itemData['product_variant'] ?? null,
                            'unique_identifier' => $uniqueIdentifier,
                            'quantity' => $itemData['quantity'],
                            'is_repairable' => $isRepairable,
                            'status' => $status,
                            'notes' => $itemData['notes'] ?? null,
                        ]);
                        $updatedItemIds[] = $newItem->id;
                        // Inventory tracking for new item - never pull more stock into a
                        // repair than is actually available.
                        $repairProduct = Product::find($itemData['product_id']);
                        $repairVariant = !empty($itemData['product_variant'])
                            ? ProductVariant::find($itemData['product_variant'])
                            : null;
                        if ($error = $this->insufficientStockMessage($repairProduct, $repairVariant, (int) $itemData['quantity'])) {
                            throw new \RuntimeException($error);
                        }

                        DB::table('products')
                            ->where('id', $itemData['product_id'])
                            ->where('company_id', $companyId)
                            ->decrement('stock_quantity', $itemData['quantity']);
                        DB::table('products')
                            ->where('id', $itemData['product_id'])
                            ->where('company_id', $companyId)
                            ->increment('on_hold', $itemData['quantity']);
                        DB::table('products')
                            ->where('id', $itemData['product_id'])
                            ->where('company_id', $companyId)
                            ->update(['inventory_status' => 'on_hold']);
                    }
                }
                // Delete items not present in the update
                $toDelete = $existingItems->keys()->diff($updatedItemIds);
                if ($toDelete->count() > 0) {
                    RepairItem::whereIn('id', $toDelete)->delete();
                }
                return $repair->fresh(['items.product', 'items.variant', 'items.assignedTo', 'reporter', 'approver']);
            });
            return response()->json([
                'status' => 'success',
                'message' => 'Repair and items updated successfully.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to update repair', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update repair.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
    /**
     * Generate a unique, incrementing repair number per company.
     */
    protected function generateRepairNumber($companyId)
    {
        $prefix = 'REP-' . substr($companyId, 0, 8) . '-';
        $lastRepair = \App\Models\Repair::where('company_id', $companyId)
            ->where('repair_number', 'like', $prefix . '%')
            ->orderBy('repair_number', 'desc')
            ->first();

        $nextNumber = $lastRepair ? (int)substr($lastRepair->getRawOriginal('repair_number'), strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Generate a unique, incrementing unique_identifier for repair items per company.
     */
    protected function generateUniqueIdentifier($companyId)
    {
        $prefix = 'RITM-' . substr($companyId, 0, 8) . '-';
        $lastItem = \App\Models\RepairItem::where('company_id', $companyId)
            ->where('unique_identifier', 'like', $prefix . '%')
            ->orderBy('unique_identifier', 'desc')
            ->first();

        $nextNumber = $lastItem ? (int)substr($lastItem->unique_identifier, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
    }

    // List all repairs for the current company
    public function index(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);
        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view repairs.'
            ], 403);
        }
        $query = Repair::with(['items.product', 'items.variant', 'items.assignedTo', 'reporter', 'approver']);
        if (!$this->hasPermission($request, 'can_manage_system')) {
            $query->where('company_id', $companyId);
        }
        $repairs = $query->latest()->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'Repairs fetched successfully.',
            'data' => $repairs
        ]);
    }

    // Store a new repair request
    public function store(Request $request)
    {
        if (!$this->hasPermission($request, 'can_create_repairs')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create a repair.'
            ], 403);
        }
        try {
            $validated = $request->validate([
                'description' => 'nullable|string',
                'approver_id' => 'required|uuid|exists:users,id',
                'items' => 'required|array|min:1',
                'items.*.product_id' => 'required|uuid|exists:products,id',
                'items.*.product_variant' => 'nullable|uuid|exists:product_variants,id',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.is_repairable' => 'boolean',
                'items.*.notes' => 'nullable|string',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($request, $validated) {
                $companyId = $request->user()->company_id;
                $repair = Repair::create([
                    'id' => Str::uuid(),
                    'company_id' => $companyId,
                    'repair_number' => $this->generateRepairNumber($companyId),
                    'reported_by' => $request->user()->id,
                    'description' => $validated['description'] ?? null,
                    'approver_id' => $validated['approver_id'],
                ]);

                foreach ($validated['items'] as $item) {
                    $uniqueIdentifier = $this->generateUniqueIdentifier($companyId);
                    $isRepairable = isset($item['is_repairable']) ? (in_array($item['is_repairable'], [true, 'true', '1', 1], true) ? 't' : 'f') : 't';
                    $repaired = isset($item['repaired']) ? (in_array($item['repaired'], [true, 'true', '1', 1], true) ? 't' : 'f') : 'f';
                    $status = 'pending';
                    RepairItem::create([
                        'id' => Str::uuid(),
                        'company_id' => $repair->company_id,
                        'repair_id' => $repair->id,
                        'product_id' => $item['product_id'],
                        'product_variant' => $item['product_variant'] ?? null,
                        'unique_identifier' => $uniqueIdentifier,
                        'quantity' => $item['quantity'],
                        'is_repairable' => $isRepairable,
                        'status' => $status,
                        'notes' => $item['notes'] ?? null,
                        'repaired' => $repaired,
                    ]);

                    // Inventory tracking: move quantity to on_hold/under_repair - never
                    // pull more stock into a repair than is actually available.
                    $repairProduct = Product::find($item['product_id']);
                    $repairVariant = !empty($item['product_variant'])
                        ? ProductVariant::find($item['product_variant'])
                        : null;
                    if ($error = $this->insufficientStockMessage($repairProduct, $repairVariant, (int) $item['quantity'])) {
                        throw new \RuntimeException($error);
                    }

                    DB::table('products')
                        ->where('id', $item['product_id'])
                        ->where('company_id', $companyId)
                        ->decrement('stock_quantity', $item['quantity']);
                    DB::table('products')
                        ->where('id', $item['product_id'])
                        ->where('company_id', $companyId)
                        ->increment('on_hold', $item['quantity']);
                    DB::table('products')
                        ->where('id', $item['product_id'])
                        ->where('company_id', $companyId)
                        ->update(['inventory_status' => 'on_hold']);
                }
                $repair->status = 'pending';
                $repair->approval_status = 'pending';
                $repair->save();
                return $repair->fresh(['items.product', 'items.variant', 'reporter', 'approver']);
            });
            return response()->json([
                'status' => 'success',
                'message' => 'Repair created successfully.',
                'data' => $result,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Failed to create repair', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create repair.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // Approve or update approval status for a repair
    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $repair = Repair::with(['items.product', 'items.variant', 'reporter', 'approver'])
            ->where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_repairs'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$repair) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Repair not found or not accessible.'
            ], 404);
        }
        $companyId = $repair->company_id;
        if (!$this->hasPermission($request, 'can_approve_repairs') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve this repair.'
            ], 403);
        }
        $validated = $request->validate([
            'approval_status' => 'required|string',
        ]);
        $repair->approved_by = $user->id;
        $repair->approved_at = now();
        $repair->approval_status = $validated['approval_status'];
        $repair->save();
        return response()->json([
            'status' => 'success',
            'message' => 'Repair approval updated.',
            'data' => $repair
        ]);
    }

    // Mark a repair as completed
    public function complete(Request $request, $id)
    {
        $user = $request->user();
        $repair = Repair::where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_repairs'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$repair) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Repair not found or not accessible.'
            ], 404);
        }
        $companyId = $repair->company_id;
        if (!$this->hasPermission($request, 'can_complete_repairs') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to complete this repair.'
            ], 403);
        }
        // Mark all items as completed
        foreach ($repair->items as $item) {
            $item->repaired = true;
            $item->status = 'completed';
            $item->save();

            // Inventory tracking: move from on_hold to available if repairable, else to damaged
            $invQuery = DB::table('products')
                ->where('id', $item->product_id)
                ->where('company_id', $repair->company_id);
            if ($item->is_repairable) {
                $invQuery->increment('stock_quantity', $item->quantity);
                $invQuery->decrement('on_hold', $item->quantity);
                $invQuery->update(['inventory_status' => 'available']);
            } else {
                $invQuery->decrement('on_hold', $item->quantity);
                $invQuery->increment('damaged', $item->quantity);
                $invQuery->update(['inventory_status' => 'damaged']);
            }
        }
        $repair->status = 'completed';
        $repair->save();

        $repair->load(['items', 'reporter', 'approver']);
        return response()->json([
            'status' => 'success',
            'message' => 'Repair marked as completed.',
            'data' => $repair,
        ]);
    }

    /**
     * Update the status of one or more repair items.
     */
    public function updateItemStatus(Request $request, $repairId)
    {
        $user = $request->user();
        $repair = Repair::with('items')->findOrFail($repairId);
        if (!$this->hasPermission($request, 'can_update_repairs') || !$this->canManageCompany($request, $repair->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update repair items.'
            ], 403);
        }
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|uuid',
            'items.*.status' => 'required|string|in:pending,in_progress,repaired,completed',
        ]);
        $updated = [];
        foreach ($validated['items'] as $itemData) {
            $item = $repair->items()->find($itemData['id']);
            if ($item) {
                $item->status = $itemData['status'];
                $item->save();
                $updated[] = $item;
            }
        }
        // Optionally, update the parent repair status if needed
        if ($request->has('repair_status')) {
            $repair->status = $request->input('repair_status');
            $repair->save();
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Repair item statuses updated.',
            'items' => $updated,
            'repair' => $repair->fresh(['items', 'reporter', 'approver'])
        ]);
    }

    // Show a single repair
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $repair = Repair::with(['items.product', 'items.variant', 'items.assignedTo', 'reporter', 'approver'])
            ->where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_repairs'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$repair) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Repair not found or not accessible.'
            ], 404);
        }
        $companyId = $repair->company_id;
        if (!$this->hasPermission($request, 'can_view_repairs') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this repair.'
            ], 403);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Repair fetched successfully.',
            'data' => $repair,
        ]);
    }

    /**
     * Mark a repair item as repaired, tracking who repaired it, when, and notes.
     */
    public function repairItem(Request $request, $repairId, $itemId)
    {
        $user = $request->user();
        $repair = Repair::with('items')->findOrFail($repairId);
        $item = $repair->items()->findOrFail($itemId);
        if (!$this->hasPermission($request, 'can_update_repairs') || !$this->canManageCompany($request, $repair->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to repair this item.'
            ], 403);
        }
        $validated = $request->validate([
            'repair_notes' => 'nullable|string',
        ]);
        $item->repaired = true;
        $item->repaired_by = $user->id;
        $item->repaired_at = now();
        $item->repair_notes = $validated['repair_notes'] ?? null;
        $item->status = 'repaired';
        $item->save();
        return response()->json([
            'status' => 'success',
            'message' => 'Repair item marked as repaired.',
            'item' => $item,
        ]);
    }

    /**
     * Assign a repair item to a user.
     */
    /**
     * Assign multiple repair items to users in one request.
     * Expects: assignments: [ { item_id: uuid, assigned_to: uuid }, ... ]
     */
    public function assignRepairItem(Request $request, $repairId)
    {
        $user = $request->user();
        $repair = Repair::with('items')->findOrFail($repairId);
        if (!$this->hasPermission($request, 'can_update_repairs') || !$this->canManageCompany($request, $repair->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to assign items.'
            ], 403);
        }
        $validated = $request->validate([
            'assignments' => 'required|array|min:1',
            'assignments.*.item_id' => 'required|uuid',
            'assignments.*.assigned_to' => 'required|uuid|exists:users,id',
        ]);
        $updated = [];
        foreach ($validated['assignments'] as $assignment) {
            $item = $repair->items()->find($assignment['item_id']);
            if ($item) {
                $item->assigned_to = $assignment['assigned_to'];
                if ($item->status !== 'assigned_repair') {
                    $item->status = 'assigned_repair';
                }
                $item->save();
                $updated[] = $item;
            }
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Repair items assigned.',
            'items' => $updated
        ]);
    }

    /**
     * Delete a repair and its items.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $repair = Repair::with('items')->where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_repairs'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$repair) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Repair not found or not accessible.'
            ], 404);
        }
        $companyId = $repair->company_id;
        if (!$this->hasPermission($request, 'can_delete_repairs') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this repair.'
            ], 403);
        }
        // Delete all items first (if not set to cascade in DB)
        $repair->items()->delete();
        $repair->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'Repair deleted successfully.'
        ]);
    }

    /**
     * Create a dispatch for repaired items after repair completion.
     * This function assumes a Dispatch model and table exist.
     * Only items with status 'completed' and is_repairable = true are dispatched.
     */
    public function dispatchRepairedItems(Request $request, $repairId)
    {
        $user = $request->user();
        $repair = Repair::with('items')->findOrFail($repairId);
        if (!$this->hasPermission($request, 'can_dispatch_repaired_items') || !$this->canManageCompany($request, $repair->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to dispatch repaired items.'
            ], 403);
        }
        $itemsToDispatch = $repair->items()->where('status', 'completed')->where('is_repairable', 't')->get();
        if ($itemsToDispatch->isEmpty()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No repaired items available for dispatch.'
            ], 400);
        }

        $dispatch = \App\Models\Dispatch::create([
            'id' => (string) Str::uuid(),
            'company_id' => $repair->company_id,
            'type' => 'repair_dispatch',
            'reference_id' => $repair->id,
            'created_by' => $user->id,
            'status' => 'pending',
        ]);
        foreach ($itemsToDispatch as $item) {
            // Create dispatch items (adjust for your schema)
            \App\Models\DispatchItem::create([
                'id' => (string) Str::uuid(),
                'dispatch_id' => $dispatch->id,
                'product_id' => $item->product_id,
                'product_variant' => $item->product_variant,
                'quantity' => $item->quantity,
                'source' => 'repair',
                'source_id' => $item->id,
            ]);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Dispatch created for repaired items.',
            'dispatch' => $dispatch,
            'items' => $itemsToDispatch
        ], 201);
    }
}
