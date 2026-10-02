<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\ChartOfAccount;
use App\Models\CompanyAccountMapping;
use App\Models\Customer;
use App\Models\User;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Services\AccountingWorkflowService;
use App\Services\AccountingIntegrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected $company;
    protected $accounts = [];
    protected $customer;
    protected $user;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create test company
        $this->company = Company::factory()->create();
        
        // Create chart of accounts
        $accountCodes = ['1000' => 'Cash', '1200' => 'A/R', '2000' => 'A/P', '4000' => 'Sales', '5000' => 'Expense'];
        foreach ($accountCodes as $code => $name) {
            $type = match($code[0]) {
                '1', '2' => 'asset',
                '4' => 'income',
                '5' => 'expense',
                default => 'asset'
            };
            $this->accounts[$code] = ChartOfAccount::create([
                'company_id' => $this->company->id,
                'code' => $code,
                'name' => $name,
                'type' => $type,
                'subtype' => 'general',
                'is_active' => true
            ])->id;
        }
        
        // Create customer and user
        $this->customer = Customer::factory()->create(['company_id' => $this->company->id]);
        $this->user = User::factory()->create(['company_id' => $this->company->id]);
    }

    public function test_invoice_creates_journal_entry()
    {
        // Configure account mappings
        CompanyAccountMapping::setMapping($this->company->id, 'accounts_receivable', '1200', $this->accounts['1200']);
        CompanyAccountMapping::setMapping($this->company->id, 'sales_revenue', '4000', $this->accounts['4000']);
        
        // Create invoice
        $invoice = Invoice::factory()->create([
            'company_id' => $this->company->id,
            'customer_id' => $this->customer->id,
            'total_amount' => 1000,
            'tax_amount' => 100,
            'status' => 'draft'
        ]);
        
        // Send invoice to trigger workflow
        $invoice->update(['status' => 'sent']);
        
        $workflow = new AccountingWorkflowService(new AccountingIntegrationService());
        $result = $workflow->forCompany($this->company->id)->asUser($this->user->id)->onInvoiceSent($invoice);
        
        $this->assertIsArray($result);
        $this->assertArrayHasKey('journal_id', $result);
        
        // Verify journal entry
        $journalEntry = JournalEntry::find($result['journal_id']);
        $this->assertNotNull($journalEntry);
        
        $totalDebit = $journalEntry->journalItems()->sum('debit_amount');
        $totalCredit = $journalEntry->journalItems()->sum('credit_amount');
        
        // Journal entry must be balanced
        $this->assertEqualsWithDelta($totalDebit, $totalCredit, 0.01, 'Journal entry is not balanced');
    }

    public function test_account_mapping_validation()
    {
        // Configure one mapping
        CompanyAccountMapping::setMapping($this->company->id, 'accounts_receivable', '1200', $this->accounts['1200']);
        
        // Validation should fail with incomplete mappings
        $validation = CompanyAccountMapping::validateConfiguration($this->company->id);
        $this->assertFalse($validation['is_valid']);
    }

    public function test_complete_accounting_setup()
    {
        // Configure all required mappings
        CompanyAccountMapping::setMapping($this->company->id, 'accounts_receivable', '1200', $this->accounts['1200']);
        CompanyAccountMapping::setMapping($this->company->id, 'sales_revenue', '4000', $this->accounts['4000']);
        CompanyAccountMapping::setMapping($this->company->id, 'accounts_payable', '2000', $this->accounts['2000']);
        CompanyAccountMapping::setMapping($this->company->id, 'expense', '5000', $this->accounts['5000']);
        CompanyAccountMapping::setMapping($this->company->id, 'cash', '1000', $this->accounts['1000']);
        
        // Validation should pass
        $validation = CompanyAccountMapping::validateConfiguration($this->company->id);
        $this->assertTrue($validation['is_valid'], 'Configuration should be valid with required mappings');
    }
}
