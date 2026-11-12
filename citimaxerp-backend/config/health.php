<?php

return [
    /*
     * Who gets the health emails, comma separated. When empty, the "health_alert_emails"
     * company setting ({"emails": ["a@b.com"]}) is used, so it can change without a redeploy.
     */
    'recipients' => array_values(array_filter(array_map('trim', explode(',', (string) env('HEALTH_ALERT_EMAILS', ''))))),

    // The live API as users reach it (through Cloudflare), so timeouts users see are caught.
    'api_url' => env('HEALTH_API_URL', 'https://citimax-main.laravel.cloud/api/system/health'),

    // The website users open.
    'website_url' => env('HEALTH_WEBSITE_URL', 'https://www.citimaxerp.com'),

    // A check slower than this counts as down (users would be getting timeouts).
    'timeout_seconds' => (int) env('HEALTH_TIMEOUT_SECONDS', 20),

    // While still down, repeat the alert this often.
    'repeat_minutes' => (int) env('HEALTH_REPEAT_MINUTES', 30),

    'timezone' => 'Africa/Nairobi',
];
