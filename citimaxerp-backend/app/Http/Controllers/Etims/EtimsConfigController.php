<?php

namespace App\Http\Controllers\Etims;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Etims\Concerns\ResolvesEtimsCompany;
use App\Models\CompanyEtimsConfig;
use App\Services\TaxCompliance\Exceptions\EncryptionConfigException;
use App\Services\TaxCompliance\Exceptions\EncryptionFailure;
use App\Services\TaxCompliance\TaxComplianceProviderRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Settings wizard backend for Kenya eTIMS configuration.
 *
 * Step 1 (identity):     PATCH /api/etims/config/identity
 * Step 2 (credentials):  PATCH /api/etims/config/credentials  (+ "Test Connection")
 *                        POST  /api/etims/config/test-connection
 * Step 3 (activation):   PATCH /api/etims/config/activation
 *
 * The "active" eTIMS config is the non-superseded row for the active company.
 * Re-onboarding (e.g. KRA PIN change after first submission) creates a new row
 * and supersedes the old via the `superseded_by_config_id` link.
 */
class EtimsConfigController extends Controller
{
    use ResolvesEtimsCompany;

    public function __construct(
        private readonly TaxComplianceProviderRegistry $registry,
    ) {}

    /**
     * Get the active config + wizard progress for the active company.
     */
    public function show(Request $request): JsonResponse
    {
        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $config = $this->activeConfigFor($companyId);

        return response()->json([
            'config' => $config ? $this->summarize($config) : null,
            'wizard' => $this->wizardProgress($config),
            'webhook_url' => $config ? $this->webhookUrlFor($config) : null,
        ]);
    }

    /**
     * Step 1 - Identity.
     */
    public function updateIdentity(Request $request): JsonResponse
    {
        abort_unless($this->canManageCompany($request, $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'country_code' => ['sometimes', Rule::in(['KE'])],
            'kra_pin' => ['required', 'string', 'regex:/^P\d{9}[A-Z]$/'],
            'branch_id' => ['nullable', 'string', 'max:10'],
        ], [
            'kra_pin.regex' => 'KRA PIN must be P followed by 9 digits and 1 uppercase letter (e.g. P051234567Z).',
        ]);

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $config = $this->upsertConfig($companyId);

        // KRA PIN immutability: cannot change after first live submission
        if ($config->isLiveEnvironmentLocked() && $config->kra_pin !== $data['kra_pin']) {
            throw ValidationException::withMessages([
                'kra_pin' => 'KRA PIN cannot be changed after a live submission has been made. Contact support for re-onboarding.',
            ]);
        }

        $config->name = $data['name'] ?? $config->name ?? 'DigiTax Kenya';
        $config->country_code = $data['country_code'] ?? $config->country_code ?? 'KE';
        $config->kra_pin = $data['kra_pin'];
        $config->branch_id = $data['branch_id'] ?? $config->branch_id ?: '00';
        $config->save();

        return response()->json([
            'config' => $this->summarize($config->fresh()),
            'wizard' => $this->wizardProgress($config),
        ]);
    }

    /**
     * Step 2 - Credentials. Sets the DigiTax API key (envelope-encrypted at rest)
     * and rotates the callback secret (returned once to the client to be configured
     * in DigiTax dashboard, never stored unencrypted).
     */
    public function updateCredentials(Request $request): JsonResponse
    {
        abort_unless($this->canManageCompany($request, $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $data = $request->validate([
            'digitax_api_key' => ['required', 'string', 'min:8'],
            'environment' => ['required', Rule::in(['test', 'live'])],
        ]);

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $config = $this->upsertConfig($companyId);

        if ($config->isLiveEnvironmentLocked() && $data['environment'] !== 'live') {
            throw ValidationException::withMessages([
                'environment' => 'Environment is locked to live after first live submission.',
            ]);
        }

        try {
            $config->setApiKey($data['digitax_api_key']);
            $config->environment = $data['environment'];

            // Rotate the callback secret on credential change. Client receives it once.
            $newCallbackSecret = $config->rotateCallbackSecret();
            $config->save();
        } catch (EncryptionConfigException $exception) {
            Log::critical('eTIMS credentials could not be encrypted because the production KEK is unavailable or invalid.', [
                'company_id' => $companyId,
                'environment' => app()->environment(),
                'exception' => $exception::class,
            ]);

            return response()->json([
                'status' => 'failed',
                'code' => 'ETIMS_ENCRYPTION_NOT_CONFIGURED',
                'message' => 'eTIMS credential encryption is not configured on this server. Ask the system administrator to configure TAX_COMPLIANCE_KEK and redeploy before saving credentials.',
            ], 503);
        } catch (EncryptionFailure $exception) {
            Log::error('eTIMS credential encryption failed.', [
                'company_id' => $companyId,
                'environment' => app()->environment(),
                'exception' => $exception::class,
            ]);

            return response()->json([
                'status' => 'failed',
                'code' => 'ETIMS_ENCRYPTION_FAILED',
                'message' => 'The server could not securely encrypt the eTIMS credentials. Verify the configured TAX_COMPLIANCE_KEK and try again.',
            ], 503);
        }

        return response()->json([
            'config' => $this->summarize($config->fresh()),
            'wizard' => $this->wizardProgress($config),
            'webhook_url' => $this->webhookUrlFor($config),
            'callback_secret' => $newCallbackSecret,  // shown ONCE - client must copy to DigiTax dashboard
            'callback_secret_notice' => 'Copy this secret into your DigiTax dashboard webhook configuration. It will not be shown again.',
        ]);
    }

    /**
     * "Test Connection" button - uses the provider to probe DigiTax.
     */
    public function testConnection(Request $request): JsonResponse
    {
        abort_unless($this->canManageCompany($request, $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $company = $this->resolveEtimsCompany($request);

        $provider = $this->registry->forCompany($company);
        $result = $provider->testConnection($company);

        return response()->json([
            'success' => $result->success,
            'message' => $result->message,
            'status_code' => $result->statusCode,
            'latency_ms' => $result->latencyMs,
            'diagnostics' => $result->diagnostics,
            'tested_at' => now()->toIso8601String(),
        ], $result->success ? 200 : 422);
    }

    /**
     * Step 3 - Activation. Enables the integration and sets go-live date.
     * Refuses to enable if the connection has never been successfully tested.
     */
    public function updateActivation(Request $request): JsonResponse
    {
        abort_unless($this->canManageCompany($request, $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'go_live_date' => ['required_if:enabled,true', 'nullable', 'date'],
        ]);

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $config = $this->activeConfigFor($companyId);

        if (! $config) {
            throw ValidationException::withMessages([
                'config' => 'Complete the Identity and Credentials steps first.',
            ]);
        }

        if ($data['enabled']) {
            // Enabling requires: PIN set, API key set, recent successful test
            if (! $config->kra_pin) {
                throw ValidationException::withMessages([
                    'kra_pin' => 'Set the KRA PIN before enabling eTIMS.',
                ]);
            }
            if (! $config->hasApiKey()) {
                throw ValidationException::withMessages([
                    'digitax_api_key' => 'Set the DigiTax API key before enabling eTIMS.',
                ]);
            }
            if ($config->last_test_connection_result !== 'success') {
                throw ValidationException::withMessages([
                    'test_connection' => 'Test Connection must succeed before enabling eTIMS.',
                ]);
            }
        }

        $config->enabled = $data['enabled'];
        $config->go_live_date = $data['go_live_date'] ?? $config->go_live_date;
        $config->save();

        return response()->json([
            'config' => $this->summarize($config->fresh()),
            'wizard' => $this->wizardProgress($config),
        ]);
    }

    /**
     * Regenerate the callback secret (e.g. user suspects it leaked).
     * Old secret retained for 24h grace so in-flight webhooks still verify.
     */
    public function regenerateCallbackSecret(Request $request): JsonResponse
    {
        abort_unless($this->canManageCompany($request, $this->resolveActiveCompanyId()), 403, 'Unauthorized');

        $companyId = (string) $this->resolveEtimsCompany($request)->id;
        $config = $this->activeConfigFor($companyId);

        if (! $config) {
            return response()->json(['message' => 'No eTIMS config to regenerate.'], 404);
        }

        $secret = $config->rotateCallbackSecret();
        $config->save();

        return response()->json([
            'callback_secret' => $secret,
            'webhook_url' => $this->webhookUrlFor($config),
            'notice' => 'Previous secret accepted for 24 hours to drain in-flight webhooks.',
        ]);
    }

    // ─────────── helpers ───────────

    private function summarize(CompanyEtimsConfig $config): array
    {
        return [
            'id' => $config->id,
            'name' => $config->name,
            'country_code' => $config->country_code,
            'kra_pin' => $config->kra_pin,
            'branch_id' => $config->branch_id,
            'environment' => $config->environment,
            'environment_locked' => $config->isLiveEnvironmentLocked(),
            'go_live_date' => $config->go_live_date?->toDateString(),
            'enabled' => $config->enabled,
            'has_api_key' => $config->hasApiKey(),
            'last_test_connection_at' => $config->last_test_connection_at?->toIso8601String(),
            'last_test_connection_result' => $config->last_test_connection_result,
            'last_sync_at' => $config->last_sync_at?->toIso8601String(),
            'last_error' => $config->last_error,
        ];
    }

    private function wizardProgress(?CompanyEtimsConfig $config): array
    {
        if (! $config) {
            return ['step' => 1, 'identity' => false, 'credentials' => false, 'activation' => false];
        }

        return [
            'step' => match (true) {
                ! $config->kra_pin => 1,
                ! $config->hasApiKey() || $config->last_test_connection_result !== 'success' => 2,
                ! $config->enabled => 3,
                default => 4,   // 4 = complete
            },
            'identity' => (bool) $config->kra_pin,
            'credentials' => $config->hasApiKey() && $config->last_test_connection_result === 'success',
            'activation' => $config->enabled,
        ];
    }

    private function webhookUrlFor(CompanyEtimsConfig $config): string
    {
        return url('/api/webhooks/etims/'.$config->webhook_token);
    }

    private function upsertConfig(string $companyId): CompanyEtimsConfig
    {
        $config = $this->activeConfigFor($companyId);
        if ($config) {
            return $config;
        }

        return CompanyEtimsConfig::create([
            'company_id' => $companyId,
            'name' => 'DigiTax Kenya',
            'country_code' => 'KE',
            'environment' => 'test',
            'branch_id' => '00',
            'enabled' => false,
        ]);
    }

    private function activeConfigFor(string $companyId): ?CompanyEtimsConfig
    {
        return CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->where('country_code', 'KE')
            ->notSuperseded()
            ->latest()
            ->first();
    }

    private function resolveActiveCompanyId(): string
    {
        // Defer to the existing multi-tenancy resolver. active_company_id() is the
        // canonical helper in this codebase.
        if (function_exists('active_company_id')) {
            $id = active_company_id();
            if ($id) {
                return (string) $id;
            }
        }
        $user = Auth::user();
        if ($user && $user->company_id) {
            return (string) $user->company_id;
        }
        abort(403, 'Cannot resolve active company for eTIMS config.');
    }
}
