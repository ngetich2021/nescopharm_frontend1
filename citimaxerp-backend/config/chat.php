<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Meta Chat Configuration
// ...existing code before platforms...
/*
|--------------------------------------------------------------------------
| Platforms Configuration
|--------------------------------------------------------------------------
|
| WhatsApp Business API, Instagram Messaging, and Messenger Platform
|
*/
'platforms' => [
    'whatsapp' => [
        'api_version' => 'v18.0',
        'base_url' => 'https://graph.facebook.com',
        'supported_message_types' => [
            'text', 'image', 'video', 'audio', 'document', 
            'location', 'contact', 'sticker', 'template', 'interactive'
        ],
        'max_file_size' => 64 * 1024 * 1024, // 64MB
        'supported_media_types' => [
            'image' => ['jpeg', 'jpg', 'png', 'webp'],
            'video' => ['mp4', '3gp'],
            'audio' => ['aac', 'mp3', 'amr', 'ogg'],
            'document' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
        ],
    ],
    'instagram' => [
        'api_version' => 'v18.0',
        'base_url' => 'https://graph.facebook.com',
        'supported_message_types' => [
            'text', 'image', 'video', 'audio', 'file'
        ],
        'max_file_size' => 25 * 1024 * 1024, // 25MB
        'supported_media_types' => [
            'image' => ['jpeg', 'jpg', 'png', 'gif'],
            'video' => ['mp4'],
            'audio' => ['aac', 'mp3'],
            'file' => ['pdf', 'doc', 'docx'],
        ],
    ],
    'messenger' => [
        'api_version' => 'v18.0',
        'base_url' => 'https://graph.facebook.com',
        'supported_message_types' => [
            'text', 'image', 'video', 'audio', 'file', 'template', 'interactive'
        ],
        'max_file_size' => 25 * 1024 * 1024, // 25MB
        'supported_media_types' => [
            'image' => ['jpeg', 'jpg', 'png', 'gif'],
            'video' => ['mp4'],
            'audio' => ['aac', 'mp3'],
            'file' => ['pdf', 'doc', 'docx', 'txt'],
        ],
    ],
],

// ...existing code after platforms...
/*
|--------------------------------------------------------------------------
| Platforms Configuration
|--------------------------------------------------------------------------
|
| WhatsApp Business API, Instagram Messaging, and Messenger Platform
|
*/
'platforms' => [
    'whatsapp' => [
        'api_version' => 'v18.0',
        'base_url' => 'https://graph.facebook.com',
        'supported_message_types' => [
            'text', 'image', 'video', 'audio', 'document', 
            'location', 'contact', 'sticker', 'template', 'interactive'
        ],
        'max_file_size' => 64 * 1024 * 1024, // 64MB
        'supported_media_types' => [
            'image' => ['jpeg', 'jpg', 'png', 'webp'],
            'video' => ['mp4', '3gp'],
        ],
    ],

    'instagram' => [
        'api_version' => 'v18.0',
        'base_url' => 'https://graph.facebook.com',
        'supported_message_types' => [
            'text', 'image', 'video', 'audio', 'file'
        ],
        'max_file_size' => 25 * 1024 * 1024, // 25MB
        'supported_media_types' => [
            'image' => ['jpeg', 'jpg', 'png', 'gif'],
            'video' => ['mp4'],
            'audio' => ['aac', 'mp3'],
            'file' => ['pdf', 'doc', 'docx'],
        ],
    ],

    'messenger' => [
        'api_version' => 'v18.0',
        'base_url' => 'https://graph.facebook.com',
        'supported_message_types' => [
            'text', 'image', 'video', 'audio', 'file', 'template', 'interactive'
        ],
        'max_file_size' => 25 * 1024 * 1024, // 25MB
        'supported_media_types' => [
            'image' => ['jpeg', 'jpg', 'png', 'gif'],
            'video' => ['mp4'],
            'audio' => ['aac', 'mp3'],
            'file' => ['pdf', 'doc', 'docx', 'txt'],
        ],
    ],
],

    /*
    |--------------------------------------------------------------------------
    | Message Settings
    |--------------------------------------------------------------------------
    */
    'messages' => [
        'max_text_length' => 4096,
        'max_caption_length' => 1024,
        'customer_service_window_hours' => 24,
        'auto_mark_as_read' => true,
        'enable_typing_indicators' => true,
        'enable_read_receipts' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Template Settings
    |--------------------------------------------------------------------------
    */
    'templates' => [
        'categories' => [
            'marketing' => 'Marketing Messages',
            'utility' => 'Utility Messages',
            'authentication' => 'Authentication Messages',
            'general' => 'General Messages',
        ],
        'types' => [
            'text' => 'Text Only',
            'media' => 'Media (Image/Video)',
            'interactive' => 'Interactive Buttons',
            'list' => 'List Selection',
            'button' => 'Call-to-Action Buttons',
        ],
        'max_variables' => 10,
        'variable_pattern' => '/\{\{([^}]+)\}\}/',
    ],

    /*
    |--------------------------------------------------------------------------
    | Webhook Settings
    |--------------------------------------------------------------------------
    */
    'webhooks' => [
        'verify_signature' => env('CHAT_WEBHOOK_VERIFY_SIGNATURE', true),
        'log_payloads' => env('CHAT_WEBHOOK_LOG_PAYLOADS', true),
        'timeout_seconds' => 30,
        'retry_failed_webhooks' => true,
        'max_retries' => 3,
    ],

    /*
    |--------------------------------------------------------------------------
    | Storage Settings
    |--------------------------------------------------------------------------
    */
    'storage' => [
        'disk' => env('CHAT_STORAGE_DISK', 'public'),
        'media_path' => 'chat-media',
        'temp_path' => 'chat-temp',
        'cleanup_temp_files_after_hours' => 24,
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    */
    'rate_limits' => [
        'whatsapp' => [
            'messages_per_second' => 80,
            'burst_limit' => 200,
        ],
        'instagram' => [
            'messages_per_second' => 20,
            'burst_limit' => 100,
        ],
        'messenger' => [
            'messages_per_second' => 20,
            'burst_limit' => 100,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Settings
    |--------------------------------------------------------------------------
    */
    'security' => [
        'encrypt_credentials' => true,
        'credential_rotation_days' => 90,
        'webhook_ip_whitelist' => [
            '173.252.74.0/24',
            '173.252.124.0/24', 
            '173.252.70.0/24',
            '31.13.64.0/18',
            '31.13.24.0/21',
            '66.220.144.0/20',
            '69.63.176.0/20',
            '69.171.224.0/19',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Feature Flags
    |--------------------------------------------------------------------------
    */
    'features' => [
        'enable_ai_responses' => env('CHAT_ENABLE_AI_RESPONSES', false),
        'enable_auto_assignment' => env('CHAT_ENABLE_AUTO_ASSIGNMENT', true),
        'enable_conversation_routing' => env('CHAT_ENABLE_CONVERSATION_ROUTING', true),
        'enable_customer_matching' => env('CHAT_ENABLE_CUSTOMER_MATCHING', true),
        'enable_media_processing' => env('CHAT_ENABLE_MEDIA_PROCESSING', true),
        'enable_template_suggestions' => env('CHAT_ENABLE_TEMPLATE_SUGGESTIONS', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Default Values
    |--------------------------------------------------------------------------
    */
    'defaults' => [
        'conversation_timeout_hours' => 72,
        'auto_close_inactive_conversations' => true,
        'default_agent_status' => 'available',
        'max_conversations_per_agent' => 50,
        'notification_channels' => ['database', 'broadcast'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Media Handling Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for handling media attachments, file uploads, and downloads
    |
    */
    
    'media' => [
        'max_file_size' => env('CHAT_MAX_FILE_SIZE', 16 * 1024 * 1024), // 16MB default
        'allowed_mime_types' => [
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            // Videos
            'video/mp4', 'video/3gpp', 'video/quicktime',
            // Audio
            'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg',
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'text/csv',
        ],
        'storage_disk' => env('CHAT_MEDIA_DISK', 'public'),
        'storage_path' => 'chat-media',
        'auto_download_whatsapp_media' => env('CHAT_AUTO_DOWNLOAD_WHATSAPP_MEDIA', true),
        'generate_thumbnails' => env('CHAT_GENERATE_THUMBNAILS', false),
        'cleanup_old_files_days' => env('CHAT_CLEANUP_OLD_FILES_DAYS', 30),
    ],
];
