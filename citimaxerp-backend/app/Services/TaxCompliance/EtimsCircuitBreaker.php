<?php

namespace App\Services\TaxCompliance;

use Illuminate\Support\Facades\Cache;

/**
 * Per-company circuit breaker. Opens after N consecutive failures within the
 * cooldown window, blocks dispatches, surfaces a banner via state().
 *
 * Three states:
 *   - closed: requests flow normally
 *   - open: requests are blocked; auto-tries half-open after cooldown
 *   - half_open: one probe attempt allowed; success → closed, failure → open
 */
class EtimsCircuitBreaker
{
    /**
     * @return bool true if the breaker is closed (or half-open and granting one probe)
     */
    public function allow(string $companyId): bool
    {
        return match ($this->state($companyId)) {
            'closed', 'half_open' => true,
            'open' => false,
            default => true,
        };
    }

    public function recordSuccess(string $companyId): void
    {
        Cache::forget($this->failKey($companyId));
        Cache::forget($this->openKey($companyId));
    }

    public function recordFailure(string $companyId): void
    {
        $threshold = (int) config('tax_compliance.etims.circuit_breaker.failure_threshold', 5);
        $cooldown = (int) config('tax_compliance.etims.circuit_breaker.open_duration_seconds', 300);

        $fails = (int) Cache::increment($this->failKey($companyId));
        Cache::put($this->failKey($companyId), $fails, now()->addMinutes(15));

        if ($fails >= $threshold) {
            Cache::put($this->openKey($companyId), now()->addSeconds($cooldown)->toIso8601String(), $cooldown);
        }
    }

    public function state(string $companyId): string
    {
        $openUntil = Cache::get($this->openKey($companyId));
        if (!$openUntil) {
            return 'closed';
        }
        if (now()->greaterThan($openUntil)) {
            // cooldown elapsed → half-open: clear the open marker, keep fail count
            Cache::forget($this->openKey($companyId));
            return 'half_open';
        }
        return 'open';
    }

    public function reset(string $companyId): void
    {
        Cache::forget($this->failKey($companyId));
        Cache::forget($this->openKey($companyId));
    }

    private function failKey(string $companyId): string
    {
        return "etims:cb:fails:{$companyId}";
    }

    private function openKey(string $companyId): string
    {
        return "etims:cb:open_until:{$companyId}";
    }
}
