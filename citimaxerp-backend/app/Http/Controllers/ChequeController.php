<?php

namespace App\Http\Controllers;

use App\Models\Cheque;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentRefund;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Services\AccountingIntegrationService;
use App\Services\InvoicePaymentApplicationService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ChequeController extends Controller
{
    protected InvoicePaymentApplicationService $paymentApplication;
    protected AccountingIntegrationService $accountingService;

    public function __construct(InvoicePaymentApplicationService $paymentApplication, AccountingIntegrationService $accountingService)
    {
        $this->middleware('auth:sanctum');
        $this->paymentApplication = $paymentApplication;
        $this->accountingService = $accountingService;
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
     * List PD cheques for the company, most-imminent maturity first.
     * Covers both directions - received from customers and issued to
     * suppliers.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (
            !$this->hasPermission($request, 'can_view_invoices', $user->company_id)
            && !$this->hasPermission($request, 'can_view_suppliers', $user->company_id)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Cheque::with(['customer:id,name', 'invoice:id,invoice_number', 'supplier:id,name', 'purchaseOrder:id,order_number'])
            ->where('company_id', $user->company_id);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('direction')) {
            $query->where('direction', $request->direction);
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }
        if ($request->filled('invoice_id')) {
            $query->where('invoice_id', $request->invoice_id);
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->supplier_id);
        }

        $cheques = $query->orderBy('maturity_date')->get();

        return response()->json(['data' => $cheques]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (
            !$this->hasPermission($request, 'can_view_invoices', $user->company_id)
            && !$this->hasPermission($request, 'can_view_suppliers', $user->company_id)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $cheque = Cheque::with(['customer:id,name', 'invoice:id,invoice_number', 'supplier:id,name', 'purchaseOrder:id,order_number'])
            ->where('company_id', $user->company_id)
            ->findOrFail($id);

        return response()->json(['data' => $cheque]);
    }

    /**
     * Record a post-dated cheque received against an invoice. Stays 'pending' and
     * does not touch the invoice balance until it is approved (i.e. matured/cleared).
     */
    public function store(Request $request): JsonResponse
    {
        $direction = $request->input('direction', 'received');

        return $direction === 'issued'
            ? $this->storeIssued($request)
            : $this->storeReceived($request);
    }

    protected function storeReceived(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_invoices', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'invoice_id' => 'required|uuid',
            'cheque_number' => 'required|string|max:100',
            'bank_name' => 'required|string|max:150',
            'amount' => 'required|numeric|min:0.01',
            'issue_date' => 'required|date',
            'maturity_date' => 'required|date|after_or_equal:issue_date',
            'notes' => 'nullable|string',
            'attachment' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $invoice = Invoice::where('company_id', $user->company_id)->findOrFail($request->invoice_id);

        $balance = $invoice->total_amount - $invoice->getTotalAllocatedAmount();
        if ($request->amount > $balance) {
            return response()->json([
                'message' => 'Cheque amount exceeds invoice balance',
                'balance_due' => $balance,
            ], 400);
        }

        $attachmentPath = null;
        if ($request->hasFile('attachment')) {
            $attachmentPath = $request->file('attachment')->store('cheques', 's3');
        }

        $cheque = Cheque::create([
            'id' => Str::uuid(),
            'company_id' => $user->company_id,
            'direction' => 'received',
            'customer_id' => $invoice->customer_id,
            'invoice_id' => $invoice->id,
            'cheque_number' => $request->cheque_number,
            'bank_name' => $request->bank_name,
            'amount' => $request->amount,
            'issue_date' => $request->issue_date,
            'maturity_date' => $request->maturity_date,
            'status' => 'pending',
            'notes' => $request->notes,
            'attachment_path' => $attachmentPath,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'message' => 'Cheque recorded as pending. It will be applied to the invoice once approved.',
            'data' => $cheque,
        ], 201);
    }

    /**
     * Record a post-dated cheque issued to a supplier (or, if invoice_id is
     * given instead, a refund cheque issued to a client). Purely a tracking
     * record for the maturity alert - it does NOT create a SupplierPayment
     * or touch purchase order balances, since a post-dated cheque hasn't
     * actually paid anything until it clears the bank.
     */
    protected function storeIssued(Request $request): JsonResponse
    {
        $user = $request->user();
        if (
            !$this->hasPermission($request, 'can_update_suppliers', $user->company_id)
            && !$this->hasPermission($request, 'can_update_invoices', $user->company_id)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'supplier_id' => 'nullable|uuid',
            'purchase_order_id' => 'nullable|uuid',
            'invoice_id' => 'nullable|uuid',
            // A refund cheque to a customer: either against a specific
            // invoice, or just the customer directly (e.g. an overpayment
            // refund with no single invoice to tie it to).
            'customer_id' => 'nullable|uuid',
            // Anything else the company pays by cheque with no supplier or
            // customer master record - office supplies, logistics/courier
            // fees, etc.
            'payee_name' => 'required_without_all:supplier_id,invoice_id,customer_id|nullable|string|max:150',
            'cheque_number' => 'required|string|max:100',
            'bank_name' => 'required|string|max:150',
            'amount' => 'required|numeric|min:0.01',
            'issue_date' => 'required|date',
            'maturity_date' => 'required|date|after_or_equal:issue_date',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $refundCustomerId = $request->input('customer_id');
        if ($request->filled('supplier_id')) {
            Supplier::where('company_id', $user->company_id)->findOrFail($request->supplier_id);
        }
        if ($request->filled('customer_id')) {
            Customer::where('company_id', $user->company_id)->findOrFail($request->customer_id);
        }
        if ($request->filled('invoice_id')) {
            $refundInvoice = Invoice::where('company_id', $user->company_id)->findOrFail($request->invoice_id);
            $refundCustomerId = $refundInvoice->customer_id;
        }

        $cheque = Cheque::create([
            'id' => Str::uuid(),
            'company_id' => $user->company_id,
            'direction' => 'issued',
            'supplier_id' => $request->input('supplier_id'),
            'customer_id' => $refundCustomerId,
            'payee_name' => $request->input('payee_name'),
            'purchase_order_id' => $request->input('purchase_order_id'),
            'invoice_id' => $request->input('invoice_id'),
            'cheque_number' => $request->cheque_number,
            'bank_name' => $request->bank_name,
            'amount' => $request->amount,
            'issue_date' => $request->issue_date,
            'maturity_date' => $request->maturity_date,
            'status' => 'pending',
            'notes' => $request->notes,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'message' => 'Issued cheque recorded. The MD and GM will be alerted a week before it matures so funds are ready.',
            'data' => $cheque,
        ], 201);
    }

    /**
     * Approve a matured cheque.
     *
     * Received: applies it as a real payment against its invoice (creating
     * the Payment/allocation and accounting entry) - it is now a receivable.
     *
     * Issued: just marks it cleared/honoured by the bank. Deliberately does
     * NOT create a SupplierPayment or touch purchase order balances - that
     * posting decision belongs to the actual supplier-payment workflow, not
     * this tracking record.
     */
    public function approve(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_invoices', $user->company_id)
            && !$this->hasPermission($request, 'can_update_suppliers', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $cheque = Cheque::where('company_id', $user->company_id)->findOrFail($id);

        if ($cheque->status !== 'pending') {
            return response()->json(['message' => "Only pending cheques can be approved (current status: {$cheque->status})"], 400);
        }

        if ($cheque->direction === 'issued') {
            DB::beginTransaction();
            try {
                $cheque->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                ]);

                // Only now has the cheque actually turned into real money - post it
                // against the purchase order/accounting the same way a normal
                // (non-cheque) supplier payment is posted immediately at record time.
                if ($cheque->supplier_payment_id) {
                    $payment = SupplierPayment::find($cheque->supplier_payment_id);
                    if ($payment && $payment->status === 'pending') {
                        $payment->update(['status' => 'completed']);

                        if ($cheque->purchase_order_id) {
                            $purchaseOrder = PurchaseOrder::lockForUpdate()->find($cheque->purchase_order_id);
                            if ($purchaseOrder) {
                                $newAmountPaid = $purchaseOrder->amount_paid + $payment->amount;
                                $poStatus = 'unpaid';
                                if ($newAmountPaid >= $purchaseOrder->total_amount && $purchaseOrder->total_amount > 0) {
                                    $poStatus = 'paid';
                                } elseif ($newAmountPaid > 0) {
                                    $poStatus = 'partial';
                                }
                                $purchaseOrder->update([
                                    'amount_paid' => $newAmountPaid,
                                    'payment_status' => $poStatus,
                                ]);
                            }
                        }

                        $supplier = $cheque->supplier_id ? Supplier::find($cheque->supplier_id) : null;
                        if ($supplier) {
                            $this->accountingService->setCompany($cheque->company_id);
                            $this->accountingService->setUser($user->id);
                            $this->accountingService->recordSupplierPayment([
                                'company_id' => $cheque->company_id,
                                'supplier_id' => $supplier->id,
                                'supplier_name' => $supplier->supplier_name,
                                'amount' => $payment->amount,
                                'payment_method' => 'cheque',
                                'date' => now()->toDateString(),
                                'reference' => $payment->payment_number,
                                'source_id' => $payment->id,
                                'source_type' => SupplierPayment::class,
                            ]);
                        }
                    }
                }

                // A refund cheque handing back a customer's overpayment - only now
                // does the excess actually leave the business, so only now does it
                // stop counting toward the payment's available balance.
                if ($cheque->payment_refund_id) {
                    $refund = PaymentRefund::find($cheque->payment_refund_id);
                    if ($refund && $refund->status === 'pending') {
                        $refund->update(['status' => 'completed']);
                        $payment = Payment::find($refund->payment_id);
                        if ($payment) {
                            $payment->update(['amount_refunded' => (float) $payment->amount_refunded + (float) $refund->amount]);
                        }
                    }
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('Failed to finalize cleared cheque', ['cheque_id' => $cheque->id, 'error' => $e->getMessage()]);
                return response()->json(['message' => 'Failed to clear cheque', 'error' => $e->getMessage()], 500);
            }

            return response()->json([
                'message' => 'Cheque marked as cleared',
                'data' => $cheque->fresh(['supplier:id,name', 'purchaseOrder:id,order_number']),
            ]);
        }

        try {
            $invoice = Invoice::where('company_id', $user->company_id)->findOrFail($cheque->invoice_id);

            $result = $this->paymentApplication->applyPayment(
                $invoice,
                $user,
                (float) $cheque->amount,
                'cheque',
                $cheque->cheque_number,
                "Cheque {$cheque->cheque_number} ({$cheque->bank_name}), matured " . $cheque->maturity_date->toDateString(),
                $cheque->maturity_date->toDateString(),
            );

            $cheque->update([
                'status' => 'approved',
                'payment_id' => $result['payment']->id,
                'approved_by' => $user->id,
                'approved_at' => now(),
            ]);

            return response()->json([
                'message' => 'Cheque approved and applied to invoice',
                'data' => $cheque->fresh(['customer:id,name', 'invoice:id,invoice_number']),
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        } catch (\Exception $e) {
            Log::error('Failed to approve cheque', ['cheque_id' => $cheque->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to approve cheque', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Mark a pending cheque as bounced (dishonoured). Since it was never applied
     * to the invoice, no reversal of payments/accounting entries is needed.
     */
    public function bounce(Request $request, string $id): JsonResponse
    {
        return $this->transitionPendingOnly($request, $id, 'bounced');
    }

    /**
     * Cancel a pending cheque (e.g. recorded in error, or returned to the customer).
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        return $this->transitionPendingOnly($request, $id, 'cancelled');
    }

    protected function transitionPendingOnly(Request $request, string $id, string $newStatus): JsonResponse
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_invoices', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $cheque = Cheque::where('company_id', $user->company_id)->findOrFail($id);

        if ($cheque->status !== 'pending') {
            return response()->json(['message' => "Only pending cheques can be marked as {$newStatus} (current status: {$cheque->status})"], 400);
        }

        $cheque->update(['status' => $newStatus]);

        // It never turned into real money - the linked supplier payment record
        // should stop showing as "pending" and reflect that it didn't go through.
        if ($cheque->supplier_payment_id) {
            SupplierPayment::where('id', $cheque->supplier_payment_id)
                ->where('status', 'pending')
                ->update(['status' => 'failed']);
        }

        // Same for a refund cheque that bounced/was cancelled - the excess it
        // was meant to hand back is still available (never left the business).
        if ($cheque->payment_refund_id) {
            PaymentRefund::where('id', $cheque->payment_refund_id)
                ->where('status', 'pending')
                ->update(['status' => 'failed']);
        }

        return response()->json([
            'message' => "Cheque marked as {$newStatus}",
            'data' => $cheque->fresh(['customer:id,name', 'invoice:id,invoice_number']),
        ]);
    }
}
