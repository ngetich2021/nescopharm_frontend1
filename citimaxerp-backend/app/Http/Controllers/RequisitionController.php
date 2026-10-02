<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;


use App\Models\Requisition;
use App\Models\RequisitionItem;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class RequisitionController extends Controller
{


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
     * Generate a unique requisition number for the company.
     *
     * @param string $companyId
     * @return string
     */
    protected function generateRequisitionNumber($companyId)
    {
        $prefix = 'REQ-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastRequisition = DB::table('requisitions')
            ->select('requisition_number')
            ->where('requisition_number', 'like', $prefix . '%')
            ->orderBy('requisition_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastRequisition ? (int)substr($lastRequisition->requisition_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }


    public function store(Request $request)
    {
        if (!$this->hasPermission($request, 'can_create_requisitions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create a requisition.'
            ], 403);
        }
        $data = $request->all();
        $validator = Validator::make($data, [
            'approver_id' => 'nullable|uuid|exists:users,id',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'nullable|uuid|exists:products,id',
            'items.*.custom_item_name' => 'nullable|string|max:255',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string',
        ]);
        $validator->after(function ($validator) use ($data) {
            foreach (($data['items'] ?? []) as $index => $item) {
                if (empty($item['product_id']) && empty($item['custom_item_name'])) {
                    $validator->errors()->add(
                        "items.$index",
                        'Each item needs either a product or a custom item name.'
                    );
                }
            }
        });
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed.' . $validator->errors(),
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }
        $validated = $validator->validated();

        // Always set company_id and requester_id from the authenticated user
        $user = $request->user();
        $validated['company_id'] = $user->company_id;
        $validated['requester_id'] = $user->id;

        // Stock check for each item - skip custom (non-catalog) items, they have no stock to check
        foreach ($validated['items'] as $item) {
            if (empty($item['product_id'])) {
                continue;
            }
            $product = Product::find($item['product_id']);
            if (!$product) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Product not found.',
                    'product_id' => $item['product_id']
                ], 404);
            }
            if (isset($item['variant_id'])) {
                $variant = ProductVariant::find($item['variant_id']);
                if (!$variant) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Variant not found.',
                        'variant_id' => $item['variant_id']
                    ], 404);
                }
                if ($variant->stock_quantity < $item['quantity']) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Insufficient stock for variant.',
                        'product_id' => $item['product_id'],
                        'variant_id' => $item['variant_id'],
                        'available' => $variant->stock_quantity
                    ], 422);
                }
            } else {
                if ($product->stock_quantity < $item['quantity']) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Insufficient stock for product.',
                        'product_id' => $item['product_id'],
                        'available' => $product->stock_quantity
                    ], 422);
                }
            }
        }

        // Create requisition and items in a transaction
        DB::beginTransaction();
        try {
            $requisitionNumber = $this->generateRequisitionNumber($validated['company_id']);
            $requisition = Requisition::create([
                'id' => (string) Str::uuid(),
                'requisition_number' => $requisitionNumber,
                'company_id' => $validated['company_id'],
                'requester_id' => $validated['requester_id'],
                'approver_id' => $validated['approver_id'] ?? null,
                'approval_status' => 'pending',
                'notes' => $validated['notes'] ?? null,
            ]);

            // Create requisition items
            foreach ($validated['items'] as $item) {
                RequisitionItem::create([
                    'id' => (string) Str::uuid(),
                    'requisition_id' => $requisition->id,
                    'product_id' => $item['product_id'] ?? null,
                    'custom_item_name' => $item['custom_item_name'] ?? null,
                    'variant_id' => $item['variant_id'] ?? null,
                    'quantity' => $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Requisition created successfully.',
                'requisition' => $requisition->fresh(['items.product', 'items.variant', 'requester', 'company', 'approver'])
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create requisition', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create requisition.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // List requisitions pending approval for the current user
    public function toApprove(Request $request)
    {
        $user = $request->user();
        $query = Requisition::with(['items.product', 'items.variant', 'requester', 'company', 'approver'])
            ->where('approval_status', 'pending')
            ->where('approver_id', $user->id);
        $requisitions = $query->orderByDesc('created_at')->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'Requisitions pending your approval fetched successfully.',
            'data' => $requisitions
        ]);
    }


    /**
     * True cross-company bypass (system admin, or an explicit cross-company
     * grant) - checked on the raw role rather than the shared hasPermission()
     * helper, since that helper already treats can_manage_company as a
     * blanket "yes" to any permission and would otherwise let GM/Director
     * see every company's requisitions instead of just their own.
     */
    protected function canManageAllCompanies(Request $request): bool
    {
        $role = $request->user()->role;
        return $role && ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_all_requisitions'));
    }

    // List all requisitions - everyone sees their own; GM/Director (and the
    // cross-company bypass above) see every requisition in scope.
    public function index(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_requisitions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view requisitions.'
            ], 403);
        }
        $user = $request->user();
        $query = Requisition::with(['items.product', 'items.variant', 'requester', 'company', 'approver']);

        $canManageAllCompanies = $this->canManageAllCompanies($request);
        if (!$canManageAllCompanies) {
            $query->where('company_id', $user->company_id);
        }

        if (!$canManageAllCompanies && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            $query->where('requester_id', $user->id);
        }

        $requisitions = $query->orderByDesc('created_at')->paginate(20);
        return response()->json([
            'status' => 'success',
            'message' => 'Requisitions fetched successfully.',
            'data' => $requisitions
        ]);
    }

    // Get a single requisition - same scoping as index() above.
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_requisitions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view requisitions.'
            ], 403);
        }

        $canManageAllCompanies = $this->canManageAllCompanies($request);
        $canManageCompany = $this->hasPermission($request, 'can_manage_company', $user->company_id);

        $requisition = Requisition::with(['items.product', 'items.variant', 'requester', 'company', 'approver'])
            ->where('id', $id)
            ->when(!$canManageAllCompanies, function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->when(!$canManageAllCompanies && !$canManageCompany, function ($q) use ($user) {
                $q->where('requester_id', $user->id);
            })
            ->first();
        if (!$requisition) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Requisition not found or not accessible.'
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Requisition fetched successfully.',
            'data' => $requisition
        ]);
    }

    // Official Purpose PDF: in-stock items print as a "Samples Requisition", custom items as an
    // "Office Maintenance Requisition" — the two are never combined into one document.
    public function printOfficialPurpose(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_requisitions')) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view requisitions.'
            ], 403);
        }

        $type = $request->query('type');
        if (!in_array($type, ['stock', 'custom'], true)) {
            return response()->json([
                'status' => 'failed',
                'message' => "A valid type ('stock' or 'custom') is required."
            ], 422);
        }

        $canManageAllCompanies = $this->canManageAllCompanies($request);
        $canManageCompany = $this->hasPermission($request, 'can_manage_company', $user->company_id);

        $requisition = Requisition::with(['items.product', 'items.variant', 'requester', 'company', 'approver'])
            ->where('id', $id)
            ->when(!$canManageAllCompanies, fn ($q) => $q->where('company_id', $user->company_id))
            ->when(!$canManageAllCompanies && !$canManageCompany, fn ($q) => $q->where('requester_id', $user->id))
            ->first();
        if (!$requisition) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Requisition not found or not accessible.'
            ], 404);
        }

        $dispatch = $requisition->dispatch_id
            ? \App\Models\Dispatch::with(['dispatchItems.batch', 'fromStore', 'createdBy'])->find($requisition->dispatch_id)
            : null;
        $dispatchedByKey = $dispatch
            ? $dispatch->dispatchItems->groupBy(fn ($di) => $di->product_id . '|' . ($di->variant_id ?? ''))
            : collect();

        $items = $requisition->items->filter(fn ($item) => $type === 'stock' ? (bool) $item->product_id : !$item->product_id);

        if ($items->isEmpty()) {
            return response()->json([
                'status' => 'failed',
                'message' => $type === 'stock'
                    ? 'This requisition has no in-stock items to print a Samples Requisition for.'
                    : 'This requisition has no custom items to print an Office Maintenance Requisition for.'
            ], 422);
        }

        $rows = $items->map(function ($item) use ($dispatchedByKey, $dispatch) {
            $isCustom = !$item->product_id;
            $issuedLines = $isCustom ? collect() : $dispatchedByKey->get($item->product_id . '|' . ($item->variant_id ?? ''), collect());
            $batches = $issuedLines->pluck('batch')->filter();

            return [
                'name' => $isCustom ? $item->custom_item_name : ($item->product->name ?? '—'),
                'variant' => $item->variant->name ?? null,
                'notes' => $item->notes,
                'requested' => $item->quantity,
                'issued' => $isCustom || !$dispatch ? null : (int) $issuedLines->sum('quantity'),
                'batches' => $batches->pluck('batch_number')->unique()->implode(', '),
                'expiries' => $batches->pluck('expiry_date')->filter()->map(fn ($d) => $d->format('d M Y'))->unique()->implode(', '),
            ];
        })->values()->all();

        $docTitle = $type === 'stock' ? 'SAMPLES REQUISITION' : 'OFFICE MAINTENANCE REQUISITION';
        $filenamePrefix = $type === 'stock' ? 'samples-requisition' : 'office-maintenance-requisition';

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('requisitions.official-purpose', [
            'requisition' => $requisition,
            'dispatch' => $dispatch,
            'rows' => $rows,
            'company' => $requisition->company,
            'docTitle' => $docTitle,
            'isCustomDoc' => $type === 'custom',
        ])->setPaper('a4', 'portrait');

        $filename = $filenamePrefix . '-' . $requisition->requisition_number . '.pdf';

        return response()->streamDownload(fn () => print($pdf->output()), $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }

    // Update a requisition (metadata only)
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $requisition = Requisition::where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_requisitions'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$requisition) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Requisition not found or not accessible.'
            ], 404);
        }
        $companyId = $requisition->company_id;
        if (!$this->hasPermission($request, 'can_update_requisitions') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this requisition.'
            ], 403);
        }
        $data = $request->all();
        $validator = Validator::make($data, [
            'notes' => 'nullable|string',
            'status' => 'nullable|in:pending,approved,dispatched,acknowledged,rejected',
            'approval_status' => 'nullable|in:pending,in_review,approved,rejected',
            'approver_id' => 'nullable|uuid|exists:users,id',
            'dispatch_id' => 'nullable|uuid|exists:dispatches,id',
            'items' => 'nullable|array|min:1',
            'items.*.product_id' => 'nullable|uuid|exists:products,id',
            'items.*.custom_item_name' => 'nullable|string|max:255',
            'items.*.variant_id' => 'nullable|uuid|exists:product_variants,id',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.notes' => 'nullable|string',
        ]);
        $validator->after(function ($validator) use ($data) {
            foreach (($data['items'] ?? []) as $index => $item) {
                if (empty($item['product_id']) && empty($item['custom_item_name'])) {
                    $validator->errors()->add(
                        "items.$index",
                        'Each item needs either a product or a custom item name.'
                    );
                }
            }
        });
        if ($validator->fails()) {
            $firstError = $validator->errors()->first();
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed: ' . $firstError,
                'message' => $validator->errors(), 'errors' => $validator->errors()
            ], 422);
        }
        $validated = $validator->validated();

        DB::beginTransaction();
        try {
            // Audit log before update
            Log::info('Requisition update initiated', [
                'requisition_id' => $requisition->id,
                'updated_by' => $user->id,
                'updated_at' => now(),
                'fields_updated' => array_keys($data),
                'items_updated' => $data['items'] ?? null,
            ]);

            // Update main requisition fields
            $requisition->update([
                'notes' => $validated['notes'] ?? $requisition->notes,
                'status' => $validated['status'] ?? $requisition->status,
                'approval_status' => $validated['approval_status'] ?? $requisition->approval_status,
                'approver_id' => $validated['approver_id'] ?? $requisition->approver_id,
                'dispatch_id' => $validated['dispatch_id'] ?? $requisition->dispatch_id,
            ]);

            // If items are provided, update them (delete old, add new)
            if (isset($validated['items'])) {
                $requisition->items()->delete();
                foreach ($validated['items'] as $item) {
                    RequisitionItem::create([
                        'id' => (string) Str::uuid(),
                        'requisition_id' => $requisition->id,
                        'product_id' => $item['product_id'] ?? null,
                        'custom_item_name' => $item['custom_item_name'] ?? null,
                        'variant_id' => $item['variant_id'] ?? null,
                        'quantity' => $item['quantity'],
                        'notes' => $item['notes'] ?? null,
                    ]);
                }
            }

            // Audit log after update
            Log::info('Requisition update completed', [
                'requisition_id' => $requisition->id,
                'updated_by' => $user->id,
                'updated_at' => now(),
            ]);

            DB::commit();
            return response()->json([
                'status' => 'success',
                'message' => 'Requisition updated successfully.',
                'data' => $requisition->fresh(['items.product', 'items.variant', 'requester', 'company', 'approver'])
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update requisition', [
                'requisition_id' => $requisition->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Delete a requisition and its items
    public function destroy($id)
    {
        $user = request()->user();
        $requisition = Requisition::where('id', $id)
            ->when(!$this->hasPermission(request(), 'can_manage_all_requisitions'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$requisition) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Requisition not found or not accessible.'
            ], 404);
        }
        $companyId = $requisition->company_id;
        if (!$this->hasPermission(request(), 'can_delete_requisitions') || !$this->canManageCompany(request(), $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this requisition.'
            ], 403);
        }
        $requisition->items()->delete();
        $requisition->delete();
        return response()->json([
            'status' => 'success',
            'message' => 'Requisition deleted successfully.'
        ]);
    }

    // Approve a requisition
    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $requisition = Requisition::where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_requisitions'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$requisition) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Requisition not found or not accessible.'
            ], 404);
        }
        $companyId = $requisition->company_id;
        if (!$this->hasPermission($request, 'can_approve_requisitions') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve this requisition.'
            ], 403);
        }
        $validated = $request->validate([
            'approver_id' => 'required|uuid|exists:users,id',
            'approval_status' => 'required|in:approved,rejected,in_review',
            'notes' => 'nullable|string',
        ]);
        $requisition->update([
            'approver_id' => $validated['approver_id'],
            'approval_status' => $validated['approval_status'],
            'notes' => $validated['notes'] ?? $requisition->notes,
        ]);
        return response()->json([
            'status' => 'success',
            'message' => 'Requisition approved successfully.',
            'data' => $requisition->fresh(['items.product', 'items.variant', 'requester', 'company', 'approver'])
        ]);
    }

    // Acknowledge receipt
    public function acknowledge(Request $request, $id)
    {
        $user = $request->user();
        $requisition = Requisition::where('id', $id)
            ->when(!$this->hasPermission($request, 'can_manage_all_requisitions'), function ($q) use ($user) {
                $q->where('company_id', $user->company_id);
            })
            ->first();
        if (!$requisition) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Requisition not found or not accessible.'
            ], 404);
        }
        $companyId = $requisition->company_id;
        if (!$this->hasPermission($request, 'can_acknowledge_requisitions') || !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to acknowledge this requisition.'
            ], 403);
        }
        $requisition->update(['status' => 'acknowledged']);
        return response()->json([
            'status' => 'success',
            'message' => 'Requisition acknowledged successfully.',
            'data' => $requisition->fresh(['items.product', 'items.variant', 'requester', 'company', 'approver'])
        ]);
    }
}
