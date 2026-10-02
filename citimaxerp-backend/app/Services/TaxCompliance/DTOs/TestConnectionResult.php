<?php

namespace App\Services\TaxCompliance\DTOs;

/**
 * Outcome of a cheap probe against the regulator/integrator to verify credentials.
 */
final class TestConnectionResult
{
    public function __construct(
        public readonly bool $success,
        public readonly string $message,
        public readonly ?int $statusCode = null,
        public readonly ?int $latencyMs = null,
        public readonly array $diagnostics = [],
    ) {}

    public static function ok(string $message, ?int $latencyMs = null, array $diagnostics = []): self
    {
        return new self(true, $message, 200, $latencyMs, $diagnostics);
    }

    public static function failure(string $message, ?int $statusCode = null, array $diagnostics = []): self
    {
        return new self(false, $message, $statusCode, null, $diagnostics);
    }
}
