<?php

namespace App\Services\TaxCompliance;

use App\Models\Company;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Invoice;
use App\Models\Product;
use App\Services\TaxCompliance\DTOs\ItemRegistrationResult;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Orchestrates product → KRA item registration.
 *
 * The provider does the HTTP/DTO work. This service is the "business" layer:
 *   - guards: company has enabled config, country supported
 *   - circuit breaker check before dispatch
 *   - upsert the EtimsItemRegistration row
 *   - re-enqueue retries on failure (in calling code via job)
 */
class EtimsItemSyncService
{
    public function __construct(
        private readonly TaxComplianceProviderRegistry $registry,
        private readonly EtimsCircuitBreaker $breaker,
        private readonly EtimsSaleAmountAllocator $amountAllocator,
    ) {}

    public function syncProduct(
        Company $company,
        Product $product,
        ?string $taxTypeCode = null,
        ?float $invoiceUnitPrice = null,
    ): ItemRegistrationResult {
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
        $this->prepareRegistration($registration, $product, $taxTypeCode, $invoiceUnitPrice);

        $defaultUnitPrice = (float) ($registration->default_unit_price ?? 0);
        if ($defaultUnitPrice <= 0) {
            $message = 'A positive eTIMS default unit price is required. '
                .'Set one on the eTIMS item profile or register this service from a priced invoice line.';
            $registration->forceFill([
                'sync_status' => EtimsItemRegistration::STATUS_FAILED,
                'last_error' => $message,
            ])->save();

            return ItemRegistrationResult::failed(
                clientRequestId: '',
                message: $message,
                statusCode: 422,
                latencyMs: 0,
            );
        }

        if (! $this->breaker->allow((string) $company->id)) {
            return ItemRegistrationResult::failed(
                clientRequestId: '',
                message: 'Circuit breaker open for this company; will retry after cooldown.',
                statusCode: null,
                latencyMs: 0,
            );
        }

        $provider = $this->registry->forCompany($company);
        $result = $provider->registerItem(
            $company,
            $product,
            $taxTypeCode,
            $defaultUnitPrice,
        );

        if ($result->status === 'failed') {
            $this->breaker->recordFailure((string) $company->id);
        } else {
            $this->breaker->recordSuccess((string) $company->id);
        }

        return $result;
    }

    /**
     * Ensure every catalogue product on an invoice exists in DigiTax before the
     * sale is submitted. More specific product/registration metadata always wins;
     * broad DigiTax-documented goods/service defaults are used only when absent.
     *
     * @return array{status: 'ready'|'pending'|'failed', message: ?string, retryable: bool}
     */
    public function prepareInvoiceProducts(Company $company, Invoice $invoice): array
    {
        $this->ensureInvoiceCatalogueProducts($company, $invoice);
        $invoice->loadMissing('lineItems.product');

        $missingProductLines = $invoice->lineItems->filter(fn ($line) => ! $line->product_id || ! $line->product);
        if ($missingProductLines->isNotEmpty()) {
            return [
                'status' => 'failed',
                'message' => 'Every eTIMS invoice line must be linked to a catalogue product.',
                'retryable' => false,
            ];
        }

        $pending = [];

        $profileDefaultUnitPrices = [];
        foreach ($invoice->lineItems as $line) {
            if (! $line->product_id || ! $line->product) {
                continue;
            }

            $taxTypeCode = EtimsTaxType::forLine($line);
            $profileKey = EtimsTaxType::key((string) $line->product_id, $taxTypeCode);
            $unitPrice = (float) $line->unit_price;
            if ($unitPrice > 0 && ! isset($profileDefaultUnitPrices[$profileKey])) {
                $profileDefaultUnitPrices[$profileKey] = $unitPrice;
            }
        }

        $processedProfiles = [];
        foreach ($invoice->lineItems as $line) {
            $product = $line->product;
            $taxTypeCode = EtimsTaxType::forLine($line);
            $profileKey = EtimsTaxType::key((string) $product->id, $taxTypeCode);
            if (isset($processedProfiles[$profileKey])) {
                continue;
            }
            $processedProfiles[$profileKey] = true;

            $registration = EtimsItemRegistration::firstOrCreate(
                [
                    'company_id' => $company->id,
                    'product_id' => $product->id,
                    'tax_type_code' => $taxTypeCode,
                ],
                ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
            );

            $invoiceUnitPrice = $profileDefaultUnitPrices[$profileKey] ?? null;
            $this->prepareRegistration(
                $registration,
                $product,
                $taxTypeCode,
                $invoiceUnitPrice,
            );

            if ($registration->sync_status === EtimsItemRegistration::STATUS_SYNCED
                && $registration->digitax_item_id) {
                continue;
            }

            // If DigiTax already assigned an item ID, refresh it with GET rather
            // than issuing a duplicate POST when the callback is late or lost.
            $result = $registration->digitax_item_id
                ? $this->refreshProduct($company, $product, $taxTypeCode)
                : $this->syncProduct(
                    $company,
                    $product,
                    $taxTypeCode,
                    $invoiceUnitPrice,
                );
            if ($result->status === 'failed') {
                return [
                    'status' => 'failed',
                    'message' => "Could not register {$product->name} with eTIMS: ".($result->errorMessage ?? 'Unknown DigiTax error'),
                    'retryable' => $result->statusCode === null || $result->statusCode >= 500,
                ];
            }

            if ($result->status === 'pending') {
                $pending[] = $product->name.' ('.EtimsTaxType::label($taxTypeCode).')';
            }
        }

        foreach ($this->amountAllocator->roundingRequirements($invoice) as $taxTypeCode => $roundingCents) {
            $product = $this->ensureRoundingProduct($company, $taxTypeCode);
            $registration = EtimsItemRegistration::firstOrCreate(
                [
                    'company_id' => $company->id,
                    'product_id' => $product->id,
                    'tax_type_code' => $taxTypeCode,
                ],
                ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
            );
            $this->prepareRegistration($registration, $product, $taxTypeCode, max(0.01, $roundingCents / 100));

            if ($registration->sync_status === EtimsItemRegistration::STATUS_SYNCED
                && $registration->digitax_item_id) {
                continue;
            }

            $result = $registration->digitax_item_id
                ? $this->refreshProduct($company, $product, $taxTypeCode)
                : $this->syncProduct($company, $product, $taxTypeCode, max(0.01, $roundingCents / 100));

            if ($result->status === 'failed') {
                return [
                    'status' => 'failed',
                    'message' => 'Could not register the '.EtimsTaxType::label($taxTypeCode)
                        .' rounding item with eTIMS: '.($result->errorMessage ?? 'Unknown DigiTax error'),
                    'retryable' => $result->statusCode === null || $result->statusCode >= 500,
                ];
            }

            if ($result->status === 'pending') {
                $pending[] = self::roundingLabel($taxTypeCode);
            }
        }

        if ($pending !== []) {
            return [
                'status' => 'pending',
                'message' => 'Registering products with eTIMS: '.implode(', ', $pending),
                'retryable' => true,
            ];
        }

        return ['status' => 'ready', 'message' => null, 'retryable' => false];
    }

    private function ensureRoundingProduct(Company $company, string $taxTypeCode): Product
    {
        $productCode = EtimsSaleAmountAllocator::roundingProductCode($taxTypeCode);
        $taxRate = EtimsSaleAmountAllocator::taxRate($taxTypeCode);

        return Product::withoutGlobalScope('company')->firstOrCreate(
            [
                'company_id' => $company->id,
                'product_code' => $productCode,
            ],
            [
                'id' => (string) Str::uuid(),
                'product_number' => $productCode,
                'name' => EtimsSaleAmountAllocator::roundingProductName($taxTypeCode),
                'description' => 'Automatic eTIMS cent reconciliation for tax-inclusive unit-price rounding.',
                'type' => 'service',
                'price' => 0.01,
                'unit_of_measurement' => 'service',
                'base_unit' => 'service',
                'is_active' => false,
                'is_taxable' => in_array(strtoupper($taxTypeCode), ['B', 'E'], true),
                'tax_rate' => $taxRate,
                'track_inventory' => false,
                'etims_item_class_code' => strtoupper($taxTypeCode) === 'C' ? '99022000' : '99020000',
            ],
        );
    }

    private static function roundingLabel(string $taxTypeCode): string
    {
        return 'eTIMS rounding adjustment ('.EtimsTaxType::label($taxTypeCode).')';
    }

    /**
     * Convert free-text invoice lines into catalogue products before DigiTax
     * registration. The generated products do not track inventory and use a
     * deterministic code based on the line ID, making retries idempotent.
     */
    public function ensureInvoiceCatalogueProducts(Company $company, Invoice $invoice): int
    {
        $invoice->loadMissing('lineItems');
        $linked = 0;

        foreach ($invoice->lineItems as $line) {
            $existingProduct = $line->product_id
                ? Product::withoutGlobalScope('company')
                    ->where('company_id', $company->id)
                    ->find($line->product_id)
                : null;

            if ($existingProduct) {
                continue;
            }

            DB::transaction(function () use ($company, $invoice, $line, &$linked) {
                $productCode = 'ETIMS-AUTO-'.strtoupper(substr(str_replace('-', '', (string) $line->id), 0, 20));
                $description = Str::squish((string) $line->description) ?: 'Invoice item';
                $unit = Str::lower(trim((string) ($line->unit ?: 'unit')));
                $type = $this->catalogueProductType($invoice, $unit);
                $taxRate = (float) $line->tax_rate;

                $product = Product::withoutGlobalScope('company')->firstOrCreate(
                    [
                        'company_id' => $company->id,
                        'product_code' => $productCode,
                    ],
                    [
                        'id' => (string) Str::uuid(),
                        'product_number' => $productCode,
                        'name' => Str::limit($description, 255, ''),
                        'description' => $description,
                        'type' => $type,
                        'price' => (float) $line->unit_price,
                        'unit_of_measurement' => $unit,
                        'base_unit' => $unit,
                        'is_active' => true,
                        'is_taxable' => $taxRate > 0,
                        'tax_rate' => $taxRate,
                        'track_inventory' => false,
                        'income_account_id' => $line->income_account_id,
                    ],
                );

                $line->update([
                    'product_id' => $product->id,
                    'variant_id' => null,
                ]);
                $linked++;
            });
        }

        if ($linked > 0) {
            $invoice->unsetRelation('lineItems');
        }

        return $linked;
    }

    private function catalogueProductType(Invoice $invoice, string $unit): string
    {
        if ($invoice->type === 'service') {
            return 'service';
        }

        return in_array($unit, [
            'service', 'hour', 'hours', 'day', 'days', 'month', 'months',
        ], true) ? 'service' : 'product';
    }

    private function refreshProduct(
        Company $company,
        Product $product,
        string $taxTypeCode,
    ): ItemRegistrationResult {
        $provider = $this->registry->forCompany($company);
        $result = $provider->refreshItemRegistration($company, $product, $taxTypeCode);

        if ($result->status === 'failed') {
            $this->breaker->recordFailure((string) $company->id);
        } else {
            $this->breaker->recordSuccess((string) $company->id);
        }

        return $result;
    }

    /** @return array<string, string|float|null> */
    private function registrationDefaults(
        Product $product,
        ?string $taxTypeCode = null,
        ?float $invoiceUnitPrice = null,
    ): array {
        $isService = $product->type === 'service';
        $taxTypeCode = $taxTypeCode ?: EtimsTaxType::forProduct($product);
        $defaultClassCode = $isService
            ? ($taxTypeCode === 'C' ? '99022000' : '99020000')
            : '99010000';

        return [
            'item_class_code' => $product->etims_item_class_code ?: $defaultClassCode,
            'item_type_code' => $isService ? '3' : '2',
            'packaging_unit_code' => 'NT',
            'quantity_unit_code' => 'U',
            'country_of_origin_code' => 'KE',
            'tax_type_code' => $taxTypeCode,
            'default_unit_price' => $this->defaultUnitPrice($product, $invoiceUnitPrice),
        ];
    }

    private function prepareRegistration(
        EtimsItemRegistration $registration,
        Product $product,
        string $taxTypeCode,
        ?float $invoiceUnitPrice = null,
    ): void {
        $this->alignRegistrationType($registration, $product);

        $hadPositiveDefault = (float) ($registration->default_unit_price ?? 0) > 0;
        foreach ($this->registrationDefaults($product, $taxTypeCode, $invoiceUnitPrice) as $field => $value) {
            if (blank($registration->{$field}) && $value !== null) {
                $registration->{$field} = $value;
            }
        }

        if (! $hadPositiveDefault
            && (float) ($registration->default_unit_price ?? 0) > 0
            && $registration->sync_status === EtimsItemRegistration::STATUS_FAILED
            && blank($registration->digitax_item_id)) {
            $registration->forceFill([
                'client_request_id' => null,
                'sync_status' => EtimsItemRegistration::STATUS_PENDING,
                'last_error' => null,
                'last_attempt_at' => null,
                'attempts' => 0,
            ]);
        }

        if ($registration->isDirty()) {
            $registration->save();
        }
    }

    private function defaultUnitPrice(Product $product, ?float $invoiceUnitPrice): ?float
    {
        $cataloguePrice = (float) ($product->price ?? 0);
        if ($cataloguePrice > 0) {
            return round($cataloguePrice, 2);
        }

        if ($invoiceUnitPrice !== null && $invoiceUnitPrice > 0) {
            return round($invoiceUnitPrice, 2);
        }

        return null;
    }

    /**
     * DigiTax item type cannot be changed through its item-update endpoint.
     * Detach a stale mapping when a catalogue record has changed between goods
     * and service so the next sync creates the correct external item. Completed
     * invoices keep their own sale/receipt references and are not modified.
     */
    private function alignRegistrationType(EtimsItemRegistration $registration, Product $product): void
    {
        $expectedType = $product->type === 'service' ? '3' : '2';
        $currentType = trim((string) $registration->item_type_code);
        $requiresReplacement = filled($registration->digitax_item_id)
            && (
                ($currentType !== '' && $currentType !== $expectedType)
                || ($expectedType === '3' && $currentType !== '3')
            );

        if ($requiresReplacement) {
            Log::notice('Replacing misclassified DigiTax item registration', [
                'company_id' => $registration->company_id,
                'product_id' => $product->id,
                'digitax_item_id' => $registration->digitax_item_id,
                'previous_item_type_code' => $currentType ?: null,
                'expected_item_type_code' => $expectedType,
            ]);

            $registration->forceFill([
                'digitax_item_id' => null,
                'item_code' => null,
                'client_request_id' => null,
                'sync_status' => EtimsItemRegistration::STATUS_PENDING,
                'synced_at' => null,
                'last_attempt_at' => null,
                'last_error' => null,
                'attempts' => 0,
            ]);
        }

        $registration->item_type_code = $expectedType;
        if ($expectedType === '3'
            && (blank($registration->item_class_code) || $registration->item_class_code === '99010000')) {
            $registration->item_class_code = $product->etims_item_class_code ?: '99020000';
        } elseif ($expectedType === '2'
            && (blank($registration->item_class_code) || $registration->item_class_code === '99020000')) {
            $registration->item_class_code = $product->etims_item_class_code ?: '99010000';
        }

        if ($registration->isDirty()) {
            $registration->save();
        }
    }

    /**
     * Mark registration synced via webhook payload - called from the inbound
     * webhook handler when DigiTax sends 'item.sync' completion.
     */
    public function applyWebhookCompletion(string $companyId, array $payload): bool
    {
        $clientRequestId = $payload['client_request_id']
            ?? $payload['X-Client-Request-Id']
            ?? null;
        $digitaxItemId = $payload['data']['id']
            ?? $payload['data']['digitax_id']
            ?? null;
        $itemCode = $payload['data']['etims_item_code']
            ?? $payload['data']['item_code']
            ?? $payload['item_code']
            ?? null;

        $query = EtimsItemRegistration::query()->where('company_id', $companyId);
        if ($clientRequestId) {
            $query->where('client_request_id', $clientRequestId);
        } elseif ($digitaxItemId) {
            $query->where('digitax_item_id', $digitaxItemId);
        } elseif ($itemCode) {
            $query->where('item_code', $itemCode);
        } else {
            return false;
        }

        $registration = $query->first();
        if (! $registration) {
            return false;
        }

        $registration->update([
            'digitax_item_id' => $digitaxItemId ?? $registration->digitax_item_id,
            'item_code' => $itemCode ?? $registration->item_code,
            'sync_status' => EtimsItemRegistration::STATUS_SYNCED,
            'synced_at' => now(),
            'last_error' => null,
        ]);

        return true;
    }
}
