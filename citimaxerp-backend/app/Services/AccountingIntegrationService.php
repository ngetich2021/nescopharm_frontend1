<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\CompanyAccountMapping;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\Invoice;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Order;
use App\Models\Customer;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * AccountingIntegrationService
 * 
 * This service centralizes all accounting journal entry creation from various
 * business modules (Invoices, Expenses, Payments, Orders, etc.)
 * 
 * DOUBLE-ENTRY BOOKKEEPING RULES:
 * - Assets increase with DEBIT, decrease with CREDIT
 * - Liabilities increase with CREDIT, decrease with DEBIT
 * - Equity increases with CREDIT, decreases with DEBIT
 * - Income increases with CREDIT, decreases with DEBIT
 * - Expenses increase with DEBIT, decrease with CREDIT
 * 
 * ACCOUNT CONFIGURATION:
 * Account codes are dynamically configured per company through the
 * CompanyAccountMapping model. Each company must set up their chart of
 * accounts first, then configure the account mappings.
 * 
 * FEATURES:
 * - Batch-loaded account resolution for performance
 * - Context-aware mappings (e.g., different expense accounts per category)
 * - Fallback chains for missing configurations
 * - Custom payment method support
 * 
 * @see CompanyAccountMapping for configuration
 * @see AccountMappingResolver for resolution logic
 */
class AccountingIntegrationService
{
    protected ?string $companyId = null;
    protected ?string $userId = null;
    protected $resolver = null;  // AccountMappingResolver instance

    /**
     * Set the company context for operations
     */
    public function setCompany(string $companyId): self
    {
        $this->companyId = $companyId;
        $this->resolver = null; // Reset resolver when company changes
        return $this;
    }

    /**
     * Set the user context for operations
     */
    public function setUser(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * Get the account mapping resolver for the current company
     * @return \App\Models\AccountMappingResolver
     */
    protected function getResolver()
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        if (!$this->resolver) {
            $this->resolver = CompanyAccountMapping::getResolver($this->companyId);
        }

        return $this->resolver;
    }

    /**
     * Get account ID for a mapping key with optional context
     */
    protected function getAccountIdForKey(string $mappingKey, array $context = []): ?string
    {
        return $this->getResolver()->getAccountId($mappingKey, $context);
    }

    /**
     * Get account by code for the current company
     */
    protected function getAccount(string $code): ?ChartOfAccount
    {
        return ChartOfAccount::where('company_id', $this->companyId)
            ->where('account_code', $code)
            ->first();
    }

    /**
     * Get account ID by code
     */
    protected function getAccountId(string $code): ?string
    {
        $account = $this->getAccount($code);
        return $account?->id;
    }

    /**
     * Get cash/bank account based on payment method
     */
    protected function getCashAccountForPaymentMethod(string $paymentMethod): ?string
    {
        return $this->getResolver()->getAccountIdForPaymentMethod($paymentMethod);
    }

    /**
     * Batch resolve multiple accounts at once (more efficient)
     */
    protected function resolveAccounts(array $keys): array
    {
        return $this->getResolver()->getMultipleAccountIds($keys);
    }

    // =========================================================================
    // VALIDATION METHODS (CRITICAL: Prevent silent failures)
    // =========================================================================

    /**
     * Validate that required mappings exist for a transaction type
     * Throws exception with detailed message if mappings missing
     */
    protected function validateRequiredMappings(array $requiredMappings, array $context = []): void
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        $missing = [];
        
        foreach ($requiredMappings as $mappingKey) {
            $accountId = $this->getAccountIdForKey($mappingKey, $context);
            
            if (!$accountId) {
                $mapping = CompanyAccountMapping::CORE_MAPPING_KEYS[$mappingKey] ?? 
                           CompanyAccountMapping::EXTENDED_MAPPING_KEYS[$mappingKey] ?? null;
                
                $missing[] = [
                    'key' => $mappingKey,
                    'description' => $mapping['description'] ?? 'Unknown mapping',
                ];
            }
        }

        if (!empty($missing)) {
            $missingList = implode(', ', array_column($missing, 'key'));
            $detailList = implode("\n  - ", array_map(
                fn($m) => "{$m['key']}: {$m['description']}", 
                $missing
            ));
            
            throw new \Exception(
                "Cannot record transaction: Required account mappings are not configured.\n" .
                "Missing mappings: {$missingList}\n" .
                "Please configure the following in Account Mappings:\n  - {$detailList}"
            );
        }
    }

    /**
     * Validate that accounts are active and correct type
     */
    protected function validateAccountsBeforePosting(array $items): void
    {
        $accountIds = array_unique(array_column($items, 'account_id'));
        
        $accounts = ChartOfAccount::whereIn('id', $accountIds)
            ->where('company_id', $this->companyId)
            ->get()
            ->keyBy('id');

        foreach ($accountIds as $accountId) {
            if (!isset($accounts[$accountId])) {
                throw new \Exception(
                    "Account {$accountId} not found for company {$this->companyId}. " .
                    "The account mapping may reference a deleted account."
                );
            }

            $account = $accounts[$accountId];
            
            if (!$account->is_active) {
                throw new \Exception(
                    "Cannot post entry: Account '{$account->account_code} - {$account->account_name}' is inactive. " .
                    "Please activate the account or update the mapping to use a different account."
                );
            }
        }
    }

    /**
     * Validate financial period is not locked
     */
    protected function validatePeriodNotLocked($entryDate): void
    {
        // Check if FinancialPeriod model exists and is being used
        try {
            $period = \App\Models\FinancialPeriod::where('company_id', $this->companyId)
                ->where('start_date', '<=', $entryDate)
                ->where('end_date', '>=', $entryDate)
                ->first();

            if ($period && $period->is_locked) {
                throw new \Exception(
                    "Cannot post entry: Financial period ({$period->period_name}) is locked. " .
                    "Please contact your system administrator to unlock the period if you need to make corrections."
                );
            }
        } catch (\Exception $e) {
            if (strpos($e->getMessage(), 'Cannot post entry') === 0) {
                throw $e;
            }
            // Model doesn't exist, skip validation
            Log::debug('FinancialPeriod model not available, skipping period lock validation');
        }
    }

    /**
     * Log detailed information about entry creation decision
     */
    protected function logEntryCreationDecision(
        string $sourceType,
        string $sourceId,
        bool $shouldCreate,
        string $reason,
        array $mappingsUsed = []
    ): void
    {
        Log::info('Journal entry creation decision', [
            'company_id' => $this->companyId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'should_create' => $shouldCreate,
            'reason' => $reason,
            'mappings_used' => $mappingsUsed,
            'user_id' => $this->userId,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Generate entry number
     */
    protected function generateEntryNumber(string $prefix = 'JE'): string
    {
        $date = now()->format('Ymd');
        $count = JournalEntry::where('company_id', $this->companyId)
            ->where('entry_number', 'like', "{$prefix}-{$date}-%")
            ->count();
        
        return sprintf('%s-%s-%04d', $prefix, $date, $count + 1);
    }

    /**
     * Create a journal entry with items
     * CRITICAL: Validates before creating to prevent bad data
     */
    protected function createJournalEntry(array $data, array $items): JournalEntry
    {
        // Step 1: Validate that debits equal credits
        $totalDebit = collect($items)->sum('debit_amount');
        $totalCredit = collect($items)->sum('credit_amount');

        if (abs($totalDebit - $totalCredit) > 0.01) {
            throw new \Exception(
                "Journal entry is unbalanced and cannot be posted. " .
                "Total Debits: {$totalDebit}, Total Credits: {$totalCredit}. " .
                "In double-entry bookkeeping, debits must equal credits."
            );
        }

        // Step 2: Validate accounts exist and are active
        $this->validateAccountsBeforePosting($items);

        // Step 3: Validate period is not locked (if applicable)
        $this->validatePeriodNotLocked($data['entry_date'] ?? now()->toDateString());

        // Step 4: Create the entry
        $journalEntry = JournalEntry::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyId,
            'entry_number' => $data['entry_number'] ?? $this->generateEntryNumber($data['prefix'] ?? 'JE'),
            'entry_date' => $data['entry_date'] ?? now()->toDateString(),
            'reference' => $data['reference'] ?? null,
            'description' => $data['description'],
            'total_debit' => $totalDebit,
            'total_credit' => $totalCredit,
            'status' => $data['status'] ?? 'posted',
            'entry_type' => $data['entry_type'] ?? 'automatic',
            'source_id' => $data['source_id'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'created_by' => $this->userId,
            'posted_by' => $data['status'] === 'posted' ? $this->userId : null,
            'posted_at' => $data['status'] === 'posted' ? now() : null,
            'metadata' => $data['metadata'] ?? null,
        ]);

        // Step 5: Create entry items
        foreach ($items as $item) {
            JournalEntryItem::create([
                'id' => (string) Str::uuid(),
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $item['account_id'],
                'company_id' => $this->companyId,
                'description' => $item['description'] ?? $journalEntry->description,
                'debit_amount' => $item['debit_amount'] ?? 0,
                'credit_amount' => $item['credit_amount'] ?? 0,
                'contact_id' => $item['contact_id'] ?? null,
                'contact_type' => $item['contact_type'] ?? null,
                'reference' => $item['reference'] ?? null,
                'metadata' => $item['metadata'] ?? null,
            ]);
        }

        // Step 6: Log with detailed information
        Log::info('Journal entry successfully created', [
            'entry_id' => $journalEntry->id,
            'entry_number' => $journalEntry->entry_number,
            'type' => $journalEntry->entry_type,
            'total_debit' => $totalDebit,
            'total_credit' => $totalCredit,
            'item_count' => count($items),
            'source_type' => $data['source_type'] ?? null,
            'source_id' => $data['source_id'] ?? null,
        ]);

        return $journalEntry;
    }

    // =========================================================================
    // INVOICE / SALES TRANSACTIONS
    // =========================================================================

    /**
     * Record a sales invoice (credit sale)
     * 
     * Journal Entry:
     * DR: Accounts Receivable (configured)  - Total Amount
     * CR: Sales Revenue (configured)        - Net Amount
     * CR: VAT Payable (configured)          - Tax Amount (if applicable)
     * 
     * @param Invoice|array $invoice Invoice model or array with invoice data
     */
    public function recordSalesInvoice($invoice): JournalEntry
    {
        if (is_array($invoice)) {
            $invoice = (object) $invoice;
        }

        $this->companyId = $this->companyId ?? $invoice->company_id;
        $this->userId = $this->userId ?? auth()->id();

        // VALIDATION: Check required mappings exist BEFORE attempting to record
        $this->validateRequiredMappings(['accounts_receivable', 'sales_revenue']);

        $arAccountId = $this->getAccountIdForKey('accounts_receivable');
        $salesAccountId = $this->getAccountIdForKey('sales_revenue');
        $vatAccountId = $this->getAccountIdForKey('vat_payable');

        // Double-check after validation (defensive programming)
        if (!$arAccountId || !$salesAccountId) {
            throw new \Exception(
                'Required accounts not properly resolved after validation. ' .
                'This is a system error. Please contact support.'
            );
        }

        $netAmount = $invoice->subtotal ?? ($invoice->total_amount - ($invoice->tax_amount ?? 0));
        $taxAmount = $invoice->tax_amount ?? 0;
        $totalAmount = $invoice->total_amount;

        $items = [
            [
                'account_id' => $arAccountId,
                'debit_amount' => $totalAmount,
                'credit_amount' => 0,
                'description' => "Invoice {$invoice->invoice_number} - " . ($invoice->customer->name ?? 'Customer'),
                'contact_id' => $invoice->customer_id,
                'contact_type' => Customer::class,
            ],
            [
                'account_id' => $salesAccountId,
                'debit_amount' => 0,
                'credit_amount' => $netAmount,
                'description' => "Sales Revenue - Invoice {$invoice->invoice_number}",
            ],
        ];

        // Add VAT entry if applicable
        if ($taxAmount > 0 && $vatAccountId) {
            $items[] = [
                'account_id' => $vatAccountId,
                'debit_amount' => 0,
                'credit_amount' => $taxAmount,
                'description' => "Output VAT - Invoice {$invoice->invoice_number}",
            ];
        }

        // Only set source_id if it's a valid UUID
        $sourceId = isset($invoice->id) && preg_match('/^[a-f0-9\-]{36}$/', $invoice->id) ? $invoice->id : null;

        return $this->createJournalEntry([
            'prefix' => 'INV',
            'entry_date' => $invoice->invoice_date ?? now()->toDateString(),
            'reference' => "INV-{$invoice->invoice_number}",
            'description' => "Sales Invoice {$invoice->invoice_number}",
            'entry_type' => 'automatic',
            'source_id' => $sourceId,
            'source_type' => $sourceId ? Invoice::class : null,
            'status' => 'posted',
            'metadata' => [
                'invoice_number' => $invoice->invoice_number,
                'customer_id' => $invoice->customer_id,
                'transaction_type' => 'sales_invoice',
            ],
        ], $items);
    }

    /**
     * Record a cash sale (immediate payment)
     * 
     * Journal Entry:
     * DR: Cash/Bank (configured)     - Total Amount
     * CR: Sales Revenue (configured) - Net Amount
     * CR: VAT Payable (configured)   - Tax Amount (if applicable)
     */
    public function recordCashSale(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        $cashAccountId = $this->getCashAccountForPaymentMethod($data['payment_method'] ?? 'cash');
        $salesAccountId = $this->getAccountIdForKey('sales_revenue');
        $vatAccountId = $this->getAccountIdForKey('vat_payable');

        if (!$cashAccountId || !$salesAccountId) {
            throw new \Exception('Required accounts (Cash or Sales Revenue) not configured. Please set up account mappings for this company.');
        }

        $netAmount = $data['net_amount'] ?? ($data['total_amount'] - ($data['tax_amount'] ?? 0));
        $taxAmount = $data['tax_amount'] ?? 0;
        $totalAmount = $data['total_amount'];

        $items = [
            [
                'account_id' => $cashAccountId,
                'debit_amount' => $totalAmount,
                'credit_amount' => 0,
                'description' => "Cash Sale - {$data['reference']}",
            ],
            [
                'account_id' => $salesAccountId,
                'debit_amount' => 0,
                'credit_amount' => $netAmount,
                'description' => "Sales Revenue - {$data['reference']}",
            ],
        ];

        if ($taxAmount > 0 && $vatAccountId) {
            $items[] = [
                'account_id' => $vatAccountId,
                'debit_amount' => 0,
                'credit_amount' => $taxAmount,
                'description' => "Output VAT - {$data['reference']}",
            ];
        }

        return $this->createJournalEntry([
            'prefix' => 'CSL',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "Cash Sale - {$data['reference']}",
            'entry_type' => 'automatic',
            'source_id' => $data['source_id'] ?? null,
            'source_type' => $data['source_type'] ?? Order::class,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'cash_sale',
                'payment_method' => $data['payment_method'] ?? 'cash',
            ],
        ], $items);
    }

    /**
     * Record customer payment (receipt)
     * 
     * Journal Entry:
     * DR: Cash/Bank (configured)           - Payment Amount
     * CR: Accounts Receivable (configured) - Payment Amount
     * 
     * @param Payment|array $payment Payment model or array with payment data
     */
    public function recordCustomerPayment($payment): JournalEntry
    {
        if (is_array($payment)) {
            $payment = (object) $payment;
        }

        $this->companyId = $this->companyId ?? $payment->company_id;
        $this->userId = $this->userId ?? auth()->id();

        // Step 1: Validate required mappings exist
        $this->validateRequiredMappings(
            ['accounts_receivable'],
            ['payment_method' => $payment->payment_method ?? 'cash']
        );

        $cashAccountId = $this->getCashAccountForPaymentMethod($payment->payment_method ?? 'cash');
        $arAccountId = $this->getAccountIdForKey('accounts_receivable');

        if (!$cashAccountId || !$arAccountId) {
            throw new \Exception('Cannot record payment: Missing required account mappings (Cash or A/R). Please configure account mappings in Finance > Account Mappings.');
        }

        $amount = $payment->amount_paid ?? $payment->amount;
        $reference = $payment->transaction_id ?? $payment->reference ?? "REC-" . now()->format('YmdHis');

        $items = [
            [
                'account_id' => $cashAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Payment received - {$reference}",
                'contact_id' => $payment->customer_id ?? null,
                'contact_type' => $payment->customer_id ? Customer::class : null,
            ],
            [
                'account_id' => $arAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "A/R reduced - {$reference}",
                'contact_id' => $payment->customer_id ?? null,
                'contact_type' => $payment->customer_id ? Customer::class : null,
            ],
        ];

        // Only set source_id if it's a valid UUID
        $sourceId = isset($payment->id) && preg_match('/^[a-f0-9\-]{36}$/', $payment->id) ? $payment->id : null;

        return $this->createJournalEntry([
            'prefix' => 'REC',
            'entry_date' => $payment->payment_date ?? now()->toDateString(),
            'reference' => $reference,
            'description' => "Customer Payment - {$reference}",
            'entry_type' => 'automatic',
            'source_id' => $sourceId,
            'source_type' => $sourceId ? Payment::class : null,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'customer_payment',
                'payment_method' => $payment->payment_method ?? 'cash',
                'customer_id' => $payment->customer_id ?? null,
                'invoice_id' => $payment->invoice_id ?? null,
            ],
        ], $items);
    }

    // =========================================================================
    // EXPENSE TRANSACTIONS
    // =========================================================================

    /**
     * Record an expense payment (cash expense)
     * 
     * Journal Entry:
     * DR: Expense Account (configured)  - Net Amount
     * DR: Input VAT (configured)        - Tax Amount (if applicable)
     * CR: Cash/Bank (configured)        - Total Amount
     * 
     * @param Expense|array $expense Expense model or array with expense data
     */
    public function recordExpense($expense): JournalEntry
    {
        if (is_array($expense)) {
            $expense = (object) $expense;
        }

        $this->companyId = $this->companyId ?? $expense->company_id;
        $this->userId = $this->userId ?? auth()->id();

        // Step 1: Validate required mappings exist
        $this->validateRequiredMappings(['miscellaneous_expense'], ['expense_category' => $expense->category_id ?? null]);

        $cashAccountId = $this->getCashAccountForPaymentMethod($expense->payment_method ?? 'cash');
        $inputVatAccountId = $this->getAccountIdForKey('input_vat');

        // Get the expense account - either from the expense category or default
        $expenseAccountId = null;
        if (isset($expense->category) && $expense->category->account_id) {
            $expenseAccountId = $expense->category->account_id;
        } else {
            // Map expense category to default account
            $expenseAccountId = $this->getAccountIdForKey('miscellaneous_expense');
        }

        if (!$cashAccountId || !$expenseAccountId) {
            throw new \Exception('Cannot record expense: Missing required account mappings (Cash or Expense). Please configure account mappings in Finance > Account Mappings.');
        }

        $taxAmount = $expense->tax_amount ?? 0;
        $netAmount = $expense->amount - $taxAmount;
        $totalAmount = $expense->amount;

        $items = [
            [
                'account_id' => $expenseAccountId,
                'debit_amount' => $netAmount,
                'credit_amount' => 0,
                'description' => "{$expense->description} - {$expense->vendor_name}",
            ],
        ];

        if ($taxAmount > 0 && $inputVatAccountId) {
            $items[] = [
                'account_id' => $inputVatAccountId,
                'debit_amount' => $taxAmount,
                'credit_amount' => 0,
                'description' => "Input VAT - {$expense->vendor_name}",
            ];
        }

        $items[] = [
            'account_id' => $cashAccountId,
            'debit_amount' => 0,
            'credit_amount' => $totalAmount,
            'description' => "Payment for {$expense->description}",
        ];

        // Only set source_id if it's a valid UUID
        $sourceId = isset($expense->id) && preg_match('/^[a-f0-9\-]{36}$/', $expense->id) ? $expense->id : null;

        return $this->createJournalEntry([
            'prefix' => 'EXP',
            'entry_date' => $expense->expense_date ?? now()->toDateString(),
            'reference' => "EXP-" . ($sourceId ?? now()->format('YmdHis')),
            'description' => "Expense: {$expense->description}",
            'entry_type' => 'automatic',
            'source_id' => $sourceId,
            'source_type' => $sourceId ? Expense::class : null,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'expense',
                'vendor_name' => $expense->vendor_name,
                'category_id' => $expense->category_id ?? null,
                'payment_method' => $expense->payment_method ?? 'cash',
            ],
        ], $items);
    }

    /**
     * Record an expense on credit (accounts payable)
     * 
     * Journal Entry:
     * DR: Expense Account (configured)    - Net Amount
     * DR: Input VAT (configured)          - Tax Amount (if applicable)
     * CR: Accounts Payable (configured)   - Total Amount
     */
    public function recordExpenseOnCredit($expense): JournalEntry
    {
        if (is_array($expense)) {
            $expense = (object) $expense;
        }

        $this->companyId = $this->companyId ?? $expense->company_id;
        $this->userId = $this->userId ?? auth()->id();

        $apAccountId = $this->getAccountIdForKey('accounts_payable');
        $inputVatAccountId = $this->getAccountIdForKey('input_vat');
        $expenseAccountId = $this->getAccountIdForKey('miscellaneous_expense');

        if (!$apAccountId || !$expenseAccountId) {
            throw new \Exception('Required accounts (A/P or Expense) not configured. Please set up account mappings for this company.');
        }

        $taxAmount = $expense->tax_amount ?? 0;
        $netAmount = $expense->amount - $taxAmount;
        $totalAmount = $expense->amount;

        $items = [
            [
                'account_id' => $expenseAccountId,
                'debit_amount' => $netAmount,
                'credit_amount' => 0,
                'description' => "{$expense->description} - {$expense->vendor_name}",
            ],
        ];

        if ($taxAmount > 0 && $inputVatAccountId) {
            $items[] = [
                'account_id' => $inputVatAccountId,
                'debit_amount' => $taxAmount,
                'credit_amount' => 0,
                'description' => "Input VAT - {$expense->vendor_name}",
            ];
        }

        $items[] = [
            'account_id' => $apAccountId,
            'debit_amount' => 0,
            'credit_amount' => $totalAmount,
            'description' => "Payable to {$expense->vendor_name}",
        ];

        return $this->createJournalEntry([
            'prefix' => 'EXP',
            'entry_date' => $expense->expense_date ?? now()->toDateString(),
            'reference' => "EXP-{$expense->id}",
            'description' => "Expense on Credit: {$expense->description}",
            'entry_type' => 'automatic',
            'source_id' => $expense->id ?? null,
            'source_type' => Expense::class,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'expense_on_credit',
                'vendor_name' => $expense->vendor_name,
            ],
        ], $items);
    }

    // =========================================================================
    // PURCHASE TRANSACTIONS
    // =========================================================================

    /**
     * Record inventory purchase on credit
     * 
     * Journal Entry:
     * DR: Inventory (configured)          - Net Amount
     * DR: Input VAT (configured)          - Tax Amount (if applicable)
     * CR: Accounts Payable (configured)   - Total Amount
     */
    public function recordPurchaseOnCredit(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        // Step 1: Validate required mappings exist
        $this->validateRequiredMappings(['accounts_payable', 'inventory']);

        $inventoryAccountId = $this->getAccountIdForKey('inventory');
        $apAccountId = $this->getAccountIdForKey('accounts_payable');
        $inputVatAccountId = $this->getAccountIdForKey('input_vat');

        if (!$inventoryAccountId || !$apAccountId) {
            throw new \Exception('Cannot record purchase: Missing required account mappings (Inventory or A/P). Please configure account mappings in Finance > Account Mappings.');
        }

        $taxAmount = $data['tax_amount'] ?? 0;
        $netAmount = $data['net_amount'] ?? ($data['total_amount'] - $taxAmount);
        $totalAmount = $data['total_amount'];

        $items = [
            [
                'account_id' => $inventoryAccountId,
                'debit_amount' => $netAmount,
                'credit_amount' => 0,
                'description' => "Inventory Purchase - {$data['reference']}",
            ],
        ];

        if ($taxAmount > 0 && $inputVatAccountId) {
            $items[] = [
                'account_id' => $inputVatAccountId,
                'debit_amount' => $taxAmount,
                'credit_amount' => 0,
                'description' => "Input VAT - {$data['reference']}",
            ];
        }

        $items[] = [
            'account_id' => $apAccountId,
            'debit_amount' => 0,
            'credit_amount' => $totalAmount,
            'description' => "Payable to {$data['supplier_name']}",
            'contact_id' => $data['supplier_id'] ?? null,
            'contact_type' => $data['supplier_id'] ? Supplier::class : null,
        ];

        return $this->createJournalEntry([
            'prefix' => 'PUR',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "Inventory Purchase - {$data['supplier_name']}",
            'entry_type' => 'automatic',
            'source_id' => $data['source_id'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'purchase_on_credit',
                'supplier_id' => $data['supplier_id'] ?? null,
                'supplier_name' => $data['supplier_name'],
            ],
        ], $items);
    }

    /**
     * Record cash purchase of inventory
     * 
     * Journal Entry:
     * DR: Inventory (configured)      - Net Amount
     * DR: Input VAT (configured)      - Tax Amount (if applicable)
     * CR: Cash/Bank (configured)      - Total Amount
     */
    public function recordCashPurchase(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        // Step 1: Validate required mappings exist
        $this->validateRequiredMappings(
            ['inventory'],
            ['payment_method' => $data['payment_method'] ?? 'cash']
        );

        $inventoryAccountId = $this->getAccountIdForKey('inventory');
        $cashAccountId = $this->getCashAccountForPaymentMethod($data['payment_method'] ?? 'cash');
        $inputVatAccountId = $this->getAccountIdForKey('input_vat');

        if (!$inventoryAccountId || !$cashAccountId) {
            throw new \Exception('Cannot record cash purchase: Missing required account mappings (Inventory or Cash). Please configure account mappings in Finance > Account Mappings.');
        }

        $taxAmount = $data['tax_amount'] ?? 0;
        $netAmount = $data['net_amount'] ?? ($data['total_amount'] - $taxAmount);
        $totalAmount = $data['total_amount'];

        $items = [
            [
                'account_id' => $inventoryAccountId,
                'debit_amount' => $netAmount,
                'credit_amount' => 0,
                'description' => "Inventory Purchase - {$data['reference']}",
            ],
        ];

        if ($taxAmount > 0 && $inputVatAccountId) {
            $items[] = [
                'account_id' => $inputVatAccountId,
                'debit_amount' => $taxAmount,
                'credit_amount' => 0,
                'description' => "Input VAT - {$data['reference']}",
            ];
        }

        $items[] = [
            'account_id' => $cashAccountId,
            'debit_amount' => 0,
            'credit_amount' => $totalAmount,
            'description' => "Cash payment to {$data['supplier_name']}",
        ];

        return $this->createJournalEntry([
            'prefix' => 'PUR',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "Cash Purchase - {$data['supplier_name']}",
            'entry_type' => 'automatic',
            'source_id' => $data['source_id'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'cash_purchase',
                'supplier_name' => $data['supplier_name'],
                'payment_method' => $data['payment_method'] ?? 'cash',
            ],
        ], $items);
    }

    /**
     * Record supplier payment
     * 
     * Journal Entry:
     * DR: Accounts Payable (configured) - Payment Amount
     * CR: Cash/Bank (configured)        - Payment Amount
     */
    public function recordSupplierPayment(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        // Step 1: Validate required mappings exist
        $this->validateRequiredMappings(
            ['accounts_payable'],
            ['payment_method' => $data['payment_method'] ?? 'cash']
        );

        $apAccountId = $this->getAccountIdForKey('accounts_payable');
        $cashAccountId = $this->getCashAccountForPaymentMethod($data['payment_method'] ?? 'cash');

        if (!$apAccountId || !$cashAccountId) {
            throw new \Exception('Cannot record supplier payment: Missing required account mappings (A/P or Cash). Please configure account mappings in Finance > Account Mappings.');
        }

        $amount = $data['amount'];
        $reference = $data['reference'] ?? "PAY-" . now()->format('YmdHis');

        $items = [
            [
                'account_id' => $apAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "A/P reduced - {$data['supplier_name']}",
                'contact_id' => $data['supplier_id'] ?? null,
                'contact_type' => $data['supplier_id'] ? Supplier::class : null,
            ],
            [
                'account_id' => $cashAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "Payment to {$data['supplier_name']}",
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'PAY',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $reference,
            'description' => "Supplier Payment - {$data['supplier_name']}",
            'entry_type' => 'automatic',
            'source_id' => $data['source_id'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'supplier_payment',
                'supplier_id' => $data['supplier_id'] ?? null,
                'supplier_name' => $data['supplier_name'],
                'payment_method' => $data['payment_method'] ?? 'cash',
            ],
        ], $items);
    }

    // =========================================================================
    // COST OF GOODS SOLD (COGS) TRANSACTIONS
    // =========================================================================

    /**
     * Record Cost of Goods Sold when goods are sold
     * 
     * Journal Entry:
     * DR: Cost of Goods Sold (configured) - Cost Amount
     * CR: Inventory (configured)          - Cost Amount
     */
    public function recordCostOfGoodsSold(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        $cogsAccountId = $this->getAccountIdForKey('cogs');
        $inventoryAccountId = $this->getAccountIdForKey('inventory');

        if (!$cogsAccountId || !$inventoryAccountId) {
            throw new \Exception('Required accounts (COGS or Inventory) not configured. Please set up account mappings for this company.');
        }

        $amount = $data['cost_amount'];

        $items = [
            [
                'account_id' => $cogsAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Cost of goods sold - {$data['reference']}",
            ],
            [
                'account_id' => $inventoryAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "Inventory reduction - {$data['reference']}",
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'COGS',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "COGS - {$data['reference']}",
            'entry_type' => 'automatic',
            'source_id' => $data['source_id'] ?? null,
            'source_type' => $data['source_type'] ?? null,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'cogs',
                'order_id' => $data['order_id'] ?? null,
            ],
        ], $items);
    }

    // =========================================================================
    // BANK/CASH TRANSACTIONS
    // =========================================================================

    /**
     * Record bank deposit (cash to bank transfer)
     * 
     * Journal Entry:
     * DR: Bank Account (configured)   - Amount
     * CR: Cash on Hand (configured)   - Amount
     */
    public function recordBankDeposit(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        // Allow specifying a specific bank account code, or use the default
        $bankAccountId = isset($data['bank_account_code']) 
            ? $this->getAccountId($data['bank_account_code'])
            : $this->getAccountIdForKey('main_bank');
        $cashAccountId = $this->getAccountIdForKey('cash_on_hand');

        if (!$bankAccountId || !$cashAccountId) {
            throw new \Exception('Required accounts (Bank or Cash) not configured. Please set up account mappings for this company.');
        }

        $amount = $data['amount'];

        $items = [
            [
                'account_id' => $bankAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Bank deposit - {$data['reference']}",
            ],
            [
                'account_id' => $cashAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "Cash deposited - {$data['reference']}",
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'DEP',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "Bank Deposit - {$data['reference']}",
            'entry_type' => 'automatic',
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'bank_deposit',
            ],
        ], $items);
    }

    /**
     * Record bank withdrawal (bank to cash transfer)
     * 
     * Journal Entry:
     * DR: Cash on Hand (configured)   - Amount
     * CR: Bank Account (configured)   - Amount
     */
    public function recordBankWithdrawal(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        $cashAccountId = $this->getAccountIdForKey('cash_on_hand');
        // Allow specifying a specific bank account code, or use the default
        $bankAccountId = isset($data['bank_account_code']) 
            ? $this->getAccountId($data['bank_account_code'])
            : $this->getAccountIdForKey('main_bank');

        if (!$bankAccountId || !$cashAccountId) {
            throw new \Exception('Required accounts (Bank or Cash) not configured. Please set up account mappings for this company.');
        }

        $amount = $data['amount'];

        $items = [
            [
                'account_id' => $cashAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Cash withdrawal - {$data['reference']}",
            ],
            [
                'account_id' => $bankAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "Bank withdrawal - {$data['reference']}",
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'WDR',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "Bank Withdrawal - {$data['reference']}",
            'entry_type' => 'automatic',
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'bank_withdrawal',
            ],
        ], $items);
    }

    /**
     * Record inter-account transfer
     * 
     * Journal Entry:
     * DR: To Account      - Amount
     * CR: From Account    - Amount
     */
    public function recordAccountTransfer(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        $fromAccountId = $this->getAccountId($data['from_account_code']);
        $toAccountId = $this->getAccountId($data['to_account_code']);

        if (!$fromAccountId || !$toAccountId) {
            throw new \Exception('Required accounts not found');
        }

        $amount = $data['amount'];

        $items = [
            [
                'account_id' => $toAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Transfer received - {$data['reference']}",
            ],
            [
                'account_id' => $fromAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "Transfer sent - {$data['reference']}",
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'TRF',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'],
            'description' => "Account Transfer - {$data['reference']}",
            'entry_type' => 'automatic',
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'account_transfer',
                'from_account' => $data['from_account_code'],
                'to_account' => $data['to_account_code'],
            ],
        ], $items);
    }

    // =========================================================================
    // ADJUSTING ENTRIES
    // =========================================================================

    /**
     * Record depreciation expense
     * 
     * Journal Entry:
     * DR: Depreciation Expense (configured)       - Amount
     * CR: Accumulated Depreciation (configured)   - Amount
     */
    public function recordDepreciation(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        $depExpenseAccountId = $this->getAccountIdForKey('depreciation');
        // Allow specifying a specific accumulated depreciation account, or use the default
        $accumDepAccountId = isset($data['accumulated_depreciation_account']) 
            ? $this->getAccountId($data['accumulated_depreciation_account'])
            : $this->getAccountIdForKey('accumulated_depreciation');

        if (!$depExpenseAccountId || !$accumDepAccountId) {
            throw new \Exception('Required depreciation accounts not configured. Please set up account mappings for this company.');
        }

        $amount = $data['amount'];

        $items = [
            [
                'account_id' => $depExpenseAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Depreciation - {$data['asset_name']}",
            ],
            [
                'account_id' => $accumDepAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "Accumulated Depreciation - {$data['asset_name']}",
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'DEP',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'] ?? "DEP-" . now()->format('Ymd'),
            'description' => "Depreciation - {$data['asset_name']}",
            'entry_type' => 'adjusting',
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'depreciation',
                'asset_id' => $data['asset_id'] ?? null,
                'asset_name' => $data['asset_name'],
            ],
        ], $items);
    }

    /**
     * Record bad debt write-off
     * 
     * Journal Entry:
     * DR: Bad Debt Expense (configured)            - Amount
     * CR: Accounts Receivable (configured)         - Amount
     * 
     * Or with Allowance method:
     * DR: Allowance for Doubtful Accounts (configured) - Amount
     * CR: Accounts Receivable (configured)             - Amount
     */
    public function recordBadDebtWriteOff(array $data): JournalEntry
    {
        $this->companyId = $this->companyId ?? $data['company_id'];
        $this->userId = $this->userId ?? auth()->id();

        $arAccountId = $this->getAccountIdForKey('accounts_receivable');
        
        // Use allowance method if specified, otherwise direct write-off
        if ($data['use_allowance'] ?? false) {
            $debitAccountId = $this->getAccountIdForKey('allowance_doubtful_accounts');
        } else {
            $debitAccountId = $this->getAccountIdForKey('bad_debt_expense');
        }

        if (!$arAccountId || !$debitAccountId) {
            throw new \Exception('Required accounts not configured. Please set up account mappings for this company.');
        }

        $amount = $data['amount'];

        $items = [
            [
                'account_id' => $debitAccountId,
                'debit_amount' => $amount,
                'credit_amount' => 0,
                'description' => "Bad debt write-off - {$data['customer_name']}",
                'contact_id' => $data['customer_id'] ?? null,
                'contact_type' => $data['customer_id'] ? Customer::class : null,
            ],
            [
                'account_id' => $arAccountId,
                'debit_amount' => 0,
                'credit_amount' => $amount,
                'description' => "A/R written off - {$data['customer_name']}",
                'contact_id' => $data['customer_id'] ?? null,
                'contact_type' => $data['customer_id'] ? Customer::class : null,
            ],
        ];

        return $this->createJournalEntry([
            'prefix' => 'WOF',
            'entry_date' => $data['date'] ?? now()->toDateString(),
            'reference' => $data['reference'] ?? "WOF-" . now()->format('YmdHis'),
            'description' => "Bad Debt Write-off - {$data['customer_name']}",
            'entry_type' => 'adjusting',
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'bad_debt_writeoff',
                'customer_id' => $data['customer_id'] ?? null,
                'customer_name' => $data['customer_name'],
                'invoice_id' => $data['invoice_id'] ?? null,
            ],
        ], $items);
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Reverse a journal entry
     */
    public function reverseJournalEntry(string $journalEntryId, ?string $reason = null): JournalEntry
    {
        $originalEntry = JournalEntry::with('items')->findOrFail($journalEntryId);
        
        if ($originalEntry->status === 'reversed') {
            throw new \Exception('Journal entry is already reversed');
        }

        $this->companyId = $originalEntry->company_id;
        $this->userId = $this->userId ?? auth()->id();

        // Create reversed items (swap debits and credits)
        $reversedItems = $originalEntry->items->map(function ($item) {
            return [
                'account_id' => $item->account_id,
                'debit_amount' => $item->credit_amount,
                'credit_amount' => $item->debit_amount,
                'description' => "Reversal: {$item->description}",
                'contact_id' => $item->contact_id,
                'contact_type' => $item->contact_type,
            ];
        })->toArray();

        // Create reversal entry
        $reversalEntry = $this->createJournalEntry([
            'prefix' => 'REV',
            'entry_date' => now()->toDateString(),
            'reference' => "REV-{$originalEntry->entry_number}",
            'description' => "Reversal of {$originalEntry->entry_number}: {$reason}",
            'entry_type' => 'manual',
            'source_id' => $originalEntry->id,
            'source_type' => JournalEntry::class,
            'status' => 'posted',
            'metadata' => [
                'transaction_type' => 'reversal',
                'original_entry_id' => $originalEntry->id,
                'original_entry_number' => $originalEntry->entry_number,
                'reversal_reason' => $reason,
            ],
        ], $reversedItems);

        // Mark original as reversed
        $originalEntry->update([
            'status' => 'reversed',
            'reversed_by' => $this->userId,
            'reversed_at' => now(),
            'reversal_reason' => $reason,
        ]);

        return $reversalEntry;
    }

    /**
     * Get journal entries by source
     */
    public function getEntriesBySource(string $sourceType, string $sourceId): \Illuminate\Database\Eloquent\Collection
    {
        return JournalEntry::where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->with('items.account')
            ->get();
    }

    /**
     * Check if a transaction has been recorded
     */
    public function hasBeenRecorded(string $sourceType, string $sourceId): bool
    {
        return JournalEntry::where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->where('status', '!=', 'reversed')
            ->exists();
    }

    /**
     * Get account balance for a specific account
     */
    public function getAccountBalance(string $accountCode, ?string $asOfDate = null): array
    {
        $account = $this->getAccount($accountCode);
        
        if (!$account) {
            throw new \Exception("Account with code {$accountCode} not found");
        }

        $query = JournalEntryItem::where('account_id', $account->id)
            ->whereHas('journalEntry', function ($q) use ($asOfDate) {
                $q->where('status', 'posted');
                if ($asOfDate) {
                    $q->where('entry_date', '<=', $asOfDate);
                }
            });

        $totalDebit = (clone $query)->sum('debit_amount');
        $totalCredit = (clone $query)->sum('credit_amount');

        // Calculate balance based on account type
        $balance = in_array($account->account_type, ['asset', 'expense'])
            ? $totalDebit - $totalCredit
            : $totalCredit - $totalDebit;

        return [
            'account_code' => $accountCode,
            'account_name' => $account->account_name,
            'account_type' => $account->account_type,
            'total_debit' => $totalDebit,
            'total_credit' => $totalCredit,
            'balance' => $balance,
            'as_of_date' => $asOfDate ?? now()->toDateString(),
        ];
    }

    /**
     * Validate that all required account mappings exist for a company
     * 
     * @param array $requiredKeys Optional list of specific keys to validate. If empty, validates all standard keys.
     */
    public function validateAccountSetup(array $requiredKeys = []): array
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        return CompanyAccountMapping::validateMappings($this->companyId, $requiredKeys);
    }

    /**
     * Initialize default account mappings for a company
     * Attempts to auto-detect and configure mappings based on common account code patterns
     */
    public function initializeAccountMappings(): array
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        return CompanyAccountMapping::initializeDefaultMappings($this->companyId);
    }

    /**
     * Set a specific account mapping for a company
     */
    public function setAccountMapping(string $mappingKey, string $accountCode, ?string $chartOfAccountId = null): CompanyAccountMapping
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        return CompanyAccountMapping::setMapping($this->companyId, $mappingKey, $accountCode, $chartOfAccountId);
    }

    /**
     * Set multiple account mappings at once
     */
    public function setAccountMappings(array $mappings): void
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        CompanyAccountMapping::setMappings($this->companyId, $mappings);
    }

    /**
     * Get all available mapping keys with descriptions
     */
    public function getAvailableMappingKeys(): array
    {
        return CompanyAccountMapping::MAPPING_KEYS;
    }

    /**
     * Get current mappings for the company
     */
    public function getCurrentMappings(): array
    {
        if (!$this->companyId) {
            throw new \Exception('Company ID is not set. Call setCompany() first.');
        }

        return CompanyAccountMapping::getMappings($this->companyId);
    }
}
