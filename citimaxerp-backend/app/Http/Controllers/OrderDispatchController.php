<?php

namespace App\Http\Controllers;

use App\Models\OrderDispatch;
use App\Models\OrderDispatchItem;
use App\Models\Order;
use App\Models\Logistic;
use App\Models\User;
use App\Models\CompanyAccountingSettings;
use App\Services\AccountingWorkflowService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class OrderDispatchController extends Controller
{
    protected AccountingWorkflowService $accountingWorkflow;

    public function __construct(AccountingWorkflowService $accountingWorkflow)
    {
        $this->middleware('auth:sanctum');
        $this->accountingWorkflow = $accountingWorkflow;
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
     * Generate a unique dispatch number for the company.
     * Format: ODI-{companyId8}-{sequential 4 digits}
     */
    protected function generateDispatchNumber($companyId)
    {
        $prefix = 'ODI-' . substr($companyId, 0, 8) . '-';

        $lastDispatch = DB::table('order_dispatches')
            ->select('dispatch_number')
            ->where('dispatch_number', 'like', $prefix . '%')
            ->orderBy('dispatch_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastDispatch ? (int) substr($lastDispatch->dispatch_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Get all order dispatches
     */
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view order dispatches.',
            ], 403);
        }

        $query = OrderDispatch::with([
            'order.customer',
            'items.product',
            'items.variant',
            'fromStore',
            'deliveryLocation',
            'logistic.deliveryPerson',
            'createdBy:id,first_name,last_name,email',
        ])->where('company_id', $user->company_id);

        // Filters
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('approval_status')) {
            $query->where('approval_status', $request->approval_status);
        }
        if ($request->has('order_id')) {
            $query->where('order_id', $request->order_id);
        }
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $perPage = $request->get('per_page', 15);
        $perPage = min($perPage, 100);

        $dispatches = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Batch-load every approver referenced across this page's dispatches in a
        // single query, instead of the N+1 pattern of calling approver_users /
        // getCurrentApprover() per row (each does its own User::find()). With a
        // slow/remote DB connection those per-row queries easily blow past PHP's
        // execution time limit and truncate the JSON response mid-stream.
        $approverIds = collect();
        foreach ($dispatches->items() as $dispatch) {
            foreach ((array) $dispatch->approvers as $approver) {
                if (!empty($approver['user_id'])) {
                    $approverIds->push($approver['user_id']);
                }
            }
        }
        $approverUsers = User::withTrashed()
            ->whereIn('id', $approverIds->unique()->values())
            ->get()
            ->keyBy('id');

        // Add approver details to each dispatch
        $dispatches->getCollection()->transform(function ($dispatch) use ($approverUsers) {
            $approvers = collect((array) $dispatch->approvers);

            $dispatch->approver_details = $approvers->map(function ($approver) use ($approverUsers) {
                return [
                    'user' => $approverUsers->get($approver['user_id']),
                    'order' => $approver['order'],
                    'status' => $approver['status'],
                    'approved_at' => $approver['approved_at'],
                    'comments' => $approver['comments'],
                ];
            });

            $pending = $approvers->where('status', 'pending')->sortBy('order')->first();
            $dispatch->current_approver = $pending ? $approverUsers->get($pending['user_id']) : null;

            $dispatch->approval_progress = $dispatch->getApprovalProgress();
            return $dispatch;
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Order dispatches retrieved successfully',
            'data' => $dispatches->items(),
            'meta' => [
                'current_page' => $dispatches->currentPage(),
                'last_page' => $dispatches->lastPage(),
                'per_page' => $dispatches->perPage(),
                'total' => $dispatches->total(),
            ],
        ], 200);
    }

    /**
     * Get a single order dispatch
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_view_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view order dispatches.',
            ], 403);
        }

        $dispatch = OrderDispatch::with([
            'order.customer',
            'order.orderItems.product',
            'order.orderItems.variant',
            'items.product',
            'items.variant',
            'fromStore',
            'deliveryLocation',
            'logistic.deliveryPerson',
            'createdBy:id,first_name,last_name,email',
        ])->where('company_id', $user->company_id)
            ->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        // Add approver details
        $dispatch->approver_details = $dispatch->approver_users;
        $dispatch->current_approver = $dispatch->getCurrentApprover();
        $dispatch->approval_progress = $dispatch->getApprovalProgress();

        return response()->json([
            'success' => true,
            'message' => 'Order dispatch retrieved successfully',
            'data' => $dispatch,
        ], 200);
    }

    /**
     * Create a new order dispatch from an order
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_create_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create order dispatches.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'order_id' => 'required|uuid|exists:orders,id',
            'notes' => 'nullable|string|max:1000',
            'estimated_delivery_date' => 'nullable|date|after_or_equal:today',
            'special_instructions' => 'nullable|string|max:1000',
            'approvers' => 'nullable|array|min:1',
            'approvers.*' => 'required|uuid|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Get the order with items
            $order = Order::with(['orderItems.product', 'orderItems.variant', 'deliveryLocation'])
                ->where('company_id', $user->company_id)
                ->find($request->order_id);

            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'Order not found in your company',
                ], 404);
            }

            if ($order->orderItems->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Order has no items to dispatch',
                ], 422);
            }



            // Create the dispatch
            $dispatch = new OrderDispatch();
            $dispatch->id = (string) Str::uuid();
            $dispatch->dispatch_number = $this->generateDispatchNumber($user->company_id);
            $dispatch->order_id = $order->id;
            $dispatch->company_id = $user->company_id;
            $dispatch->from_store_id = $order->store_id ?? null; // Order may not have store_id, fetch from product if needed
            $dispatch->delivery_location_id = $order->delivery_location_id;
            $dispatch->approval_status = 'draft';
            $dispatch->status = 'draft';
            $dispatch->notes = $request->notes;
            $dispatch->estimated_delivery_date = $request->estimated_delivery_date;
            $dispatch->special_instructions = $request->special_instructions;
            $dispatch->created_by = $user->id;

            // Handle approvers
            if ($request->has('approvers') && !empty($request->approvers)) {
                // Custom approvers provided
                $approvers = collect($request->approvers)->map(function ($userId, $index) {
                    return [
                        'user_id' => $userId,
                        'order' => $index + 1,
                        'status' => 'pending',
                        'approved_at' => null,
                        'comments' => null,
                    ];
                })->toArray();

                $dispatch->approvers = $approvers;
            } else {
                // Use default approvers from company settings
                $dispatch->initializeDefaultApprovers();
            }

            // Validate at least 1 approver
            if (empty($dispatch->approvers)) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'At least one approver is required. Please configure default approvers in company settings or provide custom approvers.',
                ], 422);
            }

            $dispatch->save();

            // Create dispatch items from order items
            foreach ($order->orderItems as $orderItem) {
                $dispatchItem = new OrderDispatchItem();
                $dispatchItem->id = (string) Str::uuid();
                $dispatchItem->order_dispatch_id = $dispatch->id;
                $dispatchItem->order_item_id = $orderItem->id;
                $dispatchItem->product_id = $orderItem->product_id;
                $dispatchItem->variant_id = $orderItem->variant_id;
                $dispatchItem->product_code = $orderItem->product->product_code ?? null;
                $dispatchItem->quantity = $orderItem->quantity;
                $dispatchItem->unit_id = $orderItem->unit_id ?? null;

                // Copy packaging breakdown if available
                if (isset($orderItem->packaging_breakdown)) {
                    $dispatchItem->packaging_breakdown = $orderItem->packaging_breakdown;
                }

                // Carry over which batch(es) FEFO drew from at order time, so
                // whoever picks/packs this dispatch knows exactly which
                // batch/expiry to pull off the shelf.
                if (!empty($orderItem->batch_allocations)) {
                    $dispatchItem->batch_allocations = $orderItem->batch_allocations;
                }

                $dispatchItem->damaged_quantity = 0;
                $dispatchItem->save();
            }

            // Update order dispatch status
            $order->dispatch_status = 'dispatch_created';
            $order->save();

            DB::commit();

            // Load relationships for response
            $dispatch->load([
                'order',
                'items.product',
                'items.variant',
                'deliveryLocation',
            ]);

            $dispatch->approver_details = $dispatch->approver_users;
            $dispatch->current_approver = $dispatch->getCurrentApprover();

            return response()->json([
                'success' => true,
                'message' => 'Order dispatch created successfully',
                'data' => $dispatch,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating order dispatch: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to create order dispatch',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a draft order dispatch
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_update_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update order dispatches.',
            ], 403);
        }

        $dispatch = OrderDispatch::where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if (!$dispatch->canBeEdited()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot update dispatch in current status. Only draft dispatches can be edited.',
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string|max:1000',
            'approvers' => 'nullable|array|min:1',
            'approvers.*' => 'required|uuid|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            if ($request->has('notes')) {
                $dispatch->notes = $request->notes;
            }

            // Update approvers if provided
            if ($request->has('approvers')) {
                $approvers = collect($request->approvers)->map(function ($userId, $index) {
                    return [
                        'user_id' => $userId,
                        'order' => $index + 1,
                        'status' => 'pending',
                        'approved_at' => null,
                        'comments' => null,
                    ];
                })->toArray();

                $dispatch->approvers = $approvers;
            }

            // Validate at least 1 approver
            if (empty($dispatch->approvers)) {
                return response()->json([
                    'success' => false,
                    'message' => 'At least one approver is required.',
                ], 422);
            }

            $dispatch->save();

            $dispatch->load(['order', 'items', 'deliveryLocation']);
            $dispatch->approver_details = $dispatch->approver_users;
            $dispatch->current_approver = $dispatch->getCurrentApprover();

            return response()->json([
                'success' => true,
                'message' => 'Order dispatch updated successfully',
                'data' => $dispatch,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error updating order dispatch: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update order dispatch',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a draft order dispatch
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_delete_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete order dispatches.',
            ], 403);
        }

        $dispatch = OrderDispatch::where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if ($dispatch->approval_status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete dispatch in current status. Only draft dispatches can be deleted.',
            ], 409);
        }

        try {
            DB::beginTransaction();

            // Delete items first
            OrderDispatchItem::where('order_dispatch_id', $dispatch->id)->delete();

            // Delete dispatch
            $dispatch->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Order dispatch deleted successfully',
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error deleting order dispatch: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete order dispatch',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Submit dispatch for approval
     */
    public function submitForApproval(Request $request, $id)
    {
        $user = $request->user();

        // Whoever can create a dispatch can submit it; approval (can_approve_order_dispatches) is the control.
        if (!$this->hasPermission($request, 'can_create_order_dispatches', $user->company_id)
            && !$this->hasPermission($request, 'can_dispatch_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to submit order dispatches for approval.',
            ], 403);
        }

        $dispatch = OrderDispatch::where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if ($dispatch->approval_status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Dispatch has already been submitted for approval',
            ], 409);
        }

        if (empty($dispatch->approvers)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot submit without approvers. Please add at least one approver.',
            ], 422);
        }

        try {
            $dispatch->approval_status = 'pending';
            $dispatch->status = 'pending';
            $dispatch->save();

            $dispatch->load(['order', 'items', 'deliveryLocation']);
            $dispatch->approver_details = $dispatch->approver_users;
            $dispatch->current_approver = $dispatch->getCurrentApprover();

            return response()->json([
                'success' => true,
                'message' => 'Dispatch submitted for approval successfully',
                'data' => $dispatch,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error submitting dispatch for approval: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to submit dispatch for approval',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Approve the dispatch (by current approver)
     */
    public function approve(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_approve_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to approve order dispatches.',
            ], 403);
        }

        $dispatch = OrderDispatch::where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if (!in_array($dispatch->approval_status, ['pending', 'in_progress'])) {
            return response()->json([
                'success' => false,
                'message' => 'Dispatch is not pending approval',
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'comments' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $dispatch->approve($user, $request->comments);

            if ($dispatch->isFullyApproved()) {
                $dispatch->order->dispatch_status = 'dispatch_approved';
                $dispatch->order->save();
            }

            $dispatch->load(['order', 'items', 'deliveryLocation']);
            $dispatch->approver_details = $dispatch->approver_users;
            $dispatch->current_approver = $dispatch->getCurrentApprover();
            $dispatch->approval_progress = $dispatch->getApprovalProgress();

            $message = $dispatch->isFullyApproved()
                ? 'Dispatch fully approved and ready for logistics'
                : 'Dispatch approved successfully. Waiting for next approver.';

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $dispatch,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error approving dispatch: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Reject the dispatch (by current approver)
     */
    public function reject(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_approve_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to reject order dispatches.',
            ], 403);
        }

        $dispatch = OrderDispatch::where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if (!in_array($dispatch->approval_status, ['pending', 'in_progress'])) {
            return response()->json([
                'success' => false,
                'message' => 'Dispatch is not pending approval',
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $dispatch->reject($user, $request->reason);

            $dispatch->load(['order', 'items', 'deliveryLocation']);
            $dispatch->approver_details = $dispatch->approver_users;

            return response()->json([
                'success' => true,
                'message' => 'Dispatch rejected successfully',
                'data' => $dispatch,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error rejecting dispatch: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Create logistics for approved dispatch
     */
    public function createLogistics(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_dispatch_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create logistics for dispatches.',
            ], 403);
        }

        $dispatch = OrderDispatch::where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if (!$dispatch->canBeDispatched()) {
            return response()->json([
                'success' => false,
                'message' => 'Dispatch must be fully approved before creating logistics',
            ], 409);
        }

        if ($dispatch->logistic_id) {
            return response()->json([
                'success' => false,
                'message' => 'Logistics already created for this dispatch',
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'delivery_person_id' => 'nullable|uuid|exists:delivery_persons,id',
            'driver_name' => 'required_without:delivery_person_id|string|max:255',
            'driver_contact' => 'required_without:delivery_person_id|string|max:20',
            'vehicle_registration' => 'required|string|max:50',
            'vehicle_type' => 'nullable|string|max:100',
            'estimated_delivery_time' => 'nullable|date',
            'pickup_location' => 'nullable|string|max:255',
            'delivery_location' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $logistic = new Logistic();
            $logistic->id = (string) Str::uuid();
            $logistic->order_dispatch_id = $dispatch->id;
            $logistic->company_id = $user->company_id;

            if ($request->has('delivery_person_id') && !empty($request->delivery_person_id)) {
                $deliveryPerson = \App\Models\DeliveryPerson::find($request->delivery_person_id);
                if ($deliveryPerson) {
                    $logistic->delivery_person_id = $deliveryPerson->id;
                    // Auto-fill details from delivery person if not explicitly provided
                    $logistic->driver_name = $request->input('driver_name', $deliveryPerson->full_name);
                    $logistic->driver_contact = $request->input('driver_contact', $deliveryPerson->phone_number);
                }
            } else {
                $logistic->driver_name = $request->driver_name;
                $logistic->driver_contact = $request->driver_contact;
            }

            $logistic->vehicle_registration = $request->vehicle_registration;
            $logistic->vehicle_type = $request->vehicle_type;
            $logistic->estimated_delivery_time = $request->estimated_delivery_time;
            $logistic->pickup_location = $request->pickup_location;
            $logistic->delivery_location = $request->delivery_location;
            $logistic->notes = $request->notes;
            $logistic->status = 'pending';
            $logistic->save();

            $dispatch->logistic_id = $logistic->id;
            $dispatch->status = 'in_transit';
            $dispatch->dispatch_date = now();
            $dispatch->save();

            DB::commit();

            $dispatch->load(['order', 'items', 'deliveryLocation', 'logistic.deliveryPerson']);

            return response()->json([
                'success' => true,
                'message' => 'Logistics created successfully',
                'data' => $dispatch,
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creating logistics: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to create logistics',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark dispatch as delivered
     */
    public function markDelivered(Request $request, $id)
    {
        $user = $request->user();

        if (!$this->hasPermission($request, 'can_dispatch_order_dispatches', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to mark dispatches as delivered.',
            ], 403);
        }

        $dispatch = OrderDispatch::with('items', 'logistic')->where('company_id', $user->company_id)->find($id);

        if (!$dispatch) {
            return response()->json([
                'success' => false,
                'message' => 'Order dispatch not found',
            ], 404);
        }

        if ($dispatch->status !== 'in_transit') {
            return response()->json([
                'success' => false,
                'message' => 'Only in-transit dispatches can be marked as delivered',
            ], 409);
        }

        // Proof of delivery (the customer-stamped delivery note) must be on file
        // before a dispatch can be closed out as delivered.
        if (!$dispatch->logistic || !$dispatch->logistic->delivery_note_file) {
            return response()->json([
                'success' => false,
                'message' => 'Upload the stamped delivery note before marking this dispatch as delivered.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|uuid|exists:order_dispatch_items,id',
            'items.*.delivered_quantity' => 'required|numeric|min:0',
            'items.*.damaged_quantity' => 'required|numeric|min:0',
            'items.*.delivery_notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation error',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            foreach ($request->items as $itemData) {
                $item = $dispatch->items->where('id', $itemData['item_id'])->first();

                if (!$item) {
                    throw new \Exception("Item {$itemData['item_id']} not found in dispatch");
                }

                $totalAccounted = $itemData['delivered_quantity'] + $itemData['damaged_quantity'];
                if ($totalAccounted != $item->quantity) {
                    throw new \Exception("Delivered + Damaged quantities must equal original quantity for item {$item->product_code}");
                }

                $item->delivered_quantity = $itemData['delivered_quantity'];
                $item->damaged_quantity = $itemData['damaged_quantity'];
                $item->delivery_notes = $itemData['delivery_notes'] ?? null;
                $item->save();
            }

            $dispatch->status = 'delivered';
            $dispatch->actual_delivery_date = now();
            $dispatch->save();

            if ($dispatch->logistic) {
                $dispatch->logistic->status = 'delivered';
                $dispatch->logistic->actual_delivery_time = now();
                $dispatch->logistic->save();
            }

            // Create accounting entry based on company settings
            // Some companies record sales revenue when delivery is confirmed
            try {
                $order = $dispatch->order;
                if ($order) {
                    $result = $this->accountingWorkflow
                        ->forCompany($dispatch->company_id)
                        ->asUser($user->id)
                        ->onOrderDelivered($order, $dispatch);

                    if ($result) {
                        Log::info('Accounting entry created on delivery confirmation', [
                            'dispatch_id' => $dispatch->id,
                            'order_id' => $order->id,
                            'journal_id' => $result['journal_id'] ?? null
                        ]);
                    } else {
                        Log::info('Accounting entry skipped (not triggered on delivery)', [
                            'dispatch_id' => $dispatch->id,
                            'order_id' => $order->id
                        ]);
                    }
                }
            } catch (\Exception $accountingError) {
                // Log but don't fail the delivery - accounting can be reconciled later
                Log::warning('Failed to create accounting entry on delivery', [
                    'dispatch_id' => $dispatch->id,
                    'error' => $accountingError->getMessage()
                ]);
            }

            DB::commit();

            $dispatch->load(['order', 'items.product', 'deliveryLocation', 'logistic']);

            return response()->json([
                'success' => true,
                'message' => 'Dispatch marked as delivered successfully',
                'data' => $dispatch,
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error marking dispatch as delivered: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
