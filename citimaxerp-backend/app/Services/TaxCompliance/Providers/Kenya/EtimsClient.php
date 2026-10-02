<?php

namespace App\Services\TaxCompliance\Providers\Kenya;

use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsSubmissionLog;
use App\Services\TaxCompliance\Encryption\EnvelopeEncryptionService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use RuntimeException;

/**
 * Per-company DigiTax HTTP wrapper.
 *
 * Responsibilities:
 *   - Resolve API key from the encrypted config (held in memory only for the call)
 *   - Env-mismatch boot guard (refuses live calls from non-prod app env)
 *   - Per-company Redis rate limiter (≤10 req/s to respect KRA OSCU caps)
 *   - Inject X-Client-Request-Id for idempotency + webhook correlation
 *   - Emit envelope-encrypted submission logs (request + response)
 *   - Map HTTP status to result_status for the audit row
 *
 * Caller owns: request body shape, business logic, retry orchestration.
 */
class EtimsClient
{
    public function __construct(
        private readonly EnvelopeEncryptionService $encryption,
    ) {}

    /**
     * @param array<string, mixed> $body
     */
    public function post(
        CompanyEtimsConfig $config,
        string $endpoint,
        array $body,
        string $clientRequestId,
        string $operation,
        ?string $subjectType = null,
        ?string $subjectId = null,
    ): Response {
        $this->guardEnv($config);
        $this->rateLimit($config);

        $url = rtrim($this->baseUrl($config), '/') . '/' . ltrim($endpoint, '/');
        $started = microtime(true);

        $resultStatus = EtimsSubmissionLog::FAILED;
        $response = null;
        $exception = null;

        try {
            $response = $this->http($config, $clientRequestId)->post($url, $body);
            $resultStatus = $response->successful() ? EtimsSubmissionLog::OK : EtimsSubmissionLog::FAILED;
        } catch (ConnectionException $e) {
            $exception = $e;
            $resultStatus = EtimsSubmissionLog::TIMEOUT;
        } catch (\Throwable $e) {
            $exception = $e;
            $resultStatus = EtimsSubmissionLog::FAILED;
        }

        $latencyMs = (int) ((microtime(true) - $started) * 1000);

        $this->logSubmission(
            config: $config,
            operation: $operation,
            subjectType: $subjectType,
            subjectId: $subjectId,
            clientRequestId: $clientRequestId,
            endpoint: $endpoint,
            method: 'POST',
            requestBody: $body,
            response: $response,
            resultStatus: $resultStatus,
            latencyMs: $latencyMs,
            exception: $exception,
        );

        if ($exception) {
            // Re-throw so the caller can mark the subject failed appropriately.
            throw $exception;
        }

        /** @var Response $response - guaranteed non-null when no exception */
        return $response;
    }

    /**
     * GET helper used by testConnection + verify endpoints.
     */
    public function get(
        CompanyEtimsConfig $config,
        string $endpoint,
        array $query = [],
        ?string $operation = null,
        ?string $clientRequestId = null,
    ): Response {
        $this->guardEnv($config);
        $this->rateLimit($config);

        $url = rtrim($this->baseUrl($config), '/') . '/' . ltrim($endpoint, '/');
        $started = microtime(true);

        $response = $this->http($config, $clientRequestId ?? '')->get($url, $query);
        $latencyMs = (int) ((microtime(true) - $started) * 1000);

        if ($operation) {
            $this->logSubmission(
                config: $config,
                operation: $operation,
                subjectType: null,
                subjectId: null,
                clientRequestId: $clientRequestId,
                endpoint: $endpoint,
                method: 'GET',
                requestBody: $query,
                response: $response,
                resultStatus: $response->successful() ? EtimsSubmissionLog::OK : EtimsSubmissionLog::FAILED,
                latencyMs: $latencyMs,
                exception: null,
            );
        }

        return $response;
    }

    // ─────────── internals ───────────

    private function http(CompanyEtimsConfig $config, string $clientRequestId): PendingRequest
    {
        $apiKey = $config->getApiKey();   // briefly resident in memory

        $headers = [
            'X-API-Key' => $apiKey,
            'Accept' => 'application/json',
        ];

        if ($clientRequestId !== '') {
            $headers['X-Client-Request-Id'] = $clientRequestId;
        }

        return Http::withHeaders($headers)
            ->timeout(config('tax_compliance.etims.http_timeout_seconds', 30))
            ->acceptJson()
            ->asJson();
    }

    private function baseUrl(CompanyEtimsConfig $config): string
    {
        return $config->environment === 'live'
            ? config('tax_compliance.etims.base_url_live')
            : config('tax_compliance.etims.base_url_test');
    }

    /**
     * Env boot guard: refuse 'live' calls from non-production app env.
     * Prevents accidentally pushing dev data to KRA Live.
     */
    private function guardEnv(CompanyEtimsConfig $config): void
    {
        if ($config->environment === 'live' && !app()->environment('production')) {
            throw new RuntimeException(
                'Refusing to call DigiTax live from non-production app env. '
                . 'Set the company eTIMS config environment to test for development.',
            );
        }
    }

    /**
     * Per-company Redis throttle. ≤10 req/s default - well within KRA's OSCU caps.
     * Falls open if Redis isn't configured (dev environments).
     */
    private function rateLimit(CompanyEtimsConfig $config): void
    {
        $allowance = (int) config('tax_compliance.etims.rate_limit_per_second', 10);
        $key = "etims:rate:{$config->company_id}";

        try {
            Redis::throttle($key)
                ->allow($allowance)
                ->every(1)
                ->then(fn() => null, function () use ($config) {
                    // Throttled - sleep a beat and retry once by rethrowing as a 429-like
                    throw new RuntimeException("eTIMS rate limit exceeded for company {$config->company_id}");
                });
        } catch (\Throwable $e) {
            // If Redis is unavailable, fall open with a debug log
            if (!str_contains($e->getMessage(), 'rate limit exceeded')) {
                Log::debug('eTIMS rate limiter fell open', ['error' => $e->getMessage()]);
                return;
            }
            throw $e;
        }
    }

    private function logSubmission(
        CompanyEtimsConfig $config,
        string $operation,
        ?string $subjectType,
        ?string $subjectId,
        ?string $clientRequestId,
        string $endpoint,
        string $method,
        array $requestBody,
        ?Response $response,
        string $resultStatus,
        int $latencyMs,
        ?\Throwable $exception,
    ): void {
        try {
            $requestJson = json_encode($requestBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $responseJson = $response ? $response->body() : ($exception ? json_encode(['exception' => $exception::class, 'message' => $exception->getMessage()]) : null);

            $requestEnc = $requestJson ? $this->packEncrypted($requestJson) : null;
            $responseEnc = $responseJson ? $this->packEncrypted($responseJson) : null;

            EtimsSubmissionLog::create([
                'company_id' => $config->company_id,
                'operation' => $operation,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'client_request_id' => $clientRequestId,
                'request_body_encrypted' => $requestEnc,
                'response_body_encrypted' => $responseEnc,
                'endpoint' => $endpoint,
                'http_method' => $method,
                'status_code' => $response?->status(),
                'result_status' => $resultStatus,
                'latency_ms' => $latencyMs,
                'actor_user_id' => Auth::id(),
                'request_hash' => $requestJson ? hash('sha256', $requestJson) : null,
            ]);
        } catch (\Throwable $e) {
            // Audit logging MUST NOT block business flow. Log + continue.
            Log::error('Failed to persist eTIMS submission log', [
                'company_id' => $config->company_id,
                'operation' => $operation,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Wrap a payload using the envelope-encryption service. Format matches
     * CompanyEtimsConfig::packEnvelope so the same decryption path works.
     */
    private function packEncrypted(string $plaintext): string
    {
        $enc = $this->encryption->encryptFresh($plaintext);
        return implode('|', [
            'v1',
            $enc['data_key_encrypted'],
            $enc['iv'],
            $enc['tag'],
            $enc['ciphertext'],
        ]);
    }
}
