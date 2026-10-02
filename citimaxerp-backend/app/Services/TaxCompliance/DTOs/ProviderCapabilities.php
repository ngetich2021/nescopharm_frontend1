<?php

namespace App\Services\TaxCompliance\DTOs;

/**
 * Static capability matrix for a tax compliance provider. Drives UI gating,
 * scheduler decisions, and validation. See ETIMS_PHASE_0_SYNTHESIS.md for
 * the cross-regime capability comparison.
 */
final class ProviderCapabilities
{
    public function __construct(
        /** Provider requires a per-branch/device serial registered with the regulator. */
        public readonly bool $requiresDeviceSerial,

        /** Items must be pre-registered before they can appear on a sale (KE, UG, RW). */
        public readonly bool $requiresItemPreRegistration,

        /** Daily Z-report submission is mandatory (TZ, RW). */
        public readonly bool $requiresDailyZReport,

        /** Provider has a stock-movement API. */
        public readonly bool $supportsStockMovements,

        /** AP-side purchase declaration for VAT reclaim cross-matching. */
        public readonly bool $supportsPurchaseDeclaration,

        /** Provider pushes webhooks for status updates (DigiTax does on top of eTIMS). */
        public readonly bool $supportsWebhooks,

        /** Receipts are signed device-side, not regulator-side (TZ VFD). */
        public readonly bool $requiresClientSideSignature,

        /** Credit notes may return a pending state requiring approval polling (UG EFRIS). */
        public readonly bool $supportsAsyncCreditNotes,

        /** Provider tolerates offline submission with store-and-forward (TZ, RW). */
        public readonly bool $supportsOfflineStoreAndForward,

        /** Provider distinguishes B2B (tax invoice) from B2C (receipt) at protocol level (RW). */
        public readonly bool $explicitB2BvsB2C,

        /** Seconds of clock drift tolerated by the regulator. */
        public readonly int $timeDriftToleranceSeconds,

        /** Country's standard VAT rate as a decimal (e.g. 0.16 for Kenya). */
        public readonly float $standardVatRate,

        /**
         * Map from internal Citimax tax category slugs to provider-specific codes.
         * e.g. ['vat_standard' => 'B', 'exempt' => 'A', ...]
         *
         * @var array<string, string>
         */
        public readonly array $taxCategoryMap,
    ) {}
}
