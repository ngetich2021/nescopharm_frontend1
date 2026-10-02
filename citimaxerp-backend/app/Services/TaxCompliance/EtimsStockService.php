<?php

namespace App\Services\TaxCompliance;

use App\Models\Company;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Product;
use App\Services\TaxCompliance\DTOs\ItemRegistrationResult;

/**
 * Phase 5: stock-add for KRA item types 1 (raw) and 2 (finished).
 * Item type 3 (services) is skipped - no physical stock movement to declare.
 */
class EtimsStockService
{
    public function __construct(
        private readonly TaxComplianceProviderRegistry $registry,
        private readonly EtimsCircuitBreaker $breaker,
    ) {}

    public function submitMovement(
        Company $company,
        Product $product,
        int $quantityDelta,
        string $movementType,
        string $reference,
    ): ?ItemRegistrationResult {
        $companyId = (string) $company->id;

        if (! $this->breaker->allow($companyId)) {
            return null;
        }

        // Skip services using both the catalogue type and the DigiTax mapping.
        // The catalogue check also protects newly-created services before their
        // first eTIMS registration exists.
        $registration = EtimsItemRegistration::query()
            ->where('company_id', $companyId)
            ->where('product_id', $product->id)
            ->first();
        if ($product->type === 'service'
            || ($registration && $registration->item_type_code === '3')) {
            return null;
        }

        $provider = $this->registry->forCompany($company);
        $result = $provider->submitStockMovement($company, $product, $quantityDelta, $movementType, $reference);

        if ($result->status === 'failed') {
            $this->breaker->recordFailure($companyId);
        } else {
            $this->breaker->recordSuccess($companyId);
        }

        return $result;
    }
}
