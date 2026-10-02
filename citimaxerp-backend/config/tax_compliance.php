<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Envelope encryption
    |--------------------------------------------------------------------------
    |
    | The Key-Encryption-Key (KEK) wraps per-company Data-Encryption-Keys (DEKs).
    | DEKs encrypt regulator credentials (DigiTax X-API-Key, callback secret, etc.)
    | with AES-256-GCM. If a single KEK leaks we rotate it without touching DEKs.
    |
    | In production, the KEK should come from a managed secrets store (Laravel
    | Cloud Secrets Manager, AWS KMS, GCP KMS). Local dev falls back to APP_KEY
    | to keep onboarding simple - never use APP_KEY-derived KEK in production.
    |
    */
    'kek' => [
        // Base64-encoded 32-byte KEK. Required in production.
        'value' => env('TAX_COMPLIANCE_KEK'),

        // Set true to derive a KEK from APP_KEY (dev only).
        'derive_from_app_key_in_dev' => env('TAX_COMPLIANCE_KEK_DERIVE_DEV', true),

        // Key version identifier for rotation support.
        'version' => env('TAX_COMPLIANCE_KEK_VERSION', 'v1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Kenya eTIMS via DigiTax
    |--------------------------------------------------------------------------
    */
    'etims' => [
        // DigiTax uses the same v2 API host for TEST and LIVE businesses; the
        // X-API-Key determines which environment receives the transaction.
        'base_url_test' => env('ETIMS_BASE_URL_TEST', 'https://api.digitax.tech/ke/v2'),
        'base_url_live' => env('ETIMS_BASE_URL_LIVE', 'https://api.digitax.tech/ke/v2'),

        // Per-company Redis rate limit (per second)
        'rate_limit_per_second' => env('ETIMS_RATE_LIMIT', 10),

        // Circuit breaker thresholds
        'circuit_breaker' => [
            'failure_threshold' => env('ETIMS_CB_FAILURES', 5),
            'open_duration_seconds' => env('ETIMS_CB_OPEN_DURATION', 300),
        ],

        // Stuck-lock reaper
        'reaper' => [
            'lock_timeout_minutes' => env('ETIMS_LOCK_TIMEOUT_MIN', 15),
            'reap_interval_minutes' => env('ETIMS_REAP_INTERVAL_MIN', 5),
        ],

        // HTTP timeouts
        'http_timeout_seconds' => env('ETIMS_HTTP_TIMEOUT', 30),

        // DigiTax documents callback_url as optional. Keep it disabled by
        // default because some DigiTax environments reject otherwise-valid
        // public HTTPS callback URLs. Queue/status polling remains authoritative.
        'callbacks_enabled' => env('ETIMS_CALLBACKS_ENABLED', false),

        // Webhook security
        'webhook' => [
            'timestamp_window_seconds' => 300,   // reject events older than 5 min
            'replay_block_days' => 7,            // event_id uniqueness window
        ],
    ],
];
