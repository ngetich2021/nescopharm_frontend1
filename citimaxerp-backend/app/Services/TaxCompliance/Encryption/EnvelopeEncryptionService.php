<?php

namespace App\Services\TaxCompliance\Encryption;

use App\Services\TaxCompliance\Exceptions\EncryptionConfigException;
use App\Services\TaxCompliance\Exceptions\EncryptionFailure;
use RuntimeException;

/**
 * Envelope encryption for per-company regulator credentials.
 *
 * Data-Encryption-Key (DEK): random 256-bit key generated per company.
 * Key-Encryption-Key (KEK):  stored in secrets manager; wraps the DEK.
 *
 * Storage layout (DigiTax X-API-Key example):
 *   data_key_encrypted          - KEK-wrapped DEK (base64)
 *   api_key_ciphertext          - DEK-encrypted plaintext (AES-256-GCM, base64)
 *   api_key_iv                  - GCM IV (base64)
 *   api_key_tag                 - GCM auth tag (base64)
 *
 * Rotation:
 *   - KEK rotation: re-wrap all DEKs with new KEK. Old KEK kept for grace period.
 *   - DEK rotation: re-encrypt secrets with fresh DEK, then re-wrap.
 *
 * Threat model:
 *   - APP_KEY leak alone does NOT compromise tenants (KEK is separate in prod).
 *   - KEK leak alone does NOT expose ciphertexts (DEKs needed too).
 *   - Both KEK + DB leak = compromise. KEK lives in secrets manager out of band.
 */
final class EnvelopeEncryptionService
{
    private const CIPHER = 'aes-256-gcm';
    private const KEY_BYTES = 32;   // 256-bit DEK
    private const IV_BYTES = 12;    // GCM standard
    private const TAG_BYTES = 16;

    /**
     * Generate a fresh DEK and wrap it with the configured KEK.
     *
     * @return array{data_key_encrypted: string} Base64-encoded wrapped DEK + metadata.
     */
    public function generateWrappedDek(): array
    {
        $dek = random_bytes(self::KEY_BYTES);
        return [
            'dek_plaintext' => $dek,
            'data_key_encrypted' => $this->wrapWithKek($dek),
        ];
    }

    /**
     * Encrypt a secret using a per-company DEK.
     *
     * @param  string  $plaintext  The secret to encrypt (e.g. DigiTax API key).
     * @param  string  $dekPlaintext  The unwrapped DEK bytes.
     * @return array{ciphertext: string, iv: string, tag: string}  All base64-encoded.
     */
    public function encryptWithDek(string $plaintext, string $dekPlaintext): array
    {
        $this->assertDek($dekPlaintext);

        $iv = random_bytes(self::IV_BYTES);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $dekPlaintext,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_BYTES
        );

        if ($ciphertext === false) {
            throw new EncryptionFailure('openssl_encrypt failed');
        }

        return [
            'ciphertext' => base64_encode($ciphertext),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
        ];
    }

    /**
     * Decrypt a secret. Unwraps the DEK, then decrypts the ciphertext.
     *
     * @param  string  $wrappedDek  base64 wrapped DEK from `data_key_encrypted` column
     * @param  string  $ciphertext  base64
     * @param  string  $iv          base64
     * @param  string  $tag         base64
     */
    public function decrypt(string $wrappedDek, string $ciphertext, string $iv, string $tag): string
    {
        $dek = $this->unwrapWithKek($wrappedDek);

        $plaintext = openssl_decrypt(
            base64_decode($ciphertext),
            self::CIPHER,
            $dek,
            OPENSSL_RAW_DATA,
            base64_decode($iv),
            base64_decode($tag)
        );

        if ($plaintext === false) {
            throw new EncryptionFailure('openssl_decrypt failed - wrong key, IV, tag, or ciphertext tampered with');
        }

        return $plaintext;
    }

    /**
     * Encrypt a secret with a freshly-wrapped DEK in one call.
     * Useful for first-time credential storage.
     *
     * @return array{data_key_encrypted: string, ciphertext: string, iv: string, tag: string}
     */
    public function encryptFresh(string $plaintext): array
    {
        $wrap = $this->generateWrappedDek();
        $enc = $this->encryptWithDek($plaintext, $wrap['dek_plaintext']);

        return [
            'data_key_encrypted' => $wrap['data_key_encrypted'],
            'ciphertext' => $enc['ciphertext'],
            'iv' => $enc['iv'],
            'tag' => $enc['tag'],
        ];
    }

    // ───────── KEK ─────────

    /** Returns the active KEK as raw bytes (32 bytes). */
    private function kek(): string
    {
        $configured = config('tax_compliance.kek.value');

        if ($configured) {
            $decoded = base64_decode($configured, true);
            if ($decoded === false || strlen($decoded) !== self::KEY_BYTES) {
                throw new EncryptionConfigException(
                    'TAX_COMPLIANCE_KEK must be base64-encoded 32 bytes'
                );
            }
            return $decoded;
        }

        if (
            app()->environment(['local', 'testing'])
            && config('tax_compliance.kek.derive_from_app_key_in_dev')
        ) {
            // Derive a stable 32-byte KEK from APP_KEY for local dev.
            // NEVER use this path in production - it negates envelope isolation.
            $appKey = config('app.key');
            if (!$appKey) {
                throw new EncryptionConfigException('APP_KEY is missing - cannot derive dev KEK');
            }
            $appKeyRaw = str_starts_with($appKey, 'base64:')
                ? base64_decode(substr($appKey, 7))
                : $appKey;
            return hash_hkdf('sha256', $appKeyRaw, self::KEY_BYTES, 'tax-compliance-kek-v1-dev');
        }

        throw new EncryptionConfigException(
            'TAX_COMPLIANCE_KEK is not configured. Set it in Laravel Cloud Secrets Manager '
            . '(base64-encoded 32 bytes) before enabling eTIMS in production.'
        );
    }

    /** Wrap a DEK with the KEK using AES-256-GCM. Returns base64 (iv|tag|ciphertext). */
    private function wrapWithKek(string $dek): string
    {
        $kek = $this->kek();
        $iv = random_bytes(self::IV_BYTES);
        $tag = '';

        $ciphertext = openssl_encrypt($dek, self::CIPHER, $kek, OPENSSL_RAW_DATA, $iv, $tag, '', self::TAG_BYTES);

        if ($ciphertext === false) {
            throw new EncryptionFailure('Failed to wrap DEK with KEK');
        }

        $version = config('tax_compliance.kek.version', 'v1');
        return $version . ':' . base64_encode($iv . $tag . $ciphertext);
    }

    /** Unwrap a wrapped DEK; throws if KEK version mismatches or auth tag fails. */
    private function unwrapWithKek(string $wrapped): string
    {
        if (!str_contains($wrapped, ':')) {
            throw new EncryptionFailure('Wrapped DEK is missing KEK version prefix');
        }

        [$version, $payload] = explode(':', $wrapped, 2);
        $currentVersion = config('tax_compliance.kek.version', 'v1');

        if ($version !== $currentVersion) {
            // Future: support a previous-version KEK for rotation grace.
            throw new EncryptionFailure("DEK was wrapped with KEK $version; current is $currentVersion. Rotation grace not yet implemented.");
        }

        $raw = base64_decode($payload, true);
        if ($raw === false || strlen($raw) < self::IV_BYTES + self::TAG_BYTES) {
            throw new EncryptionFailure('Wrapped DEK is malformed');
        }

        $iv = substr($raw, 0, self::IV_BYTES);
        $tag = substr($raw, self::IV_BYTES, self::TAG_BYTES);
        $ciphertext = substr($raw, self::IV_BYTES + self::TAG_BYTES);

        $dek = openssl_decrypt($ciphertext, self::CIPHER, $this->kek(), OPENSSL_RAW_DATA, $iv, $tag);

        if ($dek === false) {
            throw new EncryptionFailure('Failed to unwrap DEK - KEK mismatch or tampering');
        }

        return $dek;
    }

    private function assertDek(string $dek): void
    {
        if (strlen($dek) !== self::KEY_BYTES) {
            throw new RuntimeException('DEK must be exactly ' . self::KEY_BYTES . ' bytes');
        }
    }
}
