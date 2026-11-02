<?php

namespace App\Http\Controllers;

use App\Models\AccountsPayable;
use App\Models\DeliveryInvoice;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentAllocation;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\Cheque;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SupplierPaymentController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
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

        // The Supplier Payments page pages and totals on its own, so it asks for every payment (per_page=all).
        $perPage = $request->input('per_page') === 'all' ? max($query->count(), 1) : (int) $request->input('per_page', 20);
        $payments = $query->with('allocations')->orderBy('payment_date', 'desc')->orderBy('payment_number', 'desc')->paginate(max(1, min($perPage, 10000)));
        $this->withInvoicesPaid($payments->getCollection());

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
            // The supplier's invoices this payment pays (bills and transporter delivery invoices).
            'allocations' => 'nullable|array',
            'allocations.*.type' => 'required_with:allocations|in:bill,delivery_invoice',
            'allocations.*.id' => 'required_with:allocations|uuid',
            'allocations.*.amount' => 'required_with:allocations|numeric|min:0.01',
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

            // Each invoice paid must be this supplier's and still owe at least what is put on it.
            $allocations = [];
            $open = collect($this->openInvoicesFor($companyId, $request->input('supplier_id')))->keyBy(fn ($i) => "{$i['type']}:{$i['id']}");
            foreach ((array) $request->input('allocations', []) as $a) {
                $invoice = $open->get("{$a['type']}:{$a['id']}");
                $amount = round((float) $a['amount'], 2);
                if (!$invoice) {
                    DB::rollBack();
                    return response()->json(['message' => 'One of the invoices is not an unpaid invoice of this supplier. Reload and pick again.'], 422);
                }
                if ($amount > $invoice['balance'] + 0.009) {
                    DB::rollBack();
                    return response()->json(['message' => "KES " . number_format($amount, 2) . " is more than {$invoice['number']} still owes (KES " . number_format($invoice['balance'], 2) . ').'], 422);
                }
                $allocations[] = ['invoice_type' => $a['type'], 'invoice_id' => $a['id'], 'amount' => $amount];
            }
            if (round(array_sum(array_column($allocations, 'amount')), 2) > round((float) $request->input('amount'), 2)) {
                DB::rollBack();
                return response()->json(['message' => 'The invoices picked add up to more than the payment amount.'], 422);
            }
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
            foreach ($allocations as $a) {
                $payment->allocations()->create($a + ['company_id' => $companyId]);
            }
            // Pays the invoices now; a cheque pays them when it clears (ChequeController::approve).
            $payment->applyAllocations();

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

                // Posted to the ledger by LedgerSyncObserver once this commits.
            }

            DB::commit();

            $payment->load(['supplier', 'purchaseOrder', 'allocations']);
            $this->withInvoicesPaid(collect([$payment]));

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

        $payment->load('allocations');
        $this->withInvoicesPaid(collect([$payment]));

        return response()->json($payment);
    }

    /** A supplier's unpaid invoices, oldest first, for the payment form to pay. */
    public function openInvoices(Request $request, $supplierId)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_payments', $user->company_id)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json(['status' => 'success', 'data' => $this->openInvoicesFor($user->company_id, $supplierId)]);
    }

    /**
     * Unpaid supplier bills (not debit notes) and the transporter's delivery invoices, with what each still
     * owes after payments already put on it. Oldest first, the order payments clear them in.
     */
    private function openInvoicesFor(string $companyId, ?string $supplierId): array
    {
        if (!$supplierId) {
            return [];
        }

        $bills = AccountsPayable::where('company_id', $companyId)->where('vendor_id', $supplierId)
            ->whereNotIn('status', ['draft', 'cancelled', 'paid'])
            ->where(fn ($q) => $q->whereNull('metadata')->orWhereRaw("coalesce(metadata::jsonb->>'kind', '') <> 'debit_note'"))
            ->where('balance_amount', '>', 0)
            ->get()
            ->map(fn ($b) => [
                'type' => SupplierPaymentAllocation::BILL, 'id' => $b->id, 'number' => $b->invoice_number,
                'date' => $b->invoice_date?->toDateString(), 'due_date' => $b->due_date?->toDateString(),
                'description' => $b->description, 'total' => round((float) $b->total_amount, 2),
                'paid' => round((float) $b->paid_amount, 2), 'balance' => round((float) $b->balance_amount, 2),
            ]);

        $deliveries = DeliveryInvoice::where('company_id', $companyId)->where('supplier_id', $supplierId)
            ->where('status', 'pending')
            ->get()
            ->map(fn ($d) => [
                'type' => SupplierPaymentAllocation::DELIVERY_INVOICE, 'id' => $d->id, 'number' => SupplierPaymentAllocation::label($d),
                'date' => $d->invoice_date?->toDateString(), 'due_date' => null,
                'description' => $d->order_reference ?: $d->orderDispatch?->order?->order_number,
                'total' => round((float) $d->total_amount, 2), 'paid' => round((float) $d->amount_paid, 2),
                'balance' => round((float) $d->total_amount - (float) $d->amount_paid, 2),
            ])
            ->filter(fn ($d) => $d['balance'] > 0);

        return $bills->concat($deliveries)->sortBy(fn ($i) => ($i['date'] ?? '') . $i['number'])->values()->all();
    }

    private function withInvoicesPaid($payments): void
    {
        SupplierPaymentAllocation::preloadInvoices($payments->flatMap->allocations);
        foreach ($payments as $payment) {
            $payment->setAttribute('invoices_paid', $payment->allocationSummary());
            $payment->unsetRelation('allocations');
        }
    }
}
