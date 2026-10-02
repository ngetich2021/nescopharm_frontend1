<?php

namespace App\Http\Controllers;

use App\Models\SupplierPayment;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\Cheque;
use App\Services\AccountingIntegrationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SupplierPaymentController extends Controller
{
    protected $accountingService;

    public function __construct(AccountingIntegrationService $accountingService)
    {
        $this->middleware('auth:sanctum');
        $this->accountingService = $accountingService;
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        if (!$user->role) {
            return false;
        }
        if ($user->role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($user->role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $user->role->hasPermission($permission);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_payments', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view supplier payments.',
            ], 403);
        }

        $query = SupplierPayment::with(['supplier', 'purchaseOrder'])
            ->where('company_id', $user->company_id);

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->input('supplier_id'));
        }

        if ($request->filled('purchase_order_id')) {
            $query->where('purchase_order_id', $request->input('purchase_order_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('payment_date', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('payment_date', '<=', $request->input('date_to'));
        }

        $payments = $query->orderBy('payment_date', 'desc')->paginate(20);

        return response()->json([
            'status' => 'success',
            'message' => 'Supplier payments retrieved successfully.',
            'data' => $payments,
        ], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_payments', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'required|uuid|exists:suppliers,id',
            'purchase_order_id' => 'nullable|uuid|exists:purchase_orders,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_method' => 'required|string',
            'transaction_reference' => 'nullable|string',
            'notes' => 'nullable|string',
            // A cheque isn't guaranteed money until it clears, so it needs
            // enough detail to track to maturity - see the isCheque branch below.
            'cheque_number' => 'required_if:payment_method,cheque|string|max:100',
            'bank_name' => 'required_if:payment_method,cheque|string|max:150',
            'maturity_date' => 'required_if:payment_method,cheque|date|after_or_equal:payment_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $isCheque = $request->input('payment_method') === 'cheque';

        try {
            DB::beginTransaction();

            $companyId = $user->company_id;
            $purchaseOrder = null;

            if ($request->filled('purchase_order_id')) {
                $purchaseOrder = PurchaseOrder::lockForUpdate()->find($request->input('purchase_order_id'));
                if ($purchaseOrder->company_id !== $companyId) {
                    DB::rollBack();
                    return response()->json(['message' => 'Unauthorized PO access'], 403);
                }

                $balanceOwed = (float) $purchaseOrder->total_amount - (float) $purchaseOrder->amount_paid;
                if ((float) $request->input('amount') > $balanceOwed) {
                    DB::rollBack();
                    return response()->json([
                        'message' => 'Payment amount (' . number_format((float) $request->input('amount'), 2)
                            . ') exceeds the balance owed (' . number_format($balanceOwed, 2) . ') on this purchase order.',
                    ], 422);
                }
            }

            // Create Payment Record. A cheque isn't real money yet - it stays
            // "pending" and doesn't touch the PO balance or accounting until
            // ChequeController::approve() clears it (mirrors how a received
            // cheque against a customer invoice is only applied on approval).
            $payment = SupplierPayment::create([
                'company_id' => $companyId,
                'supplier_id' => $request->input('supplier_id'),
                'purchase_order_id' => $request->input('purchase_order_id'),
                'amount' => $request->input('amount'),
                'payment_date' => $request->input('payment_date'),
                'payment_method' => $request->input('payment_method'),
                'transaction_reference' => $request->input('transaction_reference'),
                'notes' => $request->input('notes'),
                'status' => $isCheque ? 'pending' : 'completed',
            ]);

            if ($isCheque) {
                Cheque::create([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'direction' => 'issued',
                    'supplier_id' => $request->input('supplier_id'),
                    'purchase_order_id' => $request->input('purchase_order_id'),
                    'supplier_payment_id' => $payment->id,
                    'cheque_number' => $request->input('cheque_number'),
                    'bank_name' => $request->input('bank_name'),
                    'amount' => $payment->amount,
                    'issue_date' => $request->input('payment_date'),
                    'maturity_date' => $request->input('maturity_date'),
                    'status' => 'pending',
                    'notes' => $request->input('notes'),
                    'created_by' => $user->id,
                ]);
            } else {
                // Update Purchase Order if exists
                if ($purchaseOrder) {
                    $newAmountPaid = $purchaseOrder->amount_paid + $payment->amount;
                    // Ensure we don't exceed total (optional, but good practice. Maybe warn or allow overpayment?)
                    // For now, let's allow it but just update status.

                    $status = 'unpaid';
                    if ($newAmountPaid >= $purchaseOrder->total_amount && $purchaseOrder->total_amount > 0) {
                        $status = 'paid';
                    } elseif ($newAmountPaid > 0) {
                        $status = 'partial';
                    }

                    $purchaseOrder->update([
                        'amount_paid' => $newAmountPaid,
                        'payment_status' => $status,
                    ]);
                }

                // Accounting Integration
                try {
                    $supplier = Supplier::find($request->input('supplier_id'));
                    $this->accountingService->setCompany($companyId);
                    $this->accountingService->setUser($user->id);

                    $this->accountingService->recordSupplierPayment([
                        'company_id' => $companyId,
                        'supplier_id' => $supplier->id,
                        'supplier_name' => $supplier->supplier_name,
                        'amount' => $payment->amount,
                        'payment_method' => $payment->payment_method,
                        'date' => $payment->payment_date->toDateString(),
                        'reference' => $payment->payment_number,
                        'source_id' => $payment->id,
                        'source_type' => SupplierPayment::class,
                    ]);
                } catch (\Exception $e) {
                    // Should we fail the whole transaction if accounting fails?
                    // Yes, to ensure data consistency.
                    throw $e;
                }
            }

            DB::commit();

            $payment->load(['supplier', 'purchaseOrder']);

            return response()->json([
                'status' => 'success',
                'message' => $isCheque
                    ? 'Cheque recorded - pending clearance. It will not reduce the purchase order balance until approved, and the Director/GM will be alerted a week before it matures.'
                    : 'Payment recorded successfully',
                'payment' => $payment,
                'data' => $payment,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create supplier payment', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to record payment: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $payment = SupplierPayment::with(['supplier', 'purchaseOrder'])->find($id);

        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if (!$this->hasPermission($request, 'can_view_payments', $payment->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($payment->company_id !== $user->company_id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($payment);
    }
}
