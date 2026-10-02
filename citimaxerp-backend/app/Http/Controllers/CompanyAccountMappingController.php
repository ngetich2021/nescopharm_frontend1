<?php

namespace App\Http\Controllers;

use App\Models\CompanyAccountMapping;
use App\Models\ChartOfAccount;
use App\Services\AccountingIntegrationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * CompanyAccountMappingController
 * 
 * Manages the mapping between logical account purposes and actual chart of account
 * codes for each company. This allows companies to configure their own account codes
 * to match their chart of accounts structure.
 * 
 * Features:
 * - CRUD operations for account mappings
 * - Context-aware mappings (e.g., different expense accounts per category)
 * - Payment method configuration
 * - Bulk operations
 * - Auto-initialization from chart of accounts
 * - Configuration validation
 */
class CompanyAccountMappingController extends Controller
{
    protected AccountingIntegrationService $accountingService;

    public function __construct(AccountingIntegrationService $accountingService)
    {
        $this->accountingService = $accountingService;
    }

    /**
     * Get all account mappings for a company
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this company\'s account mappings.',
            ], 403);
        }

        $query = CompanyAccountMapping::where('company_id', $companyId)
            ->with('chartOfAccount');

        // Filter by context if provided
        if ($request->has('context_type')) {
            $query->where('context_type', $request->input('context_type'));
        }

        // Filter by is_system flag if provided
        if ($request->has('is_system')) {
            $query->where('is_system', $request->boolean('is_system'));
        }

        $mappings = $query->orderBy('mapping_key')->get();

        // Get all available mapping keys with metadata
        $coreKeys = CompanyAccountMapping::CORE_MAPPING_KEYS;
        $extendedKeys = CompanyAccountMapping::EXTENDED_MAPPING_KEYS;

        return response()->json([
            'status' => 'success',
            'message' => 'Account mappings retrieved successfully.',
            'mappings' => $mappings,
            'available_keys' => [
                'core' => $coreKeys,
                'extended' => $extendedKeys,
            ],
        ], 200);
    }

    /**
     * Get a specific account mapping
     */
    public function show(Request $request, $id)
    {
        $mapping = CompanyAccountMapping::with('chartOfAccount')->find($id);

        if (!$mapping) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account mapping not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $mapping->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this account mapping.',
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Account mapping retrieved successfully.',
            'mapping' => $mapping,
        ], 200);
    }

    /**
     * Create or update an account mapping
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_id' => 'nullable|uuid|exists:companies,id',
            'mapping_key' => 'required|string|max:50',
            'account_code' => 'required|string|max:20',
            'chart_of_account_id' => 'nullable|uuid|exists:chart_of_accounts,id',
            'context_type' => 'nullable|string|max:50',
            'context_id' => 'nullable|uuid',
            'description' => 'nullable|string|max:255',
            'priority' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create account mappings for this company.',
            ], 403);
        }

        // Validate that the mapping key is valid
        $mappingKey = $request->input('mapping_key');
        $allKeys = array_merge(
            CompanyAccountMapping::CORE_MAPPING_KEYS,
            CompanyAccountMapping::EXTENDED_MAPPING_KEYS
        );
        
        if (!array_key_exists($mappingKey, $allKeys)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Invalid mapping key. Please check available_keys endpoint for valid keys.',
            ], 400);
        }

        // Validate that the account code exists for this company
        $accountCode = $request->input('account_code');
        $account = ChartOfAccount::where('company_id', $companyId)
            ->where('account_code', $accountCode)
            ->first();

        if (!$account) {
            return response()->json([
                'status' => 'failed',
                'message' => "Account with code '{$accountCode}' not found for this company.",
            ], 400);
        }

        try {
            $mapping = CompanyAccountMapping::setMapping(
                $companyId,
                $mappingKey,
                $accountCode,
                $request->input('chart_of_account_id', $account->id),
                [
                    'description' => $request->input('description'),
                    'context_type' => $request->input('context_type'),
                    'context_id' => $request->input('context_id'),
                    'priority' => $request->input('priority', 0),
                ]
            );

            $mapping->load('chartOfAccount');

            return response()->json([
                'status' => 'success',
                'message' => 'Account mapping saved successfully.',
                'mapping' => $mapping,
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error creating account mapping', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to save account mapping.',
            ], 500);
        }
    }

    /**
     * Update multiple account mappings at once
     */
    public function bulkUpdate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_id' => 'nullable|uuid|exists:companies,id',
            'mappings' => 'required|array',
            'mappings.*.mapping_key' => 'required|string|max:50',
            'mappings.*.account_code' => 'required|string|max:20',
            'mappings.*.chart_of_account_id' => 'nullable|uuid',
            'mappings.*.context_type' => 'nullable|string|max:50',
            'mappings.*.context_id' => 'nullable|uuid',
            'mappings.*.description' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update account mappings for this company.',
            ], 403);
        }

        try {
            DB::beginTransaction();

            $savedMappings = [];
            $errors = [];

            $allKeys = array_merge(
                CompanyAccountMapping::CORE_MAPPING_KEYS,
                CompanyAccountMapping::EXTENDED_MAPPING_KEYS
            );

            foreach ($request->input('mappings') as $mappingData) {
                $mappingKey = $mappingData['mapping_key'];
                $accountCode = $mappingData['account_code'];

                // Validate mapping key
                if (!array_key_exists($mappingKey, $allKeys)) {
                    $errors[] = "Invalid mapping key: {$mappingKey}";
                    continue;
                }

                // Validate account code exists
                $account = ChartOfAccount::where('company_id', $companyId)
                    ->where('account_code', $accountCode)
                    ->first();

                if (!$account) {
                    $errors[] = "Account code '{$accountCode}' not found for mapping '{$mappingKey}'";
                    continue;
                }

                $mapping = CompanyAccountMapping::setMapping(
                    $companyId,
                    $mappingKey,
                    $accountCode,
                    $mappingData['chart_of_account_id'] ?? $account->id,
                    [
                        'description' => $mappingData['description'] ?? null,
                        'context_type' => $mappingData['context_type'] ?? null,
                        'context_id' => $mappingData['context_id'] ?? null,
                    ]
                );

                $savedMappings[] = $mapping;
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Account mappings updated successfully.',
                'saved_count' => count($savedMappings),
                'errors' => $errors,
            ], 200);

        } catch (\Exception $e) {
            DB::rollback();
            Log::error('Error bulk updating account mappings', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update account mappings.',
            ], 500);
        }
    }

    /**
     * Delete an account mapping
     */
    public function destroy(Request $request, $id)
    {
        $mapping = CompanyAccountMapping::find($id);

        if (!$mapping) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Account mapping not found.',
            ], 404);
        }

        if (!$this->canManageCompany($request, $mapping->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this account mapping.',
            ], 403);
        }

        // Prevent deletion of system mappings
        if ($mapping->is_system) {
            return response()->json([
                'status' => 'failed',
                'message' => 'System mappings cannot be deleted. You can deactivate them instead.',
            ], 400);
        }

        try {
            $mapping->delete();

            // Clear the cache for this company
            CompanyAccountMapping::clearCache($mapping->company_id);

            return response()->json([
                'status' => 'success',
                'message' => 'Account mapping deleted successfully.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error deleting account mapping', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete account mapping.',
            ], 500);
        }
    }

    /**
     * Initialize account mappings from chart of accounts
     * Auto-detects and configures mappings based on account patterns
     */
    public function initialize(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to initialize account mappings for this company.',
            ], 403);
        }

        try {
            $result = CompanyAccountMapping::initializeFromChartOfAccounts($companyId);

            return response()->json([
                'status' => 'success',
                'message' => 'Account mappings initialized successfully.',
                'mapped' => $result['mapped'],
                'unmapped' => $result['unmapped'],
                'mapped_count' => count($result['mapped']),
                'unmapped_count' => count($result['unmapped']),
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error initializing account mappings', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to initialize account mappings.',
            ], 500);
        }
    }

    /**
     * Validate account mappings configuration for a company
     * Returns detailed validation with fixes for missing mappings
     */
    public function validateConfig(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to validate account mappings for this company.',
            ], 403);
        }

        $result = CompanyAccountMapping::validateConfiguration($companyId);

        // Enhance missing mappings with action items. validateConfiguration()
        // returns the list under 'issues', not 'missing' - reading the wrong
        // key here meant missing_mappings was silently always empty, even
        // though configured_count/required_count showed the real gap.
        $enhancedMissing = array_map(function($item) {
            return array_merge($item, [
                'action_required' => true,
                'action' => "Configure mapping for '{$item['key']}'",
                'link' => "/admin/accounting/mappings/configure/{$item['key']}",
            ]);
        }, $result['issues'] ?? []);

        // This is a read/status endpoint, not a mutation - "mappings are
        // incomplete" is a normal, expected answer (is_valid: false in the
        // body already conveys it), not a failed request. Returning 422
        // here made every caller's apiCall() throw instead of receiving the
        // structured result, which broke the account-mappings settings page
        // (it could never actually show what was missing) and spammed the
        // console with "errors" for an entirely normal, common state.
        $httpStatus = 200;

        return response()->json([
            'status' => $result['is_valid'] ? 'success' : 'incomplete',
            'message' => $result['is_valid'] 
                ? '✅ All required account mappings are configured. System is ready to record transactions.'
                : '⚠️ Account mapping configuration is incomplete. Some required mappings are missing.',
            'is_valid' => $result['is_valid'],
            'summary' => [
                'configured_count' => $result['configured_count'] ?? 0,
                'required_count' => $result['required_count'] ?? 0,
                'completion_percentage' => round((($result['configured_count'] ?? 0) / ($result['required_count'] ?? 1)) * 100),
            ],
            'configured_mappings' => $result['configured'] ?? [],
            'missing_mappings' => $enhancedMissing,
            'optional_missing' => $result['optional_missing'] ?? [],
            'next_steps' => $result['is_valid'] 
                ? ['✅ Ready to record transactions', '✅ Run test transaction to verify setup']
                : array_merge(
                    ['🔧 Complete the following mappings:'],
                    array_column($enhancedMissing, 'action')
                ),
        ], $httpStatus);
    }

    /**
     * Get available mapping keys with metadata
     */
    public function availableKeys(Request $request)
    {
        return response()->json([
            'status' => 'success',
            'message' => 'Available mapping keys retrieved successfully.',
            'core_keys' => CompanyAccountMapping::CORE_MAPPING_KEYS,
            'extended_keys' => CompanyAccountMapping::EXTENDED_MAPPING_KEYS,
            'payment_method_mappings' => CompanyAccountMapping::DEFAULT_PAYMENT_METHOD_MAPPINGS,
        ], 200);
    }

    /**
     * Configure payment method mappings for a company
     */
    public function configurePaymentMethod(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_id' => 'nullable|uuid|exists:companies,id',
            'payment_method' => 'required|string|max:50',
            'mapping_key' => 'required|string|max:50',
            'description' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to configure payment methods for this company.',
            ], 403);
        }

        try {
            // Verify the mapping key exists
            $mappingKey = $request->input('mapping_key');
            $mapping = CompanyAccountMapping::where('company_id', $companyId)
                ->where('mapping_key', $mappingKey)
                ->first();

            if (!$mapping) {
                return response()->json([
                    'status' => 'failed',
                    'message' => "Mapping key '{$mappingKey}' is not configured for this company. Please set it up first.",
                ], 400);
            }

            // Create or update payment method mapping
            DB::table('company_payment_method_mappings')->updateOrInsert(
                [
                    'company_id' => $companyId,
                    'payment_method' => strtolower($request->input('payment_method')),
                ],
                [
                    'id' => \Illuminate\Support\Str::uuid(),
                    'mapping_key' => $mappingKey,
                    'description' => $request->input('description'),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            // Clear cache
            CompanyAccountMapping::clearCache($companyId);

            return response()->json([
                'status' => 'success',
                'message' => 'Payment method mapping configured successfully.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error configuring payment method', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to configure payment method mapping.',
            ], 500);
        }
    }

    /**
     * Get payment method mappings for a company
     */
    public function getPaymentMethods(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view payment methods for this company.',
            ], 403);
        }

        $paymentMethods = DB::table('company_payment_method_mappings')
            ->where('company_id', $companyId)
            ->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Payment method mappings retrieved successfully.',
            'payment_methods' => $paymentMethods,
            'defaults' => CompanyAccountMapping::DEFAULT_PAYMENT_METHOD_MAPPINGS,
        ], 200);
    }

    /**
     * Preview journal entries that would be created for a transaction
     * 
     * This endpoint allows users to see what journal entries would be created
     * BEFORE actually recording the transaction. Useful for validation and
     * understanding the accounting impact of a transaction.
     * 
     * Request:
     * {
     *   "transaction_type": "sales_invoice|expense|customer_payment|supplier_payment|purchase",
     *   "data": { ...transaction data... }
     * }
     * 
     * Response: Array of journal entry items (without saving to database)
     */
    public function previewJournalEntries(Request $request)
    {
        $user = $request->user();
        $companyId = $request->input('company_id', $user->company_id);

        if (!$this->canManageCompany($request, $companyId)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to preview entries for this company.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'transaction_type' => 'required|string|in:sales_invoice,expense,customer_payment,supplier_payment,purchase',
            'data' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Validation failed',
                'message' => $validator->errors(), 'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $this->accountingService->setCompanyId($companyId)->setUserId($user->id);

            $transactionType = $request->input('transaction_type');
            $data = $request->input('data');

            // Build preview based on transaction type
            $preview = match ($transactionType) {
                'sales_invoice' => $this->previewSalesInvoice($data),
                'expense' => $this->previewExpense($data),
                'customer_payment' => $this->previewCustomerPayment($data),
                'supplier_payment' => $this->previewSupplierPayment($data),
                'purchase' => $this->previewPurchase($data),
                default => throw new \Exception('Unknown transaction type'),
            };

            return response()->json([
                'status' => 'success',
                'transaction_type' => $transactionType,
                'summary' => $this->calculatePreviewSummary($preview),
                'entries' => $preview,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Journal entry preview failed', [
                'company_id' => $companyId,
                'transaction_type' => $request->input('transaction_type'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Preview generation failed: ' . $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Generate preview entries for a sales invoice
     */
    private function previewSalesInvoice(array $data): array
    {
        $total = $data['total_amount'] ?? 0;
        $tax = $data['tax_amount'] ?? 0;
        $net = $total - $tax;

        return [
            [
                'account' => $this->accountingService->getAccountIdForKey('accounts_receivable'),
                'account_name' => 'Accounts Receivable',
                'debit' => $total,
                'credit' => 0,
                'description' => 'Invoice recorded - ' . ($data['reference'] ?? 'INV-' . date('YmdHis')),
            ],
            [
                'account' => $this->accountingService->getAccountIdForKey('sales_revenue'),
                'account_name' => 'Sales Revenue',
                'debit' => 0,
                'credit' => $net,
                'description' => 'Sales revenue recognized',
            ],
            [
                'account' => $this->accountingService->getAccountIdForKey('vat_payable'),
                'account_name' => 'Output VAT',
                'debit' => 0,
                'credit' => $tax,
                'description' => 'Output VAT on invoice',
            ],
        ];
    }

    /**
     * Generate preview entries for an expense
     */
    private function previewExpense(array $data): array
    {
        $total = $data['amount'] ?? 0;
        $tax = $data['tax_amount'] ?? 0;
        $net = $total - $tax;

        return [
            [
                'account' => $this->accountingService->getAccountIdForKey('miscellaneous_expense'),
                'account_name' => 'Expense Account',
                'debit' => $net,
                'credit' => 0,
                'description' => $data['description'] ?? 'Expense',
            ],
            [
                'account' => $this->accountingService->getAccountIdForKey('input_vat'),
                'account_name' => 'Input VAT',
                'debit' => $tax,
                'credit' => 0,
                'description' => 'Input VAT on expense',
            ],
            [
                'account' => $this->accountingService->getCashAccountForPaymentMethod($data['payment_method'] ?? 'cash'),
                'account_name' => 'Cash/Bank',
                'debit' => 0,
                'credit' => $total,
                'description' => 'Payment for expense',
            ],
        ];
    }

    /**
     * Generate preview entries for a customer payment
     */
    private function previewCustomerPayment(array $data): array
    {
        $amount = $data['amount'] ?? 0;

        return [
            [
                'account' => $this->accountingService->getCashAccountForPaymentMethod($data['payment_method'] ?? 'cash'),
                'account_name' => 'Cash/Bank',
                'debit' => $amount,
                'credit' => 0,
                'description' => 'Payment received from customer',
            ],
            [
                'account' => $this->accountingService->getAccountIdForKey('accounts_receivable'),
                'account_name' => 'Accounts Receivable',
                'debit' => 0,
                'credit' => $amount,
                'description' => 'A/R reduced',
            ],
        ];
    }

    /**
     * Generate preview entries for a supplier payment
     */
    private function previewSupplierPayment(array $data): array
    {
        $amount = $data['amount'] ?? 0;

        return [
            [
                'account' => $this->accountingService->getAccountIdForKey('accounts_payable'),
                'account_name' => 'Accounts Payable',
                'debit' => $amount,
                'credit' => 0,
                'description' => 'Payment to supplier',
            ],
            [
                'account' => $this->accountingService->getCashAccountForPaymentMethod($data['payment_method'] ?? 'cash'),
                'account_name' => 'Cash/Bank',
                'debit' => 0,
                'credit' => $amount,
                'description' => 'Payment made',
            ],
        ];
    }

    /**
     * Generate preview entries for a purchase
     */
    private function previewPurchase(array $data): array
    {
        $total = $data['total_amount'] ?? 0;
        $tax = $data['tax_amount'] ?? 0;
        $net = $total - $tax;

        return [
            [
                'account' => $this->accountingService->getAccountIdForKey('inventory'),
                'account_name' => 'Inventory',
                'debit' => $net,
                'credit' => 0,
                'description' => 'Inventory purchased',
            ],
            [
                'account' => $this->accountingService->getAccountIdForKey('input_vat'),
                'account_name' => 'Input VAT',
                'debit' => $tax,
                'credit' => 0,
                'description' => 'Input VAT on purchase',
            ],
            [
                'account' => $this->accountingService->getAccountIdForKey('accounts_payable'),
                'account_name' => 'Accounts Payable',
                'debit' => 0,
                'credit' => $total,
                'description' => 'Purchase recorded',
            ],
        ];
    }

    /**
     * Calculate summary statistics for preview
     */
    private function calculatePreviewSummary(array $entries): array
    {
        $totalDebits = 0;
        $totalCredits = 0;

        foreach ($entries as $entry) {
            $totalDebits += $entry['debit'] ?? 0;
            $totalCredits += $entry['credit'] ?? 0;
        }

        return [
            'total_debits' => $totalDebits,
            'total_credits' => $totalCredits,
            'is_balanced' => abs($totalDebits - $totalCredits) < 0.01,
            'variance' => abs($totalDebits - $totalCredits),
            'entry_count' => count($entries),
        ];
    }

    /**
     * Check if user can manage a specific company
     */
    protected function canManageCompany(Request $request, $companyId): bool
    {
        $user = $request->user();
        
        if (!$user) {
            return false;
        }

        $role = $user->role;
        
        if (!$role) {
            return false;
        }
        
        // System admin can manage any company
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        
        // Company manager can only manage their own company
        if ($role->hasPermission('can_manage_company')) {
            return $user->company_id === $companyId;
        }
        
        return false;
    }
}
