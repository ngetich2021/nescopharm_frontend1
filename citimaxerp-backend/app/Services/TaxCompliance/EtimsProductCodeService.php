<?php

namespace App\Services\TaxCompliance;

use App\Jobs\Etims\SyncEtimsItemJob;
use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Product;
use Illuminate\Support\Collection;

/**
 * A product's KRA codes (item class, packaging, quantity unit, origin), from the Product Codes
 * import or the product form. DigiTax's item update (PUT /items/{id}) only changes name, tax type
 * and price, so a product already registered whose codes change is registered again under the
 * new codes. Signed invoices keep their own references.
 */
class EtimsProductCodeService
{
    /**
     * Save $codes on the product and its KRA registrations. Returns true when a registration
     * already at KRA was reset to be registered again (call queue() for those products).
     *
     * @param  Collection<int, EtimsItemRegistration>|null  $profiles  the product's registrations, when already loaded
     */
    public function apply(string $companyId, Product $product, array $codes, ?Collection $profiles = null): bool
    {
        if (isset($codes['item_class_code'])) {
            $product->etims_item_class_code = $codes['item_class_code'];
            $product->save();
        }

        $profiles ??= EtimsItemRegistration::where('company_id', $companyId)->where('product_id', $product->id)->get();
        if ($profiles->isEmpty()) {
            $profiles = collect([EtimsItemRegistration::firstOrCreate(
                ['company_id' => $companyId, 'product_id' => $product->id, 'tax_type_code' => EtimsTaxType::forProduct($product)],
                ['sync_status' => EtimsItemRegistration::STATUS_PENDING],
            )]);
        }

        $reregister = false;
        foreach ($profiles as $registration) {
            $registration->fill($codes);
            if (! $registration->isDirty()) {
                continue;
            }
            if (filled($registration->digitax_item_id)) {
                $reregister = true;
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
            $registration->save();
        }

        return $reregister;
    }

    /** Register these products with KRA again now, when eTIMS is enabled for the company. */
    public function queue(string $companyId, array $productIds): void
    {
        if ($productIds === []) {
            return;
        }
        $enabled = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->notSuperseded()
            ->whereRaw('enabled = true')
            ->exists();
        if (! $enabled) {
            return;
        }
        foreach ($productIds as $productId) {
            SyncEtimsItemJob::dispatch($companyId, $productId);
        }
    }
}
