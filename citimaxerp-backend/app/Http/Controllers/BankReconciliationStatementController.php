<?php

namespace App\Http\Controllers;

use App\Models\ChartOfAccount;
use App\Services\BankReconciliationStatementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Finance > Bank Reconciliation (Tally BRS). Viewing needs bank accounts or bank reconciliation
 * view rights; giving bank dates, saving and reopening need "Update Bank Accounts".
 */
class BankReconciliationStatementController extends Controller
{
    public function __construct(private BankReconciliationStatementService $service)
    {
        $this->middleware('auth:sanctum');
    }

    private function can(Request $request, array $permissions): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        foreach (array_merge(['can_manage_system', 'can_manage_company'], $permissions) as $p) {
            if ($role->hasPermission($p)) {
                return true;
            }
        }
        return false;
    }

    private function canView(Request $request): bool
    {
        return $this->can($request, ['can_view_bank_reconciliation', 'can_view_bank_accounts']);
    }

    private function canEdit(Request $request): bool
    {
        return $this->can($request, ['can_update_bank_accounts']);
    }

    private function account(Request $request, string $accountId): ?ChartOfAccount
    {
        $companyId = $request->user()->company_id;
        if (!$this->service->bankAccounts($companyId)->contains('id', $accountId)) {
            return null;
        }
        return ChartOfAccount::where('company_id', $companyId)->find($accountId);
    }

    private function fail(string $message, int $code = 422)
    {
        return response()->json(['status' => 'failed', 'message' => $message], $code);
    }

    public function accounts(Request $request)
    {
        if (!$this->canView($request)) {
            return $this->fail('Unauthorized to view bank reconciliation.', 403);
        }
        return response()->json(['status' => 'success', 'data' => $this->service->bankAccounts($request->user()->company_id),
            'can_edit' => $this->canEdit($request)]);
    }

    public function show(Request $request, string $accountId)
    {
        if (!$this->canView($request)) {
            return $this->fail('Unauthorized to view bank reconciliation.', 403);
        }
        $v = Validator::make($request->all(), [
            'statement_date' => 'nullable|date',
            'statement_balance' => 'nullable|numeric',
            'show' => 'nullable|in:uncleared,all',
            'date_from' => 'nullable|date',
        ]);
        if ($v->fails()) {
            return $this->fail($v->errors()->first());
        }
        $account = $this->account($request, $accountId);
        if (!$account) {
            return $this->fail('That is not a bank account.', 404);
        }
        $balance = $request->filled('statement_balance') ? (float) $request->input('statement_balance') : null;

        return response()->json(['status' => 'success', 'can_edit' => $this->canEdit($request), 'data' => $this->service->statement(
            $request->user()->company_id, $account, $request->input('statement_date') ?: now()->toDateString(), $balance,
            $request->input('show', 'uncleared'), $request->input('date_from') ?: null,
        )]);
    }

    public function bankDates(Request $request, string $accountId)
    {
        if (!$this->canEdit($request)) {
            return $this->fail('You need "Update Bank Accounts" to give bank dates.', 403);
        }
        $v = Validator::make($request->all(), [
            'items' => 'required|array|min:1|max:2000',
            'items.*.journal_entry_id' => 'required|uuid',
            'items.*.bank_date' => 'nullable|date',
        ]);
        if ($v->fails()) {
            return $this->fail($v->errors()->first());
        }
        $account = $this->account($request, $accountId);
        if (!$account) {
            return $this->fail('That is not a bank account.', 404);
        }
        try {
            $n = $this->service->setBankDates($request->user()->company_id, $account, array_map(fn ($i) => [
                'journal_entry_id' => $i['journal_entry_id'], 'bank_date' => $i['bank_date'] ?? null,
            ], $request->input('items')), $request->user()->id);
        } catch (\InvalidArgumentException $e) {
            return $this->fail($e->getMessage());
        }

        return response()->json(['status' => 'success', 'message' => $n === 1 ? 'Bank date saved.' : "{$n} bank dates saved."]);
    }

    public function complete(Request $request, string $accountId)
    {
        if (!$this->canEdit($request)) {
            return $this->fail('You need "Update Bank Accounts" to save a reconciliation.', 403);
        }
        $v = Validator::make($request->all(), [
            'statement_date' => 'required|date',
            'statement_balance' => 'required|numeric',
            'notes' => 'nullable|string|max:2000',
        ]);
        if ($v->fails()) {
            return $this->fail($v->errors()->first());
        }
        $account = $this->account($request, $accountId);
        if (!$account) {
            return $this->fail('That is not a bank account.', 404);
        }
        $user = $request->user();
        try {
            $s = $this->service->complete($user->company_id, $account, $request->input('statement_date'),
                (float) $request->input('statement_balance'), $request->input('notes'), $user->id);
        } catch (\InvalidArgumentException $e) {
            return $this->fail($e->getMessage());
        }
        \App\Models\ActivityLog::logActivity('bank_reconciled', "{$account->account_name} reconciled to "
            . \Carbon\Carbon::parse($s->statement_date)->format('d/m/Y') . ' (statement KES ' . number_format((float) $s->statement_balance, 2) . ')', $user, (array) $s);

        return response()->json(['status' => 'success', 'message' => "{$account->account_name} reconciled to "
            . \Carbon\Carbon::parse($s->statement_date)->format('d/m/Y') . '.', 'data' => $s]);
    }

    public function reopen(Request $request, string $statementId)
    {
        if (!$this->canEdit($request)) {
            return $this->fail('You need "Update Bank Accounts" to reopen a reconciliation.', 403);
        }
        try {
            $s = $this->service->reopen($request->user()->company_id, $statementId);
        } catch (\InvalidArgumentException $e) {
            return $this->fail($e->getMessage());
        }
        \App\Models\ActivityLog::logActivity('bank_reconciliation_reopened', 'Bank reconciliation to '
            . \Carbon\Carbon::parse($s->statement_date)->format('d/m/Y') . ' reopened', $request->user(), (array) $s);

        return response()->json(['status' => 'success', 'message' => 'Reconciliation to ' . \Carbon\Carbon::parse($s->statement_date)->format('d/m/Y') . ' reopened.']);
    }
}
