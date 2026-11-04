<?php

namespace Tests\Feature\Etims;

use App\Jobs\Etims\SubmitStockMovementJob;
use App\Models\CompanyEtimsConfig;
use App\Models\CreditNote;
use App\Models\CreditNoteLineItem;
use App\Models\Invoice;
use App\Models\User;
use App\Observers\InventoryMovementEtimsObserver;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Until eTIMS is confirmed Live it refuses nothing and sends nothing by itself. */
class EtimsStaysOutUntilLiveTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->companyId = (string) Str::uuid();
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'name' => 'eTIMS Until Live Test',
            'country' => 'Kenya',
            'primary_country_code' => 'KE',
            'is_active' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $role = \App\Models\Role::create([
            'id' => (string) Str::uuid(),
            'name' => 'etims-until-live-' . Str::random(8),
            'company_id' => $this->companyId,
        ]);
        foreach (['can_update_invoices', 'can_delete_invoices', 'can_view_invoices'] as $key) {
            $permission = \App\Models\Permission::firstOrCreate(
                ['key' => $key],
                ['name' => $key, 'slug' => $key, 'category' => 'test', 'is_system' => true, 'is_active' => true],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }
        Sanctum::actingAs(User::factory()->create(['company_id' => $this->companyId, 'role_id' => $role->id]));

        Http::fake();
    }

    public function test_on_test_a_credit_note_issues_though_its_invoice_is_unsigned(): void
    {
        $this->config('test');
        $creditNote = $this->creditNote($this->invoice(['etims_status' => 'failed']), [
            'etims_status' => 'failed',
            'etims_last_error' => 'DigiTax refused it',
        ]);

        $this->postJson("/api/credit-notes/{$creditNote->id}/issue")->assertOk();

        $creditNote->refresh();
        $this->assertContains($creditNote->status, ['issued', 'applied']);
        $this->assertNull($creditNote->etims_status);
        $this->assertNull($creditNote->etims_last_error);
        Http::assertNothingSent();
    }

    public function test_on_test_a_credit_note_on_a_signed_invoice_is_not_sent_to_kra(): void
    {
        $this->config('test');
        $creditNote = $this->creditNote($this->invoice(['etims_status' => 'completed', 'etims_sale_id' => 'sale-1']));

        $this->postJson("/api/credit-notes/{$creditNote->id}/issue")->assertOk();

        Http::assertNothingSent();
    }

    public function test_on_test_a_signed_credit_note_can_be_deleted(): void
    {
        $this->config('test');
        $creditNote = $this->creditNote($this->invoice(), ['etims_status' => 'completed']);

        $this->assertFalse($creditNote->fresh()->on_live_etims);
        $this->deleteJson("/api/credit-notes/{$creditNote->id}")->assertOk();
        $this->assertNull(CreditNote::find($creditNote->id));
    }

    public function test_on_test_sending_an_invoice_does_not_go_to_kra(): void
    {
        $this->config('test');
        $invoice = $this->invoice(['status' => 'draft']);

        $invoice->update(['status' => 'sent']);

        $this->assertNull($invoice->fresh()->etims_status);
        Http::assertNothingSent();
    }

    public function test_on_test_stock_movements_are_not_sent(): void
    {
        $this->config('test');
        Bus::fake([SubmitStockMovementJob::class]);

        InventoryMovementEtimsObserver::send($this->companyId, (string) Str::uuid(), 5, 'adjustment', 'test');

        Bus::assertNotDispatched(SubmitStockMovementJob::class);
    }

    public function test_when_live_stock_movements_are_sent(): void
    {
        $this->config('live');
        Bus::fake([SubmitStockMovementJob::class]);

        InventoryMovementEtimsObserver::send($this->companyId, (string) Str::uuid(), 5, 'adjustment', 'test');

        Bus::assertDispatched(SubmitStockMovementJob::class);
    }

    public function test_when_live_an_unsigned_invoice_holds_its_credit_note(): void
    {
        $this->config('live', '2026-10-30');
        $creditNote = $this->creditNote($this->invoice(['invoice_date' => '2026-11-01']));

        $this->postJson("/api/credit-notes/{$creditNote->id}/issue")->assertStatus(422);

        $this->assertSame('draft', $creditNote->fresh()->status);
    }

    public function test_when_live_an_invoice_from_before_go_live_does_not_hold_its_credit_note(): void
    {
        $this->config('live', '2026-10-30');
        $creditNote = $this->creditNote($this->invoice(['invoice_date' => '2026-10-01']));

        $this->postJson("/api/credit-notes/{$creditNote->id}/issue")->assertOk();
    }

    public function test_when_live_a_signed_credit_note_cannot_be_deleted(): void
    {
        $this->config('live');
        $creditNote = $this->creditNote($this->invoice(), ['etims_status' => 'completed']);

        $this->assertTrue($creditNote->fresh()->on_live_etims);
        $this->deleteJson("/api/credit-notes/{$creditNote->id}")->assertStatus(400);
    }

    private function config(string $environment, ?string $goLive = null): void
    {
        $config = CompanyEtimsConfig::create([
            'company_id' => $this->companyId,
            'name' => 'Kenya eTIMS',
            'country_code' => 'KE',
            'kra_pin' => 'P052406784Q',
            'branch_id' => '01',
            'environment' => $environment,
            'go_live_date' => $goLive,
        ]);
        DB::statement('UPDATE company_etims_configs SET enabled = TRUE WHERE id = ?', [$config->id]);
    }

    private function invoice(array $attributes = []): Invoice
    {
        $invoice = Invoice::withoutEvents(fn () => Invoice::create($attributes + [
            'id' => (string) Str::uuid(),
            'invoice_number' => 'NSK/' . Str::random(6),
            'company_id' => $this->companyId,
            'created_by' => auth()->id(),
            'type' => 'service',
            'status' => 'sent',
            'invoice_date' => '2026-11-01',
            'due_date' => '2026-12-01',
            'subtotal' => 1000,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000,
            'amount_paid' => 0,
            'balance_amount' => 1000,
            'currency' => 'KES',
            'exchange_rate' => 1,
        ]));
        DB::statement('UPDATE invoices SET etims_requested = TRUE WHERE id = ?', [$invoice->id]);

        return $invoice->fresh();
    }

    private function creditNote(Invoice $invoice, array $attributes = []): CreditNote
    {
        $creditNote = CreditNote::create($attributes + [
            'credit_note_number' => 'CN-' . Str::random(8),
            'company_id' => $this->companyId,
            'invoice_id' => $invoice->id,
            'created_by' => auth()->id(),
            'status' => 'draft',
            'credit_note_date' => '2026-11-04',
            'currency' => 'KES',
            'subtotal' => 100,
            'tax_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100,
            'amount_applied' => 0,
            'amount_refunded' => 0,
            'balance_amount' => 100,
            'etims_requested' => true,
        ]);
        CreditNoteLineItem::create([
            'credit_note_id' => $creditNote->id,
            'description' => 'Returned goods',
            'quantity' => 1,
            'unit' => 'pcs',
            'unit_price' => 100,
            'discount_amount' => 0,
            'tax_rate' => 0,
        ]);

        return $creditNote;
    }
}
