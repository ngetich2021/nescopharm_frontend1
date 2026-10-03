<?php

namespace App\Http\Controllers;

use App\Models\Logistic;
use App\Models\Order;
use App\Models\DeliveryPerson;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LogisticController extends Controller
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

    /**
     * List all logistics records for the user's company.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }
        if (!$this->hasPermission($request, 'can_view_logistics', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view logistics records.',
            ], 403);
        }

        // Eager load orderDispatch and its related order
        $query = Logistic::with(['orderDispatch.order', 'deliveryPerson', 'deliveryNoteReviewedBy:id,first_name,last_name']);
        $query->where('company_id', $user->company_id);

        if ($request->filled('delivery_status')) {
            $query->where('delivery_status', $request->input('delivery_status'));
        }
        if ($request->filled('delivery_person_id')) {
            $query->where('delivery_person_id', $request->input('delivery_person_id'));
        }

        // Filter by order_id via the orderDispatch relationship
        if ($request->filled('order_id')) {
            $query->whereHas('orderDispatch', function ($q) use ($request) {
                $q->where('order_id', $request->input('order_id'));
            });
        }

        // Filter by order_dispatch_id directly if provided
        if ($request->filled('order_dispatch_id')) {
            $query->where('order_dispatch_id', $request->input('order_dispatch_id'));
        }

        if ($request->filled('tracking_number')) {
            $query->where('tracking_number', 'like', '%' . $request->input('tracking_number') . '%');
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('recipient_name', 'ilike', "%{$search}%")
                  ->orWhere('recipient_phone', 'ilike', "%{$search}%")
                  ->orWhere('tracking_number', 'ilike', "%{$search}%")
                  ->orWhere('driver_name', 'ilike', "%{$search}%")
                  ->orWhere('delivery_address', 'ilike', "%{$search}%")
                  ->orWhereHas('orderDispatch', function ($q2) use ($search) {
                      $q2->where('dispatch_number', 'ilike', "%{$search}%");
                  });
            });
        }

        $perPage = $request->input('per_page', 15);
        $logistics = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'message' => 'Logistics records retrieved successfully.',
            'logistics' => $logistics->items(),
            'meta' => [
                'current_page' => $logistics->currentPage(),
                'last_page' => $logistics->lastPage(),
                'per_page' => $logistics->perPage(),
                'total' => $logistics->total(),
            ],
        ], 200);
    }

    /**
     * View details of a single logistics record.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }
        if (!$this->hasPermission($request, 'can_view_logistics', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view logistics records.',
            ], 403);
        }
        $query = Logistic::where('id', $id)
            ->with(['orderDispatch.order', 'deliveryPerson', 'company'])
            ->where('company_id', $user->company_id);
        $logistic = $query->first();
        if (!$logistic) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Logistics record not found or not authorized.',
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Logistics record retrieved successfully.',
            'logistic' => $logistic,
        ], 200);
    }

    /**
     * Create a new logistics record for order dispatch.
     * This would typically be called from OrderController when an order is dispatched.
     *
     * @param Order $order
     * @param array $data
     * @return Logistic
     */
    public function storeForOrderDispatch(Order $order, array $data)
    {
        try {
            return DB::transaction(function () use ($order, $data) {
                $logistic = Logistic::create(array_merge($data, [
                    'id' => (string) Str::uuid(),
                    'order_id' => $order->id,
                    'company_id' => $order->company_id,
                    'dispatch_time' => now(),
                    'delivery_status' => $data['delivery_status'] ?? 'dispatched',
                ]));

                // Update order status if needed
                if (isset($data['update_order_status']) && $data['update_order_status']) {
                    $order->update(['status' => 'dispatched']);
                }

                return $logistic;
            });
        } catch (\Exception $e) {
            Log::error('Failed to create logistics record', [
                'error' => $e->getMessage(),
                'order_id' => $order->id
            ]);
            throw $e;
        }
    }

    /**
     * Update an existing logistics record.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }
        if (!$this->hasPermission($request, 'can_update_logistics', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update logistics records.',
            ], 403);
        }
        $logistic = Logistic::find($id);
        if (!$logistic) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Logistics record not found.',
            ], 404);
        }
        if ($logistic->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this logistics record.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'delivery_person_id' => 'sometimes|uuid|exists:delivery_persons,id',
            'logistics_provider' => 'sometimes|string|max:255',
            'delivery_method' => 'sometimes|string|max:255',
            'vehicle_type' => 'sometimes|string|max:255',
            'vehicle_id' => 'sometimes|string|max:255',
            'tracking_number' => 'sometimes|string|max:255',
            'transporter_invoice_number' => 'sometimes|nullable|string|max:255',
            'delivery_status' => 'sometimes|string|in:dispatched,in_transit,delivered,failed,returned,cancelled',
            'recipient_name' => 'sometimes|string|max:255',
            'recipient_phone' => 'sometimes|string|max:50',
            'delivery_address' => 'sometimes|string',
            'delivery_location' => 'sometimes|string|max:255',
            'city' => 'sometimes|string|max:100',
            'state' => 'sometimes|string|max:100',
            'region' => 'sometimes|string|max:100',
            'country' => 'sometimes|string|max:100',
            'estimated_delivery_time' => 'sometimes|date',
            'actual_delivery_time' => 'sometimes|date',
            'signature' => 'sometimes',
            'notes' => 'sometimes|string',
            'update_order_status' => 'sometimes|boolean',
            'delivery_cost' => 'sometimes|numeric|min:0',
            'amount_paid' => 'sometimes|numeric|min:0',
            'payment_method' => 'sometimes|string|max:100',
            'payment_reference' => 'sometimes|string|max:255',
            'payment_date' => 'sometimes|date',
            'cheque_number' => 'sometimes|string|max:100',
            'bank_name' => 'sometimes|string|max:150',
            'cheque_maturity_date' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            return DB::transaction(function () use ($request, $logistic, $user) {
                $updates = $request->except(['update_order_status']);
                if ($request->has('delivery_cost') || $request->has('amount_paid')) {
                    $updates['payment_status'] = $this->resolvePaymentStatus(
                        $request->input('delivery_cost', $logistic->delivery_cost),
                        $request->input('amount_paid', $logistic->amount_paid)
                    );
                }
                $wasDelivered = $logistic->delivery_status === 'delivered';

                // The customer-stamped delivery note is proof of receipt - a dispatch
                // can't be closed out as delivered without one on file.
                if (!$wasDelivered
                    && $request->input('delivery_status') === 'delivered'
                    && !$logistic->delivery_note_file) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Upload the stamped delivery note before marking this delivery as delivered.',
                    ], 422);
                }

                $logistic->update($updates);

                if ($request->has('transporter_invoice_number') && $logistic->delivery_invoice_id) {
                    \App\Models\DeliveryInvoice::where('id', $logistic->delivery_invoice_id)
                        ->update(['transporter_invoice_number' => $request->input('transporter_invoice_number')]);
                }

                // Update order status if requested
                if ($request->input('update_order_status', false)) {
                    $order = Order::find($logistic->order_id);
                    if ($order) {
                        $deliveryStatus = $request->input('delivery_status');

                        if ($deliveryStatus === 'delivered') {
                            $order->update(['status' => 'completed']);
                        } elseif (in_array($deliveryStatus, ['failed', 'returned', 'cancelled'])) {
                            $order->update(['status' => 'cancelled']);
                        } elseif ($deliveryStatus === 'in_transit') {
                            $order->update(['status' => 'dispatched']);
                        }
                    }
                }

                // Auto-generate the Delivery Note once the dispatch is concluded.
                if (!$wasDelivered && $logistic->delivery_status === 'delivered' && $logistic->orderDispatch) {
                    $logistic->orderDispatch->status = 'delivered';
                    $logistic->orderDispatch->actual_delivery_date = now();
                    $logistic->orderDispatch->save();

                    \App\Http\Controllers\DeliveryNoteController::generateForDispatch(
                        $logistic->orderDispatch,
                        $user->id
                    );
                }

                return response()->json([
                    'status' => 'success',
                    'message' => 'Logistics record updated successfully.',
                    'logistic' => $logistic->fresh(),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to update logistics record', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update logistics record: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload a photo/scan of the delivery note once the client has stamped
     * or signed it, as proof the order was actually received.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadDeliveryNote(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }
        if (!$this->hasPermission($request, 'can_update_logistics', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update logistics records.',
            ], 403);
        }

        $logistic = Logistic::find($id);
        if (!$logistic) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Logistics record not found.',
            ], 404);
        }
        if ($logistic->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this logistics record.',
            ], 403);
        }

        if ($logistic->delivery_note_status === 'approved') {
            return response()->json([
                'status' => 'failed',
                'message' => 'This delivery note has already been approved and can no longer be replaced.',
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'delivery_note' => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }

        // Uses the app's default disk, not a hardcoded 's3' - the R2 disk is
        // currently misconfigured (see FILESYSTEM_DISK comment in .env), which
        // silently swallowed uploads (put() returned true but the file was never
        // actually retrievable).
        $path = $request->file('delivery_note')->store('delivery-notes', config('filesystems.default'));

        $logistic->update([
            'delivery_note_file' => $path,
            'delivery_note_uploaded_at' => now(),
            'delivery_note_uploaded_by' => $user->id,
            'delivery_note_status' => 'pending_review',
            'delivery_note_reviewed_by' => null,
            'delivery_note_reviewed_at' => null,
            'delivery_note_review_comment' => null,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Delivery note uploaded successfully.',
            'logistic' => $logistic->fresh(),
        ], 200);
    }

    /**
     * GM / Director confirms the uploaded stamped delivery note, or sends it
     * back so the correct one can be uploaded.
     */
    public function reviewDeliveryNote(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }

        $roleName = optional($user->role)->name;
        $isReviewer = $roleName && in_array(strtolower($roleName), ['gm', 'director'], true);
        if (!$isReviewer && !$this->hasPermission($request, 'can_manage_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Only the GM or Director can review delivery notes.',
            ], 403);
        }

        $logistic = Logistic::find($id);
        if (!$logistic) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Logistics record not found.',
            ], 404);
        }
        if ($logistic->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to review this logistics record.',
            ], 403);
        }
        if (!$logistic->delivery_note_file) {
            return response()->json([
                'status' => 'failed',
                'message' => 'No delivery note has been uploaded yet.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'action' => 'required|in:approve,resubmit',
            'comment' => 'nullable|string|max:1000|required_if:action,resubmit',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 422);
        }

        $logistic->update([
            'delivery_note_status' => $request->input('action') === 'approve' ? 'approved' : 'resubmit_requested',
            'delivery_note_reviewed_by' => $user->id,
            'delivery_note_reviewed_at' => now(),
            'delivery_note_review_comment' => $request->input('comment'),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => $request->input('action') === 'approve'
                ? 'Delivery note approved.'
                : 'Resubmission requested - the correct delivery note must be uploaded.',
            'logistic' => $logistic->fresh(['deliveryNoteReviewedBy', 'deliveryNoteUploadedBy']),
        ], 200);
    }

    /**
     * Create a logistics record for manual dispatch.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthenticated. Please log in.',
            ], 401);
        }
        if (!$this->hasPermission($request, 'can_create_logistics', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create logistics records.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'order_dispatch_id' => 'required|uuid|exists:order_dispatches,id',
            'delivery_person_id' => 'nullable|uuid|exists:delivery_persons,id',
            'logistics_provider' => 'nullable|string|max:255',
            'delivery_method' => 'nullable|string|max:255',
            'vehicle_type' => 'nullable|string|max:255',
            'vehicle_id' => 'nullable|string|max:255',
            'tracking_number' => 'nullable|string|max:255',
            'transporter_invoice_number' => 'nullable|string|max:255',
            'delivery_status' => 'required|string|in:dispatched,in_transit,delivered,failed,returned,cancelled',
            'recipient_name' => 'nullable|string|max:255',
            'recipient_phone' => 'nullable|string|max:50',
            'delivery_address' => 'nullable|string',
            'delivery_location' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'region' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'estimated_delivery_time' => 'nullable|date',
            'notes' => 'nullable|string',
            'update_order_status' => 'sometimes|boolean',
            // What was paid to the delivery/logistics provider for this
            // dispatch - distinct from the customer's payment for the goods.
            // Manual entry path (kept for backward compatibility).
            'delivery_cost' => 'nullable|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|string|max:100',
            'payment_reference' => 'nullable|string|max:255',
            'payment_date' => 'nullable|date',
            'cheque_number' => 'nullable|string|max:100',
            'bank_name' => 'nullable|string|max:150',
            'cheque_maturity_date' => 'nullable|date',
            // Rate-based path: warehouse manager picks an approved transporter
            // rate + carton count, and the app computes the cost and raises a
            // Delivery Invoice for the accountant to pay before dispatch proceeds.
            'delivery_rate_id' => 'nullable|uuid|exists:delivery_rates,id',
            'number_of_cartons' => 'nullable|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $dispatch = \App\Models\OrderDispatch::with('order')->find($request->input('order_dispatch_id'));

            if (!$dispatch) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Order Dispatch not found.',
                ], 404);
            }

            // Allow if user can manage all logistics OR matches company
            if (!$this->hasPermission($request, 'can_manage_all_logistics') && $dispatch->company_id !== $user->company_id) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to create logistics for this dispatch.',
                ], 403);
            }

            // A dispatch can only ever be sent out once - block re-dispatching
            // an order that already has a logistics/driver assignment.
            if ($dispatch->logistic_id) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Logistics already created for this dispatch.',
                ], 409);
            }

            if ($dispatch->approval_status !== 'approved') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'This dispatch must be approved before it can be dispatched.',
                ], 422);
            }

            return DB::transaction(function () use ($request, $dispatch, $user) {
                // Rate-based path: transporter + zone rate approved by GM/Director,
                // warehouse manager just enters carton count. The app computes the
                // cost and raises a Delivery Invoice - the dispatch is held at its
                // current status until the accountant pays it (see
                // DeliveryInvoiceController::pay()).
                $deliveryRate = null;
                $pendingPayment = false;
                if ($request->filled('delivery_rate_id') && $request->filled('number_of_cartons')) {
                    $deliveryRate = \App\Models\DeliveryRate::where('company_id', $dispatch->company_id)
                        ->where('id', $request->input('delivery_rate_id'))
                        ->where('status', 'approved')
                        ->whereRaw('is_active = true')
                        ->first();

                    if (!$deliveryRate) {
                        throw new \Exception('Selected delivery rate is not approved or not available.');
                    }

                    $pendingPayment = true;
                }

                $deliveryCost = $request->input('delivery_cost');
                $amountPaid = $request->input('amount_paid');
                if ($deliveryRate) {
                    $deliveryCost = $deliveryRate->rate_per_carton * (int) $request->input('number_of_cartons');
                    $amountPaid = 0;
                }

                $logistic = Logistic::create([
                    'id' => (string) Str::uuid(),
                    'order_dispatch_id' => $dispatch->id,
                    'company_id' => $dispatch->company_id,
                    'delivery_rate_id' => $deliveryRate?->id,
                    'number_of_cartons' => $request->input('number_of_cartons'),
                    'delivery_person_id' => $request->input('delivery_person_id'),
                    'logistics_provider' => $deliveryRate?->transporter_name ?? $request->input('logistics_provider'),
                    'delivery_method' => $request->input('delivery_method'),
                    'vehicle_type' => $request->input('vehicle_type'),
                    'vehicle_id' => $request->input('vehicle_id'),
                    'tracking_number' => $request->input('tracking_number'),
                    'transporter_invoice_number' => $request->input('transporter_invoice_number'),
                    'delivery_status' => $pendingPayment ? 'pending_payment' : $request->input('delivery_status'),
                    'recipient_name' => $request->input('recipient_name'),
                    'recipient_phone' => $request->input('recipient_phone'),
                    'delivery_address' => $request->input('delivery_address'),
                    'delivery_location' => $request->input('delivery_location'),
                    'city' => $request->input('city'),
                    'state' => $request->input('state'),
                    'region' => $request->input('region'),
                    'country' => $request->input('country', 'Kenya'),
                    'dispatch_time' => now(),
                    'estimated_delivery_time' => $request->input('estimated_delivery_time'),
                    'notes' => $request->input('notes'),
                    'delivery_cost' => $deliveryCost,
                    'amount_paid' => $amountPaid,
                    'payment_method' => $request->input('payment_method'),
                    'payment_reference' => $request->input('payment_reference'),
                    'payment_date' => $request->input('payment_date'),
                    'cheque_number' => $request->input('cheque_number'),
                    'bank_name' => $request->input('bank_name'),
                    'cheque_maturity_date' => $request->input('cheque_maturity_date'),
                    'payment_status' => $pendingPayment ? 'unpaid' : $this->resolvePaymentStatus($deliveryCost, $amountPaid),
                ]);

                // Link back to the dispatch so OrderDispatch::logistic() resolves
                // and the "Dispatch Order" action can no longer be re-triggered
                // for this dispatch (see the logistic_id guard above).
                $dispatch->logistic_id = $logistic->id;
                $dispatch->save();

                // Raise the Delivery Invoice immediately for the accountant to pay.
                if ($deliveryRate) {
                    $invoice = \App\Models\DeliveryInvoice::create([
                        'company_id' => $dispatch->company_id,
                        'order_dispatch_id' => $dispatch->id,
                        'delivery_rate_id' => $deliveryRate->id,
                        'invoice_number' => $this->generateDeliveryInvoiceNumber($dispatch->company_id),
                        'transporter_invoice_number' => $request->input('transporter_invoice_number'),
                        'transporter_name' => $deliveryRate->transporter_name,
                        'zone' => $deliveryRate->zone,
                        'number_of_cartons' => (int) $request->input('number_of_cartons'),
                        'rate_per_carton' => $deliveryRate->rate_per_carton,
                        'total_amount' => $deliveryCost,
                        'status' => 'pending',
                        'created_by' => $user->id,
                    ]);

                    $logistic->delivery_invoice_id = $invoice->id;
                    $logistic->save();

                    \App\Http\Controllers\DeliveryNoteController::generateForDispatch($dispatch, $user->id);
                }

                // Pending-payment dispatches are held where they are (typically
                // 'approved') until the delivery invoice is paid - the requested
                // delivery_status/order_status changes below are skipped in that case.
                if (!$pendingPayment) {
                    // Update order status if requested and order exists
                    if ($request->input('update_order_status', true) && $dispatch->order) {
                        $order = $dispatch->order;
                        $deliveryStatus = $request->input('delivery_status');
                        if ($deliveryStatus === 'delivered') {
                            $order->update(['status' => 'completed']);
                        } elseif (in_array($deliveryStatus, ['failed', 'returned', 'cancelled'])) {
                            // Decide if order should be cancelled or just flagged; usually depends on workflow
                            // Keeping it simple as per previous logic logic, but strict 'cancelled' might be aggressive
                            $order->update(['status' => 'cancelled']);
                        } elseif ($deliveryStatus === 'dispatched' || $deliveryStatus === 'in_transit') {
                            $order->update(['status' => 'dispatched']);
                        }
                    }

                    // Update Dispatch Status as well to keep them in sync
                    // Map 'dispatched' from logistics to 'in_transit' for order_dispatch
                    $dispatchStatus = $request->input('delivery_status');
                    if ($dispatchStatus === 'dispatched') {
                        $dispatchStatus = 'in_transit';
                    }

                    // Ensure the status is valid for order_dispatches
                    if (in_array($dispatchStatus, ['pending', 'approved', 'in_transit', 'delivered', 'cancelled'])) {
                        $dispatch->status = $dispatchStatus;
                        $dispatch->save();
                    }
                }

                return response()->json([
                    'status' => 'success',
                    'message' => $pendingPayment
                        ? 'Logistics record created. A delivery invoice has been sent to accounting - the dispatch will proceed once it is paid.'
                        : 'Logistics record created successfully.',
                    'logistic' => $logistic->load(['orderDispatch', 'deliveryPerson', 'deliveryRate', 'deliveryInvoice']),
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create logistics record', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create logistics record: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate the next delivery invoice number for a company (DI-00001, ...).
     */
    protected function generateDeliveryInvoiceNumber($companyId): string
    {
        $last = \App\Models\DeliveryInvoice::where('company_id', $companyId)
            ->latest('created_at')
            ->first();

        $nextNumber = $last ? ((int) substr($last->invoice_number, 3)) + 1 : 1;
        return 'DI-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Derive the delivery payment status from what's owed vs what's paid.
     */
    protected function resolvePaymentStatus($deliveryCost, $amountPaid): string
    {
        $cost = $deliveryCost !== null ? (float) $deliveryCost : null;
        $paid = (float) ($amountPaid ?? 0);

        if ($cost === null || $cost <= 0) {
            return $paid > 0 ? 'paid' : 'unpaid';
        }

        if ($paid <= 0) {
            return 'unpaid';
        }

        return $paid >= $cost ? 'paid' : 'partial';
    }
}
