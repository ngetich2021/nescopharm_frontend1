<?php

namespace App\Services\TaxCompliance\Providers\Kenya;

use App\Models\Company;
use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Models\Product;
use App\Services\TaxCompliance\Contracts\TaxComplianceProvider;
use App\Services\TaxCompliance\DTOs\ItemRegistrationResult;
use App\Services\TaxCompliance\DTOs\ProviderCapabilities;
use App\Services\TaxCompliance\DTOs\ReceiptVerification;
use App\Services\TaxCompliance\DTOs\SaleSubmission;
use App\Services\TaxCompliance\DTOs\TestConnectionResult;
use App\Services\TaxCompliance\EtimsTaxType;
use App\Services\TaxCompliance\EtimsSaleAmountAllocator;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Kenya eTIMS provider via DigiTax (KRA-approved OSCU integrator).
 *
 * IMPORTANT: This is plan-conformant code. The exact JSON field shapes for
 * /items, /sales, /credit-notes, /stock-add, /verify endpoints follow DigiTax's
 * public documentation but MUST be validated against the DigiTax sandbox before
 * production go-live. Mismatches will surface as `result_status='response_invalid'`
 * audit-log rows or 4xx responses - easy to triage.
 *
 * Docs: https://ke.docs.digitax.tech/docs/getting-started
 */
class EtimsProvider implements TaxComplianceProvider
{
    public function __construct(
        private readonly EtimsClient $client,
        private readonly EtimsSaleAmountAllocator $amountAllocator,
    ) {}

    public function countryCode(): string
    {
        return 'KE';
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            requiresDeviceSerial: false,
            requiresItemPreRegistration: true,
            requiresDailyZReport: false,
            supportsStockMovements: true,
            supportsPurchaseDeclaration: true,
            supportsWebhooks: true,
            requiresClientSideSignature: false,
            supportsAsyncCreditNotes: true,
            supportsOfflineStoreAndForward: false,
            explicitB2BvsB2C: false,
            timeDriftToleranceSeconds: 300,
            standardVatRate: 0.16,
            taxCategoryMap: [
                'vat_standard' => 'B',
                'exempt' => 'A',
                'zero_rated' => 'C',
                'non_vat' => 'D',
                'reduced_8' => 'E',
            ],
        );
    }

    // ─────────── Test connection (unchanged behaviour, routes through client) ───────────

    public function testConnection(Company $company): TestConnectionResult
    {
        $config = $this->configFor($company);
        if (! $config) {
            return TestConnectionResult::failure('No eTIMS configuration found. Complete the setup wizard first.');
        }
        if (! $config->hasApiKey()) {
            return TestConnectionResult::failure('DigiTax API key is not set. Complete the Credentials step of the setup wizard.');
        }
        if (! $config->kra_pin || ! CompanyEtimsConfig::isValidKraPin($config->kra_pin)) {
            return TestConnectionResult::failure('KRA PIN is missing or invalid. Expected: P + 9 digits + 1 uppercase letter.');
        }

        $started = microtime(true);
        try {
            $response = $this->client->get($config, '/etims-info', [], 'test_connection');
            $latency = (int) ((microtime(true) - $started) * 1000);

            $this->recordProbe($config, $response->successful() ? 'success' : 'failure');

            if ($response->successful()) {
                return TestConnectionResult::ok(
                    "Connected to DigiTax {$config->environment} in {$latency}ms.",
                    $latency,
                    ['status' => $response->status()],
                );
            }
            $body = $response->json() ?? [];

            return TestConnectionResult::failure(
                'DigiTax responded with: '.($body['message'] ?? 'HTTP '.$response->status()),
                $response->status(),
                ['status' => $response->status(), 'environment' => $config->environment],
            );
        } catch (ConnectionException $e) {
            $this->recordProbe($config, 'failure');

            return TestConnectionResult::failure('Could not reach DigiTax. Check your network and try again.');
        } catch (\Throwable $e) {
            $this->recordProbe($config, 'failure');
            Log::warning('eTIMS test connection failed', ['company_id' => $company->id, 'error' => $e->getMessage()]);

            return TestConnectionResult::failure('Test connection failed: '.$e->getMessage());
        }
    }

    // ─────────── Phase 3: items ───────────

    public function registerItem(
        Company $company,
        Product $product,
        ?string $taxTypeCode = null,
        ?float $defaultUnitPrice = null,
    ): ItemRegistrationResult {
        $config = $this->requireConfig($company);
        if (! $taxTypeCode) {
            $existingProfiles = EtimsItemRegistration::query()
                ->where('company_id', $company->id)
                ->where('product_id', $product->id)
                ->get();
            $taxTypeCode = $existingProfiles->count() === 1
                ? ($existingProfiles->first()->tax_type_code ?: EtimsTaxType::forProduct($product))
                : EtimsTaxType::forProduct($product);
        }
        $registration = EtimsItemRegistration::firstOrCreate(
            [
                'company_id' => $company->id,
                'product_id' => $product->id,
                'tax_type_code' => $taxTypeCode,
            ],
            ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
        );

        $clientRequestId = $registration->client_request_id ?: (string) Str::uuid();
        $itemTypeCode = $registration->item_type_code ?? ($product->type === 'service' ? '3' : '2');

        $profileCount = EtimsItemRegistration::query()
            ->where('company_id', $company->id)
            ->where('product_id', $product->id)
            ->count();
        $itemName = $profileCount > 1
            ? $product->name.' ('.EtimsTaxType::label($taxTypeCode).')'
            : $product->name;
        $baseBarCode = $product->product_code ?? $product->sku ?? (string) $product->id;
        $defaultUnitPrice = $defaultUnitPrice
            ?? ($registration->default_unit_price !== null ? (float) $registration->default_unit_price : null)
            ?? (float) ($product->price ?? 0);
        if ($defaultUnitPrice <= 0) {
            $message = 'A positive eTIMS default unit price is required before item registration.';
            $registration->update([
                'sync_status' => EtimsItemRegistration::STATUS_FAILED,
                'last_error' => $message,
            ]);

            return ItemRegistrationResult::failed(
                $clientRequestId,
                $message,
                422,
                0,
            );
        }
        if ((float) ($registration->default_unit_price ?? 0) <= 0) {
            $registration->update(['default_unit_price' => round($defaultUnitPrice, 2)]);
        }

        $payload = [
            'item_class_code' => $registration->item_class_code,
            'item_type_code' => $itemTypeCode,
            'item_name' => $itemName,
            'origin_nation_code' => $registration->country_of_origin_code ?? 'KE',
            'package_unit_code' => $registration->packaging_unit_code,
            'quantity_unit_code' => $registration->quantity_unit_code,
            'tax_type_code' => $taxTypeCode,
            'default_unit_price' => round($defaultUnitPrice, 2),
            'item_bar_code' => $baseBarCode.'-'.$taxTypeCode,
        ];
        if ($callbackUrl = $this->callbackUrl($config)) {
            $payload['callback_url'] = $callbackUrl;
        }
        if ($itemTypeCode !== '3') {
            $payload['stock_quantity'] = (float) max(
                (float) ($product->stock_quantity ?? 0),
                (float) ($product->on_hand ?? 0),
            );
        }

        try {
            $response = $this->client->post(
                config: $config,
                endpoint: '/items',
                body: $payload,
                clientRequestId: $clientRequestId,
                operation: 'item.register',
                subjectType: 'product',
                subjectId: (string) $product->id,
            );
        } catch (\Throwable $e) {
            $registration->update([
                'client_request_id' => $clientRequestId,
                'sync_status' => EtimsItemRegistration::STATUS_FAILED,
                'last_error' => $e->getMessage(),
                'last_attempt_at' => now(),
                'attempts' => ($registration->attempts ?? 0) + 1,
            ]);

            return ItemRegistrationResult::failed($clientRequestId, $e->getMessage(), null, 0);
        }

        $body = $response->json() ?? [];
        if ($response->successful()) {
            $data = $body['data'] ?? $body;
            $digitaxItemId = $data['id'] ?? null;
            $regulatorCode = $data['etims_item_code'] ?? null;
            $status = strtoupper((string) ($data['status'] ?? 'PENDING'));
            $isComplete = in_array($status, ['COMPLETE', 'COMPLETED'], true);
            $registration->update([
                'client_request_id' => $clientRequestId,
                'digitax_item_id' => $digitaxItemId ?? $registration->digitax_item_id,
                'item_code' => $regulatorCode ?? $registration->item_code,
                'sync_status' => $isComplete
                    ? EtimsItemRegistration::STATUS_SYNCED
                    : EtimsItemRegistration::STATUS_PENDING,
                'last_attempt_at' => now(),
                'synced_at' => $isComplete ? now() : $registration->synced_at,
                'attempts' => ($registration->attempts ?? 0) + 1,
                'last_error' => null,
            ]);

            return $isComplete
                ? ItemRegistrationResult::synced($clientRequestId, $regulatorCode ?? $digitaxItemId, 0, $body)
                : ItemRegistrationResult::pending($clientRequestId, $regulatorCode ?? $digitaxItemId, 0, $body);
        }

        $message = $body['message'] ?? "DigiTax HTTP {$response->status()}";
        $registration->update([
            'client_request_id' => $clientRequestId,
            'sync_status' => EtimsItemRegistration::STATUS_FAILED,
            'last_error' => $message,
            'last_attempt_at' => now(),
            'attempts' => ($registration->attempts ?? 0) + 1,
        ]);

        return ItemRegistrationResult::failed($clientRequestId, $message, $response->status(), 0, $body);
    }

    public function refreshItemRegistration(
        Company $company,
        Product $product,
        ?string $taxTypeCode = null,
    ): ItemRegistrationResult {
        $config = $this->requireConfig($company);
        if (! $taxTypeCode) {
            $existingProfiles = EtimsItemRegistration::query()
                ->where('company_id', $company->id)
                ->where('product_id', $product->id)
                ->get();
            $taxTypeCode = $existingProfiles->count() === 1
                ? ($existingProfiles->first()->tax_type_code ?: EtimsTaxType::forProduct($product))
                : EtimsTaxType::forProduct($product);
        }
        $registration = EtimsItemRegistration::query()
            ->where('company_id', $company->id)
            ->where('product_id', $product->id)
            ->where('tax_type_code', $taxTypeCode)
            ->first();

        if (! $registration?->digitax_item_id) {
            return $this->registerItem($company, $product, $taxTypeCode);
        }

        $clientRequestId = $registration->client_request_id ?: (string) Str::uuid();

        try {
            $response = $this->client->get(
                $config,
                '/items/'.$registration->digitax_item_id,
                [],
                'item.status',
                $clientRequestId,
            );
        } catch (\Throwable $e) {
            return ItemRegistrationResult::failed($clientRequestId, $e->getMessage(), null, 0);
        }

        $body = $response->json() ?? [];
        if (! $response->successful()) {
            return ItemRegistrationResult::failed(
                $clientRequestId,
                $body['message'] ?? "DigiTax HTTP {$response->status()}",
                $response->status(),
                0,
                $body,
            );
        }

        $data = $body['data'] ?? $body;
        $status = strtoupper((string) ($data['status'] ?? 'PENDING'));
        if ($status === 'FAILED') {
            $message = $data['message'] ?? 'DigiTax rejected the item registration.';
            $registration->update([
                'sync_status' => EtimsItemRegistration::STATUS_FAILED,
                'last_error' => $message,
                'last_attempt_at' => now(),
            ]);

            return ItemRegistrationResult::failed($clientRequestId, $message, $response->status(), 0, $body);
        }

        $isComplete = in_array($status, ['COMPLETE', 'COMPLETED'], true);
        $registration->update([
            'digitax_item_id' => $data['id'] ?? $registration->digitax_item_id,
            'item_code' => $data['etims_item_code'] ?? $registration->item_code,
            'sync_status' => $isComplete
                ? EtimsItemRegistration::STATUS_SYNCED
                : EtimsItemRegistration::STATUS_PENDING,
            'synced_at' => $isComplete ? now() : $registration->synced_at,
            'last_attempt_at' => now(),
            'last_error' => null,
        ]);

        return $isComplete
            ? ItemRegistrationResult::synced(
                $clientRequestId,
                $registration->item_code ?? $registration->digitax_item_id,
                0,
                $body,
            )
            : ItemRegistrationResult::pending(
                $clientRequestId,
                $registration->item_code ?? $registration->digitax_item_id,
                0,
                $body,
            );
    }

    // ─────────── Phase 4: sales ───────────

    public function submitSale(Company $company, Invoice $invoice, string $clientRequestId): SaleSubmission
    {
        $config = $this->requireConfig($company);

        $payload = $this->buildSalePayload($config, $invoice);

        try {
            $response = $this->client->post(
                config: $config,
                endpoint: '/sales',
                body: $payload,
                clientRequestId: $clientRequestId,
                operation: 'sale.submit',
                subjectType: 'invoice',
                subjectId: (string) $invoice->id,
            );
        } catch (\Throwable $e) {
            return SaleSubmission::failed($clientRequestId, $e->getMessage(), null, 0);
        }

        $body = $response->json() ?? [];

        if (! $response->successful()) {
            $message = $body['message'] ?? "DigiTax HTTP {$response->status()}";

            return SaleSubmission::failed($clientRequestId, $message, $response->status(), 0, $body);
        }

        $data = $body['data'] ?? $body;

        // DigiTax v2 returns the sale identifier as `id`.
        $regulatorSaleId = $data['id'] ?? $data['digitax_id'] ?? null;
        if (! $regulatorSaleId) {
            return SaleSubmission::invalidResponse($clientRequestId, 'DigiTax response missing sale id', 0, $body);
        }

        $config->markLiveSubmission();

        $status = strtoupper((string) ($data['status'] ?? $data['queue_status'] ?? 'PENDING'));
        if ($status === 'FAILED') {
            return SaleSubmission::failed(
                $clientRequestId,
                $data['message'] ?? 'DigiTax queued the sale but eTIMS rejected it.',
                $response->status(),
                0,
                $body,
            );
        }
        if ($status === 'COMPLETED') {
            return SaleSubmission::completed(
                $clientRequestId,
                (string) $regulatorSaleId,
                $data['receipt_signature'] ?? null,
                $data['etims_url'] ?? null,
                $data['trader_invoice_number'] ?? null,
                0,
                $body,
            );
        }

        return new SaleSubmission(
            status: 'pending',
            regulatorSaleId: (string) $regulatorSaleId,
            clientRequestId: $clientRequestId,
            traderInvoiceNumber: $data['trader_invoice_number'] ?? $invoice->invoice_number,
            latencyMs: 0,
            raw: $body,
        );
    }

    public function refreshSaleSubmission(Company $company, Invoice $invoice): SaleSubmission
    {
        $config = $this->requireConfig($company);
        $clientRequestId = $invoice->etims_client_request_id ?: (string) Str::uuid();

        if (! $invoice->etims_sale_id) {
            return SaleSubmission::invalidResponse($clientRequestId, 'Invoice has no DigiTax sale id to refresh.');
        }

        try {
            $response = $this->client->get(
                $config,
                '/sales/'.$invoice->etims_sale_id,
                [],
                'sale.status',
                $clientRequestId,
            );
        } catch (\Throwable $e) {
            return SaleSubmission::failed($clientRequestId, $e->getMessage());
        }

        $body = $response->json() ?? [];
        if (! $response->successful()) {
            return SaleSubmission::failed(
                $clientRequestId,
                $body['message'] ?? "DigiTax HTTP {$response->status()}",
                $response->status(),
                0,
                $body,
            );
        }

        $data = $body['data'] ?? $body;
        $status = strtoupper((string) ($data['status'] ?? $data['queue_status'] ?? 'PENDING'));
        if ($status === 'FAILED') {
            return SaleSubmission::failed(
                $clientRequestId,
                $data['message'] ?? 'DigiTax reported a failed eTIMS sale.',
                $response->status(),
                0,
                $body,
            );
        }

        if (in_array($status, ['COMPLETE', 'COMPLETED'], true)) {
            return SaleSubmission::completed(
                $clientRequestId,
                (string) ($data['id'] ?? $invoice->etims_sale_id),
                $data['receipt_signature'] ?? null,
                $data['etims_url'] ?? null,
                $data['trader_invoice_number'] ?? $invoice->invoice_number,
                0,
                $body,
            );
        }

        return new SaleSubmission(
            status: 'pending',
            regulatorSaleId: (string) ($data['id'] ?? $invoice->etims_sale_id),
            clientRequestId: $clientRequestId,
            traderInvoiceNumber: $data['trader_invoice_number'] ?? $invoice->invoice_number,
            raw: $body,
        );
    }

    public function findSaleSubmission(Company $company, Invoice $invoice): ?SaleSubmission
    {
        $config = $this->requireConfig($company);
        $clientRequestId = $invoice->etims_client_request_id ?: (string) Str::uuid();
        $invoiceDate = $invoice->invoice_date ?? now();

        try {
            $response = $this->client->get(
                $config,
                '/sales',
                [
                    'since' => $invoiceDate->copy()->subDay()->toDateString(),
                    'until' => now()->addDay()->toDateString(),
                    'limit' => 500,
                ],
                'sale.lookup',
                $clientRequestId,
            );
        } catch (\Throwable) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $body = $response->json() ?? [];
        $sales = collect($body['data'] ?? $body);
        $data = $sales->first(
            fn ($sale) => ($sale['trader_invoice_number'] ?? null) === $invoice->invoice_number,
        );
        if (! is_array($data)) {
            return null;
        }

        $saleId = $data['id'] ?? $data['sale_id'] ?? $data['digitax_id'] ?? null;
        if (! $saleId) {
            return null;
        }

        $status = strtoupper((string) ($data['status'] ?? $data['queue_status'] ?? 'PENDING'));
        if (in_array($status, ['COMPLETE', 'COMPLETED'], true)) {
            return SaleSubmission::completed(
                $clientRequestId,
                (string) $saleId,
                $data['receipt_signature'] ?? $data['signature'] ?? null,
                $data['etims_url'] ?? $data['qr_url'] ?? null,
                $data['trader_invoice_number'] ?? $invoice->invoice_number,
                0,
                ['data' => $data],
            );
        }

        return new SaleSubmission(
            status: 'pending',
            regulatorSaleId: (string) $saleId,
            clientRequestId: $clientRequestId,
            traderInvoiceNumber: $data['trader_invoice_number'] ?? $invoice->invoice_number,
            raw: ['data' => $data],
        );
    }

    /** @return array<string, mixed> */
    private function buildSalePayload(CompanyEtimsConfig $config, Invoice $invoice): array
    {
        $invoice->loadMissing(['lineItems.product', 'customer']);
        $customerTin = trim((string) $invoice->customer?->pin_number) ?: null;
        $registrations = EtimsItemRegistration::query()
            ->where('company_id', $invoice->company_id)
            ->whereIn('product_id', $invoice->lineItems->pluck('product_id')->filter())
            ->get()
            ->groupBy('product_id');

        $lineProfiles = $invoice->lineItems->groupBy(
            fn ($line) => EtimsTaxType::key((string) $line->product_id, EtimsTaxType::forLine($line)),
        );

        $roundingCentsByTaxType = [];
        $lines = $lineProfiles
            ->map(function ($profileLines) use (&$roundingCentsByTaxType, $registrations) {
                $firstLine = $profileLines->first();
                $taxTypeCode = EtimsTaxType::forLine($firstLine);
                $productRegistrations = $registrations->get($firstLine->product_id, collect());
                $registration = $productRegistrations->firstWhere('tax_type_code', $taxTypeCode)
                    ?? ($productRegistrations->count() === 1
                        && blank($productRegistrations->first()?->tax_type_code)
                        ? $productRegistrations->first()
                        : null);
                $quantityHundredths = (int) $profileLines->sum(
                    fn ($line) => (int) round((float) $line->quantity * 100),
                );
                $totalAmountCents = (int) $profileLines->sum(
                    fn ($line) => (int) round((float) $line->line_total * 100),
                );
                $amount = $this->amountAllocator->allocate($quantityHundredths, $totalAmountCents);
                if ($amount['rounding_amount_cents'] > 0) {
                    $roundingCentsByTaxType[$taxTypeCode] = ($roundingCentsByTaxType[$taxTypeCode] ?? 0)
                        + $amount['rounding_amount_cents'];
                }
                $description = $profileLines->count() === 1
                    ? $firstLine->description
                    : ($firstLine->product?->name ?? $firstLine->description)
                        .' ('.$profileLines->count().' invoice lines)';

                return array_filter([
                    'id' => $registration?->digitax_item_id,
                    'quantity' => $amount['quantity'],
                    'unit_price' => $amount['unit_price'],
                    'total_amount' => $amount['total_amount'],
                    'package_unit_quantity' => $amount['quantity'],
                    'item_description' => $description,
                ], static fn ($value) => $value !== null);
            })
            ->values()
            ->all();

        foreach ($roundingCentsByTaxType as $taxTypeCode => $roundingCents) {
            $product = Product::withoutGlobalScope('company')
                ->where('company_id', $invoice->company_id)
                ->where('product_code', EtimsSaleAmountAllocator::roundingProductCode($taxTypeCode))
                ->first();
            $registration = $product
                ? EtimsItemRegistration::query()
                    ->where('company_id', $invoice->company_id)
                    ->where('product_id', $product->id)
                    ->where('tax_type_code', $taxTypeCode)
                    ->where('sync_status', EtimsItemRegistration::STATUS_SYNCED)
                    ->first()
                : null;

            if (! $registration?->digitax_item_id) {
                throw new RuntimeException(
                    'The '.EtimsTaxType::label($taxTypeCode).' eTIMS rounding item is not registered yet.',
                );
            }

            $roundingAmount = $roundingCents / 100;
            $lines[] = [
                'id' => $registration->digitax_item_id,
                'quantity' => 1.0,
                'unit_price' => $roundingAmount,
                'total_amount' => $roundingAmount,
                'package_unit_quantity' => 1.0,
                'item_description' => EtimsSaleAmountAllocator::roundingProductName($taxTypeCode),
            ];
        }

        return array_filter([
            'sale_date' => optional($invoice->invoice_date)->format('Y-m-d'),
            'customer_tin' => $customerTin,
            'customer_name' => $invoice->customer?->name,
            'trader_invoice_number' => $invoice->invoice_number,
            'payment_type_code' => $invoice->metadata['etims_payment_type'] ?? '01', // default cash
            'invoice_status_code' => '02', // approved
            'callback_url' => $this->callbackUrl($config),
            'invoice_details' => $invoice->notes,
            'is_tax_exempt' => (float) $invoice->tax_amount === 0.0,
            'items' => $lines,
        ], static fn ($value) => $value !== null);
    }

    private function callbackUrl(CompanyEtimsConfig $config): ?string
    {
        if (! config('tax_compliance.etims.callbacks_enabled', false)) {
            return null;
        }

        return url('/api/webhooks/etims/'.$config->webhook_token);
    }

    // ─────────── Phase 5: stock ───────────

    public function submitStockMovement(
        Company $company,
        Product $product,
        int $quantityDelta,
        string $movementType,
        string $reference,
    ): ItemRegistrationResult {
        $config = $this->requireConfig($company);

        $clientRequestId = (string) Str::uuid();
        $payload = [
            'kra_pin' => $config->kra_pin,
            'branch_id' => $config->branch_id,
            'item_code' => $product->product_code ?? $product->sku ?? $product->id,
            'movement_type' => $movementType,                  // 'receipt' | 'adjustment'
            'movement_direction' => $quantityDelta >= 0 ? 'IN' : 'OUT',
            'quantity' => abs($quantityDelta),
            'reference' => $reference,
            'moved_at' => now()->format('Y-m-d\TH:i:s'),
        ];

        try {
            $response = $this->client->post(
                config: $config,
                endpoint: '/stock-movements',
                body: $payload,
                clientRequestId: $clientRequestId,
                operation: 'stock.add',
                subjectType: 'product',
                subjectId: (string) $product->id,
            );
        } catch (\Throwable $e) {
            return ItemRegistrationResult::failed($clientRequestId, $e->getMessage(), null, 0);
        }

        $body = $response->json() ?? [];
        if ($response->successful()) {
            return ItemRegistrationResult::synced($clientRequestId, $body['data']['movement_id'] ?? $clientRequestId, 0, $body);
        }

        return ItemRegistrationResult::failed($clientRequestId, $body['message'] ?? "HTTP {$response->status()}", $response->status(), 0, $body);
    }

    // ─────────── Phase 6: credit notes ───────────

    public function submitCreditNote(
        Company $company,
        Invoice $originalInvoice,
        Invoice $creditNote,
        string $clientRequestId,
    ): SaleSubmission {
        $config = $this->requireConfig($company);

        // DigiTax v2 credit notes are their own sale-shaped transaction. The
        // credited lines and trader number therefore come from the credit note,
        // while sale_id/original_trader_invoice_number identify the KRA sale
        // being reversed.
        $payload = array_merge($this->buildSalePayload($config, $creditNote), [
            'receipt_type_code' => 'R',
            'returned_date' => optional($creditNote->invoice_date)->format('Y-m-d'),
            'sale_id' => $originalInvoice->etims_sale_id,
            'original_trader_invoice_number' => $originalInvoice->etims_trader_invoice_number
                ?: $originalInvoice->invoice_number,
        ]);

        try {
            $response = $this->client->post(
                config: $config,
                endpoint: '/credit-notes',
                body: $payload,
                clientRequestId: $clientRequestId,
                operation: 'credit_note.submit',
                subjectType: 'invoice',
                subjectId: (string) $creditNote->id,
            );
        } catch (\Throwable $e) {
            return SaleSubmission::failed($clientRequestId, $e->getMessage(), null, 0);
        }

        $body = $response->json() ?? [];
        if (! $response->successful()) {
            return SaleSubmission::failed($clientRequestId, $body['message'] ?? "HTTP {$response->status()}", $response->status(), 0, $body);
        }
        $data = $body['data'] ?? $body;
        $regulatorId = $data['id'] ?? $data['sale_id'] ?? $data['credit_note_id'] ?? null;
        if (! $regulatorId) {
            return SaleSubmission::invalidResponse($clientRequestId, 'DigiTax credit-note response missing id', 0, $body);
        }

        $config->markLiveSubmission();

        $status = strtoupper((string) ($data['status'] ?? $data['queue_status'] ?? 'PENDING'));
        if ($status === 'FAILED') {
            return SaleSubmission::failed(
                $clientRequestId,
                $data['message'] ?? 'DigiTax queued the credit note but eTIMS rejected it.',
                $response->status(),
                0,
                $body,
            );
        }
        if (in_array($status, ['COMPLETE', 'COMPLETED'], true)) {
            return SaleSubmission::completed(
                $clientRequestId,
                (string) $regulatorId,
                $data['receipt_signature'] ?? null,
                $data['etims_url'] ?? null,
                $data['trader_invoice_number'] ?? $creditNote->invoice_number,
                0,
                $body,
            );
        }

        return new SaleSubmission(
            status: 'pending',
            regulatorSaleId: (string) $regulatorId,
            clientRequestId: $clientRequestId,
            traderInvoiceNumber: $data['trader_invoice_number'] ?? $creditNote->invoice_number,
            raw: $body,
        );
    }

    // ─────────── Phase 7: AP-side verify ───────────

    public function verifySupplierReceipt(
        Company $company,
        string $qrPayload,
        ?string $supplierKraPin = null,
        ?string $traderInvoiceNumber = null,
    ): ReceiptVerification {
        $config = $this->requireConfig($company);

        $clientRequestId = (string) Str::uuid();

        try {
            $response = $this->client->post(
                config: $config,
                endpoint: '/verify',
                body: [
                    'qr_payload' => $qrPayload,
                    'supplier_kra_pin' => $supplierKraPin,
                    'trader_invoice_number' => $traderInvoiceNumber,
                ],
                clientRequestId: $clientRequestId,
                operation: 'verify_receipt',
            );
        } catch (\Throwable $e) {
            return ReceiptVerification::invalid($e->getMessage());
        }

        $body = $response->json() ?? [];
        if (! $response->successful()) {
            return ReceiptVerification::invalid(
                $body['message'] ?? "DigiTax HTTP {$response->status()}",
                $body,
            );
        }

        $data = $body['data'] ?? $body;
        $valid = (bool) ($data['valid'] ?? $data['verified'] ?? false);
        if (! $valid) {
            return ReceiptVerification::invalid(
                $data['reason'] ?? 'DigiTax could not verify the receipt signature.',
                $body,
            );
        }

        return ReceiptVerification::valid($data, $body);
    }

    // ─────────── helpers ───────────

    private function configFor(Company $company): ?CompanyEtimsConfig
    {
        return CompanyEtimsConfig::query()
            ->where('company_id', $company->id)
            ->where('country_code', 'KE')
            ->notSuperseded()
            ->first();
    }

    private function requireConfig(Company $company): CompanyEtimsConfig
    {
        $config = $this->configFor($company);
        if (! $config || ! $config->enabled) {
            throw new RuntimeException("Company {$company->id} has no enabled eTIMS configuration.");
        }

        return $config;
    }

    private function recordProbe(CompanyEtimsConfig $config, string $result): void
    {
        $config->last_test_connection_at = now();
        $config->last_test_connection_result = $result;
        $config->saveQuietly();
    }
}
