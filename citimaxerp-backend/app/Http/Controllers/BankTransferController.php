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
        $banks = DB::table('bank_accounts')->where('company_id', $companyId)->whereNull('deleted_at')
            ->whereNotNull('chart_of_account_id')->get(['chart_of_account_id', 'bank_name', 'account_number', 'account_name']);
        $mapped = DB::table('company_account_mappings')->where('company_id', $companyId)->whereNull('context_type')
            ->whereIn('mapping_key', ['cash_on_hand', 'petty_cash', 'main_bank', 'mpesa_float'])->pluck('chart_of_account_id');

        $accounts = ChartOfAccount::where('company_id', $companyId)
            ->whereIn('id', $banks->pluck('chart_of_account_id')->merge($mapped)->filter()->unique())
            ->orderBy('account_code')->get();
        $balances = app(LedgerBalanceService::class)->balances($companyId, null, $accounts);

        return $accounts->map(function ($a) use ($banks, $balances) {
            $bank = $banks->firstWhere('chart_of_account_id', $a->id);
            return [
                'id' => $a->id,
                'code' => $a->account_code,
                'name' => $a->account_name,
                'label' => $bank ? "{$a->account_name} - {$bank->bank_name} {$bank->account_number}" : $a->account_name,
                'balance' => (float) ($balances[$a->id] ?? 0),
            ];
        })->values();
    }

    public function accounts(Request $request)
    {
        if (!$this->hasPermission($request, 'can_view_bank_accounts')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view bank accounts.'], 403);
        }
        return response()->json(['status' => 'success', 'data' => $this->moneyAccounts($request->user()->company_id)]);
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
            // TRF-0001, TRF-0002 ... per company; the lock keeps two saves from taking the same number.
            $last = BankTransfer::where('company_id', $companyId)->lockForUpdate()
                ->orderByDesc('transfer_number')->value('transfer_number');
            $next = $last ? ((int) substr($last, 4)) + 1 : 1;

            return BankTransfer::create([
                'company_id' => $companyId,
                'transfer_number' => 'TRF-' . str_pad((string) $next, 4, '0', STR_PAD_LEFT),
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
