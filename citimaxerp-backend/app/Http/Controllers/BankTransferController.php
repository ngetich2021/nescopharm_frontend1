<?php

namespace App\Http\Controllers;

use App\Models\BankTransfer;
use App\Models\ChartOfAccount;
use App\Services\LedgerBalanceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Withdrawals and transfers between the company's own money accounts (bank, M-Pesa, cash),
 * with the bank's charge. Each one posts to the ledger through LedgerSyncObserver.
 */
class BankTransferController extends Controller
{
    public function __construct()
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

    /**
     * Accounts money can move between: those linked to a finance bank account, plus whatever the
     * cash, bank and M-Pesa payment methods post to.
     */
    private function moneyAccounts(string $companyId)
    {
        return app(\App\Services\CashBookService::class)->moneyAccounts($companyId);
    }

    public function accounts(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_bank_accounts')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view bank accounts.'], 403);
        }
        return response()->json(['status' => 'success', 'data' => $this->moneyAccounts($request->user()->company_id)]);
    }

    /**
     * Paid from (Petty Cash / Prime Bank, with balances) and the ledger account a supplier payment
     * is charged to (Accounts Payables), for the supplier and transporter payment forms.
     */
    public function paymentSources(Request $request)
    {
        $allowed = collect(['can_create_payments', 'can_view_payments', 'can_pay_delivery_invoices', 'can_view_expenses', 'can_view_bank_accounts'])
            ->contains(fn ($p) => $this->hasPermission($request, $p));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view payment accounts.'], 403);
        }
        $companyId = $request->user()->company_id;
        $payablesId = DB::table('company_account_mappings')->where('company_id', $companyId)->whereNull('context_type')
            ->where('is_active', true)->where('mapping_key', 'accounts_payable')->value('chart_of_account_id');
        $payables = $payablesId ? ChartOfAccount::find($payablesId, ['id', 'account_code', 'account_name']) : null;

        return response()->json(['status' => 'success', 'data' => [
            'paid_from' => app(\App\Services\CashBookService::class)->paymentSources($companyId),
            'payables' => $payables ? ['id' => $payables->id, 'code' => $payables->account_code, 'name' => $payables->account_name] : null,
        ]]);
    }

    public function index(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_bank_accounts')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view bank transfers.'], 403);
        }
        $query = BankTransfer::with(['fromAccount:id,account_code,account_name', 'toAccount:id,account_code,account_name', 'creator:id,first_name,last_name'])
            ->where('company_id', $request->user()->company_id)
            ->orderByDesc('transfer_date')->orderByDesc('created_at');
        if ($account = $request->input('account_id')) {
            $query->where(fn ($q) => $q->where('from_account_id', $account)->orWhere('to_account_id', $account));
        }
        if ($from = $request->input('date_from')) {
            $query->whereDate('transfer_date', '>=', $from);
        }
        if ($to = $request->input('date_to')) {
            $query->whereDate('transfer_date', '<=', $to);
        }

        return response()->json(['status' => 'success', 'data' => $query->limit(1000)->get()->map(fn ($t) => [
            'id' => $t->id,
            'transfer_number' => $t->transfer_number,
            'transfer_date' => $t->transfer_date?->toDateString(),
            'from_account' => $t->fromAccount ? "{$t->fromAccount->account_code} {$t->fromAccount->account_name}" : null,
            'to_account' => $t->toAccount ? "{$t->toAccount->account_code} {$t->toAccount->account_name}" : null,
            'from_account_id' => $t->from_account_id,
            'to_account_id' => $t->to_account_id,
            'amount' => (float) $t->amount,
            'charges' => (float) $t->charges,
            'total_out' => round((float) $t->amount + (float) $t->charges, 2),
            'reference' => $t->reference,
            'purpose' => $t->purpose,
            'notes' => $t->notes,
            'created_by' => $t->creator ? trim("{$t->creator->first_name} {$t->creator->last_name}") : null,
        ])]);
    }

    public function store(Request $request)
    {
        if (!$this->hasPermission($request, 'can_create_bank_accounts')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to record bank transfers.'], 403);
        }
        $companyId = $request->user()->company_id;
        $allowed = $this->moneyAccounts($companyId)->pluck('id')->all();

        $validator = Validator::make($request->all(), [
            'transfer_date' => 'required|date|before_or_equal:today',
            'from_account_id' => ['required', 'uuid', fn ($a, $v, $fail) => in_array($v, $allowed, true) || $fail('Choose a bank, M-Pesa or cash account to take the money from.')],
            'to_account_id' => ['required', 'uuid', 'different:from_account_id', fn ($a, $v, $fail) => in_array($v, $allowed, true) || $fail('Choose a bank, M-Pesa or cash account to put the money into.')],
            'amount' => 'required|numeric|min:0.01|max:999999999',
            'charges' => 'nullable|numeric|min:0|max:999999',
            'reference' => 'nullable|string|max:255',
            'purpose' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
        ], ['to_account_id.different' => 'The money has to go to a different account than it comes from.']);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }

        $transfer = DB::transaction(function () use ($request, $companyId) {
            return BankTransfer::record([
                'company_id' => $companyId,
                'transfer_date' => $request->input('transfer_date'),
                'from_account_id' => $request->input('from_account_id'),
                'to_account_id' => $request->input('to_account_id'),
                'amount' => round((float) $request->input('amount'), 2),
                'charges' => round((float) $request->input('charges', 0), 2),
                'reference' => $request->input('reference'),
                'purpose' => $request->input('purpose'),
                'notes' => $request->input('notes'),
                'created_by' => $request->user()->id,
            ]);
        });

        return response()->json(['status' => 'success', 'message' => "Transfer {$transfer->transfer_number} recorded.", 'data' => $transfer], 201);
    }

    /**
     * Bank Book / Cash Book: one money account (Prime Bank, Cash at Hand ...) with a running balance.
     */
    public function book(Request $request, string $accountId)
    {
        if (!$this->hasPermission($request, 'can_view_bank_accounts') && !$this->hasPermission($request, 'can_view_general_ledger')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view the cash and bank books.'], 403);
        }
        $companyId = $request->user()->company_id;
        if (!$this->moneyAccounts($companyId)->contains('id', $accountId)) {
            return response()->json(['status' => 'failed', 'message' => 'That is not a bank or cash account.'], 404);
        }
        $account = ChartOfAccount::where('company_id', $companyId)->findOrFail($accountId);

        return response()->json(['status' => 'success', 'data' => app(\App\Services\CashBookService::class)->book(
            $companyId, $account, $request->input('date_from') ?: null, $request->input('date_to') ?: null,
            $request->boolean('show_corrections'),
        )]);
    }

    /**
     * A bank withdrawal that was booked as an expense becomes what it is: a transfer from the bank
     * into cash (Contra). The expense is removed, so the books no longer count it as spending, and
     * the cash it brought in is there to pay the real expenses from.
     */
    public function fromExpense(Request $request, string $expenseId)
    {
        if (!$this->hasPermission($request, 'can_create_bank_accounts')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to record bank transfers.'], 403);
        }
        $user = $request->user();
        $companyId = $user->company_id;
        $expense = \App\Models\Expense::where('company_id', $companyId)->find($expenseId);
        if (!$expense) {
            return response()->json(['status' => 'failed', 'message' => 'Expense not found.'], 404);
        }
        $allowed = $this->moneyAccounts($companyId)->pluck('id')->all();
        $mapping = fn (string $key) => DB::table('company_account_mappings')->where('company_id', $companyId)
            ->whereNull('context_type')->where('mapping_key', $key)->where('is_active', true)->value('chart_of_account_id');

        $validator = Validator::make($request->all(), [
            'from_account_id' => ['nullable', 'uuid', fn ($a, $v, $fail) => in_array($v, $allowed, true) || $fail('Choose the bank the money came out of.')],
            'to_account_id' => ['nullable', 'uuid', fn ($a, $v, $fail) => in_array($v, $allowed, true) || $fail('Choose the cash account the money went into.')],
            'charges' => 'nullable|numeric|min:0|max:999999',
            'reference' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first(), 'errors' => $validator->errors()], 422);
        }
        $from = $request->input('from_account_id') ?: $mapping('main_bank');
        $to = $request->input('to_account_id') ?: ($mapping('petty_cash') ?: $mapping('cash_on_hand'));
        if (!$from || !$to || $from === $to) {
            return response()->json(['status' => 'failed', 'message' => 'Choose the bank the money came out of and the cash account it went into.'], 422);
        }

        $transfer = DB::transaction(function () use ($request, $companyId, $expense, $from, $to, $user) {
            $date = $expense->expense_date ?? $expense->created_at;
            $transfer = BankTransfer::record([
                'company_id' => $companyId,
                'transfer_date' => \Illuminate\Support\Carbon::parse($date)->toDateString(),
                'from_account_id' => $from,
                'to_account_id' => $to,
                'amount' => round((float) $expense->amount, 2),
                'charges' => round((float) $request->input('charges', 0), 2),
                'reference' => $request->input('reference') ?: ($expense->expense_number ?: null),
                'purpose' => mb_substr((string) ($expense->description ?: 'Cash withdrawal'), 0, 255),
                'notes' => 'Was recorded as an expense (' . number_format((float) $expense->amount, 2) . ' on '
                    . \Illuminate\Support\Carbon::parse($date)->format('d/m/Y') . '); moved to a bank-to-cash transfer by '
                    . trim("{$user->first_name} {$user->last_name}") . ' on ' . now()->format('d/m/Y') . '.',
                'created_by' => $user->id,
            ]);
            \App\Models\ActivityLog::logActivity('expense_converted_to_transfer',
                "Expense \"{$expense->description}\" (" . number_format((float) $expense->amount, 2) . ") turned into transfer {$transfer->transfer_number}", $user, [
                    'expense' => $expense->only(['id', 'description', 'amount', 'expense_date', 'payment_method', 'category_id', 'status']),
                    'transfer_id' => $transfer->id,
                ]);
            $expense->delete();

            return $transfer;
        });

        return response()->json(['status' => 'success', 'message' => "Recorded as transfer {$transfer->transfer_number}; the expense is removed.", 'data' => $transfer], 201);
    }

    // Deleting reverses its ledger entry (LedgerSyncObserver).
    public function destroy(Request $request, string $id)
    {
        if (!$this->hasPermission($request, 'can_delete_bank_accounts')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to delete bank transfers.'], 403);
        }
        $transfer = BankTransfer::where('company_id', $request->user()->company_id)->find($id);
        if (!$transfer) {
            return response()->json(['status' => 'failed', 'message' => 'Transfer not found.'], 404);
        }
        $transfer->delete();

        return response()->json(['status' => 'success', 'message' => "Transfer {$transfer->transfer_number} deleted."]);
    }
}
