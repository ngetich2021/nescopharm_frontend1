<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerAccount;
use App\Models\Invoice;
use App\Models\Role;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Aging counts from the terms date; forgot password, registration and adding a user work end to end. */
class AccountAccessAndAgingTermsTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;
    private Role $role;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        RateLimiter::clear('reset|');

        $this->companyId = (string) Str::uuid();
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'name' => 'Access Test ' . Str::random(8),
            'country' => 'Kenya',
            'primary_country_code' => 'KE',
            'is_active' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->role = Role::create(['id' => (string) Str::uuid(), 'name' => 'access-test-' . Str::random(8), 'company_id' => $this->companyId]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'company_id' => $this->companyId,
            'role_id' => $this->role->id,
            'email' => 'person-' . Str::lower(Str::random(10)) . '@example.com',
            'is_active' => true,
            'email_verified' => true,
        ], $attributes));
    }

    private function allowViewingAging(): void
    {
        $key = 'can_view_finance_menu';
        $permission = DB::table('permissions')->where('key', $key)->first();
        $id = $permission?->id ?? (string) Str::uuid();
        if (!$permission) {
            DB::table('permissions')->insert(['id' => $id, 'key' => $key, 'name' => $key, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->role->assignPermission($id);
    }

    private function invoice(string $date, ?string $due, array $extra = []): Invoice
    {
        $customer = Customer::query()->where('company_id', $this->companyId)->first();
        $customerId = $customer?->id ?? (string) Str::uuid();
        if (!$customer) {
            DB::table('customers')->insert(['id' => $customerId, 'company_id' => $this->companyId, 'name' => 'Terms Test', 'created_at' => now(), 'updated_at' => now()]);
        }

        return Invoice::create(array_merge([
            'company_id' => $this->companyId,
            'customer_id' => $customerId,
            'created_by' => $this->user()->id,
            'invoice_number' => 'T-' . Str::random(8),
            'type' => 'sales',
            'status' => 'sent',
            'invoice_date' => $date,
            'due_date' => $due,
            'total_amount' => 100,
            'subtotal' => 100,
            'tax_amount' => 0,
            'amount_paid' => 0,
            'currency' => 'KES',
        ], $extra));
    }

    private function resetToken(User $user): string
    {
        $url = null;
        Notification::assertSentTo($user, VerifyEmailNotification::class, function ($n) use (&$url) {
            $url = $n->passwordSetupUrl;
            return true;
        });
        parse_str(parse_url($url, PHP_URL_QUERY), $query);
        $this->assertSame($user->id, $query['id']);

        return $query['token'];
    }

    /* ---------- aging ---------- */

    public function test_a_30_day_invoice_91_days_old_is_61_days_overdue_and_sits_in_61_to_90(): void
    {
        Carbon::setTestNow('2026-11-06 10:00:00');
        $this->allowViewingAging();
        Sanctum::actingAs($this->user());
        $invoice = $this->invoice('2026-08-07', '2026-09-06', ['payment_terms' => 'Net 30', 'credit_terms_days' => 30, 'payment_type' => 'credit']);

        $response = $this->getJson('/api/finance/accounts-receivable/aging-report?as_of_date=2026-11-06')->assertOk();
        $row = collect($response->json('detail_report'))->firstWhere('receivable.id', $invoice->id);

        $this->assertSame(91, $row['age_days']);
        $this->assertSame(30, $row['terms_days']);
        $this->assertSame(61, $row['days_past_due']);
        $this->assertSame('61_90', $row['bucket']);
    }

    public function test_an_invoice_cannot_be_due_before_its_terms_run_out(): void
    {
        foreach ([
            'credit days' => ['2026-08-07', ['credit_terms_days' => 30, 'payment_terms' => 'Net 30']],
            'blank due date' => [null, ['payment_terms' => 'Net 30']],
            'only the terms text' => ['2026-08-07', ['payment_terms' => 'net 30']],
        ] as $case => [$due, $terms]) {
            $this->assertSame('2026-09-06', $this->invoice('2026-08-07', $due, $terms)->due_date->toDateString(), $case);
        }
    }

    public function test_a_later_due_date_and_a_cash_invoice_are_left_alone(): void
    {
        $later = $this->invoice('2026-08-07', '2026-10-01', ['payment_terms' => 'Net 30']);
        $cash = $this->invoice('2026-08-07', '2026-08-07', ['payment_terms' => 'Paid Instantly']);

        $this->assertSame('2026-10-01', $later->due_date->toDateString());
        $this->assertSame('2026-08-07', $cash->due_date->toDateString());
    }

    /* ---------- the customer's Credit Period ---------- */

    private function creditPeriod(?int $days, ?string $formFigure = null): CustomerAccount
    {
        $probe = $this->invoice('2026-08-07', '2026-08-07');
        $id = (string) Str::uuid();
        DB::table('customer_accounts')->insert([
            'id' => $id, 'account_number' => 'T-' . Str::random(10), 'customer_id' => $probe->customer_id, 'credit_days' => $days, 'credit_period_required' => $formFigure,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return CustomerAccount::findOrFail($id);
    }

    public function test_the_credit_period_decides_the_due_date_whatever_the_invoice_says(): void
    {
        $this->creditPeriod(90);

        foreach ([['2026-09-06', 'Net 30'], ['2027-05-01', 'Net 365'], [null, 'Due on Receipt']] as [$due, $terms]) {
            $invoice = $this->invoice('2026-08-07', $due, ['payment_terms' => $terms, 'credit_terms_days' => 30]);

            $this->assertSame('2026-11-05', $invoice->due_date->toDateString());
            $this->assertSame(90, $invoice->credit_terms_days);
            $this->assertSame('Net 90', $invoice->payment_terms);
        }
    }

    public function test_the_form_figure_is_the_period_when_credit_days_was_never_set(): void
    {
        $account = $this->creditPeriod(null, '60');

        foreach (['60', '60 days', '60days', ' 60 Days '] as $figure) {
            $account->credit_period_required = $figure;
            $this->assertSame(60, $account->creditPeriodDays(), $figure);
        }

        $account->credit_period_required = 'as agreed';
        $this->assertNull($account->creditPeriodDays());

        $this->assertSame('2026-10-06', $this->invoice('2026-08-07', '2026-08-07')->due_date->toDateString());
    }

    public function test_syncing_reads_a_period_written_in_words(): void
    {
        Carbon::setTestNow('2026-11-06 10:00:00');
        $invoice = $this->invoice('2026-08-07', '2026-08-07');
        DB::table('customer_accounts')->insert([
            'id' => (string) Str::uuid(), 'account_number' => 'T-' . Str::random(10), 'customer_id' => $invoice->customer_id, 'credit_period_required' => '90 Days',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        Invoice::syncCreditPeriods($invoice->customer_id);

        $this->assertSame('2026-11-05', $invoice->refresh()->due_date->toDateString());
        $this->assertSame('Net 90', $invoice->payment_terms);
    }

    public function test_a_debit_stays_due_on_receipt(): void
    {
        $this->creditPeriod(60);

        $debit = $this->invoice('2026-08-07', '2026-08-07', ['invoice_number' => Invoice::DEBIT_PREFIX . Str::random(8), 'payment_terms' => 'Due on receipt', 'credit_terms_days' => 0]);

        $this->assertSame('2026-08-07', $debit->due_date->toDateString());
        $this->assertSame('Due on receipt', $debit->payment_terms);
    }

    public function test_changing_the_credit_period_moves_invoices_and_their_status_but_not_debits(): void
    {
        Carbon::setTestNow('2026-11-06 10:00:00');
        $account = $this->creditPeriod(30);
        $invoice = $this->invoice('2026-08-07', null);
        $debit = $this->invoice('2026-08-07', '2026-08-07', ['invoice_number' => Invoice::DEBIT_PREFIX . Str::random(8), 'payment_terms' => 'Due on receipt']);
        DB::table('invoices')->where('id', $invoice->id)->update(['status' => 'overdue']);

        $account->credit_days = 120;
        $account->save();

        $invoice->refresh();
        $this->assertSame('2026-12-05', $invoice->due_date->toDateString());
        $this->assertSame('Net 120', $invoice->payment_terms);
        $this->assertSame('sent', $invoice->status);
        $this->assertSame('2026-08-07', $debit->refresh()->due_date->toDateString());

        // A shorter period makes it overdue again.
        $account->credit_days = 30;
        $account->save();
        $this->assertSame('overdue', $invoice->refresh()->status);
    }

    public function test_a_customer_with_no_credit_period_keeps_the_invoices_terms(): void
    {
        $this->assertSame('2026-10-01', $this->invoice('2026-08-07', '2026-10-01', ['payment_terms' => 'Net 30'])->due_date->toDateString());
    }

    /* ---------- forgot password ---------- */

    public function test_forgot_password_emails_a_working_link_whatever_the_capitals(): void
    {
        $user = $this->user(['email' => 'mixed.case@example.com', 'email_verified' => false, 'password' => Hash::make('old-password')]);
        $session = $user->createToken('api-token');

        $this->postJson('/api/users/send-password-reset-link', ['email' => ' Mixed.Case@Example.com '])->assertOk();

        $token = $this->resetToken($user);
        $this->postJson("/api/users/{$user->id}/set-password", [
            'token' => $token, 'password' => 'new-password', 'password_confirmation' => 'new-password',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-password', $user->password));
        $this->assertTrue($user->email_verified);
        $this->assertNull($user->password_setup_token);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $session->accessToken->id]);

        // It logs in with the new password, and the link is used up.
        $this->postJson('/api/login', ['email' => 'MIXED.case@example.com', 'password' => 'new-password'])->assertOk();
        $this->postJson("/api/users/{$user->id}/set-password", [
            'token' => $token, 'password' => 'another-password', 'password_confirmation' => 'another-password',
        ])->assertStatus(400);
    }

    public function test_the_reply_does_not_reveal_who_has_an_account(): void
    {
        $user = $this->user();
        $known = $this->postJson('/api/users/send-password-reset-link', ['email' => $user->email])->assertOk();
        $unknown = $this->postJson('/api/users/send-password-reset-link', ['email' => 'nobody-' . Str::random(8) . '@example.com'])->assertOk();

        $this->assertSame($known->json(), $unknown->json());
    }

    public function test_deactivated_and_deleted_accounts_get_no_link(): void
    {
        $inactive = $this->user(['is_active' => false]);
        $deleted = $this->user();
        $deleted->delete();

        $this->postJson('/api/users/send-password-reset-link', ['email' => $inactive->email])->assertOk();
        $this->postJson('/api/users/send-password-reset-link', ['email' => $deleted->email])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_a_wrong_expired_or_malformed_link_is_refused_cleanly(): void
    {
        $user = $this->user();
        $user->forceFill(['password_setup_token' => 'right-token', 'password_setup_token_expires_at' => now()->addDay()])->save();
        $body = ['password' => 'new-password', 'password_confirmation' => 'new-password'];

        $this->postJson("/api/users/{$user->id}/set-password", $body + ['token' => 'wrong-token'])->assertStatus(400);
        $this->postJson('/api/users/not-a-uuid/set-password', $body + ['token' => 'right-token'])->assertStatus(400);

        $user->forceFill(['password_setup_token_expires_at' => now()->subMinute()])->save();
        $this->postJson("/api/users/{$user->id}/set-password", $body + ['token' => 'right-token'])
            ->assertStatus(400)->assertJsonPath('message', 'Invalid or expired token.');
    }

    public function test_the_link_only_goes_to_our_own_site_whatever_origin_is_claimed(): void
    {
        $user = $this->user();

        $this->withHeader('Origin', 'https://evil.example')
            ->postJson('/api/users/send-password-reset-link', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, VerifyEmailNotification::class, fn ($n) => !str_contains($n->passwordSetupUrl, 'evil.example'));
    }

    public function test_the_old_verify_route_no_longer_gives_out_the_password_token(): void
    {
        $user = $this->user();
        $user->forceFill(['password_setup_token' => 'secret-token', 'password_setup_token_expires_at' => now()->addDay()])->save();

        $response = $this->get("/api/email/verify/{$user->id}/" . sha1($user->email));

        $response->assertRedirect();
        $this->assertStringContainsString('/forgot-password', $response->headers->get('Location'));
        $this->assertStringNotContainsString('secret-token', $response->headers->get('Location'));
    }

    public function test_too_many_requests_for_one_email_get_a_written_message(): void
    {
        $email = 'nobody-' . Str::random(8) . '@example.com';
        foreach (range(1, 5) as $i) {
            $this->postJson('/api/users/send-password-reset-link', ['email' => $email])->assertOk();
        }

        $this->postJson('/api/users/send-password-reset-link', ['email' => $email])
            ->assertStatus(429)->assertJsonPath('status', 'failed');
    }

    public function test_a_wrong_password_is_refused(): void
    {
        $user = $this->user(['password' => Hash::make('right-password')]);

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertStatus(401)->assertJsonPath('message', 'Invalid credentials.');
    }

    /* ---------- registration ---------- */

    public function test_registering_creates_the_company_an_admin_and_emails_the_link(): void
    {
        $company = 'New Company ' . Str::random(8);
        $email = 'owner-' . Str::lower(Str::random(8)) . '@example.com';

        $this->postJson('/api/register', [
            'email' => strtoupper($email), 'first_name' => 'Pat', 'last_name' => 'Owner', 'phone' => '+254700000000',
            'company_name' => $company, 'company_phone' => '+254711111111',
        ])->assertCreated()->assertJsonMissingPath('user.password_setup_token');

        $user = User::where('email', $email)->firstOrFail();
        $this->assertSame('super_admin', $user->role->name);
        $this->assertSame($company, $user->company->name);
        $this->assertSame('+254711111111', $user->company->phone);

        // Before the password is set, login explains what to do.
        $this->postJson('/api/login', ['email' => $email, 'password' => 'new-password'])->assertStatus(403);

        $token = $this->resetToken($user);
        $this->postJson("/api/users/{$user->id}/set-password", [
            'token' => $token, 'password' => 'new-password', 'password_confirmation' => 'new-password',
        ])->assertOk();

        $this->postJson('/api/login', ['email' => $email, 'password' => 'new-password'])
            ->assertOk()->assertJsonPath('status', 'success');
    }

    public function test_an_email_taken_in_other_capitals_is_refused(): void
    {
        $user = $this->user();

        $this->postJson('/api/register', [
            'email' => strtoupper($user->email), 'first_name' => 'Pat', 'last_name' => 'Owner', 'phone' => '+254700000000',
            'company_name' => 'Another ' . Str::random(8),
        ])->assertStatus(400);

        Notification::assertNothingSent();
    }

    /* ---------- adding a user ---------- */

    public function test_a_user_added_by_an_admin_keeps_the_chosen_role_and_can_finish_setup(): void
    {
        $key = 'can_manage_company';
        $permission = DB::table('permissions')->where('key', $key)->first();
        $id = $permission?->id ?? (string) Str::uuid();
        if (!$permission) {
            DB::table('permissions')->insert(['id' => $id, 'key' => $key, 'name' => $key, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->role->assignPermission($id);
        Sanctum::actingAs($this->user());
        $sales = Role::create(['id' => (string) Str::uuid(), 'name' => 'sales-' . Str::random(8), 'company_id' => $this->companyId]);
        $email = 'staff-' . Str::lower(Str::random(8)) . '@example.com';

        $this->postJson('/api/users', ['email' => $email, 'first_name' => 'Sam', 'last_name' => 'Staff', 'role_id' => $sales->id])->assertCreated();

        $added = User::where('email', $email)->firstOrFail();
        $this->assertSame($sales->id, $added->role_id);

        $token = $this->resetToken($added);
        $this->postJson("/api/users/{$added->id}/set-password", [
            'token' => $token, 'password' => 'new-password', 'password_confirmation' => 'new-password',
        ])->assertOk();
        $this->postJson('/api/login', ['email' => $email, 'password' => 'new-password'])->assertOk();
    }

    public function test_another_companys_role_cannot_be_given(): void
    {
        $key = 'can_manage_company';
        $permission = DB::table('permissions')->where('key', $key)->first();
        $id = $permission?->id ?? (string) Str::uuid();
        if (!$permission) {
            DB::table('permissions')->insert(['id' => $id, 'key' => $key, 'name' => $key, 'created_at' => now(), 'updated_at' => now()]);
        }
        $this->role->assignPermission($id);
        Sanctum::actingAs($this->user());

        $otherCompany = (string) Str::uuid();
        DB::table('companies')->insert(['id' => $otherCompany, 'name' => 'Other ' . Str::random(8), 'country' => 'Kenya', 'primary_country_code' => 'KE', 'is_active' => DB::raw('TRUE'), 'created_at' => now(), 'updated_at' => now()]);
        $theirs = Role::create(['id' => (string) Str::uuid(), 'name' => 'theirs-' . Str::random(8), 'company_id' => $otherCompany]);

        $this->postJson('/api/users', ['email' => 'x-' . Str::lower(Str::random(8)) . '@example.com', 'first_name' => 'Sam', 'last_name' => 'Staff', 'role_id' => $theirs->id])
            ->assertStatus(400);
    }
}
