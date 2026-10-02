<?php

namespace App\Services\TaxCompliance\Contracts;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\Product;
use App\Services\TaxCompliance\DTOs\ItemRegistrationResult;
use App\Services\TaxCompliance\DTOs\ProviderCapabilities;
use App\Services\TaxCompliance\DTOs\ReceiptVerification;
use App\Services\TaxCompliance\DTOs\SaleSubmission;
use App\Services\TaxCompliance\DTOs\TestConnectionResult;

/**
 * Unified contract for country-specific tax compliance integration.
 *
 * Concrete implementations:
 *   - Kenya: EtimsProvider (DigiTax)
 *   - Uganda: EfrisProvider (planned)
 *   - Tanzania: VfdProvider (planned)
 *   - Rwanda: EbmProvider (planned)
 *
 * Each method takes the rich Eloquent model so the provider can compose the
 * regulator payload from its own knowledge of the schema. Returning DTOs keeps
 * the service callers regulator-agnostic.
 */
interface TaxComplianceProvider
{
    public function countryCode(): string;

    public function capabilities(): ProviderCapabilities;

    public function testConnection(Company $company): TestConnectionResult;

    // ──────── Phase 3: items ────────

    /**
     * Register a product as a KRA item. Async on DigiTax - returns 'pending'
     * and the webhook completes the registration.
     */
    public function registerItem(
        Company $company,
        Product $product,
        ?string $taxTypeCode = null,
        ?float $defaultUnitPrice = null,
    ): ItemRegistrationResult;

    /**
     * Refresh an already-created regulator item when its callback is delayed.
     */
    public function refreshItemRegistration(
        Company $company,
        Product $product,
        ?string $taxTypeCode = null,
    ): ItemRegistrationResult;

    // ──────── Phase 4: sales ────────

    /**
     * Submit a sale (invoice). For DigiTax this is async - returns 'pending'.
     * Caller MUST pre-populate the invoice with `etims_client_request_id` and
     * `etims_lock_state='locked_pending'` BEFORE calling, so the webhook can
     * resolve back even if it arrives before this returns.
     */
    public function submitSale(Company $company, Invoice $invoice, string $clientRequestId): SaleSubmission;

    /**
     * Refresh a submitted sale when its completion callback is delayed.
     */
    public function refreshSaleSubmission(Company $company, Invoice $invoice): SaleSubmission;

    /**
     * Find a sale DigiTax already accepted when the original response was lost
     * and a safe retry reports a duplicate trader invoice number.
     */
    public function findSaleSubmission(Company $company, Invoice $invoice): ?SaleSubmission;

    // ──────── Phase 5: stock ────────

    /**
     * Send a stock movement (add/remove) for an item-type-1/2 product.
     * Skipped for services (item_type_code=3) - see capabilities().
     */
    public function submitStockMovement(
        Company $company,
        Product $product,
        int $quantityDelta,
        string $movementType,    // 'receipt' | 'adjustment'
        string $reference,
    ): ItemRegistrationResult;

    // ──────── Phase 6: credit notes ────────

    /**
     * Submit a credit note tied to a previously-completed sale. The credit
     * note is a separate eTIMS transaction and must carry its own lines and
     * trader invoice number while referencing the original DigiTax sale.
     */
    public function submitCreditNote(
        Company $company,
        Invoice $originalInvoice,
        Invoice $creditNote,
        string $clientRequestId,
    ): SaleSubmission;

    // ──────── Phase 7: AP-side ────────

    /**
     * Verify an uploaded supplier receipt against the regulator. Returns
     * extracted fields + a verdict on VAT-reclaim eligibility.
     */
    public function verifySupplierReceipt(
        Company $company,
        string $qrPayload,
        ?string $supplierKraPin = null,
        ?string $traderInvoiceNumber = null,
    ): ReceiptVerification;
}
