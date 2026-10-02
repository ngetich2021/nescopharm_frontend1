<?php

namespace Tests\Feature\Etims;

use App\Models\Company;
use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Product;
use App\Services\TaxCompliance\EtimsItemSyncService;
use App\Services\TaxCompliance\EtimsSaleService;
use App\Services\TaxCompliance\Providers\Kenya\EtimsProvider;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Opt-in test that creates an item and sale in the DigiTax Kenya test account. */
class CitimaxDigitaxLiveSandboxTest extends TestCase
{
    use DatabaseTransactions;

    public function test_live_digitax_item_and_sale_flow(): void
    {
        $apiKey = (string) env('DIGITAX_TEST_API_KEY');
        if ($apiKey === '') {
            $this->markTestSkipped('Set DIGITAX_TEST_API_KEY to run the live DigiTax sandbox test.');
        }

        config([
            'tax_compliance.kek.value' => base64_encode(str_repeat('l', 32)),
            'tax_compliance.etims.base_url_test' => 'https://api.digitax.tech/ke/v2',
            'tax_compliance.etims.callbacks_enabled' => false,
        ]);

        $suffix = now()->format('ymdHis').'-'.Str::lower(Str::random(4));
        $companyId = (string) Str::uuid();
        $userId = (string) Str::uuid();
        DB::table('companies')->insert([
            'id' => $companyId,
            'name' => 'Citimax eTIMS Sandbox Validation',
            'country' => 'Kenya',
            'primary_country_code' => 'KE',
            'is_active' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('users')->insert([
            'id' => $userId,
            'company_id' => $companyId,
            'email' => "citimax-etims-{$suffix}@example.test",
            'first_name' => 'Citimax',
            'last_name' => 'Sandbox',
            'password' => bcrypt('password'),
            'is_active' => DB::raw('TRUE'),
            'email_verified' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $config = CompanyEtimsConfig::create([
            'company_id' => $companyId,
            'name' => 'DigiTax test',
            'country_code' => 'KE',
            'kra_pin' => 'P052406784Q',
            'branch_id' => '01',
            'environment' => 'test',
        ]);
        $config->setApiKey($apiKey);
        $config->save();
        DB::statement('UPDATE company_etims_configs SET enabled = TRUE WHERE id = ?', [$config->id]);

        $productId = (string) Str::uuid();
        DB::table('products')->insert([
            'id' => $productId,
            'company_id' => $companyId,
            'name' => "Citimax sandbox validation {$suffix}",
            'product_code' => 'CMX-LIVE-'.strtoupper($suffix),
            'price' => 116,
            'type' => 'service',
            'is_taxable' => DB::raw('TRUE'),
            'tax_rate' => 16,
            'track_inventory' => DB::raw('FALSE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $invoice = Invoice::withoutEvents(fn () => Invoice::create([
            'id' => (string) Str::uuid(),
            'invoice_number' => 'CMX-LIVE-'.strtoupper($suffix),
            'company_id' => $companyId,
            'created_by' => $userId,
            'type' => 'service',
            'status' => 'sent',
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'subtotal' => 100,
            'tax_amount' => 16,
            'discount_amount' => 0,
            'total_amount' => 116,
            'amount_paid' => 0,
            'balance_amount' => 116,
            'currency' => 'KES',
            'exchange_rate' => 1,
        ]));
        DB::statement('UPDATE invoices SET etims_requested = TRUE WHERE id = ?', [$invoice->id]);
        InvoiceLineItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $productId,
            'description' => 'Citimax eTIMS sandbox validation service',
            'quantity' => 1,
            'unit' => 'service',
            'unit_price' => 100,
            'discount_amount' => 0,
            'tax_rate' => 16,
            'metadata' => ['etims_tax_type_code' => 'B'],
        ]);

        $company = Company::findOrFail($companyId);
        $product = Product::withoutGlobalScope('company')->findOrFail($productId);
        $itemResult = app(EtimsItemSyncService::class)->syncProduct($company, $product, 'B', 116);
        $provider = app(EtimsProvider::class);
        for ($attempt = 0; $itemResult->status === 'pending' && $attempt < 10; $attempt++) {
            usleep(1_500_000);
            $itemResult = $provider->refreshItemRegistration($company, $product, 'B');
        }
        $this->assertSame('synced', $itemResult->status, $itemResult->errorMessage ?? json_encode($itemResult->raw));
        $this->assertSame(
            EtimsItemRegistration::STATUS_SYNCED,
            EtimsItemRegistration::where('product_id', $productId)->value('sync_status'),
        );

        $saleResult = app(EtimsSaleService::class)->submitInvoice($invoice->fresh());
        $this->assertNotNull($saleResult);
        $this->assertContains($saleResult->status, ['pending', 'completed'], $saleResult->errorMessage ?? json_encode($saleResult->raw));
        for ($attempt = 0; $invoice->fresh()->etims_status === 'submitted' && $attempt < 15; $attempt++) {
            usleep(1_500_000);
            app(EtimsSaleService::class)->refreshInvoice($invoice->fresh());
        }

        $invoice->refresh();
        $this->assertSame('completed', $invoice->etims_status, $invoice->etims_last_error ?? 'Sale remained pending.');
        $this->assertNotEmpty($invoice->etims_sale_id);
        $this->assertNotEmpty($invoice->etims_trader_invoice_number);
        $this->assertNotEmpty($invoice->etims_qr_url);
    }
}
