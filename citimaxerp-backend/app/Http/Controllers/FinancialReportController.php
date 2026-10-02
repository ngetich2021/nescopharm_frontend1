<?php

namespace App\Http\Controllers;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\FinancialPeriod;
use App\Services\FinancialStatementService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class FinancialReportController extends Controller
{
    protected FinancialStatementService $financialService;

    public function __construct(FinancialStatementService $financialService)
    {
        $this->middleware('auth:sanctum');
        $this->financialService = $financialService;
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

    protected function canManageCompany(Request $request, $companyId): bool
    {
        $user = $request->user();
        if ($this->hasPermission($request, 'can_manage_system')) {
            return true;
        }
        return $user->company_id === $companyId;
    }

    /**
     * Generate Trial Balance Report
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $asOfDate = $request->input('as_of_date', now()->toDateString());

        try {
            $trialBalance = $this->financialService
                ->forCompany($companyId)
                ->getTrialBalance($asOfDate);

            return response()->json([
                'status' => 'success',
                'message' => 'Trial balance generated successfully.',
                'data' => $trialBalance,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Trial Balance generation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate trial balance.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate Balance Sheet Report
     */
    public function balanceSheet(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_manage_system') && !$this->hasPermission($request, 'can_manage_company', $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $asOfDate = $request->input('as_of_date', now()->toDateString());

        try {
            $balanceSheet = $this->financialService
                ->forCompany($companyId)
                ->getBalanceSheet($asOfDate);

            return response()->json([
                'status' => 'success',
                'message' => 'Balance sheet generated successfully.',
                'data' => $balanceSheet,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Balance Sheet generation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate balance sheet.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate Income Statement (Profit & Loss)
     */
    public function incomeStatement(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_view_financial_reports') && !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $dateFrom = $request->input('date_from', now()->startOfYear()->toDateString());
        $dateTo = $request->input('date_to', now()->toDateString());

        try {
            $incomeStatement = $this->financialService
                ->forCompany($companyId)
                ->getIncomeStatement($dateFrom, $dateTo);

            return response()->json([
                'status' => 'success',
                'message' => 'Income statement generated successfully.',
                'data' => $incomeStatement,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Income Statement generation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate income statement.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate Cash Flow Statement
     */
    public function cashFlowStatement(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_view_financial_reports') && !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $dateFrom = $request->input('date_from', now()->startOfYear()->toDateString());
        $dateTo = $request->input('date_to', now()->toDateString());

        try {
            $cashFlow = $this->financialService
                ->forCompany($companyId)
                ->getCashFlowStatement($dateFrom, $dateTo);

            return response()->json([
                'status' => 'success',
                'message' => 'Cash flow statement generated successfully.',
                'data' => $cashFlow,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Cash Flow Statement generation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate cash flow statement.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate Financial Ratios Report
     */
    public function financialRatios(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_view_financial_reports') && !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $asOfDate = $request->input('as_of_date', now()->toDateString());
        $dateFrom = $request->input('date_from', now()->startOfYear()->toDateString());

        try {
            $ratios = $this->financialService
                ->forCompany($companyId)
                ->getFinancialRatios($asOfDate, $dateFrom);

            return response()->json([
                'status' => 'success',
                'message' => 'Financial ratios calculated successfully.',
                'data' => $ratios,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Financial Ratios calculation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to calculate financial ratios.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate Comparative Income Statement
     */
    public function comparativeIncomeStatement(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_view_financial_reports') && !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $request->validate([
            'current_from' => 'required|date',
            'current_to' => 'required|date',
            'prior_from' => 'required|date',
            'prior_to' => 'required|date',
        ]);

        try {
            $comparative = $this->financialService
                ->forCompany($companyId)
                ->getComparativeIncomeStatement(
                    $request->input('current_from'),
                    $request->input('current_to'),
                    $request->input('prior_from'),
                    $request->input('prior_to')
                );

            return response()->json([
                'status' => 'success',
                'message' => 'Comparative income statement generated successfully.',
                'data' => $comparative,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Comparative Income Statement generation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate comparative income statement.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get financial periods for the company
     */
    public function financialPeriods(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial periods.',
            ], 403);
        }

        try {
            $periods = $this->financialService
                ->forCompany($companyId)
                ->getFinancialPeriods();

            $currentPeriod = $this->financialService->getCurrentFinancialPeriod();

            return response()->json([
                'status' => 'success',
                'message' => 'Financial periods retrieved successfully.',
                'data' => [
                    'periods' => $periods,
                    'current_period' => $currentPeriod,
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Financial Periods retrieval error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve financial periods.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get account ledger with transactions
     */
    public function accountLedger(Request $request, string $accountId): JsonResponse
    {
        $user = $request->user();
        
        $account = ChartOfAccount::find($accountId);
        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $account->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this account ledger.',
            ], 403);
        }

        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        try {
            $ledger = $this->financialService
                ->forCompany($account->company_id)
                ->getAccountLedger($accountId, $dateFrom, $dateTo);

            return response()->json([
                'status' => 'success',
                'message' => 'Account ledger retrieved successfully.',
                'data' => $ledger,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Account Ledger retrieval error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve account ledger.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate a comprehensive financial report package
     */
    public function financialReportPackage(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->hasPermission($request, 'can_view_financial_reports') && !$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view financial reports.',
            ], 403);
        }

        $asOfDate = $request->input('as_of_date', now()->toDateString());
        $dateFrom = $request->input('date_from', now()->startOfYear()->toDateString());
        $dateTo = $request->input('date_to', $asOfDate);

        try {
            $service = $this->financialService->forCompany($companyId);

            return response()->json([
                'status' => 'success',
                'message' => 'Financial report package generated successfully.',
                'data' => [
                    'trial_balance' => $service->getTrialBalance($asOfDate),
                    'income_statement' => $service->getIncomeStatement($dateFrom, $dateTo),
                    'balance_sheet' => $service->getBalanceSheet($asOfDate),
                    'cash_flow_statement' => $service->getCashFlowStatement($dateFrom, $dateTo),
                    'financial_ratios' => $service->getFinancialRatios($asOfDate, $dateFrom),
                ],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Financial Report Package generation error: ' . $e->getMessage());
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate financial report package.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
