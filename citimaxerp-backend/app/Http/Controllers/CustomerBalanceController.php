<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Payment;
use App\Services\CustomerAccountService;
use App\Services\CustomerLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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

        return response()->json(['data' => $ledger->ledger($companyId, $customerId, $request->query('date_from'), $request->query('date_to'))]);
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
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => ['required', 'in:' . implode(',', Payment::INSTANT_METHODS)],
            'payment_date' => 'nullable|date',
            'transaction_id' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'allocations' => 'nullable|array',
            'allocations.*.invoice_id' => 'required_with:allocations|uuid',
            'allocations.*.amount' => 'required_with:allocations|numeric|min:0.01',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $split = $request->has('allocations') ? (array) $request->input('allocations') : null;
        if ($split !== null && array_sum(array_column($split, 'amount')) > (float) $request->amount + 0.01) {
            return response()->json(['message' => 'The split adds up to more than the amount received'], 422);
        }

        $customer = Customer::where('company_id', $request->user()->company_id)->findOrFail($customerId);

        try {
            $result = $this->accounts->receive(
                $customer,
                $request->user(),
                (float) $request->amount,
                $request->payment_method,
                $request->payment_date,
                $request->transaction_id,
                $request->notes,
                $split,
            );
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            Log::error('Failed to receive customer payment', ['customer_id' => $customerId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to record payment', 'error' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Payment recorded: ' . number_format($result['allocated'], 2) . ' applied to invoices'
                . ($result['left_as_credit'] > 0.005 ? ', ' . number_format($result['left_as_credit'], 2) . ' kept as customer credit' : ''),
            'data' => $result,
            'account' => $this->accounts->summary($customer->company_id, $customer->id),
        ], 201);
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
            Log::error('Failed to apply customer credit', ['customer_id' => $customerId, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to apply credit', 'error' => $e->getMessage()], 500);
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
