<?php

namespace App\Http\Controllers;

use App\Services\PayrollLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Payroll > Open Ledger: the payroll payable accounts (Net Salaries, PAYE, NSSF, SHIF, Housing Levy,
 * HELB, NITA, Other Deductions) with their balances, each account's Tally ledger and its payees.
 */
class PayrollLedgerController extends Controller
{
    public function __construct(private readonly PayrollLedgerService $service)
    {
        $this->middleware('auth:sanctum');
    }

    // GET /payroll-ledger/accounts
    public function accounts(Request $request): JsonResponse
    {
        try {
            return response()->json(['status' => 'success', 'data' => $this->service->accounts($request->user()->company_id)]);
        } catch (\Throwable $e) {
            Log::error('PayrollLedgerController@accounts: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => 'Could not load the payroll accounts.'], 500);
        }
    }

    // GET /payroll-ledger/{key}?date_from=&date_to=&corrections=1
    public function show(Request $request, string $key): JsonResponse
    {
        if (!array_key_exists($key, PayrollLedgerService::ACCOUNTS)) {
            return response()->json(['status' => 'failed', 'message' => 'There is no payroll account called "' . $key . '".'], 404);
        }
        $request->validate(['date_from' => 'nullable|date', 'date_to' => 'nullable|date']);
        try {
            $data = $this->service->account(
                $request->user()->company_id, $key,
                $request->input('date_from') ?: null, $request->input('date_to') ?: null,
                $request->boolean('corrections'),
            );
            if (!$data) {
                return response()->json(['status' => 'failed', 'message' => 'This account is not set up in the chart of accounts (Finance > Account Mappings).'], 404);
            }
            return response()->json(['status' => 'success', 'data' => $data]);
        } catch (\Throwable $e) {
            Log::error('PayrollLedgerController@show: ' . $e->getMessage());
            return response()->json(['status' => 'failed', 'message' => 'Could not load the ledger.'], 500);
        }
    }
}
