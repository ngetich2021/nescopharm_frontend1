<?php

namespace Tests\Feature;

use App\Models\Cheque;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\User;
use App\Services\CustomerAccountService;
use App\Services\CustomerStatementService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Money follows an invoice moved to another customer; statement ageing ranges and credit notes. */
class CustomerMoveAndAgeingTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;
    private string $kitale;
    private string $bungoma;
    private string $userId;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-04 12:00:00');

        $this->companyId = (string) Str::uuid();
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'name' => 'Move Test',
            'country' => 'Kenya',
            'primary_country_code' => 'KE',
            'is_active' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $role = \App\Models\Role::create(['id' => (string) Str::uuid(), 'name' => 'move-test-' . Str::random(8), 'company_id' => $this->companyId]);
        $user = User::factory()->create(['company_id' => $this->companyId, 'role_id' => $role->id]);
        $this->userId = $user->id;
        Sanctum::actingAs($user);
        $this->kitale = $this->customer('Kitale');
        $this->bungoma = $this->customer('Bungoma');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_a_receipt_only_on_the_moved_invoice_follows_it(): void
    {
        $invoice = $this->invoice($this->kitale, '2026-09-01', 100);
        $payment = $this->pay($this->kitale, 100, [[$invoice, 100]]);
        $cheque = $this->cheque($this->kitale, $payment, 100);

        $this->move($invoice, $this->bungoma);

        $this->assertSame($this->bungoma, $payment->fresh()->customer_id);
        $this->assertSame($this->bungoma, $cheque->fresh()->customer_id);
        $this->assertEqualsWithDelta(100, (float) $invoice->fresh()->amount_paid, 0.01);
    }

    public function test_a_credit_note_follows_its_moved_invoice(): void
    {
        $invoice = $this->invoice($this->kitale, '2026-09-01', 100);
        $note = $this->creditNote($this->kitale, $invoice, 40);

        $this->move($invoice, $this->bungoma);

        $this->assertSame($this->bungoma, $note->fresh()->customer_id);
    }

    public function test_a_receipt_shared_with_other_invoices_stays_and_pays_the_old_customers_oldest(): void
    {
        $moved = $this->invoice($this->kitale, '2026-09-01', 100);
        $stays = $this->invoice($this->kitale, '2026-09-02', 100);
        $open = $this->invoice($this->kitale, '2026-09-03', 100);
        $payment = $this->pay($this->kitale, 200, [[$moved, 100], [$stays, 100]]);

        $this->move($moved, $this->bungoma);

        $this->assertSame($this->kitale, $payment->fresh()->customer_id);
        $this->assertEqualsWithDelta(0, (float) $moved->fresh()->amount_paid, 0.01);
        $this->assertEqualsWithDelta(100, (float) $open->fresh()->amount_paid, 0.01);
        $this->assertEqualsWithDelta(200, (float) PaymentAllocation::where('payment_id', $payment->id)->sum('amount_allocated'), 0.01);
    }

    public function test_money_received_is_unchanged_across_both_accounts(): void
    {
        $moved = $this->invoice($this->kitale, '2026-09-01', 100);
        $other = $this->invoice($this->kitale, '2026-09-02', 100);
        $this->pay($this->kitale, 150, [[$moved, 100], [$other, 50]]);

        $before = $this->owedByBoth();
        $this->move($moved, $this->bungoma);

        $this->assertEqualsWithDelta($before, $this->owedByBoth(), 0.01);
    }

    public function test_a_new_credit_note_goes_to_the_customer_the_invoice_is_on_now(): void
    {
        $this->grant('can_create_invoices');
        $invoice = $this->invoice($this->bungoma, '2026-09-01', 100);

        $response = $this->postJson('/api/credit-notes', [
            'invoice_id' => $invoice->id,
            'customer_id' => $this->kitale,
            'credit_note_date' => '2026-11-04',
            'line_items' => [['description' => 'Returned', 'quantity' => 1, 'unit_price' => 10]],
        ])->assertCreated();

        $this->assertSame($this->bungoma, CreditNote::find($response->json('data.id'))->customer_id);
    }

    public function test_each_invoice_sits_in_one_range_by_the_days_past_its_due_date(): void
    {
        // Days past due on 2026-11-04: 10, 45, 75, 120. Invoice dates differ, and don't decide the range.
        $this->invoice($this->kitale, '2026-10-20', 10, '2026-10-25');
        $this->invoice($this->kitale, '2026-09-01', 20, '2026-09-20');
        $this->invoice($this->kitale, '2026-05-01', 30, '2026-08-21');
        $this->invoice($this->kitale, '2026-04-01', 40, '2026-07-07');

        $ageing = $this->ageing();

        $this->assertSame(['<30 Days', '30–60 Days', '60–90 Days', '>90 Days'], array_column($ageing['buckets'], 'label'));
        $this->assertSame([10.0, 20.0, 30.0, 40.0], array_column($ageing['buckets'], 'amount'));
        $this->assertSame([3, 2, 1, 0], array_column($ageing['rows'], 'bucket'));
        $this->assertSame([120, 75, 45, 10], array_column($ageing['rows'], 'overdue_days'));
        $this->assertSame('2026-07-07', $ageing['rows'][0]['due_date']);
    }

    public function test_an_invoice_not_yet_due_counts_as_zero_days_past_due(): void
    {
        $this->invoice($this->kitale, '2026-01-10', 10, '2027-02-01');

        $row = $this->ageing()['rows'][0];

        $this->assertSame(0, $row['overdue_days']);
        $this->assertSame(0, $row['bucket']);
    }

    public function test_range_edges(): void
    {
        foreach (['2026-10-06' => 0, '2026-10-05' => 1, '2026-09-06' => 1, '2026-09-05' => 2, '2026-08-06' => 2, '2026-08-05' => 3] as $date => $bucket) {
            // Days past due 29, 30, 59, 60, 90, 91.
            $this->invoice($this->kitale, $date, 1, $date);
        }

        $this->assertSame([3, 2, 2, 1, 1, 0], array_column($this->ageing()['rows'], 'bucket'));
    }

    public function test_an_invoice_leaves_the_ageing_when_paid_and_shows_what_is_left_until_then(): void
    {
        $first = $this->invoice($this->kitale, '2026-08-01', 100);
        $second = $this->invoice($this->kitale, '2026-09-01', 100);
        $this->pay($this->kitale, 130, [[$first, 100], [$second, 30]]);

        $rows = $this->ageing()['rows'];

        $this->assertCount(1, $rows);
        $this->assertSame($second->id, $rows[0]['invoice_id']);
        $this->assertEqualsWithDelta(70, $rows[0]['amount'], 0.01);
    }

    public function test_ageing_takes_credit_notes_off_and_still_totals_the_balance(): void
    {
        $paidUp = $this->invoice($this->kitale, '2026-05-01', 100, '2026-06-01');
        $this->pay($this->kitale, 100, [[$paidUp, 100]], '2026-06-01');
        $this->creditNote($this->kitale, $paidUp, 100, 'issued'); // Unused: its invoice was already paid.
        $open = $this->invoice($this->kitale, '2026-10-01', 300, '2026-12-01');

        $ageing = $this->ageing();

        $this->assertEqualsWithDelta(100, $ageing['credit_notes'], 0.01);
        $this->assertEqualsWithDelta(200, $ageing['buckets'][0]['amount'], 0.01); // Not yet due
        $this->assertEqualsWithDelta(200, $ageing['total'], 0.01);
        $this->assertEquals(0.0, $ageing['unallocated']);
    }

    public function test_an_older_statement_ages_what_was_owed_then(): void
    {
        $invoice = $this->invoice($this->kitale, '2026-07-01', 100, '2026-08-01');
        $this->pay($this->kitale, 100, [[$invoice, 100]], '2026-10-01');

        $this->assertEqualsWithDelta(0, array_sum(array_column($this->ageing()['buckets'], 'amount')), 0.01);

        $inSeptember = $this->ageing('2026-09-15');
        $this->assertSame('2026-09-15', $inSeptember['as_at']);
        $this->assertEqualsWithDelta(100, $inSeptember['buckets'][1]['amount'], 0.01); // 45 days past due
        $this->assertEqualsWithDelta(100, $inSeptember['total'], 0.01);
    }

    public function test_a_ledger_entry_for_another_customer_does_not_count_as_unchanged(): void
    {
        $entry = new \App\Models\JournalEntry(['entry_date' => '2026-05-14']);
        $entry->setRelation('items', collect([new \App\Models\JournalEntryItem([
            'account_id' => 'ar',
            'debit_amount' => 100,
            'credit_amount' => 0,
            'contact_id' => $this->kitale,
        ])]));
        $spec = fn (string $customerId) => ['date' => '2026-05-14', 'items' => [[
            'account_id' => 'ar',
            'debit_amount' => 100.0,
            'credit_amount' => 0.0,
            'contact_id' => $customerId,
        ]]];

        $matches = new \ReflectionMethod(\App\Services\LedgerPostingService::class, 'matches');
        $service = app(\App\Services\LedgerPostingService::class);

        $this->assertTrue($matches->invoke($service, $entry, $spec($this->kitale)));
        $this->assertFalse($matches->invoke($service, $entry, $spec($this->bungoma)));
    }

    public function test_an_accountant_can_delete_a_credit_note_but_not_an_invoice(): void
    {
        $this->grant('can_delete_credit_notes');
        $invoice = $this->invoice($this->kitale, '2026-09-01', 100);
        $note = $this->creditNote($this->kitale, $invoice, 40);

        $this->deleteJson("/api/credit-notes/{$note->id}")->assertOk();
        $this->assertNull(CreditNote::find($note->id));

        $this->deleteJson("/api/invoices/{$invoice->id}")->assertStatus(403);
    }

    public function test_a_bounced_cheque_debit_is_numbered_deb_and_takes_no_invoice_number(): void
    {
        $user = User::find($this->userId);
        $this->assertSame('DEB-001', $this->bounce('2026-05-01', $user)['charge_invoice']->invoice_number);
        $charge = $this->bounce('2026-05-02', $user)['charge_invoice'];

        $this->assertSame('DEB-002', $charge->invoice_number);
        $this->assertSame('DEB-' . substr($this->companyId, 0, 8) . '-002', $charge->getRawOriginal('invoice_number'));
        $this->assertSame(0, Invoice::where('company_id', $this->companyId)->where('invoice_number', 'like', 'INV-%')->count());
        $this->assertEqualsWithDelta(2000, (float) $charge->total_amount, 0.01);
    }

    public function test_a_debit_shows_its_number_on_the_statement_and_is_found_by_it(): void
    {
        $charge = $this->bounce('2026-05-01', User::find($this->userId))['charge_invoice'];

        $references = array_column(app(CustomerStatementService::class)->generate(
            $this->companyId,
            $this->kitale,
            Carbon::parse('2026-01-01')->startOfDay(),
            Carbon::parse('2026-11-04')->endOfDay(),
        )['transactions'], 'reference');

        $this->assertContains('DEB-001', $references);
        foreach (['DEB-001', 'deb 1', 'DEB001'] as $term) {
            $this->assertSame($charge->id, Invoice::where('company_id', $this->companyId)->whereNumberMatches($term)->value('id'), $term);
        }
    }

    public function test_a_debit_cannot_be_given_a_file_number(): void
    {
        $this->grant('can_view_filing');
        $charge = $this->bounce('2026-05-01', User::find($this->userId))['charge_invoice'];

        $this->patchJson("/api/filing/{$charge->id}", ['file_number' => '999'])->assertStatus(422);
        $this->assertSame('DEB-001', $charge->fresh()->invoice_number);
        $this->assertNotContains($charge->id, array_column($this->getJson('/api/filing')->assertOk()->json('invoices'), 'id'));
    }

    public function test_sales_invoices_leave_debits_out_but_the_customers_invoices_keep_them(): void
    {
        $this->grant('can_view_invoices');
        $invoice = $this->invoice($this->kitale, '2026-09-01', 100);
        $charge = $this->bounce('2026-05-01', User::find($this->userId))['charge_invoice'];

        $listed = array_column($this->getJson('/api/invoices?exclude_debits=1')->assertOk()->json('data'), 'id');
        $this->assertContains($invoice->id, $listed);
        $this->assertNotContains($charge->id, $listed);

        $this->assertContains($charge->id, array_column($this->getJson("/api/invoices?customer_id={$this->kitale}")->assertOk()->json('data'), 'id'));
    }

    public function test_a_customer_is_named_by_their_business_name(): void
    {
        $this->assertSame('Racecourse Hospital Ltd', (new Customer(['name' => 'David Momanyi', 'business_name' => 'Racecourse Hospital Ltd']))->display_name);
        $this->assertSame('Syria Pharmacy', (new Customer(['name' => 'Syria Pharmacy', 'business_name' => null]))->display_name);
    }

    public function test_a_statement_period_reads_dd_mm_yyyy(): void
    {
        $this->assertSame('01/09/2026 - 30/09/2026', app(CustomerStatementService::class)->formatPeriodLabel(Carbon::parse('2026-09-01'), Carbon::parse('2026-09-30')));
    }

    public function test_imports_read_the_systems_dates_day_first(): void
    {
        $date = new \ReflectionMethod(\App\Http\Controllers\DataImportController::class, 'date');
        $controller = app(\App\Http\Controllers\DataImportController::class);

        $this->assertSame('2026-11-04', $date->invoke($controller, '04/11/2026'));
        $this->assertSame('2026-02-15', $date->invoke($controller, '15/02/2026'));
        $this->assertFalse($date->invoke($controller, '31/02/2026'));
    }

    private function bounce(string $maturity, User $user): array
    {
        $cheque = Cheque::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyId,
            'direction' => 'received',
            'customer_id' => $this->kitale,
            'cheque_number' => 'CHQ' . Str::random(6),
            'bank_name' => 'Test Bank',
            'amount' => 100,
            'issue_date' => $maturity,
            'maturity_date' => $maturity,
            'status' => 'pending',
            'created_by' => $this->userId,
        ]);

        return app(\App\Services\ChequeBounceService::class)->bounceReceived($cheque, $user);
    }

    private function ageing(?string $to = null): array
    {
        return app(CustomerStatementService::class)->generate(
            $this->companyId,
            $this->kitale,
            Carbon::parse('2026-01-01')->startOfDay(),
            Carbon::parse($to ?? '2026-11-04')->endOfDay(),
        )['ageing'];
    }

    private function owedByBoth(): float
    {
        $accounts = app(CustomerAccountService::class);

        return $accounts->summary($this->companyId, $this->kitale)['totals']['net_balance']
            + $accounts->summary($this->companyId, $this->bungoma)['totals']['net_balance'];
    }

    private function move(Invoice $invoice, string $toCustomerId): void
    {
        $from = $invoice->customer_id;
        $invoice->update(['customer_id' => $toCustomerId]);
        app(CustomerAccountService::class)->followInvoice($invoice, $from);
    }

    private function grant(string $key): void
    {
        $permission = \App\Models\Permission::firstOrCreate(
            ['key' => $key],
            ['id' => (string) Str::uuid(), 'name' => $key, 'category' => 'test', 'is_system' => true, 'is_active' => true],
        );
        User::find($this->userId)->role->permissions()->syncWithoutDetaching([$permission->id]);
    }

    private function customer(string $name): string
    {
        return Customer::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyId,
            'customer_number' => 'CUST-' . Str::random(8),
            'name' => $name,
            'email' => strtolower($name) . Str::random(6) . '@example.test',
        ])->id;
    }

    private function invoice(string $customerId, string $date, float $total, ?string $due = null): Invoice
    {
        return Invoice::withoutEvents(fn () => Invoice::create([
            'id' => (string) Str::uuid(),
            'invoice_number' => 'NSK/' . Str::random(6),
            'company_id' => $this->companyId,
            'customer_id' => $customerId,
            'created_by' => $this->userId,
            'type' => 'service',
            'status' => 'sent',
            'invoice_date' => $date,
            'due_date' => $due ?? Carbon::parse($date)->addDays(30)->toDateString(),
            'subtotal' => $total,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'amount_paid' => 0,
            'balance_amount' => $total,
            'currency' => 'KES',
            'exchange_rate' => 1,
        ]));
    }

    private function pay(string $customerId, float $amount, array $lines, string $date = '2026-10-01'): Payment
    {
        $payment = Payment::create([
            'id' => (string) Str::uuid(),
            'customer_id' => $customerId,
            'company_id' => $this->companyId,
            'payment_method' => 'cash',
            'transaction_id' => 'T-' . Str::random(8),
            'amount_paid' => $amount,
            'status' => 'completed',
            'payment_date' => $date,
        ]);
        foreach ($lines as [$invoice, $put]) {
            PaymentAllocation::create([
                'payment_id' => $payment->id,
                'invoice_id' => $invoice->id,
                'amount_allocated' => $put,
                'allocated_date' => now(),
            ]);
            $invoice->update(['amount_paid' => (float) $invoice->fresh()->amount_paid + $put]);
        }

        return $payment;
    }

    private function cheque(string $customerId, Payment $payment, float $amount): Cheque
    {
        return Cheque::create([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyId,
            'customer_id' => $customerId,
            'payment_id' => $payment->id,
            'direction' => 'received',
            'cheque_number' => 'CHQ' . Str::random(6),
            'bank_name' => 'Test Bank',
            'amount' => $amount,
            'issue_date' => '2026-10-01',
            'maturity_date' => '2026-10-01',
            'status' => 'approved',
        ]);
    }

    private function creditNote(string $customerId, Invoice $invoice, float $total, string $status = 'draft'): CreditNote
    {
        return CreditNote::create([
            'credit_note_number' => 'CN-' . Str::random(8),
            'company_id' => $this->companyId,
            'customer_id' => $customerId,
            'invoice_id' => $invoice->id,
            'created_by' => $this->userId,
            'status' => $status,
            'credit_note_date' => '2026-10-15',
            'currency' => 'KES',
            'subtotal' => $total,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => $total,
            'amount_applied' => 0,
            'amount_refunded' => 0,
            'balance_amount' => $total,
        ]);
    }
}
