<?php

namespace Tests\Feature;

use App\Models\DeliveryRate;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Accountant A raises a delivery rate, Accountant B approves it. */
class DeliveryRateApprovalTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Str::uuid();
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'name' => 'Rate Test',
            'country' => 'Kenya',
            'primary_country_code' => 'KE',
            'is_active' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function userWith(string $roleName): User
    {
        $role = Role::firstOrCreate(
            ['name' => $roleName, 'company_id' => $this->companyId],
            ['id' => (string) Str::uuid()],
        );
        foreach (['can_view_delivery_rates', 'can_create_delivery_rates', 'can_approve_delivery_rates'] as $key) {
            $permission = Permission::firstOrCreate(
                ['key' => $key],
                ['id' => (string) Str::uuid(), 'name' => $key, 'category' => 'test', 'is_system' => true, 'is_active' => true],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        return User::factory()->create(['company_id' => $this->companyId, 'role_id' => $role->id]);
    }

    private function raise(User $user): string
    {
        Sanctum::actingAs($user);

        return $this->postJson('/api/delivery-rates', [
            'transporter_name' => 'Rate Carrier ' . Str::random(6),
            'zone' => 'nairobi',
            'rate_per_carton' => 100,
        ])->assertCreated()->json('delivery_rate.id');
    }

    public function test_an_accountant_cannot_approve_a_rate_they_raised_but_another_can(): void
    {
        $a = $this->userWith('Accountant');
        $b = $this->userWith('Accountant');
        $id = $this->raise($a);

        $this->postJson("/api/delivery-rates/{$id}/approve")->assertForbidden()
            ->assertJsonPath('message', 'You raised this delivery rate, so another approver (another accountant, the GM or a Director) must approve it.');
        $this->assertSame('pending', DeliveryRate::find($id)->status);

        Sanctum::actingAs($b);
        $this->postJson("/api/delivery-rates/{$id}/approve")->assertOk();
        $this->assertSame('approved', DeliveryRate::find($id)->status);
    }

    public function test_an_accountant_cannot_approve_their_own_edit(): void
    {
        $a = $this->userWith('Accountant');
        $b = $this->userWith('Accountant');
        $id = $this->raise($a);

        Sanctum::actingAs($b);
        $this->patchJson("/api/delivery-rates/{$id}", ['rate_per_carton' => 150])->assertOk();
        $this->postJson("/api/delivery-rates/{$id}/approve")->assertForbidden();

        // Whoever raised it is still blocked too: a third approver signs off.
        Sanctum::actingAs($a);
        $this->postJson("/api/delivery-rates/{$id}/approve")->assertForbidden();
    }

    public function test_the_list_says_why_and_the_gm_may_approve_what_they_raised(): void
    {
        $accountant = $this->userWith('Accountant');
        $gm = $this->userWith('GM');
        $id = $this->raise($accountant);

        $block = fn () => collect($this->getJson('/api/delivery-rates')->assertOk()->json('delivery_rates'))->firstWhere('id', $id)['approval_block'];
        $this->assertStringContainsString('You raised this delivery rate', $block());

        Sanctum::actingAs($gm);
        $this->assertNull($block());

        $own = $this->raise($gm);
        $this->postJson("/api/delivery-rates/{$own}/approve")->assertOk();
    }

    public function test_delivery_invoice_totals_follow_the_search(): void
    {
        $user = $this->userWith('Accountant');
        Sanctum::actingAs($user);
        $permission = Permission::firstOrCreate(
            ['key' => 'can_view_delivery_invoices'],
            ['id' => (string) Str::uuid(), 'name' => 'can_view_delivery_invoices', 'category' => 'test', 'is_system' => true, 'is_active' => true],
        );
        $user->role->permissions()->syncWithoutDetaching([$permission->id]);

        $invoice = function (string $transporter, float $total, string $status) use ($user) {
            DB::table('delivery_invoices')->insert([
                'id' => (string) Str::uuid(),
                'company_id' => $this->companyId,
                'invoice_number' => 'DI-T' . Str::random(8),
                'transporter_name' => $transporter,
                'zone' => 'nairobi',
                'number_of_cartons' => 1,
                'rate_per_carton' => $total,
                'total_amount' => $total,
                'status' => $status,
                'created_by' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        };
        $invoice('Imevo Limited', 100, 'paid');
        $invoice('Imevo Limited', 50, 'pending');
        $invoice('Imevo Limited', 999, 'cancelled');
        $invoice('Other Movers', 7, 'pending');

        $this->getJson('/api/delivery-invoices')->assertOk()
            ->assertJsonPath('totals', ['count' => 3, 'total' => 157, 'paid' => 100, 'unpaid' => 57]);
        // Any case finds them, and the figures become Imevo's.
        $this->getJson('/api/delivery-invoices?search=imevo&per_page=1')->assertOk()
            ->assertJsonPath('totals', ['count' => 2, 'total' => 150, 'paid' => 100, 'unpaid' => 50]);
    }

    public function test_supplier_invoice_totals_follow_the_filters(): void
    {
        $user = $this->userWith('Accountant');
        Sanctum::actingAs($user);
        foreach (['can_view_accounts_payable', 'can_view_suppliers', 'can_view_supplier_payments'] as $key) {
            $permission = Permission::firstOrCreate(
                ['key' => $key],
                ['id' => (string) Str::uuid(), 'name' => $key, 'category' => 'test', 'is_system' => true, 'is_active' => true],
            );
            $user->role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $totals = $this->getJson('/api/finance/accounts-payable?search=nothing-matches-this')->assertOk()->json('totals');

        $this->assertEquals(['billed' => 0, 'paid' => 0, 'owed' => 0, 'debit_notes' => 0], $totals);
    }

    public function test_an_accountant_may_still_reject_a_rate_they_raised(): void
    {
        $id = $this->raise($this->userWith('Accountant'));

        $this->postJson("/api/delivery-rates/{$id}/reject", ['notes' => 'Entered in error'])->assertOk();
        $this->assertSame('rejected', DeliveryRate::find($id)->status);
    }
}
