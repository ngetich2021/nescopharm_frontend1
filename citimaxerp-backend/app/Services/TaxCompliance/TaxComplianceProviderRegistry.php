<?php

namespace App\Services\TaxCompliance;

use App\Models\Company;
use App\Services\TaxCompliance\Contracts\TaxComplianceProvider;
use App\Services\TaxCompliance\Exceptions\UnsupportedCountry;
use App\Services\TaxCompliance\Providers\Kenya\EtimsProvider;

/**
 * Resolves the right tax compliance provider for a company based on its primary country.
 *
 * Currently registered: Kenya only. Uganda EFRIS, Tanzania VFD, Rwanda EBM
 * register here when their concrete providers ship.
 */
class TaxComplianceProviderRegistry
{
    public function __construct(
        private readonly EtimsProvider $etims,
    ) {}

    /** Resolve by company. Throws UnsupportedCountry if no provider exists. */
    public function forCompany(Company $company): TaxComplianceProvider
    {
        $iso2 = $this->resolveCountryCode($company);
        return $this->forCountry($iso2);
    }

    public function forCountry(string $iso2): TaxComplianceProvider
    {
        return match (strtoupper($iso2)) {
            'KE' => $this->etims,
            // 'UG' => $this->efris,   // Phase: future
            // 'TZ' => $this->vfd,     // Phase: future
            // 'RW' => $this->ebm,     // Phase: future
            default => throw UnsupportedCountry::for($iso2),
        };
    }

    public function isSupported(string $iso2): bool
    {
        return in_array(strtoupper($iso2), ['KE'], true);
    }

    private function resolveCountryCode(Company $company): string
    {
        // Company.primary_country_code is the ISO-2 source of truth (see
        // Company::primaryCountry relation). Fall back to 'KE' when null so
        // single-country deployments keep working.
        return strtoupper((string) ($company->primary_country_code ?? 'KE'));
    }
}
