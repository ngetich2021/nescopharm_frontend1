<?php

namespace App\Models;

use App\Services\TaxCompliance\Encryption\EnvelopeEncryptionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Per-company eTIMS configuration for Kenyan tenants.
 *
 * Storage is two-tier (envelope encryption):
 *   - `data_key_encrypted`     KEK-wrapped Data-Encryption-Key
 *   - `api_key_ciphertext` + `api_key_iv` + `api_key_tag`   AES-256-GCM
 *   - `callback_secret_encrypted` (and previous, for rotation grace)
 *
 * Lifecycle:
 *   - environment starts as 'test'; flips to 'live' only with explicit user action
 *   - `live_first_submission_at` is set on first successful live submission and locks the environment
 *   - `superseded_at` set when re-onboarding (e.g. KRA PIN change creates a new config row)
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $kra_pin
 * @property string $branch_id
 * @property string $environment 'test' | 'live'
 * @property string|null $webhook_token Opaque CSPRNG token used in webhook URL
 * @property \Carbon\Carbon|null $go_live_date
 * @property bool $enabled
 */
class CompanyEtimsConfig extends Model
{
    protected $table = 'company_etims_configs';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'country_code',
        'kra_pin',
        'branch_id',
        'environment',
        'webhook_token',
        'go_live_date',
        'enabled',
        // Encrypted fields are written via setApiKey/setCallbackSecret, NOT mass assignment
    ];

    protected $hidden = [
        'data_key_encrypted',
        'api_key_ciphertext',
        'api_key_iv',
        'api_key_tag',
        'callback_secret_encrypted',
        'callback_secret_previous_encrypted',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'go_live_date' => 'date',
        'live_first_submission_at' => 'datetime',
        'callback_secret_previous_expires_at' => 'datetime',
        'superseded_at' => 'datetime',
        'last_sync_at' => 'datetime',
        'last_test_connection_at' => 'datetime',
    ];

    /**
     * PostgreSQL expects a native boolean expression. Persisting PHP booleans
     * through PDO can otherwise bind them as 0/1 integers.
     */
    public function setEnabledAttribute($value): void
    {
        $this->attributes['enabled'] = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    protected static function booted(): void
    {
        static::creating(function (self $config) {
            if (empty($config->id)) {
                $config->id = (string) Str::uuid();
            }
            if (empty($config->webhook_token)) {
                $config->webhook_token = self::generateWebhookToken();
            }
        });
    }

    // ─────────── Scopes ───────────

    public function scopeActive(Builder $q): Builder
    {
        return $q->whereNull('superseded_at')->whereRaw('enabled = true');
    }

    public function scopeNotSuperseded(Builder $q): Builder
    {
        return $q->whereNull('superseded_at');
    }

    // ─────────── Relations ───────────

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function supersededBy()
    {
        return $this->belongsTo(self::class, 'superseded_by_config_id');
    }

    // ─────────── Credentials ───────────

    /**
     * Set the DigiTax API key. Always generates a fresh DEK on credential change.
     */
    public function setApiKey(string $plaintext): void
    {
        $enc = app(EnvelopeEncryptionService::class)->encryptFresh($plaintext);

        $this->data_key_encrypted = $enc['data_key_encrypted'];
        $this->api_key_ciphertext = $enc['ciphertext'];
        $this->api_key_iv = $enc['iv'];
        $this->api_key_tag = $enc['tag'];
    }

    /**
     * Decrypt and return the DigiTax API key plaintext.
     * Caller must handle securely - log nothing, hold briefly.
     */
    public function getApiKey(): string
    {
        if (! $this->data_key_encrypted || ! $this->api_key_ciphertext) {
            throw new RuntimeException('No API key stored for company '.$this->company_id);
        }

        return app(EnvelopeEncryptionService::class)->decrypt(
            $this->data_key_encrypted,
            $this->api_key_ciphertext,
            $this->api_key_iv,
            $this->api_key_tag,
        );
    }

    public function hasApiKey(): bool
    {
        return ! empty($this->data_key_encrypted) && ! empty($this->api_key_ciphertext);
    }

    /**
     * Set the callback secret. Moves the existing one to `_previous` with 24h grace
     * so in-flight webhooks signed with the old secret still verify.
     */
    public function setCallbackSecret(string $plaintext): void
    {
        if (! empty($this->callback_secret_encrypted)) {
            $this->callback_secret_previous_encrypted = $this->callback_secret_encrypted;
            $this->callback_secret_previous_expires_at = now()->addHours(24);
        }

        $enc = app(EnvelopeEncryptionService::class)->encryptFresh($plaintext);

        // Repack into the existing DEK if possible - for simplicity, fresh DEK per secret.
        // Storage: a separate DEK per-secret is fine because the DEK is small.
        // We pack the 4 fields into one column (`v1:dek|iv|tag|cipher` base64).
        $this->callback_secret_encrypted = $this->packEnvelope($enc);
    }

    public function getCallbackSecret(): ?string
    {
        return $this->callback_secret_encrypted ? $this->unpackEnvelope($this->callback_secret_encrypted) : null;
    }

    /**
     * Return the previous callback secret if it hasn't expired (rotation grace).
     */
    public function getPreviousCallbackSecret(): ?string
    {
        if (! $this->callback_secret_previous_encrypted) {
            return null;
        }
        if (! $this->callback_secret_previous_expires_at || $this->callback_secret_previous_expires_at->isPast()) {
            return null;
        }

        return $this->unpackEnvelope($this->callback_secret_previous_encrypted);
    }

    public function rotateCallbackSecret(): string
    {
        $new = bin2hex(random_bytes(32));
        $this->setCallbackSecret($new);

        return $new;
    }

    // ─────────── Lifecycle ───────────

    public function isLiveEnvironmentLocked(): bool
    {
        return $this->environment === 'live' && $this->live_first_submission_at !== null;
    }

    public function markLiveSubmission(): void
    {
        if ($this->environment === 'live' && ! $this->live_first_submission_at) {
            $this->live_first_submission_at = now();
            $this->save();
        }
    }

    // ─────────── Helpers ───────────

    public static function generateWebhookToken(): string
    {
        // 32 random bytes = 256 bits of entropy, base64url-encoded
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    /**
     * KRA PIN validation: P + 9 digits + 1 uppercase letter.
     * e.g. P051234567Z
     */
    public static function isValidKraPin(string $pin): bool
    {
        return (bool) preg_match('/^P\d{9}[A-Z]$/', $pin);
    }

    private function packEnvelope(array $env): string
    {
        // Pipe-delimited so it stays a single column. Components are already base64.
        return implode('|', [
            'v1',
            $env['data_key_encrypted'],
            $env['iv'],
            $env['tag'],
            $env['ciphertext'],
        ]);
    }

    private function unpackEnvelope(string $packed): string
    {
        $parts = explode('|', $packed);
        if (count($parts) !== 5 || $parts[0] !== 'v1') {
            throw new RuntimeException('Malformed envelope payload');
        }

        return app(EnvelopeEncryptionService::class)->decrypt(
            $parts[1], // data_key_encrypted
            $parts[4], // ciphertext
            $parts[2], // iv
            $parts[3], // tag
        );
    }
}
