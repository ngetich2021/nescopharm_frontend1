<?php

namespace App\Services\TaxCompliance\DTOs;

final class ItemRegistrationResult
{
    public function __construct(
        public readonly string $status,           // 'pending' | 'synced' | 'failed'
        public readonly string $clientRequestId,
        public readonly ?string $regulatorItemCode = null,
        public readonly ?string $errorMessage = null,
        public readonly ?int $statusCode = null,
        public readonly int $latencyMs = 0,
        public readonly array $raw = [],
    ) {}

    public static function pending(string $clientRequestId, ?string $regulatorItemCode, int $latencyMs, array $raw = []): self
    {
        return new self('pending', $clientRequestId, $regulatorItemCode, null, null, $latencyMs, $raw);
    }

    public static function synced(string $clientRequestId, string $regulatorItemCode, int $latencyMs, array $raw = []): self
    {
        return new self('synced', $clientRequestId, $regulatorItemCode, null, null, $latencyMs, $raw);
    }

    public static function failed(string $clientRequestId, string $message, ?int $statusCode, int $latencyMs, array $raw = []): self
    {
        return new self('failed', $clientRequestId, null, $message, $statusCode, $latencyMs, $raw);
    }
}
