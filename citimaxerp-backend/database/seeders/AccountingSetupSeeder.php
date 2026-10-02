<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\ChartOfAccount;
use App\Models\FinancialPeriod;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Models\Company;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AccountingSetupSeeder extends Seeder
{
    private $companyId;
    private $accounts = [];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = Company::first();
        
        if (!$company) {
            $this->command->error('No company found. Please create a company first.');
            return;
        }

        $this->companyId = $company->id;
        $this->command->info("Setting up accounting for: {$company->name}");
        $this->command->newLine();

        // Load all accounts into memory for easy reference
        $this->loadAccounts();

        DB::beginTransaction();
        try {
            // Step 1: Create Financial Period
            $this->createFinancialPeriod();
            
            // Step 2: Set Opening Balances
            $this->setOpeningBalances();
            
            // Step 3: Create Sample Journal Entries
            $this->createSampleJournalEntries();

            DB::commit();
            $this->command->newLine();
            $this->command->info('✅ Accounting setup completed successfully!');
            
        } catch (\Exception $e) {
            DB::rollBack();
            $this->command->error('Error: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Load all accounts for easy lookup by code
     */
    private function loadAccounts(): void
    {
        $accounts = ChartOfAccount::where('company_id', $this->companyId)->get();
        foreach ($accounts as $account) {
            $this->accounts[$account->account_code] = $account;
        }
        $this->command->info("📋 Loaded {$accounts->count()} accounts");
    }

    /**
     * Get account by code
     */
    private function getAccount(string $code): ?ChartOfAccount
    {
        return $this->accounts[$code] ?? null;
    }

    /**
     * Step 1: Create Financial Period for December 2025
     */
    private function createFinancialPeriod(): void
    {
        $this->command->info('');
        $this->command->info('═══════════════════════════════════════════════════════════');
        $this->command->info('  STEP 1: Creating Financial Period');
        $this->command->info('═══════════════════════════════════════════════════════════');

        // Check if period already exists
        $existingPeriod = FinancialPeriod::where('company_id', $this->companyId)
            ->where('start_date', '2025-12-01')
            ->first();

        if ($existingPeriod) {
            $this->command->warn("  ⚠️  Financial period for December 2025 already exists");
            return;
        }

        // Create December 2025 period
        // Use raw SQL to handle PostgreSQL boolean properly
        $periodId = (string) Str::uuid();
        DB::statement("
            INSERT INTO financial_periods 
            (id, company_id, name, period_type, start_date, end_date, status, is_current, description, created_at, updated_at)
            VALUES 
            (?, ?, 'December 2025', 'monthly', '2025-12-01', '2025-12-31', 'open', true, 'Financial period for December 2025', now(), now())
        ", [$periodId, $this->companyId]);
        
        $period = FinancialPeriod::find($periodId);

        $this->command->info("  ✓ Created: {$period->name}");
        $this->command->info("    Period: {$period->start_date} to {$period->end_date}");
        $this->command->info("    Status: {$period->status} (Current: Yes)");
    }

    /**
     * Step 2: Set Opening Balances
     */
    private function setOpeningBalances(): void
    {
        $this->command->info('');
        $this->command->info('═══════════════════════════════════════════════════════════');
        $this->command->info('  STEP 2: Setting Opening Balances');
        $this->command->info('═══════════════════════════════════════════════════════════');
        $this->command->info('');
        $this->command->info('  Scenario: Cherry Distributors starting with existing balances');
        $this->command->info('');

        // Opening balances represent what the company has at the start
        $openingBalances = [
            // ASSETS
            '1110' => 500000.00,    // Main Operating Account - KES 500,000
            '1130' => 50000.00,     // M-Pesa Float - KES 50,000
            '1020' => 10000.00,     // Petty Cash - KES 10,000
            '1210' => 150000.00,    // Trade Receivables - KES 150,000 (customers owe us)
            '1310' => 300000.00,    // Finished Goods Inventory - KES 300,000
            '1530' => 800000.00,    // Vehicles - KES 800,000
            '1550' => 200000.00,    // Equipment - KES 200,000
            '1560' => 100000.00,    // Computer Equipment - KES 100,000
            '1540' => 50000.00,     // Furniture & Fixtures - KES 50,000
            
            // CONTRA ASSETS (Accumulated Depreciation - Credit balances shown as negative)
            '1531' => -160000.00,   // Accum Depreciation - Vehicles
            '1551' => -40000.00,    // Accum Depreciation - Equipment  
            '1561' => -30000.00,    // Accum Depreciation - Computers
            '1541' => -10000.00,    // Accum Depreciation - Furniture

            // LIABILITIES (Credit balances shown as negative for opening balance)
            '2110' => -120000.00,   // Trade Payables - KES 120,000 (we owe suppliers)
            '2310' => -25000.00,    // VAT Payable - KES 25,000
            '2210' => -80000.00,    // Accrued Salaries - KES 80,000
            '2510' => -400000.00,   // Bank Loans - KES 400,000

            // EQUITY (Credit balance)
            '3110' => -500000.00,   // Ordinary Share Capital - KES 500,000
            '3210' => -795000.00,   // Prior Year Retained Earnings - KES 795,000
        ];

        $this->command->info('  Setting opening balances:');
        $this->command->info('  ' . str_repeat('-', 55));
        
        $totalDebits = 0;
        $totalCredits = 0;

        foreach ($openingBalances as $code => $balance) {
            $account = $this->getAccount($code);
            if ($account) {
                // For opening_balance field, we store the absolute value
                // The account type determines if it's normally debit or credit
                $account->opening_balance = abs($balance);
                $account->save();

                $formattedBalance = number_format(abs($balance), 2);
                $balanceType = $balance >= 0 ? 'Dr' : 'Cr';
                
                if ($balance >= 0) {
                    $totalDebits += $balance;
                } else {
                    $totalCredits += abs($balance);
                }

                $this->command->info("  {$code} {$account->account_name}");
                $this->command->info("       Balance: KES {$formattedBalance} ({$balanceType})");
            }
        }

        $this->command->info('  ' . str_repeat('-', 55));
        $this->command->info("  Total Debits:  KES " . number_format($totalDebits, 2));
        $this->command->info("  Total Credits: KES " . number_format($totalCredits, 2));
        
        if (abs($totalDebits - $totalCredits) < 0.01) {
            $this->command->info("  ✓ Opening balances are BALANCED!");
        } else {
            $this->command->warn("  ⚠️  Difference: KES " . number_format(abs($totalDebits - $totalCredits), 2));
        }
    }

    /**
     * Step 3: Create Sample Journal Entries
     */
    private function createSampleJournalEntries(): void
    {
        $this->command->info('');
        $this->command->info('═══════════════════════════════════════════════════════════');
        $this->command->info('  STEP 3: Recording Sample Journal Entries');
        $this->command->info('═══════════════════════════════════════════════════════════');
        $this->command->info('');

        // Sample transactions for December 2025
        $transactions = [
            // Transaction 1: Cash Sale
            [
                'date' => '2025-12-01',
                'reference' => 'JE-2025-001',
                'description' => 'Cash sale to walk-in customer',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '1110', 'debit' => 25000, 'credit' => 0, 'desc' => 'Cash received'],
                    ['code' => '4110', 'debit' => 0, 'credit' => 25000, 'desc' => 'Product sales revenue'],
                ],
                'explanation' => '💰 Customer pays KES 25,000 cash for goods',
            ],
            
            // Transaction 2: Credit Sale
            [
                'date' => '2025-12-02',
                'reference' => 'JE-2025-002',
                'description' => 'Credit sale to ABC Traders - Invoice #INV-001',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '1210', 'debit' => 50000, 'credit' => 0, 'desc' => 'Amount due from ABC Traders'],
                    ['code' => '4110', 'debit' => 0, 'credit' => 50000, 'desc' => 'Product sales revenue'],
                ],
                'explanation' => '📝 Sold goods worth KES 50,000 on credit (customer will pay later)',
            ],

            // Transaction 3: Purchase Inventory on Credit
            [
                'date' => '2025-12-03',
                'reference' => 'JE-2025-003',
                'description' => 'Purchased inventory from Supplier XYZ on credit',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '1310', 'debit' => 80000, 'credit' => 0, 'desc' => 'Inventory purchased'],
                    ['code' => '2110', 'debit' => 0, 'credit' => 80000, 'desc' => 'Amount owed to Supplier XYZ'],
                ],
                'explanation' => '📦 Bought KES 80,000 inventory on credit (we will pay supplier later)',
            ],

            // Transaction 4: Pay Rent
            [
                'date' => '2025-12-05',
                'reference' => 'JE-2025-004',
                'description' => 'Paid monthly rent for December 2025',
                'entry_type' => 'manual',
                'entries' => [
                    ['code' => '5230', 'debit' => 35000, 'credit' => 0, 'desc' => 'Rent expense for December'],
                    ['code' => '1110', 'debit' => 0, 'credit' => 35000, 'desc' => 'Bank transfer for rent'],
                ],
                'explanation' => '🏠 Paid KES 35,000 rent from bank account',
            ],

            // Transaction 5: Pay Salaries
            [
                'date' => '2025-12-05',
                'reference' => 'JE-2025-005',
                'description' => 'Paid staff salaries for November 2025',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '2210', 'debit' => 80000, 'credit' => 0, 'desc' => 'Clear accrued salaries'],
                    ['code' => '1110', 'debit' => 0, 'credit' => 80000, 'desc' => 'Bank transfer for salaries'],
                ],
                'explanation' => '👥 Paid KES 80,000 accrued salaries from bank',
            ],

            // Transaction 6: Receive Payment from Customer
            [
                'date' => '2025-12-10',
                'reference' => 'JE-2025-006',
                'description' => 'Received payment from customer via M-Pesa',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '1130', 'debit' => 30000, 'credit' => 0, 'desc' => 'M-Pesa payment received'],
                    ['code' => '1210', 'debit' => 0, 'credit' => 30000, 'desc' => 'Reduce customer debt'],
                ],
                'explanation' => '📱 Customer paid KES 30,000 via M-Pesa',
            ],

            // Transaction 7: Pay Supplier
            [
                'date' => '2025-12-12',
                'reference' => 'JE-2025-007',
                'description' => 'Paid Supplier XYZ for previous purchases',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '2110', 'debit' => 50000, 'credit' => 0, 'desc' => 'Reduce amount owed'],
                    ['code' => '1110', 'debit' => 0, 'credit' => 50000, 'desc' => 'Bank payment to supplier'],
                ],
                'explanation' => '💳 Paid KES 50,000 to supplier from bank',
            ],

            // Transaction 8: Record Utilities Expense
            [
                'date' => '2025-12-15',
                'reference' => 'JE-2025-008',
                'description' => 'Paid electricity bill for November',
                'entry_type' => 'manual',
                'entries' => [
                    ['code' => '5241', 'debit' => 8000, 'credit' => 0, 'desc' => 'Electricity expense'],
                    ['code' => '1110', 'debit' => 0, 'credit' => 8000, 'desc' => 'Bank payment for electricity'],
                ],
                'explanation' => '⚡ Paid KES 8,000 electricity bill',
            ],

            // Transaction 9: Record Cost of Goods Sold
            [
                'date' => '2025-12-15',
                'reference' => 'JE-2025-009',
                'description' => 'Cost of goods sold for sales made Dec 1-15',
                'entry_type' => 'automatic',
                'entries' => [
                    ['code' => '5010', 'debit' => 45000, 'credit' => 0, 'desc' => 'Cost of goods sold'],
                    ['code' => '1310', 'debit' => 0, 'credit' => 45000, 'desc' => 'Reduce inventory'],
                ],
                'explanation' => '📊 Record KES 45,000 cost for goods sold',
            ],

            // Transaction 10: Petty Cash Replenishment
            [
                'date' => '2025-12-16',
                'reference' => 'JE-2025-010',
                'description' => 'Replenished petty cash and recorded petty cash expenses',
                'entry_type' => 'manual',
                'entries' => [
                    ['code' => '5250', 'debit' => 3000, 'credit' => 0, 'desc' => 'Office supplies purchased'],
                    ['code' => '5350', 'debit' => 2000, 'credit' => 0, 'desc' => 'Staff meals'],
                    ['code' => '1110', 'debit' => 0, 'credit' => 5000, 'desc' => 'Bank withdrawal to replenish petty cash'],
                ],
                'explanation' => '💵 Recorded petty cash expenses (KES 5,000 total)',
            ],

            // Transaction 11: Accrue December Salaries
            [
                'date' => '2025-12-31',
                'reference' => 'JE-2025-011',
                'description' => 'Accrue December 2025 salaries (to be paid in January)',
                'entry_type' => 'adjusting',
                'entries' => [
                    ['code' => '5212', 'debit' => 85000, 'credit' => 0, 'desc' => 'Staff salaries for December'],
                    ['code' => '2210', 'debit' => 0, 'credit' => 85000, 'desc' => 'Salaries payable'],
                ],
                'explanation' => '📅 Accrue KES 85,000 salaries (expense now, pay later)',
            ],

            // Transaction 12: Record Depreciation
            [
                'date' => '2025-12-31',
                'reference' => 'JE-2025-012',
                'description' => 'Monthly depreciation for December 2025',
                'entry_type' => 'adjusting',
                'entries' => [
                    ['code' => '5310', 'debit' => 15000, 'credit' => 0, 'desc' => 'Depreciation expense'],
                    ['code' => '1531', 'debit' => 0, 'credit' => 8000, 'desc' => 'Accum depreciation - Vehicles'],
                    ['code' => '1551', 'debit' => 0, 'credit' => 3000, 'desc' => 'Accum depreciation - Equipment'],
                    ['code' => '1561', 'debit' => 0, 'credit' => 2500, 'desc' => 'Accum depreciation - Computers'],
                    ['code' => '1541', 'debit' => 0, 'credit' => 1500, 'desc' => 'Accum depreciation - Furniture'],
                ],
                'explanation' => '📉 Record monthly depreciation (KES 15,000 total)',
            ],
        ];

        $entryNumber = 0;
        foreach ($transactions as $transaction) {
            $entryNumber++;
            
            $this->command->info("  ─────────────────────────────────────────────────────");
            $this->command->info("  📝 Transaction {$entryNumber}: {$transaction['explanation']}");
            $this->command->info("  ─────────────────────────────────────────────────────");
            $this->command->info("  Date: {$transaction['date']}");
            $this->command->info("  Ref: {$transaction['reference']}");
            $this->command->info("  Description: {$transaction['description']}");
            $this->command->info("");

            // Calculate totals
            $totalDebit = 0;
            $totalCredit = 0;
            foreach ($transaction['entries'] as $entry) {
                $totalDebit += $entry['debit'];
                $totalCredit += $entry['credit'];
            }

            // Generate entry number
            $entryNumberStr = str_pad($entryNumber, 6, '0', STR_PAD_LEFT);

            // Get a user for created_by
            $userId = \App\Models\User::first()->id;

            // Create journal entry
            $journalEntry = JournalEntry::create([
                'id' => (string) Str::uuid(),
                'company_id' => $this->companyId,
                'entry_number' => $entryNumberStr,
                'reference' => $transaction['reference'],
                'entry_date' => $transaction['date'],
                'description' => $transaction['description'],
                'entry_type' => $transaction['entry_type'],
                'status' => 'posted', // Auto-post for demo
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'posted_at' => now(),
                'created_by' => $userId,
                'posted_by' => $userId,
            ]);

            // Create journal entry items
            $this->command->info("  " . str_pad("ACCOUNT", 40) . str_pad("DEBIT", 15) . "CREDIT");
            $this->command->info("  " . str_repeat("-", 70));
            
            foreach ($transaction['entries'] as $entry) {
                $account = $this->getAccount($entry['code']);
                if (!$account) {
                    $this->command->error("  Account {$entry['code']} not found!");
                    continue;
                }

                JournalEntryItem::create([
                    'id' => (string) Str::uuid(),
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $account->id,
                    'company_id' => $this->companyId,
                    'debit_amount' => $entry['debit'],
                    'credit_amount' => $entry['credit'],
                    'description' => $entry['desc'],
                ]);

                $debitStr = $entry['debit'] > 0 ? number_format($entry['debit'], 2) : '';
                $creditStr = $entry['credit'] > 0 ? number_format($entry['credit'], 2) : '';
                
                $this->command->info("  " . str_pad("{$entry['code']} {$account->account_name}", 40) . str_pad($debitStr, 15) . $creditStr);
            }
            
            $this->command->info("  " . str_repeat("-", 70));
            $this->command->info("  " . str_pad("TOTALS", 40) . str_pad(number_format($totalDebit, 2), 15) . number_format($totalCredit, 2));
            
            if (abs($totalDebit - $totalCredit) < 0.01) {
                $this->command->info("  ✓ Entry is balanced");
            } else {
                $this->command->error("  ✗ Entry is NOT balanced!");
            }
            
            $this->command->info("");
        }

        $this->command->info("  ═══════════════════════════════════════════════════════════");
        $this->command->info("  Total Journal Entries Created: {$entryNumber}");
        $this->command->info("  ═══════════════════════════════════════════════════════════");
    }
}
