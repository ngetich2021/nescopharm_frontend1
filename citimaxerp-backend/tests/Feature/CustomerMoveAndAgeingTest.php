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

    public function test_ageing_ranges_follow_credit_days_and_can_be_chosen(): void
    {
        DB::table('customer_accounts')->insert([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyId,
            'customer_id' => $this->kitale,
            'account_number' => 'ACC-' . Str::random(6),
            'credit_days' => 60,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->invoice($this->kitale, '2026-06-01', 100, '2026-08-01'); // 95 days past due

        $byTerms = $this->ageing();
        $this->assertSame(60, $byTerms['days']);
        $this->assertSame(['Current / Not Yet Due', '1–60 Days', '61–120 Days', '121–180 Days', 'Over 180 Days'], array_column($byTerms['buckets'], 'label'));
        $this->assertEqualsWithDelta(100, $byTerms['buckets'][2]['amount'], 0.01);

        $byThirty = $this->ageing(null, 30);
        $this->assertSame('Over 90 Days', $byThirty['buckets'][4]['label']);
        $this->assertEqualsWithDelta(100, $byThirty['buckets'][4]['amount'], 0.01);
    }

    public function test_ageing_takes_credit_notes_off_and_still_totals_the_balance(): void
    {
        $paidUp = $this->invoice($this->kitale, '2026-05-01', 100, '2026-06-01');
        $this->pay($this->kitale, 100, [[$paidUp, 100]], '2026-06-01');
        $this->creditNote($this->kitale, $paidUp, 100, 'issued'); // Unused: its invoice was already paid.
        $open = $this->invoice($this->kitale, '2026-10-01', 300, '2026-12-01');

        $ageing = $this->ageing();

        $this->assertEqualsWithDelta(100, $ageing['credit_notes'], 0.01);
        $this->assertEqualsWithDelta(200, $ageing['buckets'][0]['amount'], 0.01);
        $this->assertEqualsWithDelta(200, $ageing['total'], 0.01);
        $this->assertEquals(0.0, $ageing['unallocated']);
    }

    public function test_an_older_statement_ages_what_was_owed_then(): void
    {
        $invoice = $this->invoice($this->kitale, '2026-07-01', 100, '2026-08-01');
        $this->pay($this->kitale, 100, [[$invoice, 100]], '2026-10-01');

        $this->assertEqualsWithDelta(0, array_sum(array_column($this->ageing()['buckets'], 'amount')), 0.01);

        $inSeptember = $this->ageing('2026-09-15', 30);
        $this->assertSame('2026-09-15', $inSeptember['as_at']);
        $this->assertEqualsWithDelta(100, $inSeptember['buckets'][2]['amount'], 0.01); // 45 days past due
        $this->assertEqualsWithDelta(100, $inSeptember['total'], 0.01);
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

    private function ageing(?string $to = null, ?int $days = null): array
    {
        return app(CustomerStatementService::class)->generate(
            $this->companyId,
            $this->kitale,
            Carbon::parse('2026-01-01')->startOfDay(),
            Carbon::parse($to ?? '2026-11-04')->endOfDay(),
            $days,
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
