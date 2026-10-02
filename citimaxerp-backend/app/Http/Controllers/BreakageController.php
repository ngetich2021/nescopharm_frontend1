<?php

namespace App\Http\Controllers;

use App\Http\Traits\ChecksStockAvailability;
use App\Models\Breakage;
use App\Models\BreakageItem;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BreakageController extends Controller
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
    public function replaceItemViaDispatch(Request $request, $breakageId, $itemId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_dispatch_items', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to dispatch breakage items.',
                'data' => null
            ], 403);
        }

        $user = $request->user();
        $breakage = \App\Models\Breakage::findOrFail($breakageId);
        $item = \App\Models\BreakageItem::where('breakage_id', $breakageId)->findOrFail($itemId);
        if (!$this->hasPermission($request, 'can_replace_breakage_items') || !$this->canManageCompany($request, $breakage->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to replace breakage item.'
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'dispatch_id' => 'required|uuid|exists:dispatches,id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }
        $quantity = (int) $request->input('quantity');
        if ($quantity > $item->quantity) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Replacement quantity exceeds breakage item quantity.'
            ], 422);
        }
        // Check if already fully replaced
        $alreadyReplaced = \App\Models\BreakageItemDispatch::where('breakage_item_id', $item->id)->sum('quantity');
        if ($alreadyReplaced + $quantity > $item->quantity) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Total replaced quantity would exceed breakage item quantity.'
            ], 422);
        }
        // Create record in breakage_item_dispatch
        $bid = new \App\Models\BreakageItemDispatch([
            'id' => (string) Str::uuid(),
            'breakage_item_id' => $item->id,
            'dispatch_id' => $request->input('dispatch_id'),
            'quantity' => $quantity,
            'replaced_at' => now(),
            'replaced_by' => $user->id,
            'notes' => $request->input('notes'),
        ]);
        $bid->save();
        // Optionally update replaced_at/replaced_by on item if fully replaced
        $totalReplaced = $alreadyReplaced + $quantity;
        if ($totalReplaced >= $item->quantity) {
            $item->replaced_at = now();
            $item->replaced_by = $user->id;
            $item->save();
        }
        // If all items for the breakage are fully replaced, mark breakage as resolved
        $allItems = \App\Models\BreakageItem::where('breakage_id', $breakage->id)->get();
        $allReplaced = $allItems->every(function ($i) {
            $sum = \App\Models\BreakageItemDispatch::where('breakage_item_id', $i->id)->sum('quantity');
            return $sum >= $i->quantity;
        });
        if ($allReplaced && $breakage->status !== 'resolved') {
            $breakage->status = 'resolved';
            $breakage->save();
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Breakage item marked as replaced via dispatch.',
            'breakage_item_dispatch' => $bid,
            'breakage_item' => $item->fresh(),
            'breakage' => $breakage->fresh('items'),
        ], 200);
    }
    protected string $disk;

    public function __construct()
    {
        $this->disk = config('filesystems.default', 's3');
    }


    /**
     * Generate a unique breakage number for the company.
     * Format: BRK-<company_id_prefix>-<increment>
     */
    protected function generateBreakageNumber($companyId)
    {
        $prefix = 'BRK-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastBreakage = DB::table('breakages')
            ->select('breakage_number')
            ->where('company_id', $companyId)
            ->where('breakage_number', 'like', $prefix . '%')
            ->orderBy('breakage_number', 'desc')
            ->lockForUpdate()
            ->first();

        if ($lastBreakage && preg_match('/' . preg_quote($prefix, '/') . '(\d{4})$/', $lastBreakage->breakage_number, $matches)) {
            $nextNumber = (int) $matches[1] + 1;
        } else {
            $nextNumber = 1;
        }
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    // List all breakages (with optional filters)
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view breakages.',
                'data' => null
            ], 403);
        }

        $query = Breakage::with(['items', 'reporter', 'approver']);
        // Always filter by company unless blanket permission
        if (!$this->hasPermission($request, 'can_manage_all_breakages')) {
            $query->where('company_id', $user->company_id);
        }
        if ($request->has('company_id')) {
            $query->where('company_id', $request->company_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Breakages retrieved successfully.',
            'breakages' => $query->paginate(20),
        ], 200);
    }

    // Store a new breakage report with items
    public function store(Request $request)
    {

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create breakages.',
                'data' => null
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string',
            'approver_id' => 'required|uuid|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid',
            'items.*.variant_id' => 'nullable|uuid',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.cause' => 'nullable|string',
            'items.*.notes' => 'nullable|string',
            'items.*.image' => 'nullable|file|image|max:2048',
            'items.*.replacement_requested' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
                'data' => null
            ], 400);
        }

        $user = $request->user();
        $companyId = $user->company_id;
        $reportedBy = $user->id;

        try {
            $result = DB::transaction(function () use ($request, $user, $companyId, $reportedBy) {
                $breakageNumber = $this->generateBreakageNumber($companyId);
                $breakage = Breakage::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'reported_by' => $reportedBy,
                    'breakage_number' => $breakageNumber,
                    'notes' => $request->input('notes'),
                    'approval_status' => 'pending',
                    'approved_by' => $request->input('approver_id'),
                    'approved_at' => null, // Will be set when actually approved
                    'status' => 'pending',
                ]);

                foreach ($request->input('items') as $item) {
                    $imagePath = null;
                    if (isset($item['image']) && $item['image']) {
                        try {
                            $path = 'breakages/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $item['image']->getClientOriginalExtension();
                            $stored = Storage::disk($this->disk)->put($path, file_get_contents($item['image']->getRealPath()));

                            if ($stored) {
                                $imagePath = Storage::disk($this->disk)->url($path);
                            } else {
                                throw new \Exception('Failed to store breakage image');
                            }
                        } catch (\Exception $e) {
                            Log::error('Storage upload failed', ['error' => $e->getMessage()]);
                        }
                    }
                    $replacementRequested = isset($item['replacement_requested']) ?
                        (in_array($item['replacement_requested'], [true, 'true', '1', 1], true) ? true : false) : false;
                    $itemId = (string) Str::uuid();
                    DB::table('breakage_items')->insert([
                        'id' => $itemId,
                        'breakage_id' => $breakage->id,
                        'product_id' => $item['product_id'],
                        'variant_id' => $item['variant_id'] ?? null,
                        'quantity' => $item['quantity'],
                        'cause' => $item['cause'] ?? null,
                        'notes' => $item['notes'] ?? null,
                        'company_id' => $companyId,
                        'image_path' => $imagePath,
                        'replacement_requested' => $replacementRequested ? 't' : 'f',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    // Inventory tracking: move quantity from available to damaged, set
                    // inventory_status - never record more breakage than is actually in stock.
                    $breakageProduct = Product::find($item['product_id']);
                    $breakageVariant = !empty($item['variant_id']) ? ProductVariant::find($item['variant_id']) : null;
                    if ($error = $this->insufficientStockMessage($breakageProduct, $breakageVariant, (int) $item['quantity'])) {
                        throw new \RuntimeException($error);
                    }

                    DB::table('products')
                        ->where('id', $item['product_id'])
                        ->where('company_id', $companyId)
                        ->decrement('stock_quantity', $item['quantity']);
                    DB::table('products')
                        ->where('id', $item['product_id'])
                        ->where('company_id', $companyId)
                        ->increment('damaged', $item['quantity']);
                    DB::table('products')
                        ->where('id', $item['product_id'])
                        ->where('company_id', $companyId)
                        ->update(['inventory_status' => 'damaged']);
                }

                return $breakage->load('items');
            });
            return response()->json([
                'status' => 'success',
                'message' => 'Breakage created successfully.',
                'data' => $result
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create breakage', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create breakage: ' . $e->getMessage(),
                'data' => null
            ], 500);
        }
    }

    // Show a single breakage
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view breakages.',
                'data' => null
            ], 403);
        }
        $breakage = Breakage::with(['items', 'reporter', 'approver'])->findOrFail($id);
        $user = $request->user();
        $companyId = $breakage->company_id;
        if (!$this->hasPermission($request, 'can_view_breakages') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this breakage.'
            ], 403);
        }
        return response()->json([
            'status' => 'success',
            'breakage' => $breakage,
            'reporter' => $breakage->reporter,
            'approver' => $breakage->approver,
        ], 200);
    }

    // Approve or reject a breakage
    public function approve(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_approve_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve breakages.',
                'data' => null
            ], 403);
        }
        $breakage = Breakage::findOrFail($id);
        $user = $request->user();
        $companyId = $breakage->company_id;
        if (!$this->hasPermission($request, 'can_approve_breakages') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve breakages.'
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'approval_status' => 'required|string',
            'notes' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }
        $breakage->approved_by = $user->id;
        $breakage->approved_at = now();
        $breakage->approval_status = $request->approval_status;
        if ($request->has('notes')) {
            $breakage->notes = $request->notes;
        }
        $breakage->save();
        Log::info('Breakage approval status updated', [
            'breakage_id' => $breakage->id,
            'approval_status' => $breakage->approval_status,
            'approved_by' => $user->id,
        ]);
        return response()->json([
            'status' => 'success',
            'message' => 'Breakage approval updated.',
            'breakage' => $breakage->fresh('items'),
        ], 200);
    }

    // Update a breakage (notes, status, etc.)
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update breakages.',
                'data' => null
            ], 403);
        }

        $breakage = Breakage::findOrFail($id);

        // Validate all updatable fields, including items
        $validator = Validator::make($request->all(), [
            'breakage_number' => 'sometimes|string',
            'company_id' => 'sometimes|uuid',
            'reported_by' => 'sometimes|uuid',
            'notes' => 'nullable|string',
            'approved' => 'nullable|boolean',
            'approval_status' => 'nullable|string',
            'approved_by' => 'nullable|uuid',
            'status' => 'nullable|string',
            'items' => 'sometimes|array',
            'items.*.id' => 'sometimes|uuid',
            'items.*.product_id' => 'required_with:items|uuid',
            'items.*.variant_id' => 'nullable|uuid',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.cause' => 'nullable|string',
            'items.*.notes' => 'nullable|string',
            'items.*.image' => 'nullable|file|image|max:2048',
            'items.*.replacement_requested' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }


        DB::transaction(function () use ($request, $breakage) {
            // Update breakage fields
            $breakage->fill($request->only([
                'breakage_number',
                'company_id',
                'reported_by',
                'notes',
                'approved',
                'approval_status',
                'approved_by',
                'status',
            ]));
            $breakage->save();

            // Handle items update if provided
            if ($request->has('items')) {
                $itemIds = [];
                foreach ($request->input('items') as $item) {
                    $imagePath = null;
                    if (isset($item['image']) && $item['image']) {
                        try {
                            $path = 'breakages/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $item['image']->getClientOriginalExtension();
                            $stored = Storage::disk($this->disk)->put($path, file_get_contents($item['image']->getRealPath()));

                            if ($stored) {
                                $imagePath = Storage::disk($this->disk)->url($path);
                            } else {
                                throw new \Exception('Failed to store breakage image');
                            }
                        } catch (\Exception $e) {
                            Log::error('Storage upload failed', ['error' => $e->getMessage()]);
                        }
                    }
                    // Use PostgreSQL boolean format for replacement_requested
                    $replacementRequested = isset($item['replacement_requested']) ?
                        (in_array($item['replacement_requested'], [true, 'true', '1', 1], true) ? 't' : 'f') : 'f';

                    if (isset($item['id'])) {
                        // Update existing item using query builder for explicit boolean
                        $updateData = [
                            'product_id' => $item['product_id'],
                            'variant_id' => $item['variant_id'] ?? null,
                            'quantity' => $item['quantity'],
                            'cause' => $item['cause'] ?? null,
                            'notes' => $item['notes'] ?? null,
                            'replacement_requested' => $replacementRequested,
                        ];
                        if ($imagePath) {
                            $updateData['image_path'] = $imagePath;
                        }
                        DB::table('breakage_items')
                            ->where('id', $item['id'])
                            ->where('breakage_id', $breakage->id)
                            ->update($updateData);
                        $itemIds[] = $item['id'];
                    } else {
                        // Create new item using query builder for explicit boolean
                        $newId = (string) Str::uuid();
                        DB::table('breakage_items')->insert([
                            'id' => $newId,
                            'breakage_id' => $breakage->id,
                            'product_id' => $item['product_id'],
                            'variant_id' => $item['variant_id'] ?? null,
                            'quantity' => $item['quantity'],
                            'cause' => $item['cause'] ?? null,
                            'notes' => $item['notes'] ?? null,
                            'company_id' => $breakage->company_id,
                            'image_path' => $imagePath,
                            'replacement_requested' => $replacementRequested,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        $itemIds[] = $newId;
                    }
                }
                // Delete items not present in the update
                BreakageItem::where('breakage_id', $breakage->id)
                    ->whereNotIn('id', $itemIds)
                    ->delete();
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Breakage updated successfully.',
            'breakage' => $breakage->fresh('items'),
        ], 200);
    }

    // Delete a breakage
    public function destroy(Request $request, $id)
    {
        $breakage = Breakage::findOrFail($id);

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete breakages.',
                'data' => null
            ], 403);
        }


        $breakage->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'Breakage deleted successfully.'
        ], 200);
    }

    // List breakages for the authenticated user
    public function myBreakages(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view breakages.',
                'data' => null
            ], 403);
        }
        $user = $request->user();
        $breakages = Breakage::with(['items', 'reporter', 'approver'])->where('reported_by', $user->id)->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'My breakages retrieved successfully.',
            'breakages' => $breakages,
        ], 200);
    }

    // List breakages for a company (admin only)
    public function companyBreakages(Request $request, $companyId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view breakages.',
                'data' => null
            ], 403);
        }
        $breakages = Breakage::with(['items', 'reporter', 'approver'])->where('company_id', $companyId)->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'Company breakages retrieved successfully.',
            'breakages' => $breakages,
        ], 200);
    }

    // Upload an image for a breakage item (standalone endpoint)
    public function uploadImage(Request $request, $itemId)
    {
        $item = BreakageItem::findOrFail($itemId);
        $user = $request->user();
        // Only allow update if user can update breakages for the item's company
        if (!$this->hasPermission($request, 'can_update_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update breakages.',
                'data' => null
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'image' => 'required|file|image|max:2048',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('image');
        try {
            $path = 'breakages/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
            $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

            if ($stored) {
                $item->image_path = Storage::disk($this->disk)->url($path);
                $item->save();
                return response()->json([
                    'status' => 'success',
                    'message' => 'Image uploaded successfully.',
                    'image_path' => $item->image_path,
                ], 200);
            } else {
                throw new \Exception('Failed to store breakage image');
            }
        } catch (\Exception $e) {
            Log::error('Storage upload failed', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to upload image: ' . $e->getMessage(),
            ], 500);
        }
    }

    // List dispatch items assignable to the authenticated user
    public function myAssignableItems(Request $request)
    {

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_breakages', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view breakages.',
                'data' => null
            ], 403);
        }
        $user = $request->user();
        // Join dispatches, dispatch_items, products, and product_variants to get product and variant names
        $items = DB::table('dispatch_items')
            ->join('dispatches', 'dispatch_items.dispatch_id', '=', 'dispatches.id')
            ->leftJoin('products', 'dispatch_items.product_id', '=', 'products.id')
            ->leftJoin('product_variants', 'dispatch_items.variant_id', '=', 'product_variants.id')
            ->where('dispatches.to_user_id', $user->id)
            ->whereNotNull('dispatches.acknowledged_by')
            ->select(
                'dispatch_items.*',
                'dispatches.dispatch_number',
                'dispatches.type',
                'dispatches.from_store_id',
                'dispatches.to_entity',
                'products.name as product_name',
                'product_variants.name as variant_name'
            )
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Assignable items retrieved successfully.',
            'items' => $items,
        ], 200);
    }
}
