<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Payment;
use App\Services\CustomerAccountService;
use App\Services\CustomerLedgerService;
use App\Support\PaymentFailure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * The customer's running account on their CRM account: balance, credit, and receiving one
 * payment for several invoices. See CustomerAccountService.
 */
class CustomerBalanceController extends Controller
{
    public function __construct(protected CustomerAccountService $accounts)
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, string $permission): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }

        return $role->hasPermission('can_manage_system')
            || $role->hasPermission('can_manage_company')
            || $role->hasPermission($permission);
    }

    public function show(Request $request, string $customerId): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json(['data' => $this->accounts->summary($request->user()->company_id, $customerId)]);
    }

    // The customer's double entries: each journal entry touching them, with all its lines.
    public function ledger(Request $request, string $customerId, CustomerLedgerService $ledger): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $request->validate(['date_from' => 'nullable|date', 'date_to' => 'nullable|date']);
        $companyId = $request->user()->company_id;
        Customer::where('company_id', $companyId)->findOrFail($customerId);

        return response()->json(['data' => $ledger->ledger(
            $companyId,
            $customerId,
            $request->query('date_from'),
            $request->query('date_to'),
            $request->boolean('hide_corrections'),
        )]);
    }

    // Oldest-first split of an amount, to prefill the Receive Payment form.
    public function suggestSplit(Request $request, string $customerId): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $amount = (float) $request->query('amount', 0);
        Customer::where('company_id', $request->user()->company_id)->findOrFail($customerId);

        return response()->json(['data' => $this->accounts->suggestSplit($request->user()->company_id, $customerId, $amount)]);
    }

    public function receive(Request $request, string $customerId): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_update_invoices')) {
            return response()->json(['message' => PaymentFailure::NOT_ALLOWED], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => ['required', 'in:' . implode(',', Payment::INSTANT_METHODS)],
            'payment_date' => 'nullable|date',
            'transaction_id' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ], PaymentFailure::VALIDATION_MESSAGES);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        try {
            $customer = Customer::where('company_id', $request->user()->company_id)->findOrFail($customerId);
            $result = $this->accounts->receive(
                $customer,
                $request->user(),
                (float) $request->amount,
                $request->payment_method,
                $request->payment_date,
                $request->transaction_id,
                $request->notes,
            );
        } catch (\Throwable $e) {
            return PaymentFailure::response($e);
        }

        return response()->json([
            'message' => 'Payment recorded: ' . $this->accounts->describeApplied($result['allocations'], $result['left_as_credit']),
            'data' => $result,
            'account' => $this->accounts->summary($customer->company_id, $customer->id),
        ], 201);
    }

    // Receipts taken from the customer, for the Payments tab of their profile.
    public function receipts(Request $request, string $customerId): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_view_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $companyId = $request->user()->company_id;
        Customer::where('company_id', $companyId)->findOrFail($customerId);

        return response()->json(['data' => $this->accounts->receipts($companyId, $customerId)]);
    }

    // A receipt captured in error: its money comes back off the invoices it paid. Cancel keeps it
    // on record as cancelled; delete removes it.
    public function cancelReceipt(Request $request, string $customerId, string $paymentId): JsonResponse
    {
        return $this->removeReceipt($request, $customerId, $paymentId, true);
    }

    public function deleteReceipt(Request $request, string $customerId, string $paymentId): JsonResponse
    {
        return $this->removeReceipt($request, $customerId, $paymentId, false);
    }

    protected function removeReceipt(Request $request, string $customerId, string $paymentId, bool $cancel): JsonResponse
    {
        // Taking back a payment captured in error is a refund-type action: accountants (who refund
        // payments but don't delete invoices) can do it as well as those who delete invoices.
        if (!$this->hasPermission($request, 'can_delete_invoices') && !$this->hasPermission($request, 'can_refund_payments')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $companyId = $request->user()->company_id;
        Customer::where('company_id', $companyId)->findOrFail($customerId);
        $payment = Payment::where('company_id', $companyId)->findOrFail($paymentId);
        if (!$this->accounts->receipts($companyId, $customerId)->contains('id', $payment->id)) {
            return response()->json(['message' => 'This payment is not one of this customer\'s receipts'], 404);
        }

        try {
            $result = $this->accounts->removeReceipt($payment, $cancel);
        } catch (\Throwable $e) {
            return PaymentFailure::response($e, $cancel ? 'The cancellation' : 'The deletion');
        }

        $done = $cancel ? 'cancelled' : 'deleted';
        $reversed = collect($result['reversed'])->map(fn ($r) => number_format($r['amount'], 2) . ' back on ' . $r['invoice_number'])->implode(', ');

        return response()->json([
            'message' => 'Payment of ' . number_format((float) $payment->amount_paid, 2) . " {$done}"
                . ($reversed ? "; {$reversed}" : '')
                . ($result['cheque_number'] ? "; cheque {$result['cheque_number']} {$done}" : ''),
            'data' => $result,
            'account' => $this->accounts->summary($companyId, $customerId),
        ]);
    }

    public function applyCredit(Request $request, string $customerId): JsonResponse
    {
        if (!$this->hasPermission($request, 'can_update_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $companyId = $request->user()->company_id;
        Customer::where('company_id', $companyId)->findOrFail($customerId);

        try {
            $applied = $this->accounts->applyCredit($companyId, $customerId);
        } catch (\Throwable $e) {
            return PaymentFailure::response($e, 'The credit');
        }

        $total = round(array_sum(array_column($applied, 'amount')), 2);

        return response()->json([
            'message' => $total > 0
                ? number_format($total, 2) . ' of credit applied to ' . count(array_unique(array_column($applied, 'invoice_id'))) . ' invoice(s)'
                : 'No credit could be applied (no open invoices, or no credit available)',
            'data' => $applied,
            'account' => $this->accounts->summary($companyId, $customerId),
        ]);
    }
}
