<?php

namespace Tests\Feature\Etims;

use App\Models\Company;
use App\Models\CompanyEtimsConfig;
use App\Models\CreditNote;
use App\Models\CreditNoteLineItem;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Product;
use App\Services\TaxCompliance\EtimsItemSyncService;
use App\Services\TaxCompliance\EtimsCreditNoteService;
use App\Services\TaxCompliance\EtimsSaleService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class CitimaxDigitaxIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;
    private string $userId;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.url' => 'https://citimax.example.test',
            'tax_compliance.kek.value' => base64_encode(str_repeat('k', 32)),
            'tax_compliance.etims.base_url_test' => 'https://api.digitax.tech/ke/v2',
            'tax_compliance.etims.callbacks_enabled' => false,
        ]);

        $this->companyId = (string) Str::uuid();
        $this->userId = (string) Str::uuid();
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'name' => 'Citimax DigiTax Test',
            'country' => 'Kenya',
            'primary_country_code' => 'KE',
            'is_active' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('users')->insert([
            'id' => $this->userId,
            'company_id' => $this->companyId,
            'email' => 'digitax-'.Str::random(8).'@example.test',
            'first_name' => 'DigiTax',
            'last_name' => 'Tester',
            'password' => bcrypt('password'),
            'is_active' => DB::raw('TRUE'),
            'email_verified' => DB::raw('TRUE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_credentials_are_encrypted_and_round_trip(): void
    {
        $config = $this->createConfig('test-secret-api-key');
        $raw = DB::table('company_etims_configs')->where('id', $config->id)->first();

        $this->assertSame('test-secret-api-key', $config->fresh()->getApiKey());
        $this->assertNotSame('test-secret-api-key', $raw->api_key_ciphertext);
        $this->assertStringNotContainsString('test-secret-api-key', json_encode($raw));
    }

    public function test_item_sale_and_webhook_complete_the_full_digitax_flow(): void
    {
        $config = $this->createConfig('test-contract-key');
        [$product, $invoice] = $this->createInvoiceFixture();

        Http::fake(function ($request) {
            if (str_ends_with($request->url(), '/items')) {
                return Http::response([
                    'id' => 'digitax-item-citimax-1',
                    'etims_item_code' => 'KE3NTXU0000001',
                    'status' => 'COMPLETE',
                ], 201);
            }

            if (str_ends_with($request->url(), '/sales')) {
                return Http::response([
                    'id' => 'digitax-sale-citimax-1',
                    'status' => 'PENDING',
                    'trader_invoice_number' => 'CMX-ETIMS-0001',
                ], 201);
            }

            return Http::response([], 404);
        });

        $itemResult = app(EtimsItemSyncService::class)->syncProduct(
            Company::findOrFail($this->companyId),
            $product,
            'B',
            1160,
        );
        $this->assertSame('synced', $itemResult->status, $itemResult->errorMessage ?? '');

        $saleResult = app(EtimsSaleService::class)->submitInvoice($invoice->fresh());
        $this->assertNotNull($saleResult);
        $this->assertSame('pending', $saleResult->status, $saleResult->errorMessage ?? '');
        $this->assertSame('submitted', $invoice->fresh()->etims_status);

        $recorded = Http::recorded();
        $itemRequest = collect($recorded)->first(fn ($entry) => str_ends_with($entry[0]->url(), '/items'))[0];
        $saleRequest = collect($recorded)->first(fn ($entry) => str_ends_with($entry[0]->url(), '/sales'))[0];

        $this->assertTrue($itemRequest->hasHeader('X-API-Key', 'test-contract-key'));
        $this->assertSame('3', $itemRequest->data()['item_type_code']);
        $this->assertSame('B', $itemRequest->data()['tax_type_code']);
        $this->assertSame(1160.0, (float) $itemRequest->data()['default_unit_price']);
        $this->assertTrue($saleRequest->hasHeader('X-API-Key', 'test-contract-key'));
        $this->assertSame('CMX-ETIMS-0001', $saleRequest->data()['trader_invoice_number']);
        $this->assertSame('digitax-item-citimax-1', $saleRequest->data()['items'][0]['id']);
        $this->assertSame(1160.0, (float) $saleRequest->data()['items'][0]['total_amount']);

        $response = $this->postJson('/api/webhooks/etims/'.$config->webhook_token, [
            'event' => 'sale.sync',
            'client_request_id' => $invoice->fresh()->etims_client_request_id,
            'data' => [
                'id' => 'digitax-sale-citimax-1',
                'queue_status' => 'COMPLETED',
                'success' => true,
                'trader_invoice_number' => 'CMX-ETIMS-0001',
                'receipt_signature' => 'KRA-SIGNATURE',
                'etims_url' => 'https://etims-sbx.kra.go.ke/receipt/citimax-1',
                'receipt_number' => 'RCPT-1',
                'serial_number' => 'SCU-1',
            ],
        ]);

        $response->assertOk()->assertJson(['received' => true, 'event' => 'sale.sync']);
        $invoice->refresh();
        $this->assertSame('completed', $invoice->etims_status);
        $this->assertSame('KRA-SIGNATURE', $invoice->etims_signature);
        $this->assertSame('RCPT-1', $invoice->etims_receipt_number);
        $this->assertNull($invoice->etims_lock_state);

        $html = view('invoice.pdf', [
            'invoice' => $invoice->load(['company', 'customer', 'lineItems']),
        ])->render();
        $this->assertStringContainsString('KRA eTIMS TAX INVOICE', $html);
        $this->assertStringContainsString('data:image/png;base64,', $html);
    }

    public function test_credit_note_references_and_completes_the_original_etims_sale(): void
    {
        $config = $this->createConfig('test-credit-note-key');
        [$product, $invoice] = $this->createInvoiceFixture();
        EtimsItemRegistration::create([
            'company_id' => $this->companyId,
            'product_id' => $product->id,
            'digitax_item_id' => 'digitax-item-credit-1',
            'item_code' => 'KE3NTXU0000002',
            'tax_type_code' => 'B',
            'sync_status' => EtimsItemRegistration::STATUS_SYNCED,
        ]);
        $invoice->update([
            'etims_status' => 'completed',
            'etims_sale_id' => 'original-sale-1',
            'etims_trader_invoice_number' => 'CMX-ETIMS-0001',
        ]);

        $creditNote = CreditNote::create([
            'credit_note_number' => 'CMX-CN-0001',
            'company_id' => $this->companyId,
            'invoice_id' => $invoice->id,
            'created_by' => $this->userId,
            'status' => 'draft',
            'credit_note_date' => '2026-09-13',
            'subtotal' => 100,
            'tax_amount' => 16,
            'discount_amount' => 0,
            'total_amount' => 116,
            'amount_applied' => 0,
            'amount_refunded' => 0,
            'balance_amount' => 116,
            'currency' => 'KES',
        ]);
        CreditNoteLineItem::create([
            'credit_note_id' => $creditNote->id,
            'product_id' => $product->id,
            'description' => 'Reversal of Citimax integration service',
            'quantity' => 1,
            'unit' => 'service',
            'unit_price' => 100,
            'discount_amount' => 0,
            'tax_rate' => 16,
            'metadata' => ['etims_tax_type_code' => 'B'],
        ]);

        Http::fake([
            'https://api.digitax.tech/ke/v2/credit-notes' => Http::response([
                'id' => 'digitax-credit-1',
                'status' => 'PENDING',
                'trader_invoice_number' => 'CMX-CN-0001',
            ], 201),
        ]);
        $result = app(EtimsCreditNoteService::class)->submit($creditNote);

        $this->assertSame('pending', $result->status, $result->errorMessage ?? '');
        $request = Http::recorded()[0][0];
        $this->assertSame('R', $request->data()['receipt_type_code']);
        $this->assertSame('original-sale-1', $request->data()['sale_id']);
        $this->assertSame('CMX-ETIMS-0001', $request->data()['original_trader_invoice_number']);
        $this->assertSame('digitax-item-credit-1', $request->data()['items'][0]['id']);

        $this->postJson('/api/webhooks/etims/'.$config->webhook_token, [
            'event' => 'credit_note.sync',
            'client_request_id' => $creditNote->fresh()->etims_client_request_id,
            'data' => [
                'id' => 'digitax-credit-1',
                'queue_status' => 'COMPLETED',
                'success' => true,
                'trader_invoice_number' => 'CMX-CN-0001',
                'receipt_signature' => 'KRA-CREDIT-SIGNATURE',
                'etims_url' => 'https://etims-sbx.kra.go.ke/receipt/credit-1',
            ],
        ])->assertOk();

        $creditNote->refresh();
        $this->assertSame('completed', $creditNote->etims_status);
        $this->assertSame('KRA-CREDIT-SIGNATURE', $creditNote->etims_signature);
    }

    private function createConfig(string $apiKey): CompanyEtimsConfig
    {
        $config = CompanyEtimsConfig::create([
            'company_id' => $this->companyId,
            'name' => 'Kenya eTIMS',
            'country_code' => 'KE',
            'kra_pin' => 'P052406784Q',
            'branch_id' => '01',
            'environment' => 'test',
        ]);
        $config->setApiKey($apiKey);
        $config->save();
        DB::statement('UPDATE company_etims_configs SET enabled = TRUE WHERE id = ?', [$config->id]);

        return $config->fresh();
    }

    /** @return array{Product, Invoice} */
    private function createInvoiceFixture(): array
    {
        $productId = (string) Str::uuid();
        DB::table('products')->insert([
            'id' => $productId,
            'company_id' => $this->companyId,
            'name' => 'Citimax integration service',
            'product_code' => 'CMX-SVC-001',
            'price' => 1160,
            'type' => 'service',
            'is_taxable' => DB::raw('TRUE'),
            'tax_rate' => 16,
            'track_inventory' => DB::raw('FALSE'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $invoice = Invoice::withoutEvents(fn () => Invoice::create([
            'id' => (string) Str::uuid(),
            'invoice_number' => 'CMX-ETIMS-0001',
            'company_id' => $this->companyId,
            'created_by' => $this->userId,
            'type' => 'service',
            'status' => 'sent',
            'invoice_date' => '2026-09-13',
            'due_date' => '2026-10-13',
            'subtotal' => 1000,
            'tax_amount' => 160,
            'discount_amount' => 0,
            'total_amount' => 1160,
            'amount_paid' => 0,
            'balance_amount' => 1160,
            'currency' => 'KES',
            'exchange_rate' => 1,
            'metadata' => ['etims_payment_type' => '01'],
        ]));
        DB::statement('UPDATE invoices SET etims_requested = TRUE WHERE id = ?', [$invoice->id]);
        $invoice->refresh();
        InvoiceLineItem::create([
            'invoice_id' => $invoice->id,
            'product_id' => $productId,
            'description' => 'Citimax integration service',
            'quantity' => 1,
            'unit' => 'service',
            'unit_price' => 1000,
            'discount_amount' => 0,
            'tax_rate' => 16,
            'metadata' => ['etims_tax_type_code' => 'B'],
        ]);

        return [Product::withoutGlobalScope('company')->findOrFail($productId), $invoice];
    }
}
