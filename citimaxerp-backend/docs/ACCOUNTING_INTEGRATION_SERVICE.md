# Accounting Integration Service

## Overview

The `AccountingIntegrationService` centralizes all journal entry creation from various business modules (Invoices, Expenses, Payments, Orders, etc.). It ensures all financial transactions are properly recorded using double-entry bookkeeping principles.

## Dynamic Account Configuration

Account codes are **dynamically configured per company** through the `CompanyAccountMapping` model. This allows each company to customize their chart of accounts while using the same accounting service.

### Key Features:
- **Company-specific configurations** - Each company can map logical accounts to their own codes
- **Context-aware mappings** - Different expense accounts per category, location, etc.
- **Fallback chains** - Automatic fallback to parent accounts when specific mappings don't exist
- **Custom payment method support** - Configure different bank/cash accounts per payment method
- **Efficient batch loading** - Single query loads all mappings with smart caching

## Quick Start

```php
use App\Services\AccountingIntegrationService;

// Get the service instance
$accountingService = app(AccountingIntegrationService::class);

// Set company and user context
$accountingService->setCompany($companyId)->setUser($userId);

// Record transactions
$journalEntry = $accountingService->recordSalesInvoice($invoice);
```

## Account Configuration Setup

Before using the accounting service, companies must configure their account mappings:

### 1. Initialize from Chart of Accounts (Auto-Detection)

```php
use App\Models\CompanyAccountMapping;

// Auto-detect and configure mappings based on account patterns
$result = CompanyAccountMapping::initializeFromChartOfAccounts($companyId);

// Returns:
// ['mapped' => [...], 'unmapped' => [...]]
```

### 2. Manual Configuration

```php
// Set individual mappings
CompanyAccountMapping::setMapping(
    $companyId,
    'accounts_receivable',  // mapping key
    '1200',                 // account code
    $chartOfAccountId,      // UUID of chart of account
    'Trade Receivables'     // description
);
```

### 3. Bulk Configuration via API

```bash
POST /api/finance/account-mappings/bulk
{
  "company_id": "uuid",
  "mappings": [
    {"mapping_key": "cash_on_hand", "account_code": "1010"},
    {"mapping_key": "accounts_receivable", "account_code": "1200"},
    {"mapping_key": "sales_revenue", "account_code": "4100"}
  ]
}
```

### 4. Validate Configuration

```php
$result = CompanyAccountMapping::validateConfiguration($companyId);
// Returns: ['is_valid' => bool, 'configured' => [...], 'missing' => [...]]
```

## Available Mapping Keys

### Core Mapping Keys (Required)

| Key | Description | Account Type |
|-----|-------------|--------------|
| `cash_on_hand` | Cash on Hand | Asset |
| `main_bank` | Main Operating Bank Account | Asset |
| `accounts_receivable` | Trade Receivables | Asset |
| `accounts_payable` | Trade Payables | Liability |
| `inventory` | Inventory/Stock | Asset |
| `sales_revenue` | Sales Revenue | Income |
| `cost_of_goods_sold` | Cost of Goods Sold | Expense |
| `vat_payable` | VAT/Tax Payable | Liability |
| `input_vat` | Input VAT/Tax | Asset |

### Extended Mapping Keys (Optional)

| Key | Description | Account Type |
|-----|-------------|--------------|
| `petty_cash` | Petty Cash | Asset |
| `mpesa_float` | M-Pesa Float Account | Asset |
| `customer_deposits` | Customer Deposits | Liability |
| `service_revenue` | Service Revenue | Income |
| `salaries_expense` | Salaries & Wages | Expense |
| `rent_expense` | Rent Expense | Expense |
| `utilities_expense` | Utilities Expense | Expense |
| `depreciation_expense` | Depreciation Expense | Expense |
| `bad_debt_expense` | Bad Debt Expense | Expense |
| `accumulated_depreciation` | Accumulated Depreciation | Asset (Contra) |

## Context-Aware Mappings

Configure different accounts based on context (e.g., expense category):

```php
// Configure expense account for "Transport" category
CompanyAccountMapping::setMapping(
    $companyId,
    'expense',                    // mapping key
    '6400',                       // transport expense account
    $chartOfAccountId,
    'Transport Expense',
    'expense_category',           // context type
    $transportCategoryId          // context id
);

// The service will automatically use the correct account
$expense->category_id = $transportCategoryId;
$accountingService->recordExpense($expense);
```

## Custom Payment Methods

Configure payment methods to use different cash/bank accounts:

```bash
POST /api/finance/account-mappings/payment-methods
{
  "company_id": "uuid",
  "payment_method": "equity_bank",
  "mapping_key": "equity_bank_account",
  "description": "Equity Bank Current Account"
}
```

## Double-Entry Bookkeeping Rules

| Account Type | Increases With | Decreases With |
|--------------|----------------|----------------|
| **Assets** | DEBIT | CREDIT |
| **Liabilities** | CREDIT | DEBIT |
| **Equity** | CREDIT | DEBIT |
| **Income** | CREDIT | DEBIT |
| **Expenses** | DEBIT | CREDIT |

## Available Methods

### Sales Transactions

#### 1. Record Sales Invoice (Credit Sale)
```php
$accountingService->recordSalesInvoice($invoice);

// Creates:
// DR: Accounts Receivable (1200)  - Total Amount
// CR: Sales Revenue (4100)        - Net Amount
// CR: VAT Payable (2310)          - Tax Amount
```

#### 2. Record Cash Sale
```php
$accountingService->recordCashSale([
    'company_id' => $companyId,
    'total_amount' => 11600,
    'net_amount' => 10000,
    'tax_amount' => 1600,
    'payment_method' => 'mpesa',  // cash, bank_transfer, mpesa
    'reference' => 'SALE-001',
    'date' => '2025-12-03',
]);

// Creates:
// DR: Cash/Bank (1010/1110/1130)  - Total Amount
// CR: Sales Revenue (4100)        - Net Amount
// CR: VAT Payable (2310)          - Tax Amount
```

#### 3. Record Customer Payment (Receipt)
```php
$accountingService->recordCustomerPayment($payment);

// Creates:
// DR: Cash/Bank (1010/1110)       - Amount
// CR: Accounts Receivable (1200)  - Amount
```

### Expense Transactions

#### 4. Record Expense (Paid)
```php
$accountingService->recordExpense($expense);

// Creates:
// DR: Expense Account (6xxx)      - Net Amount
// DR: Input VAT (1430)            - Tax Amount
// CR: Cash/Bank (1010/1110)       - Total Amount
```

#### 5. Record Expense on Credit
```php
$accountingService->recordExpenseOnCredit($expense);

// Creates:
// DR: Expense Account (6xxx)      - Net Amount
// DR: Input VAT (1430)            - Tax Amount
// CR: Accounts Payable (2100)     - Total Amount
```

### Purchase Transactions

#### 6. Record Inventory Purchase on Credit
```php
$accountingService->recordPurchaseOnCredit([
    'company_id' => $companyId,
    'total_amount' => 50000,
    'net_amount' => 43103,
    'tax_amount' => 6897,
    'reference' => 'PO-001',
    'supplier_name' => 'ABC Suppliers',
    'supplier_id' => $supplierId,
]);

// Creates:
// DR: Inventory (1300)            - Net Amount
// DR: Input VAT (1430)            - Tax Amount
// CR: Accounts Payable (2100)     - Total Amount
```

#### 7. Record Cash Purchase
```php
$accountingService->recordCashPurchase([
    'company_id' => $companyId,
    'total_amount' => 25000,
    'tax_amount' => 0,
    'payment_method' => 'bank_transfer',
    'reference' => 'PO-002',
    'supplier_name' => 'XYZ Supplies',
]);

// Creates:
// DR: Inventory (1300)            - Net Amount
// DR: Input VAT (1430)            - Tax Amount
// CR: Cash/Bank (1010/1110)       - Total Amount
```

#### 8. Record Supplier Payment
```php
$accountingService->recordSupplierPayment([
    'company_id' => $companyId,
    'amount' => 50000,
    'payment_method' => 'bank_transfer',
    'date' => '2025-12-03',
    'reference' => 'PAY-001',
    'supplier_name' => 'ABC Suppliers',
]);

// Creates:
// DR: Accounts Payable (2100)     - Amount
// CR: Cash/Bank (1010/1110)       - Amount
```

### Cost of Goods Sold

#### 9. Record COGS (When Goods Are Sold)
```php
$accountingService->recordCostOfGoodsSold([
    'company_id' => $companyId,
    'cost_amount' => 15000,
    'reference' => 'ORD-001',
    'order_id' => $orderId,
]);

// Creates:
// DR: Cost of Goods Sold (5100)   - Amount
// CR: Inventory (1300)            - Amount
```

### Bank/Cash Transactions

#### 10. Record Bank Deposit
```php
$accountingService->recordBankDeposit([
    'company_id' => $companyId,
    'amount' => 100000,
    'reference' => 'DEP-001',
]);

// Creates:
// DR: Bank Account (1110)         - Amount
// CR: Cash on Hand (1010)         - Amount
```

#### 11. Record Bank Withdrawal
```php
$accountingService->recordBankWithdrawal([
    'company_id' => $companyId,
    'amount' => 50000,
    'reference' => 'WDR-001',
]);

// Creates:
// DR: Cash on Hand (1010)         - Amount
// CR: Bank Account (1110)         - Amount
```

#### 12. Record Account Transfer
```php
$accountingService->recordAccountTransfer([
    'company_id' => $companyId,
    'amount' => 30000,
    'from_account_code' => '1110',
    'to_account_code' => '1130',
    'reference' => 'TRF-001',
]);

// Creates:
// DR: To Account                  - Amount
// CR: From Account                - Amount
```

### Adjusting Entries

#### 13. Record Depreciation
```php
$accountingService->recordDepreciation([
    'company_id' => $companyId,
    'amount' => 5000,
    'asset_name' => 'Office Equipment',
    'accumulated_depreciation_account' => '1610',
]);

// Creates:
// DR: Depreciation Expense (6500) - Amount
// CR: Accumulated Depreciation    - Amount
```

#### 14. Record Bad Debt Write-off
```php
$accountingService->recordBadDebtWriteOff([
    'company_id' => $companyId,
    'amount' => 10000,
    'customer_name' => 'Defaulting Customer',
    'customer_id' => $customerId,
    'use_allowance' => false,  // true to use allowance method
]);

// Creates:
// DR: Bad Debt Expense (6700)     - Amount
// CR: Accounts Receivable (1200)  - Amount
```

### Utility Methods

#### Reverse a Journal Entry
```php
$reversalEntry = $accountingService->reverseJournalEntry(
    $journalEntryId,
    'Incorrect amount recorded'
);
```

#### Get Account Balance
```php
$balance = $accountingService->getAccountBalance('1010', '2025-12-31');
// Returns: ['account_code', 'account_name', 'balance', ...]
```

#### Check if Transaction Recorded
```php
$exists = $accountingService->hasBeenRecorded(Invoice::class, $invoiceId);
```

#### Validate Account Setup
```php
$validation = $accountingService->validateAccountSetup();
// Returns: ['is_valid' => bool, 'found' => [...], 'missing' => [...]]
```

## Integration Examples

### In InvoiceController
```php
use App\Services\AccountingIntegrationService;

class InvoiceController extends Controller
{
    protected AccountingIntegrationService $accountingService;

    public function __construct(AccountingIntegrationService $accountingService)
    {
        $this->accountingService = $accountingService;
    }

    public function store(Request $request)
    {
        DB::beginTransaction();
        try {
            // Create invoice...
            $invoice = Invoice::create([...]);
            
            // Record in accounting
            $this->accountingService
                ->setCompany($user->company_id)
                ->setUser($user->id)
                ->recordSalesInvoice($invoice);
            
            DB::commit();
            return response()->json($invoice, 201);
        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    public function recordPayment(Request $request, $id)
    {
        DB::beginTransaction();
        try {
            $invoice = Invoice::findOrFail($id);
            
            // Update invoice payment...
            $payment = Payment::create([...]);
            
            // Record payment in accounting
            $this->accountingService
                ->setCompany($user->company_id)
                ->setUser($user->id)
                ->recordCustomerPayment($payment);
            
            DB::commit();
            return response()->json(['message' => 'Payment recorded']);
        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
```

### In ExpenseController
```php
public function markAsPaid(Request $request, $id)
{
    $expense = Expense::findOrFail($id);
    
    DB::beginTransaction();
    try {
        $expense->update(['status' => 'paid']);
        
        // Record in accounting
        app(AccountingIntegrationService::class)
            ->setCompany($expense->company_id)
            ->setUser(auth()->id())
            ->recordExpense($expense);
        
        DB::commit();
        return response()->json(['message' => 'Expense paid and recorded']);
    } catch (Exception $e) {
        DB::rollBack();
        throw $e;
    }
}
```

## Payment Method Mapping

| Payment Method | Account Code | Account Name |
|----------------|--------------|--------------|
| cash | 1010 | Cash on Hand |
| bank_transfer | 1110 | Main Operating Account |
| bank | 1110 | Main Operating Account |
| mpesa | 1130 | M-Pesa Float |
| m-pesa | 1130 | M-Pesa Float |
| card | 1110 | Main Operating Account |
| credit_card | 1110 | Main Operating Account |
| cheque | 1110 | Main Operating Account |

## Error Handling

The service throws exceptions for:
- Missing required accounts
- Unbalanced journal entries (debits ≠ credits)
- Already reversed entries
- Invalid account codes

Always wrap calls in try-catch blocks:
```php
try {
    $entry = $accountingService->recordSalesInvoice($invoice);
} catch (\Exception $e) {
    Log::error('Accounting error: ' . $e->getMessage());
    // Handle gracefully
}
```

## Best Practices

1. **Always use database transactions** when recording journal entries alongside business operations
2. **Validate account setup** during application startup or deployment
3. **Use metadata** to store additional information for audit trails
4. **Check before recording** to avoid duplicate entries using `hasBeenRecorded()`
5. **Handle VAT separately** when applicable for proper tax reporting
