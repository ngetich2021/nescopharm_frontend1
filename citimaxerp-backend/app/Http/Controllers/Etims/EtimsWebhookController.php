<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsWebhookEvent;
use App\Services\TaxCompliance\EtimsItemSyncService;
use App\Services\TaxCompliance\EtimsSaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Inbound webhook from DigiTax. Opaque-token routing + replay block + dispatch.
 *
 * Security layers (all required):
 *   1. Opaque webhook_token in URL - 32-byte CSPRNG value, not enumerable.
 * DigiTax's documented v2 callbacks contain `event` and `data`, but do not
 * document signature/timestamp headers. If those headers are supplied we
 * validate them; otherwise the unguessable per-config URL token is the
 * authentication boundary. Exact duplicate bodies are de-duplicated by hash.
 */
class EtimsWebhookController extends Controller
{
    public function __construct(
        private readonly EtimsItemSyncService $itemSync,
        private readonly EtimsSaleService $saleSync,
    ) {}

    public function handle(Request $request, string $token): JsonResponse
    {
        $config = CompanyEtimsConfig::query()
            ->where('webhook_token', $token)
            ->notSuperseded()
            ->first();

        if (! $config) {
            return response()->json(['error' => 'not_found'], 404);
        }

        $signature = $request->header('X-Digitax-Signature');
        $timestamp = $request->header('X-Digitax-Timestamp');
        $eventId = $request->header('X-Digitax-Event-Id');

        $hasSignatureHeaders = $signature || $timestamp;
        if ($hasSignatureHeaders) {
            if (! $signature || ! $timestamp || ! $this->isWithinTimestampWindow($timestamp)
                || ! $this->verifySignature($config, $timestamp, $request->getContent(), $signature)) {
                Log::warning('eTIMS webhook signature verification failed', [
                    'company_id' => $config->company_id,
                    'token_prefix' => substr($token, 0, 8),
                    'event_id' => $eventId,
                ]);

                return response()->json(['error' => 'invalid_signature'], 401);
            }
        }

        $payload = $request->json()->all();
        $event = $payload['event'] ?? $payload['event_type'] ?? null;
        if (! $event) {
            return response()->json(['error' => 'missing_event'], 422);
        }
        $eventId ??= hash('sha256', $request->getContent());
        $clientRequestId = $payload['client_request_id'] ?? $request->header('X-Client-Request-Id');

        // Idempotency: dedup via unique (company_id, event_id)
        $existing = EtimsWebhookEvent::where('company_id', $config->company_id)
            ->where('event_id', $eventId)
            ->first();
        if ($existing) {
            return response()->json([
                'received' => true,
                'duplicate' => true,
                'event' => $event,
                'event_id' => $eventId,
            ]);
        }

        $row = EtimsWebhookEvent::create([
            'company_id' => $config->company_id,
            'event_id' => $eventId,
            'event_type' => (string) ($event ?? 'unknown'),
            'subject_type' => $this->subjectTypeForEvent($event),
            'subject_id' => $payload['subject_id'] ?? null,
            'client_request_id' => $clientRequestId,
            'processing_status' => EtimsWebhookEvent::RECEIVED,
            'payload' => $payload,
            'received_at' => now(),
        ]);

        try {
            $handled = $this->dispatchEvent($config->company_id, $event, $payload);
            $row->update([
                'processing_status' => $handled ? EtimsWebhookEvent::PROCESSED : EtimsWebhookEvent::IGNORED,
                'processed_at' => now(),
            ]);
        } catch (\Throwable $e) {
            $row->update([
                'processing_status' => EtimsWebhookEvent::FAILED,
                'last_error' => $e->getMessage(),
                'processed_at' => now(),
            ]);
            Log::error('eTIMS webhook handler error', [
                'company_id' => $config->company_id,
                'event' => $event,
                'event_id' => $eventId,
                'error' => $e->getMessage(),
            ]);
            // Still return 200 so DigiTax doesn't keep retrying - we have the row.
        }

        return response()->json([
            'received' => true,
            'event' => $event,
            'event_id' => $eventId,
        ]);
    }

    private function dispatchEvent(string $companyId, ?string $event, array $payload): bool
    {
        return match ($event) {
            'item.sync', 'item.registered' => $this->itemSync->applyWebhookCompletion($companyId, $payload),
            'sale.sync', 'sale.completed', 'sale.signed' => $this->saleSync->applyWebhookCompletion($companyId, $payload),
            'credit_note.sync', 'credit_note.completed' => $this->saleSync->applyWebhookCompletion($companyId, $payload),
            default => false,
        };
    }

    private function subjectTypeForEvent(?string $event): ?string
    {
        return match (true) {
            str_starts_with((string) $event, 'item.') => 'product',
            str_starts_with((string) $event, 'sale.'),
            str_starts_with((string) $event, 'credit_note.') => 'invoice',
            default => null,
        };
    }

    private function verifySignature(CompanyEtimsConfig $config, string $timestamp, string $body, string $providedSig): bool
    {
        $payload = $timestamp.'.'.$body;

        $current = $config->getCallbackSecret();
        if ($current && hash_equals(hash_hmac('sha256', $payload, $current), $providedSig)) {
            return true;
        }

        $previous = $config->getPreviousCallbackSecret();
        if ($previous && hash_equals(hash_hmac('sha256', $payload, $previous), $providedSig)) {
            return true;
        }

        return false;
    }

    private function isWithinTimestampWindow(string $timestamp): bool
    {
        $windowSeconds = (int) config('tax_compliance.etims.webhook.timestamp_window_seconds', 300);
        $eventTime = is_numeric($timestamp) ? (int) $timestamp : strtotime($timestamp);
        if (! $eventTime) {
            return false;
        }

        return abs(time() - $eventTime) <= $windowSeconds;
    }
}
