<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Order;
use App\Models\Customer;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    /**
     * Initialize the controller with middleware for authentication.
     */
    public function __construct()
    {
        $this->middleware('auth:sanctum')->except(['mpesaCallback']);
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
     * Retrieve a list of payments with optional filters.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_payments', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view payments.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = Payment::with(['order', 'customer']);

            // Always default to user's company
            $companyId = $user->company_id;
            
            // If user has manage_payments permission and explicitly requests another company
            if ($this->hasPermission($request, 'can_manage_payments') && $request->filled('company_id')) {
                $companyId = $request->input('company_id');
            }
            
            $query->where('company_id', $companyId);

            // Apply filters
            if ($request->filled('order_id')) {
                $query->where('order_id', $request->input('order_id'));
            }

            if ($request->filled('customer_id')) {
                $query->where('customer_id', $request->input('customer_id'));
            }

            if ($request->filled('payment_method')) {
                $query->where('payment_method', $request->input('payment_method'));
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            if ($request->filled('date_from')) {
                $query->whereDate('payment_date', '>=', $request->input('date_from'));
            }

            if ($request->filled('date_to')) {
                $query->whereDate('payment_date', '<=', $request->input('date_to'));
            }

            // Handle sorting
            $sortField = $request->input('sort_by', 'created_at');
            $sortDirection = $request->input('sort_direction', 'desc');
            $query->orderBy($sortField, $sortDirection);

            $payments = $query->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Payments retrieved successfully.',
                'payments' => $payments,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve payments', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve payments: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Retrieve details of a specific payment.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_payments', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view payment details.',
            ], 403);
        }

        try {
            $user = $request->user();
            $query = Payment::where('id', $id)
                ->with(['order', 'customer', 'invoice']);

            if (!$this->hasPermission($request, 'can_manage_all_payments')) {
                $query->where('company_id', $user->company_id);
            }

            $payment = $query->first();

            if (!$payment) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Payment not found or not authorized.',
                ], 404);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Payment details retrieved successfully.',
                'payment' => $payment,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to retrieve payment details', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve payment details: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create a new payment.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_payments', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create payments.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'order_id' => 'nullable|uuid|exists:orders,id',
            'payment_method' => 'required|string',
            'amount_paid' => 'required|numeric|min:0.01',
            'transaction_id' => 'nullable|string|max:255',
            'payment_date' => 'nullable|date',
            'status' => 'required|string',
            'generate_invoice' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $orderId = $request->input('order_id');
            $customerId = $request->input('customer_id');
            $companyId = $user->company_id;
            $order = null;
            if ($orderId) {
                $order = Order::lockForUpdate()->with('customer')->find($orderId);
                if (!$order) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Order not found.',
                    ], 404);
                }
                if (!$this->hasPermission($request, 'can_create_payments', $order->company_id)) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Unauthorized to create payments for this order.',
                    ], 403);
                }
                $companyId = $order->company_id;
                $customerId = $order->customer_id;
            }
            // If no order, check if user can manage their own company
            if (!$order && !$this->hasPermission($request, 'can_create_payments', $companyId)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized to create payments for this company.',
                ], 403);
            }
            DB::enableQueryLog();
            return DB::transaction(function () use ($request, $order, $orderId, $companyId, $customerId) {
                Log::info('Creating payment record', ['order_id' => $orderId]);
                $payment = Payment::create([
                    'id' => (string) Str::uuid(),
                    'order_id' => $orderId,
                    'customer_id' => $customerId,
                    'company_id' => $companyId,
                    'payment_method' => $request->input('payment_method'),
                    'transaction_id' => $request->input('transaction_id'),
                    'amount_paid' => $request->input('amount_paid'),
                    'status' => $request->input('status'),
                    'payment_date' => $request->input('payment_date', now()),
                ]);
                Log::info('Payment created', ['payment_id' => $payment->id]);
                // If payment is for an order, update order and debts
                if ($order) {
                    Log::info('Updating order', ['order_id' => $order->id]);
                    $newAmountPaid = $order->amount_paid + $request->input('amount_paid');
                    $paymentStatus = 'unpaid';
                    if ($newAmountPaid >= $order->final_amount) {
                        $paymentStatus = 'paid';
                    } elseif ($newAmountPaid > 0) {
                        $paymentStatus = 'partial';
                    }
                    $order->update([
                        'amount_paid' => $newAmountPaid,
                        'payment_status' => $paymentStatus,
                    ]);
                    Log::info('Order updated', ['order_id' => $order->id]);
                    // --- Debt auto-update logic ---
                    if ($paymentStatus === 'paid') {
                        $debts = \App\Models\Debt::where('order_id', $order->id)->where('status', '!=', 'paid')->get();
                        foreach ($debts as $debt) {
                            $debt->amount = 0;
                            $debt->status = 'paid';
                            $debt->save();
                        }
                    }
                    // --- End debt auto-update logic ---
                }
                // Only generate invoice if payment is for an order
                if ($order && $request->input('generate_invoice', false) && $payment->status === 'completed') {
                    Log::info('Generating invoice', ['payment_id' => $payment->id]);
                    $invoice = $this->generateInvoice($payment);
                    Log::info('Invoice generated', ['payment_id' => $payment->id, 'invoice_id' => $invoice ? $invoice->id : null]);
                }
                return response()->json([
                    'status' => 'success',
                    'message' => 'Payment created successfully.',
                    'payment' => $payment->load(['order', 'customer']),
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error('Failed to create payment', [
                'error' => $e->getMessage(),
                'queries' => DB::getQueryLog(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing payment.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_payments', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update payments.',
            ], 403);
        }

        $payment = Payment::find($id);
        if (!$payment) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payment not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_update_payments', $payment->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this payment.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'payment_method' => 'sometimes|string',
            'transaction_id' => 'nullable|string|max:255',
            'amount_paid' => 'sometimes|numeric|min:0.01',
            'status' => 'sometimes|string|in:pending,completed,failed,refunded',
            'payment_date' => 'nullable|date',
            'generate_invoice' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::enableQueryLog();
            return DB::transaction(function () use ($request, $payment) {
                $order = Order::lockForUpdate()->find($payment->order_id);
                $oldAmount = $payment->amount_paid;
                $oldStatus = $payment->status;

                if ($request->has('amount_paid') && $request->input('amount_paid') != $oldAmount) {
                    $amountDifference = $request->input('amount_paid') - $oldAmount;
                    $newOrderAmountPaid = $order->amount_paid + $amountDifference;

                    if ($newOrderAmountPaid > $order->final_amount) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Updated payment amount would exceed the order total.',
                        ], 400);
                    }

                    $paymentStatus = 'unpaid';
                    if ($newOrderAmountPaid >= $order->final_amount) {
                        $paymentStatus = 'paid';
                    } elseif ($newOrderAmountPaid > 0) {
                        $paymentStatus = 'partial';
                    }

                    Log::info('Updating order', ['order_id' => $order->id]);
                    $order->update([
                        'amount_paid' => $newOrderAmountPaid,
                        'payment_status' => $paymentStatus,
                    ]);
                    Log::info('Order updated', ['order_id' => $order->id]);
                }

                Log::info('Updating payment', ['payment_id' => $payment->id]);
                $payment->update($request->only([
                    'payment_method',
                    'transaction_id',
                    'amount_paid',
                    'status',
                    'payment_date',
                ]));
                Log::info('Payment updated', ['payment_id' => $payment->id]);

                if (
                    $request->input('generate_invoice', false) ||
                    ($oldStatus !== 'completed' && $payment->status === 'completed' && !$payment->invoice)
                ) {
                    Log::info('Generating invoice', ['payment_id' => $payment->id]);
                    $invoice = $this->generateInvoice($payment);
                    Log::info('Invoice generated', ['payment_id' => $payment->id, 'invoice_id' => $invoice ? $invoice->id : null]);
                }

                return response()->json([
                    'status' => 'success',
                    'message' => 'Payment updated successfully.',
                    'payment' => $payment->load(['order', 'customer', 'invoice']),
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to update payment', [
                'error' => $e->getMessage(),
                'queries' => DB::getQueryLog(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Process M-Pesa callback.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function mpesaCallback(Request $request)
    {
        try {
            Log::info('M-Pesa callback received', ['data' => $request->all()]);

            $validator = Validator::make($request->all(), [
                'TransactionType' => 'required|string',
                'TransID' => 'required|string',
                'TransTime' => 'required|string',
                'TransAmount' => 'required|numeric',
                'BusinessShortCode' => 'required|string',
                'BillRefNumber' => 'required|string',
                'PhoneNumber' => 'required|string',
                'FirstName' => 'nullable|string',
                'LastName' => 'nullable|string',
                'ResultCode' => 'required|integer',
                'ResultDesc' => 'required|string',
            ]);

            if ($validator->fails()) {
                Log::error('M-Pesa callback validation failed', ['message' => $validator->errors(), 'errors' => $validator->errors()]);
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Invalid callback data',
                    'message' => $validator->errors(), 'errors' => $validator->errors(),
                ], 400);
            }

            if ($request->input('ResultCode') !== 0) {
                Log::warning('M-Pesa transaction failed', [
                    'ResultCode' => $request->input('ResultCode'),
                    'ResultDesc' => $request->input('ResultDesc'),
                ]);
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Transaction failed: ' . $request->input('ResultDesc'),
                ], 400);
            }

            $orderNumber = $request->input('BillRefNumber');
            $order = Order::lockForUpdate()->where('order_number', $orderNumber)->first();

            if (!$order) {
                Log::error('Order not found for M-Pesa payment', ['order_number' => $orderNumber]);
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Order not found',
                ], 404);
            }

            DB::enableQueryLog();
            return DB::transaction(function () use ($request, $order) {
                $existingPayment = Payment::where('transaction_id', $request->input('TransID'))
                    ->where('payment_method', 'mpesa')
                    ->first();

                if ($existingPayment) {
                    Log::warning('Duplicate M-Pesa transaction detected', [
                        'TransID' => $request->input('TransID'),
                    ]);
                    return response()->json([
                        'status' => 'success',
                        'message' => 'Payment already processed',
                    ], 200);
                }

                $amount = (float) $request->input('TransAmount');

                Log::info('Creating payment record', ['order_id' => $order->id]);
                $payment = Payment::create([
                    'id' => (string) Str::uuid(),
                    'order_id' => $order->id,
                    'customer_id' => $order->customer_id ?? throw new \Exception('Customer ID is null'),
                    'company_id' => $order->company_id ?? throw new \Exception('Company ID is null'),
                    'payment_method' => 'mpesa',
                    'transaction_id' => $request->input('TransID'),
                    'amount_paid' => $amount,
                    'status' => 'completed',
                    'payment_date' => now(),
                ]);
                Log::info('Payment created', ['payment_id' => $payment->id]);

                Log::info('Updating order', ['order_id' => $order->id]);
                $newAmountPaid = $order->amount_paid + $amount;
                $paymentStatus = 'unpaid';
                if ($newAmountPaid >= $order->final_amount) {
                    $paymentStatus = 'paid';
                } elseif ($newAmountPaid > 0) {
                    $paymentStatus = 'partial';
                }
                $order->update([
                    'amount_paid' => $newAmountPaid,
                    'payment_status' => $paymentStatus,
                ]);
                Log::info('Order updated', ['order_id' => $order->id]);

                Log::info('Generating invoice', ['payment_id' => $payment->id]);
                $invoice = $this->generateInvoice($payment);
                Log::info('Invoice generated', ['payment_id' => $payment->id, 'invoice_id' => $invoice ? $invoice->id : null]);

                $logData = [
                    'timestamp' => now()->toDateTimeString(),
                    'transaction_id' => $request->input('TransID'),
                    'amount' => $amount,
                    'phone' => $request->input('PhoneNumber'),
                    'customer_name' => $request->input('FirstName') . ' ' . $request->input('LastName'),
                    'order_number' => $request->input('BillRefNumber'),
                    'status' => 'success',
                ];
                $logPath = storage_path('logs/payment_log.txt');
                file_put_contents($logPath, json_encode($logData) . PHP_EOL, FILE_APPEND);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Payment processed successfully',
                ], 200);
            });
        } catch (\Exception $e) {
            Log::error('Failed to process M-Pesa callback', [
                'error' => $e->getMessage(),
                'queries' => DB::getQueryLog(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to process payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate an invoice for a payment.
     *
     * @param Payment $payment
     * @return Invoice|null
     */
    protected function generateInvoice(Payment $payment)
    {
        try {
            if ($payment->invoice) {
                Log::info('Invoice already exists', ['payment_id' => $payment->id]);
                return $payment->invoice;
            }

            $order = Order::with(['orderItems.product', 'orderItems.variant', 'customer'])
                ->find($payment->order_id);

            if (!$order) {
                Log::error('Order not found for invoice generation', [
                    'payment_id' => $payment->id,
                    'order_id' => $payment->order_id,
                ]);
                throw new \Exception('Order not found');
            }

            if (!$order->company_id) {
                Log::error('Missing company_id', [
                    'payment_id' => $payment->id,
                    'order_id' => $payment->order_id,
                ]);
                throw new \Exception('Invalid order data: missing company_id');
            }

            Log::info('Creating invoice', ['payment_id' => $payment->id]);
            
            $invoice = Invoice::create([
                'invoice_number' => $this->generateInvoiceNumber($order->company_id, 'sales'),
                'company_id' => $order->company_id,
                'customer_id' => $order->customer_id,
                'order_id' => $order->id,
                'payment_id' => $payment->id,
                'type' => 'sales',
                'status' => 'paid', // Mark as paid since payment is already made
                'invoice_date' => $payment->payment_date ?? now()->toDateString(),
                'due_date' => $payment->payment_date ?? now()->toDateString(),
                'subtotal' => $payment->amount_paid,
                'tax_amount' => 0,
                'discount_amount' => 0,
                'total_amount' => $payment->amount_paid,
                'amount_paid' => $payment->amount_paid,
                'balance_amount' => 0,
                'currency' => $order->currency ?? 'KES',
                'payment_terms' => 'Paid',
                'notes' => 'Auto-generated invoice for payment',
                'paid_at' => $payment->payment_date ?? now(),
                'created_by' => auth()->id() ?? 1, 
            ]);

            // Create line items from order items
            if ($order->orderItems && $order->orderItems->count() > 0) {
                foreach ($order->orderItems as $orderItem) {
                    \App\Models\InvoiceLineItem::create([
                        'invoice_id' => $invoice->id,
                        'product_id' => $orderItem->product_id,
                        'variant_id' => $orderItem->variant_id,
                        'description' => $orderItem->product->name . ($orderItem->variant ? ' - ' . $orderItem->variant->name : ''),
                        'quantity' => $orderItem->quantity,
                        'unit' => 'pcs',
                        'unit_price' => $orderItem->unit_price,
                        'discount_amount' => 0,
                        'tax_rate' => 0,
                        'tax_amount' => 0,
                        'line_total' => $orderItem->quantity * $orderItem->unit_price,
                    ]);
                }
            } else {
                // Create a generic line item if no order items
                \App\Models\InvoiceLineItem::create([
                    'invoice_id' => $invoice->id,
                    'description' => 'Payment for Order #' . $order->order_number,
                    'quantity' => 1,
                    'unit' => 'service',
                    'unit_price' => $payment->amount_paid,
                    'discount_amount' => 0,
                    'tax_rate' => 0,
                    'tax_amount' => 0,
                    'line_total' => $payment->amount_paid,
                ]);
            }

            Log::info('Invoice created', ['invoice_id' => $invoice->id]);

            return $invoice;
        } catch (\Exception $e) {
            Log::error('Failed to generate invoice', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Generate a unique invoice number for the company.
     *
     * @param string $companyId
     * @param string $type
     * @return string
     */
    protected function generateInvoiceNumber($companyId, $type = 'sales')
    {
        $typePrefix = strtoupper(substr($type, 0, 3));
        $prefix = $typePrefix . '-' . substr($companyId, 0, 8) . '-';
        
        // Use raw query to avoid model accessors interfering
        $lastInvoice = DB::table('invoices')
            ->select('invoice_number')
            ->where('company_id', $companyId)
            ->where('invoice_number', 'like', $prefix . '%')
            ->orderBy('invoice_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastInvoice ? (int)substr($lastInvoice->invoice_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Process a refund for a payment.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function refund(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_refund_payments', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to refund payments.',
            ], 403);
        }

        $payment = Payment::find($id);
        if (!$payment) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payment not found.',
            ], 404);
        }

        if (!$this->hasPermission($request, 'can_refund_payments', $payment->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to refund this payment.',
            ], 403);
        }

        if ($payment->status === 'refunded') {
            return response()->json([
                'status' => 'failed',
                'message' => 'Payment has already been refunded.',
            ], 400);
        }

        $validator = Validator::make($request->all(), [
            'refund_reason' => 'required|string|max:255',
            'partial_amount' => 'nullable|numeric|min:0.01|max:' . $payment->amount_paid,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            DB::enableQueryLog();
            return DB::transaction(function () use ($request, $payment) {
                $order = Order::lockForUpdate()->find($payment->order_id);
                $refundAmount = $request->input('partial_amount', $payment->amount_paid);

                $newAmountPaid = $order->amount_paid - $refundAmount;
                $paymentStatus = 'unpaid';
                if ($newAmountPaid >= $order->final_amount) {
                    $paymentStatus = 'paid';
                } elseif ($newAmountPaid > 0) {
                    $paymentStatus = 'partial';
                }

                Log::info('Updating order', ['order_id' => $order->id]);
                $order->update([
                    'amount_paid' => $newAmountPaid,
                    'payment_status' => $paymentStatus,
                ]);
                Log::info('Order updated', ['order_id' => $order->id]);

                if ($refundAmount < $payment->amount_paid) {
                    Log::info('Updating payment for partial refund', ['payment_id' => $payment->id]);
                    $payment->update([
                        'amount_paid' => $payment->amount_paid - $refundAmount,
                        'notes' => ($payment->notes ? $payment->notes . '; ' : '') .
                                   'Partial refund of ' . $refundAmount . ' processed on ' . now()->toDateTimeString() .
                                   '. Reason: ' . $request->input('refund_reason'),
                    ]);
                    Log::info('Payment updated', ['payment_id' => $payment->id]);

                    Log::info('Creating refund record', ['payment_id' => $payment->id]);
                    $refund = Payment::create([
                        'id' => (string) Str::uuid(),
                        'order_id' => $payment->order_id,
                        'customer_id' => $payment->customer_id,
                        'company_id' => $payment->company_id,
                        'payment_method' => $payment->payment_method,
                        'transaction_id' => $payment->transaction_id . '-REFUND',
                        'amount_paid' => -$refundAmount,
                        'status' => 'refunded',
                        'payment_date' => now(),
                        'notes' => 'Refund for payment ID: ' . $payment->id . '. Reason: ' . $request->input('refund_reason'),
                    ]);
                    Log::info('Refund record created', ['refund_id' => $refund->id]);

                    return response()->json([
                        'status' => 'success',
                        'message' => 'Payment partially refunded successfully.',
                        'original_payment' => $payment->fresh(),
                        'refund' => $refund,
                    ], 200);
                } else {
                    Log::info('Updating payment for full refund', ['payment_id' => $payment->id]);
                    $payment->update([
                        'status' => 'refunded',
                        'notes' => ($payment->notes ? $payment->notes . '; ' : '') .
                                   'Full refund processed on ' . now()->toDateTimeString() .
                                   '. Reason: ' . $request->input('refund_reason'),
                    ]);
                    Log::info('Payment updated', ['payment_id' => $payment->id]);

                    return response()->json([
                        'status' => 'success',
                        'message' => 'Payment fully refunded successfully.',
                        'payment' => $payment->fresh(),
                    ], 200);
                }
            });
        } catch (\Exception $e) {
            Log::error('Failed to refund payment', [
                'error' => $e->getMessage(),
                'queries' => DB::getQueryLog(),
            ]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to refund payment: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate payment reports.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function reports(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_payment_reports', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view payment reports.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'group_by' => 'sometimes|in:day,week,month,payment_method,status',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $user = $request->user();
            $query = Payment::whereBetween('payment_date', [
                $request->input('date_from'),
                $request->input('date_to'),
            ]);

            // Always default to user's company
            $companyId = $user->company_id;
            
            // If user has manage_all_payments permission and explicitly requests another company
            if ($this->hasPermission($request, 'can_manage_all_payments') && $request->filled('company_id')) {
                $companyId = $request->input('company_id');
            }
            
            $query->where('company_id', $companyId);

            $groupBy = $request->input('group_by', 'day');
            $summary = [];

            if ($groupBy === 'day') {
                $records = $query->selectRaw('DATE(payment_date) as date, SUM(amount_paid) as total, COUNT(*) as count')
                    ->groupBy(DB::raw('DATE(payment_date)'))
                    ->orderBy('date')
                    ->get();

                foreach ($records as $record) {
                    $summary[] = [
                        'date' => $record->date,
                        'total' => (float) $record->total,
                        'count' => $record->count,
                    ];
                }
            } elseif ($groupBy === 'week') {
                $records = $query->selectRaw('YEARWEEK(payment_date) as year_week, MIN(payment_date) as start_date, SUM(amount_paid) as total, COUNT(*) as count')
                    ->groupBy(DB::raw('YEARWEEK(payment_date)'))
                    ->orderBy('year_week')
                    ->get();

                foreach ($records as $record) {
                    $startDate = new \DateTime($record->start_date);
                    $summary[] = [
                        'week' => $startDate->format('W'),
                        'year' => $startDate->format('Y'),
                        'start_date' => $startDate->format('Y-m-d'),
                        'total' => (float) $record->total,
                        'count' => $record->count,
                    ];
                }
            } elseif ($groupBy === 'month') {
                $records = $query->selectRaw('YEAR(payment_date) as year, MONTH(payment_date) as month, SUM(amount_paid) as total, COUNT(*) as count')
                    ->groupBy(DB::raw('YEAR(payment_date), MONTH(payment_date)'))
                    ->orderBy('year')
                    ->orderBy('month')
                    ->get();

                foreach ($records as $record) {
                    $summary[] = [
                        'year' => $record->year,
                        'month' => $record->month,
                        'total' => (float) $record->total,
                        'count' => $record->count,
                    ];
                }
            } elseif ($groupBy === 'payment_method') {
                $records = $query->selectRaw('payment_method, SUM(amount_paid) as total, COUNT(*) as count')
                    ->groupBy('payment_method')
                    ->orderBy('total', 'desc')
                    ->get();

                foreach ($records as $record) {
                    $summary[] = [
                        'payment_method' => $record->payment_method,
                        'total' => (float) $record->total,
                        'count' => $record->count,
                    ];
                }
            } elseif ($groupBy === 'status') {
                $records = $query->selectRaw('status, SUM(amount_paid) as total, COUNT(*) as count')
                    ->groupBy('status')
                    ->orderBy('total', 'desc')
                    ->get();

                foreach ($records as $record) {
                    $summary[] = [
                        'status' => $record->status,
                        'total' => (float) $record->total,
                        'count' => $record->count,
                    ];
                }
            }

            $totals = $query->selectRaw('SUM(amount_paid) as total, COUNT(*) as count')->first();

            return response()->json([
                'status' => 'success',
                'message' => 'Payment reports generated successfully.',
                'date_range' => [
                    'from' => $request->input('date_from'),
                    'to' => $request->input('date_to'),
                ],
                'summary' => $summary,
                'totals' => [
                    'total_amount' => (float) $totals->total,
                    'total_count' => $totals->count,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to generate payment reports', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate payment reports: ' . $e->getMessage(),
            ], 500);
        }
    }
}