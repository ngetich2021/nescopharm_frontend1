<?php

namespace App\Services\TaxCompliance\DTOs;

/**
 * Outcome of a sale-submission attempt at the regulator.
 *
 * For synchronous regulators (rare), `status` = 'completed' immediately.
 * For DigiTax/eTIMS, `status` = 'pending' until the webhook arrives with
 * signature + QR. `clientRequestId` is the idempotency anchor that lets
 * the webhook resolve back to the originating invoice.
 */
final class SaleSubmission
{
    public function __construct(
        public readonly string $status,           // 'pending' | 'completed' | 'failed' | 'response_invalid'
        public readonly ?string $regulatorSaleId, // DigiTax's sale identifier
        public readonly string $clientRequestId,  // Our UUID, stored on invoice
        public readonly ?string $signature = null,
        public readonly ?string $qrUrl = null,
        public readonly ?string $traderInvoiceNumber = null,
        public readonly ?string $errorMessage = null,
        public readonly ?int $statusCode = null,
        public readonly ?int $latencyMs = null,
        public readonly array $raw = [],
    ) {}

    public static function pending(string $clientRequestId, ?string $regulatorSaleId, int $latencyMs, array $raw = []): self
    {
        return new self(
            status: 'pending',
            regulatorSaleId: $regulatorSaleId,
            clientRequestId: $clientRequestId,
            latencyMs: $latencyMs,
            raw: $raw,
        );
    }

    public static function completed(
        string $clientRequestId,
        ?string $regulatorSaleId,
        ?string $signature,
        ?string $qrUrl,
        ?string $traderInvoiceNumber,
        int $latencyMs = 0,
        array $raw = [],
    ): self {
        return new self(
            status: 'completed',
            regulatorSaleId: $regulatorSaleId,
            clientRequestId: $clientRequestId,
            signature: $signature,
            qrUrl: $qrUrl,
            traderInvoiceNumber: $traderInvoiceNumber,
            latencyMs: $latencyMs,
            raw: $raw,
        );
    }

    public static function failed(string $clientRequestId, string $message, ?int $statusCode = null, int $latencyMs = 0, array $raw = []): self
    {
        return new self(
            status: 'failed',
            regulatorSaleId: null,
            clientRequestId: $clientRequestId,
            errorMessage: $message,
            statusCode: $statusCode,
            latencyMs: $latencyMs,
            raw: $raw,
        );
    }

    public static function invalidResponse(string $clientRequestId, string $message, int $latencyMs = 0, array $raw = []): self
    {
        return new self(
            status: 'response_invalid',
            regulatorSaleId: null,
            clientRequestId: $clientRequestId,
            errorMessage: $message,
            latencyMs: $latencyMs,
            raw: $raw,
        );
    }
}
