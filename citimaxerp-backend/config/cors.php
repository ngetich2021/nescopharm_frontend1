<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'], // allow all origins — you’re the boss

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'], // accept all headers

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false, // MUST be false when using '*'
];
