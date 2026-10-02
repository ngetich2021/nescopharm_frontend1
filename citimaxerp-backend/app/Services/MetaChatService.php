<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Message;
use App\Models\MessageTemplate;
use App\Models\MetaPlatformCredential;
use App\Models\WebhookLog;
use App\Events\MessageReceived;
use App\Events\MessageStatusUpdated;
use App\Services\MediaAttachmentService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MetaChatService
{
    protected MediaAttachmentService $mediaService;

    public function __construct(MediaAttachmentService $mediaService)
    {
        $this->mediaService = $mediaService;
    }
    /**
     * Send a message via the appropriate Meta platform API
     */
    public function sendMessage(Conversation $conversation, Message $message): array
    {
        try {
            $credentials = $this->getCredentialsForConversation($conversation);
            
            if (!$credentials || !$credentials->isValid()) {
                return [
                    'success' => false,
                    'error' => 'Invalid or expired platform credentials',
                ];
            }

            switch ($conversation->platform) {
                case 'whatsapp':
                    return $this->sendWhatsAppMessage($conversation, $message, $credentials);
                case 'instagram':
                    return $this->sendInstagramMessage($conversation, $message, $credentials);
                case 'messenger':
                    return $this->sendMessengerMessage($conversation, $message, $credentials);
                default:
                    return [
                        'success' => false,
                        'error' => 'Unsupported platform: ' . $conversation->platform,
                    ];
            }
        } catch (\Exception $e) {
            Log::error('Failed to send message', [
                'conversation_id' => $conversation->id,
                'message_id' => $message->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Send WhatsApp message
     */
    private function sendWhatsAppMessage(Conversation $conversation, Message $message, MetaPlatformCredential $credentials): array
    {
        $url = "https://graph.facebook.com/v18.0/{$credentials->phone_number_id}/messages";
        
        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $conversation->platform_user_id,
        ];

        // Build message payload based on type
        switch ($message->message_type) {
            case 'text':
                $payload['type'] = 'text';
                $payload['text'] = [
                    'body' => $message->content,
                ];
                break;

            case 'image':
                $payload['type'] = 'image';
                $payload['image'] = [
                    'link' => $message->media_url,
                ];
                if ($message->caption) {
                    $payload['image']['caption'] = $message->caption;
                }
                break;

            case 'video':
                $payload['type'] = 'video';
                $payload['video'] = [
                    'link' => $message->media_url,
                ];
                if ($message->caption) {
                    $payload['video']['caption'] = $message->caption;
                }
                break;

            case 'audio':
                $payload['type'] = 'audio';
                $payload['audio'] = [
                    'link' => $message->media_url,
                ];
                break;

            case 'document':
                $payload['type'] = 'document';
                $payload['document'] = [
                    'link' => $message->media_url,
                ];
                if ($message->caption) {
                    $payload['document']['caption'] = $message->caption;
                }
                break;

            case 'template':
                $payload['type'] = 'template';
                
                // Get template data from rich_content
                if (isset($message->rich_content['template_id'])) {
                    $template = MessageTemplate::find($message->rich_content['template_id']);
                    if (!$template) {
                        return [
                            'success' => false,
                            'error' => 'Template not found',
                        ];
                    }

                    $templateVariables = $message->rich_content['variables'] ?? [];
                    
                    // Build WhatsApp template structure
                    $payload['template'] = [
                        'name' => $template->name,
                        'language' => [
                            'code' => $template->language_code ?? 'en_US',
                        ],
                    ];

                    // Add components for variables if any
                    if (!empty($templateVariables) && !empty($template->variables)) {
                        $payload['template']['components'] = [];
                        
                        // For text templates, add body component with parameters
                        if ($template->template_type === 'text') {
                            $parameters = [];
                            
                            // Map variables to WhatsApp parameters in order
                            foreach ($template->variables as $variableConfig) {
                                $variableName = $variableConfig['name'];
                                if (isset($templateVariables[$variableName])) {
                                    $parameters[] = [
                                        'type' => 'text',
                                        'text' => (string) $templateVariables[$variableName],
                                    ];
                                }
                            }
                            
                            if (!empty($parameters)) {
                                $payload['template']['components'][] = [
                                    'type' => 'body',
                                    'parameters' => $parameters,
                                ];
                            }
                        }
                    }
                } else {
                    return [
                        'success' => false,
                        'error' => 'Template data not found in message',
                    ];
                }
                break;

            default:
                return [
                    'success' => false,
                    'error' => 'Unsupported message type for WhatsApp: ' . $message->message_type,
                ];
        }

        // Add reply context if this is a reply
        if ($message->reply_to_message_id) {
            $replyMessage = Message::find($message->reply_to_message_id);
            if ($replyMessage && $replyMessage->platform_message_id) {
                $payload['context'] = [
                    'message_id' => $replyMessage->platform_message_id,
                ];
            }
        }

        // Log the payload for debugging
        Log::info('WhatsApp API Payload', [
            'url' => $url,
            'payload' => $payload,
            'message_id' => $message->id,
            'conversation_id' => $conversation->id,
        ]);

        $response = $this->makeApiCall($url, 'POST', $payload, $credentials->access_token);

        if ($response['success']) {
            return [
                'success' => true,
                'message_id' => $response['data']['messages'][0]['id'] ?? null,
                'platform_response' => $response['data'],
            ];
        }

        return [
            'success' => false,
            'error' => $response['error'],
        ];
    }

    /**
     * Send Instagram message
     */
    private function sendInstagramMessage(Conversation $conversation, Message $message, MetaPlatformCredential $credentials): array
    {
        $url = "https://graph.facebook.com/v18.0/{$credentials->page_id}/messages";
        
        $payload = [
            'recipient' => [
                'id' => $conversation->platform_user_id,
            ],
            'messaging_type' => 'RESPONSE',
        ];

        // Build message payload based on type
        switch ($message->message_type) {
            case 'text':
                $payload['message'] = [
                    'text' => $message->content,
                ];
                break;

            case 'image':
            case 'video':
            case 'audio':
            case 'document':
                $payload['message'] = [
                    'attachment' => [
                        'type' => $message->message_type === 'document' ? 'file' : $message->message_type,
                        'payload' => [
                            'url' => $message->media_url,
                        ],
                    ],
                ];
                break;

            default:
                return [
                    'success' => false,
                    'error' => 'Unsupported message type for Instagram: ' . $message->message_type,
                ];
        }

        $response = $this->makeApiCall($url, 'POST', $payload, $credentials->access_token);

        if ($response['success']) {
            return [
                'success' => true,
                'message_id' => $response['data']['message_id'] ?? null,
                'platform_response' => $response['data'],
            ];
        }

        return [
            'success' => false,
            'error' => $response['error'],
        ];
    }

    /**
     * Send Messenger message
     */
    private function sendMessengerMessage(Conversation $conversation, Message $message, MetaPlatformCredential $credentials): array
    {
        $url = "https://graph.facebook.com/v18.0/{$credentials->page_id}/messages";
        
        $payload = [
            'recipient' => [
                'id' => $conversation->platform_user_id,
            ],
            'messaging_type' => 'RESPONSE',
        ];

        // Build message payload based on type (similar to Instagram)
        switch ($message->message_type) {
            case 'text':
                $payload['message'] = [
                    'text' => $message->content,
                ];
                break;

            case 'image':
            case 'video':
            case 'audio':
            case 'document':
                $payload['message'] = [
                    'attachment' => [
                        'type' => $message->message_type === 'document' ? 'file' : $message->message_type,
                        'payload' => [
                            'url' => $message->media_url,
                        ],
                    ],
                ];
                break;

            case 'interactive':
                $payload['message'] = $message->rich_content;
                break;

            default:
                return [
                    'success' => false,
                    'error' => 'Unsupported message type for Messenger: ' . $message->message_type,
                ];
        }

        $response = $this->makeApiCall($url, 'POST', $payload, $credentials->access_token);

        if ($response['success']) {
            return [
                'success' => true,
                'message_id' => $response['data']['message_id'] ?? null,
                'platform_response' => $response['data'],
            ];
        }

        return [
            'success' => false,
            'error' => $response['error'],
        ];
    }

    /**
     * Process incoming webhook from Meta platforms
     */
    public function processWebhook(string $platform, array $payload, string $companyId): array
    {
        try {
            // Log the webhook
            WebhookLog::create([
                'company_id' => $companyId,
                'platform' => $platform,
                'webhook_type' => $payload['object'] ?? 'unknown',
                'payload' => json_encode($payload),
                'status' => 'received',
            ]);

            switch ($platform) {
                case 'whatsapp':
                    return $this->processWhatsAppWebhook($payload, $companyId);
                case 'instagram':
                    return $this->processInstagramWebhook($payload, $companyId);
                case 'messenger':
                    return $this->processMessengerWebhook($payload, $companyId);
                default:
                    return [
                        'success' => false,
                        'error' => 'Unsupported platform: ' . $platform,
                    ];
            }
        } catch (\Exception $e) {
            Log::error('Failed to process webhook', [
                'platform' => $platform,
                'company_id' => $companyId,
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Process WhatsApp webhook
     */
    private function processWhatsAppWebhook(array $payload, string $companyId): array
    {
        if (!isset($payload['entry'])) {
            return ['success' => false, 'error' => 'Invalid webhook payload'];
        }

        foreach ($payload['entry'] as $entry) {
            if (!isset($entry['changes'])) continue;

            foreach ($entry['changes'] as $change) {
                $field = $change['field'];
                $value = $change['value'];

                // Process different webhook types
                switch ($field) {
                    case 'messages':
                        // Process incoming messages
                        if (isset($value['messages'])) {
                            foreach ($value['messages'] as $messageData) {
                                $this->processIncomingWhatsAppMessage($messageData, $value['metadata'], $companyId);
                            }
                        }

                        // Process message statuses
                        if (isset($value['statuses'])) {
                            foreach ($value['statuses'] as $statusData) {
                                $this->processWhatsAppMessageStatus($statusData, $companyId);
                            }
                        }
                        break;

                    case 'message_template_status_update':
                        // Process template status updates
                        $this->processWhatsAppTemplateStatusUpdate($value, $companyId);
                        break;

                    default:
                        Log::info("Unhandled WhatsApp webhook field: {$field}", [
                            'company_id' => $companyId,
                            'value' => $value,
                        ]);
                        break;
                }
            }
        }

        return ['success' => true];
    }

    /**
     * Process Instagram webhook
     */
    private function processInstagramWebhook(array $payload, string $companyId): array
    {
        if (!isset($payload['entry'])) {
            return ['success' => false, 'error' => 'Invalid webhook payload'];
        }

        foreach ($payload['entry'] as $entry) {
            if (!isset($entry['messaging'])) continue;

            foreach ($entry['messaging'] as $messagingEvent) {
                if (isset($messagingEvent['message'])) {
                    $this->processIncomingInstagramMessage($messagingEvent, $companyId);
                }
                
                if (isset($messagingEvent['delivery'])) {
                    $this->processInstagramMessageDelivery($messagingEvent['delivery'], $companyId);
                }
                
                if (isset($messagingEvent['read'])) {
                    $this->processInstagramMessageRead($messagingEvent['read'], $companyId);
                }
            }
        }

        return ['success' => true];
    }

    /**
     * Process Messenger webhook
     */
    private function processMessengerWebhook(array $payload, string $companyId): array
    {
        // Similar to Instagram processing
        return $this->processInstagramWebhook($payload, $companyId);
    }

    /**
     * Process incoming WhatsApp message
     */
    private function processIncomingWhatsAppMessage(array $messageData, array $metadata, string $companyId): void
    {
        $phoneNumberId = $metadata['phone_number_id'];
        $customerPhone = $messageData['from'];
        $platformMessageId = $messageData['id'];

        // Find or create conversation
        $conversation = $this->findOrCreateConversation(
            $companyId,
            'whatsapp',
            $customerPhone,
            $customerPhone,
            [
                'phone_number_id' => $phoneNumberId,
                'display_phone_number' => $metadata['display_phone_number'] ?? null,
            ]
        );

        // Determine message type and content
        $messageType = 'text';
        $content = '';
        $mediaUrl = null;
        $mediaType = null;
        $caption = null;
        $platformMediaId = null;

        if (isset($messageData['text'])) {
            $content = $messageData['text']['body'];
        } elseif (isset($messageData['image'])) {
            $messageType = 'image';
            $platformMediaId = $messageData['image']['id'];
            $caption = $messageData['image']['caption'] ?? null;
            $content = $caption ?? '[Image]';
        } elseif (isset($messageData['video'])) {
            $messageType = 'video';
            $platformMediaId = $messageData['video']['id'];
            $caption = $messageData['video']['caption'] ?? null;
            $content = $caption ?? '[Video]';
        } elseif (isset($messageData['audio'])) {
            $messageType = 'audio';
            $platformMediaId = $messageData['audio']['id'];
            $content = '[Audio]';
        } elseif (isset($messageData['document'])) {
            $messageType = 'document';
            $platformMediaId = $messageData['document']['id'];
            $caption = $messageData['document']['caption'] ?? null;
            $filename = $messageData['document']['filename'] ?? 'document';
            $content = $caption ?? "[Document: {$filename}]";
        } elseif (isset($messageData['sticker'])) {
            $messageType = 'sticker';
            $platformMediaId = $messageData['sticker']['id'];
            $content = '[Sticker]';
        } elseif (isset($messageData['location'])) {
            $messageType = 'location';
            $content = "Location: {$messageData['location']['latitude']}, {$messageData['location']['longitude']}";
            // Store additional location data
            $locationData = [
                'latitude' => $messageData['location']['latitude'],
                'longitude' => $messageData['location']['longitude'],
                'name' => $messageData['location']['name'] ?? null,
                'address' => $messageData['location']['address'] ?? null,
            ];
        } elseif (isset($messageData['contacts'])) {
            $messageType = 'contact';
            $content = 'Contact shared';
            // Extract contact information
            $contactInfo = [];
            foreach ($messageData['contacts'] as $contact) {
                $contactInfo[] = [
                    'name' => $contact['name']['formatted_name'] ?? 'Unknown',
                    'phones' => $contact['phones'] ?? [],
                    'emails' => $contact['emails'] ?? [],
                ];
            }
            $content = 'Contact: ' . implode(', ', array_column($contactInfo, 'name'));
        } elseif (isset($messageData['interactive'])) {
            $messageType = 'interactive';
            $interactiveType = $messageData['interactive']['type'];
            
            switch ($interactiveType) {
                case 'button_reply':
                    $content = "Button: {$messageData['interactive']['button_reply']['title']}";
                    break;
                case 'list_reply':
                    $content = "List: {$messageData['interactive']['list_reply']['title']}";
                    break;
                case 'nfm_reply':
                    $content = "Form: {$messageData['interactive']['nfm_reply']['name']}";
                    break;
                default:
                    $content = "Interactive: {$interactiveType}";
                    break;
            }
        } elseif (isset($messageData['button'])) {
            $messageType = 'button';
            $content = "Button: {$messageData['button']['text']}";
        } elseif (isset($messageData['order'])) {
            $messageType = 'order';
            $content = "Order: {$messageData['order']['catalog_id']}";
        } elseif (isset($messageData['system'])) {
            $messageType = 'system';
            $content = "System: {$messageData['system']['body']}";
        } elseif (isset($messageData['reaction'])) {
            $messageType = 'reaction';
            $emoji = $messageData['reaction']['emoji'] ?? '👍';
            $messageId = $messageData['reaction']['message_id'];
            $content = "Reacted {$emoji} to message";
            
            // Find the original message and update it
            $originalMessage = Message::whereHas('conversation', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            })
            ->where('platform_message_id', $messageId)
            ->first();
            
            if ($originalMessage) {
                $reactions = $originalMessage->reactions ?? [];
                $reactions[] = [
                    'emoji' => $emoji,
                    'user_id' => $customerPhone,
                    'timestamp' => now()->toISOString(),
                ];
                $originalMessage->update(['reactions' => $reactions]);
            }
        } elseif (isset($messageData['errors'])) {
            $messageType = 'error';
            $content = "Error: {$messageData['errors'][0]['title']}";
        } elseif (isset($messageData['type']) && $messageData['type'] === 'unsupported') {
            $messageType = 'unsupported';
            $content = 'Unsupported message type';
        }

        // Create message record
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'platform_message_id' => $platformMessageId,
            'direction' => 'inbound',
            'sender_type' => 'customer',
            'sender_name' => $conversation->customer_name,
            'message_type' => $messageType,
            'content' => $content,
            'caption' => $caption,
            'status' => 'delivered',
            'delivered_at' => now(),
            'metadata' => $messageData,
        ]);

        // Handle media download if there's a platform media ID
        if ($platformMediaId && config('chat.media.auto_download_whatsapp_media', true)) {
            $this->downloadAndAttachMedia($message, $platformMediaId, $phoneNumberId, $companyId);
        }

        // Broadcast the incoming message event
        broadcast(new MessageReceived($message, $conversation));

        // Update conversation
        $conversation->updateLastMessageTime();
        $conversation->updateLastCustomerMessageTime();
        $conversation->incrementUnreadCount();
    }

    /**
     * Download and attach media for an incoming message
     */
    private function downloadAndAttachMedia(Message $message, string $platformMediaId, string $phoneNumberId, string $companyId): void
    {
        try {
            // Get credentials for this phone number
            $credentials = MetaPlatformCredential::where('company_id', $companyId)
                ->where('platform', 'whatsapp')
                ->where('phone_number_id', $phoneNumberId)
                ->where('is_active', true)
                ->first();

            if (!$credentials) {
                Log::warning('No credentials found for media download', [
                    'phone_number_id' => $phoneNumberId,
                    'company_id' => $companyId,
                    'platform_media_id' => $platformMediaId,
                ]);
                return;
            }

            // Download the media
            $downloadResult = $this->mediaService->downloadWhatsAppMedia($platformMediaId, $credentials);

            if ($downloadResult['success']) {
                // Create attachment record
                $attachment = $this->mediaService->createAttachment($message, $downloadResult);

                // Update message with media URL for quick access
                $message->update([
                    'media_url' => $attachment->file_url,
                    'media_type' => $attachment->mime_type,
                ]);

                Log::info('Successfully downloaded and attached media', [
                    'message_id' => $message->id,
                    'attachment_id' => $attachment->id,
                    'platform_media_id' => $platformMediaId,
                ]);
            } else {
                Log::error('Failed to download WhatsApp media', [
                    'message_id' => $message->id,
                    'platform_media_id' => $platformMediaId,
                    'error' => $downloadResult['error'],
                ]);

                // Update message to indicate download failure
                $message->update([
                    'metadata' => array_merge($message->metadata ?? [], [
                        'media_download_error' => $downloadResult['error'],
                        'media_download_attempted_at' => now()->toISOString(),
                    ]),
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Exception during media download', [
                'message_id' => $message->id,
                'platform_media_id' => $platformMediaId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Process WhatsApp message status
     */
    private function processWhatsAppMessageStatus(array $statusData, string $companyId): void
    {
        $platformMessageId = $statusData['id'];
        $status = $statusData['status']; // sent, delivered, read, failed

        $message = Message::whereHas('conversation', function ($q) use ($companyId) {
            $q->where('company_id', $companyId);
        })
        ->where('platform_message_id', $platformMessageId)
        ->first();

        if ($message) {
            $updateData = ['status' => $status];
            
            if ($status === 'delivered') {
                $updateData['delivered_at'] = now();
            } elseif ($status === 'read') {
                $updateData['read_at'] = now();
            } elseif ($status === 'failed') {
                $updateData['error_message'] = $statusData['errors'][0]['title'] ?? 'Message failed';
            }

            $message->update($updateData);
        }
    }

    /**
     * Process incoming Instagram message
     */
    private function processIncomingInstagramMessage(array $messagingEvent, string $companyId): void
    {
        $senderId = $messagingEvent['sender']['id'];
        $messageData = $messagingEvent['message'];
        $platformMessageId = $messageData['mid'];

        // Find or create conversation
        $conversation = $this->findOrCreateConversation(
            $companyId,
            'instagram',
            $senderId,
            $senderId
        );

        $messageType = 'text';
        $content = '';
        $mediaUrl = null;

        if (isset($messageData['text'])) {
            $content = $messageData['text'];
        } elseif (isset($messageData['attachments'])) {
            $attachment = $messageData['attachments'][0];
            $messageType = $attachment['type'];
            $mediaUrl = $attachment['payload']['url'] ?? null;
        }

        // Create message record
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'platform_message_id' => $platformMessageId,
            'direction' => 'inbound',
            'sender_type' => 'customer',
            'sender_name' => $conversation->customer_name,
            'message_type' => $messageType,
            'content' => $content,
            'media_url' => $mediaUrl,
            'status' => 'delivered',
            'delivered_at' => now(),
            'metadata' => $messageData,
        ]);

        // Broadcast the incoming message event
        broadcast(new MessageReceived($message, $conversation));

        // Update conversation
        $conversation->updateLastMessageTime();
        $conversation->updateLastCustomerMessageTime();
        $conversation->incrementUnreadCount();
    }

    /**
     * Find or create conversation with enhanced customer mapping
     */
    private function findOrCreateConversation(
        string $companyId,
        string $platform,
        string $platformConversationId,
        string $platformUserId,
        array $metadata = []
    ): Conversation {
        $conversation = Conversation::where('company_id', $companyId)
            ->where('platform', $platform)
            ->where('platform_conversation_id', $platformConversationId)
            ->first();

        if (!$conversation) {
            // Find or create customer with enhanced platform mapping
            $customer = $this->findOrCreateCustomerFromPlatform(
                $companyId, 
                $platform, 
                $platformUserId, 
                $metadata
            );

            $conversation = Conversation::create([
                'company_id' => $companyId,
                'customer_id' => $customer->id,
                'platform' => $platform,
                'platform_conversation_id' => $platformConversationId,
                'platform_user_id' => $platformUserId,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'customer_email' => $customer->email,
                'customer_profile_picture' => $this->getCustomerProfilePicture($platform, $platformUserId),
                'metadata' => $metadata,
                'status' => 'active',
            ]);

            // Log conversation creation
            $conversation->events()->create([
                'event_type' => 'conversation_created',
                'description' => "New {$platform} conversation created",
            ]);
        }

        return $conversation;
    }

    /**
     * Find or create customer from platform data
     */
    private function findOrCreateCustomerFromPlatform(
        string $companyId,
        string $platform,
        string $platformUserId,
        array $metadata = []
    ): Customer {
        $customer = null;

        // Try to find existing customer by platform-specific identifiers
        switch ($platform) {
            case 'whatsapp':
                // WhatsApp uses phone numbers
                $customer = Customer::where('company_id', $companyId)
                    ->where('phone', $platformUserId)
                    ->first();
                break;
                
            case 'instagram':
                // Instagram - check for existing customer with Instagram ID in metadata
                $customer = Customer::where('company_id', $companyId)
                    ->whereJsonContains('tags', ['instagram_id:' . $platformUserId])
                    ->first();
                    
                // Also try to find by Instagram username if available
                if (!$customer && isset($metadata['username'])) {
                    $customer = Customer::where('company_id', $companyId)
                        ->whereJsonContains('tags', ['instagram_username:' . $metadata['username']])
                        ->first();
                }
                break;
                
            case 'messenger':
                // Messenger - check for existing customer with PSID in metadata
                $customer = Customer::where('company_id', $companyId)
                    ->whereJsonContains('tags', ['messenger_psid:' . $platformUserId])
                    ->first();
                break;
        }

        if (!$customer) {
            // Create new customer from platform data
            $customer = $this->createCustomerFromPlatformData(
                $companyId,
                $platform,
                $platformUserId,
                $metadata
            );
        } else {
            // Update existing customer with new platform data
            $this->updateCustomerWithPlatformData($customer, $platform, $platformUserId, $metadata);
        }

        return $customer;
    }

    /**
     * Create new customer from platform data
     */
    private function createCustomerFromPlatformData(
        string $companyId,
        string $platform,
        string $platformUserId,
        array $metadata = []
    ): Customer {
        $customerData = [
            'company_id' => $companyId,
            'name' => $this->getCustomerNameFromPlatform($platform, $platformUserId, $metadata),
            'status' => 'active',
            'customer_type' => 'individual',
            'preferred_communication_channel' => $platform,
            'last_contact_date' => now(),
            'tags' => $this->generateCustomerTags($platform, $platformUserId, $metadata),
        ];

        // Set platform-specific fields
        switch ($platform) {
            case 'whatsapp':
                $customerData['phone'] = $platformUserId;
                break;
                
            case 'instagram':
                if (isset($metadata['username'])) {
                    $customerData['name'] = $metadata['username'];
                }
                break;
                
            case 'messenger':
                // Messenger customers are identified by PSID only
                if (isset($metadata['first_name'], $metadata['last_name'])) {
                    $customerData['name'] = $metadata['first_name'] . ' ' . $metadata['last_name'];
                }
                break;
        }

        return Customer::create($customerData);
    }

    /**
     * Update existing customer with platform data
     */
    private function updateCustomerWithPlatformData(
        Customer $customer,
        string $platform,
        string $platformUserId,
        array $metadata = []
    ): void {
        $updateData = [
            'last_contact_date' => now(),
        ];

        // Add platform-specific tags if not already present
        $newTags = $this->generateCustomerTags($platform, $platformUserId, $metadata);
        $existingTags = $customer->tags ?? [];
        
        $updateData['tags'] = array_unique(array_merge($existingTags, $newTags));

        // Update phone if WhatsApp and customer doesn't have one
        if ($platform === 'whatsapp' && !$customer->phone) {
            $updateData['phone'] = $platformUserId;
        }

        // Update preferred communication channel if not set
        if (!$customer->preferred_communication_channel) {
            $updateData['preferred_communication_channel'] = $platform;
        }

        $customer->update($updateData);
    }

    /**
     * Generate customer tags for platform identification
     */
    private function generateCustomerTags(string $platform, string $platformUserId, array $metadata = []): array
    {
        $tags = [];

        switch ($platform) {
            case 'whatsapp':
                $tags[] = 'whatsapp_user';
                $tags[] = 'whatsapp_phone:' . $platformUserId;
                break;
                
            case 'instagram':
                $tags[] = 'instagram_user';
                $tags[] = 'instagram_id:' . $platformUserId;
                if (isset($metadata['username'])) {
                    $tags[] = 'instagram_username:' . $metadata['username'];
                }
                break;
                
            case 'messenger':
                $tags[] = 'messenger_user';
                $tags[] = 'messenger_psid:' . $platformUserId;
                break;
        }

        return $tags;
    }

    /**
     * Get customer name from platform with enhanced data
     */
    private function getCustomerNameFromPlatform(string $platform, string $platformUserId, array $metadata = []): string
    {
        switch ($platform) {
            case 'whatsapp':
                // Try to get name from WhatsApp Business API profile
                return $metadata['profile_name'] ?? $metadata['display_name'] ?? "WhatsApp User ({$platformUserId})";
                
            case 'instagram':
                return $metadata['username'] ?? "Instagram User";
                
            case 'messenger':
                if (isset($metadata['first_name'], $metadata['last_name'])) {
                    return $metadata['first_name'] . ' ' . $metadata['last_name'];
                }
                return $metadata['first_name'] ?? "Messenger User";
                
            default:
                return "Unknown User";
        }
    }

    /**
     * Get customer profile picture from platform
     */
    private function getCustomerProfilePicture(string $platform, string $platformUserId): ?string
    {
        // This would fetch profile picture from platform APIs
        // For now, return null - implement platform-specific logic
        return null;
    }

    /**
     * Link customer across platforms
     */
    public function linkCustomerAcrossPlatforms(Customer $customer): void
    {
        // Find conversations from different platforms that might belong to same customer
        $conversations = Conversation::where('company_id', $customer->company_id)
            ->where('customer_id', '!=', $customer->id)
            ->where(function ($query) use ($customer) {
                // Link by phone number
                if ($customer->phone) {
                    $query->orWhere('customer_phone', $customer->phone);
                }
                
                // Link by email
                if ($customer->email) {
                    $query->orWhere('customer_email', $customer->email);
                }
                
                // Link by name (fuzzy matching)
                if ($customer->name) {
                    $query->orWhere('customer_name', 'LIKE', '%' . $customer->name . '%');
                }
            })
            ->get();

        foreach ($conversations as $conversation) {
            $conversation->update([
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_phone' => $customer->phone,
                'customer_email' => $customer->email,
            ]);
        }
    }

    /**
     * Get credentials for a conversation
     */
    private function getCredentialsForConversation(Conversation $conversation): ?MetaPlatformCredential
    {
        return MetaPlatformCredential::where('company_id', $conversation->company_id)
            ->where('platform', $conversation->platform)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Make API call to Meta platform
     */
    private function makeApiCall(string $url, string $method, array $payload, string $accessToken): array
    {
        try {
            $response = Http::withToken($accessToken)
                ->timeout(30)
                ->$method($url, $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json(),
                ];
            } else {
                $error = $response->json();
                return [
                    'success' => false,
                    'error' => $error['error']['message'] ?? 'API call failed',
                    'error_code' => $error['error']['code'] ?? null,
                    'details' => $error,
                ];
            }
        } catch (\Exception $e) {
            Log::error('Meta API call failed', [
                'url' => $url,
                'method' => $method,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Network error: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Process Instagram message delivery
     */
    private function processInstagramMessageDelivery(array $deliveryData, string $companyId): void
    {
        foreach ($deliveryData['mids'] as $mid) {
            $message = Message::whereHas('conversation', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            })
            ->where('platform_message_id', $mid)
            ->first();

            if ($message) {
                $message->update([
                    'status' => 'delivered',
                    'delivered_at' => now(),
                ]);
            }
        }
    }

    /**
     * Process Instagram message read
     */
    private function processInstagramMessageRead(array $readData, string $companyId): void
    {
        // Mark messages as read up to the watermark timestamp
        $watermark = $readData['watermark'];
        
        Message::whereHas('conversation', function ($q) use ($companyId) {
            $q->where('company_id', $companyId)->where('platform', 'instagram');
        })
        ->where('created_at', '<=', date('Y-m-d H:i:s', $watermark / 1000))
        ->where('direction', 'outbound')
        ->whereNull('read_at')
        ->update([
            'status' => 'read',
            'read_at' => now(),
        ]);
    }

    /**
     * Submit template to Meta platform for approval
     */
    public function submitTemplate(MessageTemplate $template): array
    {
        try {
            $credentials = MetaPlatformCredential::where('company_id', $template->company_id)
                ->where('platform', $template->platform)
                ->where('is_active', true)
                ->first();

            if (!$credentials) {
                return [
                    'success' => false,
                    'error' => 'No active credentials found for ' . $template->platform,
                ];
            }

            switch ($template->platform) {
                case 'whatsapp':
                    return $this->submitWhatsAppTemplate($template, $credentials);
                case 'instagram':
                    return $this->submitInstagramTemplate($template, $credentials);
                case 'messenger':
                    return $this->submitMessengerTemplate($template, $credentials);
                default:
                    return [
                        'success' => false,
                        'error' => 'Unsupported platform: ' . $template->platform,
                    ];
            }
        } catch (\Exception $e) {
            Log::error('Failed to submit template', [
                'template_id' => $template->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Submit WhatsApp template
     */
    private function submitWhatsAppTemplate(MessageTemplate $template, MetaPlatformCredential $credentials): array
    {
        $url = "https://graph.facebook.com/v18.0/{$credentials->business_account_id}/message_templates";
        
        $payload = [
            'name' => $template->name,
            'language' => $template->language_code,
            'category' => strtoupper($template->category),
            'components' => $this->buildWhatsAppTemplateComponents($template),
        ];

        $response = $this->makeApiCall($url, 'POST', $payload, $credentials->access_token);

        if ($response['success']) {
            $template->update([
                'platform_template_id' => $response['data']['id'],
                'approval_status' => 'pending',
            ]);

            return [
                'success' => true,
                'template_id' => $response['data']['id'],
                'status' => $response['data']['status'],
            ];
        }

        return $response;
    }

    /**
     * Submit Instagram template (placeholder)
     */
    private function submitInstagramTemplate(MessageTemplate $template, MetaPlatformCredential $credentials): array
    {
        // Instagram doesn't have template approval system like WhatsApp
        return [
            'success' => false,
            'error' => 'Instagram does not support template approval system',
        ];
    }

    /**
     * Submit Messenger template (placeholder)
     */
    private function submitMessengerTemplate(MessageTemplate $template, MetaPlatformCredential $credentials): array
    {
        // Messenger doesn't have template approval system like WhatsApp
        return [
            'success' => false,
            'error' => 'Messenger does not support template approval system',
        ];
    }

    /**
     * Build WhatsApp template components
     */
    private function buildWhatsAppTemplateComponents(MessageTemplate $template): array
    {
        $components = [];

        // Header component (if needed)
        if ($template->template_type === 'media') {
            $components[] = [
                'type' => 'HEADER',
                'format' => 'IMAGE', // or VIDEO, DOCUMENT
                'example' => [
                    'header_handle' => ['example_media_url'],
                ],
            ];
        }

        // Body component (required)
        $bodyText = $template->content;
        $variables = $template->variables ?? [];
        
        $components[] = [
            'type' => 'BODY',
            'text' => $bodyText,
            'example' => [
                'body_text' => [
                    array_map(function ($var) {
                        return 'example_' . $var;
                    }, $variables)
                ],
            ],
        ];

        // Footer component (optional)
        if (isset($template->rich_content['footer'])) {
            $components[] = [
                'type' => 'FOOTER',
                'text' => $template->rich_content['footer'],
            ];
        }

        // Buttons component (if interactive)
        if ($template->template_type === 'interactive' && isset($template->rich_content['buttons'])) {
            $buttons = [];
            foreach ($template->rich_content['buttons'] as $button) {
                $buttons[] = [
                    'type' => strtoupper($button['type']),
                    'text' => $button['text'],
                    'url' => $button['url'] ?? null,
                    'phone_number' => $button['phone_number'] ?? null,
                ];
            }
            
            $components[] = [
                'type' => 'BUTTONS',
                'buttons' => $buttons,
            ];
        }

        return $components;
    }

    /**
     * Create WhatsApp template via API
     */
    public function createWhatsAppTemplate(array $templateData, string $companyId): array
    {
        try {
            $credentials = MetaPlatformCredential::where('company_id', $companyId)
                ->where('platform', 'whatsapp')
                ->where('is_active', true)
                ->first();

            if (!$credentials) {
                return [
                    'success' => false,
                    'error' => 'No active WhatsApp credentials found',
                ];
            }

            // Build the API payload according to WhatsApp API specification
            $payload = [
                'name' => $templateData['name'],
                'language' => $templateData['language_code'] ?? 'en_US',
                'category' => strtoupper($templateData['category']),
                'components' => $this->buildWhatsAppTemplateComponentsFromData($templateData),
            ];

            // Add TTL if specified
            if (isset($templateData['message_send_ttl_seconds'])) {
                $payload['message_send_ttl_seconds'] = $templateData['message_send_ttl_seconds'];
            }

            // Add parameter format if specified
            if (isset($templateData['parameter_format'])) {
                $payload['parameter_format'] = $templateData['parameter_format'];
            }

            $url = "https://graph.facebook.com/v23.0/{$credentials->business_account_id}/message_templates";
            
            $response = $this->makeApiCall($url, 'POST', $payload, $credentials->access_token);

            if ($response['success']) {
                return [
                    'success' => true,
                    'platform_template_id' => $response['data']['id'],
                    'status' => $response['data']['status'],
                    'category' => $response['data']['category'],
                    'payload' => $payload, // For debugging
                ];
            }

            return $response;
        } catch (\Exception $e) {
            Log::error('Failed to create WhatsApp template', [
                'template_data' => $templateData,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Build WhatsApp template components from raw data
     */
    private function buildWhatsAppTemplateComponentsFromData(array $templateData): array
    {
        $components = [];

        // Header component
        if (isset($templateData['header'])) {
            $header = $templateData['header'];
            $headerComponent = [
                'type' => 'HEADER',
                'format' => strtoupper($header['format']),
            ];

            if ($header['format'] === 'TEXT') {
                $headerComponent['text'] = $header['text'];
                if (isset($header['example'])) {
                    $headerComponent['example'] = [
                        'header_text' => [$header['example']]
                    ];
                }
            } elseif (in_array($header['format'], ['IMAGE', 'VIDEO', 'DOCUMENT'])) {
                if (isset($header['example'])) {
                    $headerComponent['example'] = [
                        'header_handle' => [$header['example']]
                    ];
                }
            }

            $components[] = $headerComponent;
        }

        // Body component (required)
        $bodyComponent = [
            'type' => 'BODY',
            'text' => $templateData['content'],
        ];

        // Add body examples if variables are present
        if (isset($templateData['variables']) && !empty($templateData['variables'])) {
            $bodyComponent['example'] = [
                'body_text' => [
                    array_map(function ($var) {
                        return $var['example'] ?? 'example_' . $var['name'];
                    }, $templateData['variables'])
                ],
            ];
        }

        $components[] = $bodyComponent;

        // Footer component
        if (isset($templateData['footer'])) {
            $components[] = [
                'type' => 'FOOTER',
                'text' => $templateData['footer'],
            ];
        }

        // Buttons component
        if (isset($templateData['buttons']) && !empty($templateData['buttons'])) {
            $buttons = [];
            foreach ($templateData['buttons'] as $button) {
                $buttonComponent = [
                    'type' => strtoupper($button['type']),
                    'text' => $button['text'],
                ];

                switch ($button['type']) {
                    case 'URL':
                        $buttonComponent['url'] = $button['url'];
                        if (isset($button['example'])) {
                            $buttonComponent['example'] = [$button['example']];
                        }
                        break;
                    case 'PHONE_NUMBER':
                        $buttonComponent['phone_number'] = $button['phone_number'];
                        break;
                    case 'QUICK_REPLY':
                        // Quick reply buttons don't need additional fields
                        break;
                }

                $buttons[] = $buttonComponent;
            }

            $components[] = [
                'type' => 'BUTTONS',
                'buttons' => $buttons,
            ];
        }

        return $components;
    }

    /**
     * Check template approval status
     */
    public function checkTemplateStatus(MessageTemplate $template): array
    {
        try {
            if (!$template->platform_template_id) {
                return [
                    'success' => false,
                    'error' => 'Template not submitted to platform yet',
                ];
            }

            $credentials = MetaPlatformCredential::where('company_id', $template->company_id)
                ->where('platform', $template->platform)
                ->where('is_active', true)
                ->first();

            if (!$credentials) {
                return [
                    'success' => false,
                    'error' => 'No active credentials found',
                ];
            }

            switch ($template->platform) {
                case 'whatsapp':
                    return $this->checkWhatsAppTemplateStatus($template, $credentials);
                default:
                    return [
                        'success' => false,
                        'error' => 'Status check not supported for ' . $template->platform,
                    ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check WhatsApp template status
     */
    private function checkWhatsAppTemplateStatus(MessageTemplate $template, MetaPlatformCredential $credentials): array
    {
        $url = "https://graph.facebook.com/v18.0/{$template->platform_template_id}";
        
        $response = $this->makeApiCall($url, 'GET', [], $credentials->access_token);

        if ($response['success']) {
            $status = $response['data']['status'];
            
            // Update template status
            $template->update([
                'approval_status' => strtolower($status),
            ]);

            return [
                'success' => true,
                'data' => $response['data'],
            ];
        }

        return $response;
    }

    /**
     * Delete template from Meta platform
     */
    public function deleteTemplate(MessageTemplate $template): array
    {
        try {
            if (!$template->platform_template_id) {
                return [
                    'success' => false,
                    'error' => 'Template not submitted to platform',
                ];
            }

            $credentials = MetaPlatformCredential::where('company_id', $template->company_id)
                ->where('platform', $template->platform)
                ->where('is_active', true)
                ->first();

            if (!$credentials) {
                return [
                    'success' => false,
                    'error' => 'No active credentials found',
                ];
            }

            switch ($template->platform) {
                case 'whatsapp':
                    return $this->deleteWhatsAppTemplate($template, $credentials);
                default:
                    return [
                        'success' => false,
                        'error' => 'Template deletion not supported for ' . $template->platform,
                    ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Delete WhatsApp template
     */
    private function deleteWhatsAppTemplate(MessageTemplate $template, MetaPlatformCredential $credentials): array
    {
        $url = "https://graph.facebook.com/v18.0/{$credentials->business_account_id}/message_templates";
        
        $payload = [
            'name' => $template->name,
        ];

        $response = $this->makeApiCall($url, 'DELETE', $payload, $credentials->access_token);

        if ($response['success']) {
            return [
                'success' => true,
                'message' => 'Template deleted successfully',
            ];
        }

        return $response;
    }

    /**
     * Process WhatsApp template status update
     */
    private function processWhatsAppTemplateStatusUpdate(array $statusData, string $companyId): void
    {
        try {
            // Extract template information from the webhook payload
            $event = $statusData['event']; // APPROVED, REJECTED, DISABLED
            $templateId = $statusData['message_template_id'];
            $templateName = $statusData['message_template_name'];
            $templateLanguage = $statusData['message_template_language'];
            $reason = $statusData['reason'] ?? 'NONE';
            
            Log::info("Processing WhatsApp template status update", [
                'company_id' => $companyId,
                'template_id' => $templateId,
                'template_name' => $templateName,
                'event' => $event,
                'reason' => $reason,
            ]);

            // Find the template in our database
            $template = MessageTemplate::where('company_id', $companyId)
                ->where('platform', 'whatsapp')
                ->where('platform_template_id', $templateId)
                ->first();

            if (!$template) {
                // Try to find by name and language if platform_template_id is not set
                $template = MessageTemplate::where('company_id', $companyId)
                    ->where('platform', 'whatsapp')
                    ->where('name', $templateName)
                    ->where('language_code', $templateLanguage)
                    ->first();
            }

            if (!$template) {
                Log::warning("Template not found in database for status update", [
                    'company_id' => $companyId,
                    'template_id' => $templateId,
                    'template_name' => $templateName,
                    'language' => $templateLanguage,
                ]);
                return;
            }

            // Update the template status based on the event
            $updateData = ['platform_template_id' => $templateId];
            
            switch ($event) {
                case 'APPROVED':
                    $updateData['approval_status'] = 'approved';
                    $updateData['is_active'] = true;
                    Log::info("Template approved", [
                        'template_id' => $template->id,
                        'template_name' => $template->name,
                        'platform_template_id' => $templateId,
                    ]);
                    break;

                case 'REJECTED':
                    $updateData['approval_status'] = 'rejected';
                    $updateData['is_active'] = false;
                    Log::warning("Template rejected", [
                        'template_id' => $template->id,
                        'template_name' => $template->name,
                        'platform_template_id' => $templateId,
                        'reason' => $reason,
                    ]);
                    break;

                case 'DISABLED':
                    $updateData['is_active'] = false;
                    $disableInfo = $statusData['disable_info'] ?? null;
                    if ($disableInfo) {
                        $updateData['additional_info'] = json_encode([
                            'disabled_at' => $disableInfo['disable_date'] ?? null,
                            'reason' => $reason,
                        ]);
                    }
                    Log::warning("Template disabled", [
                        'template_id' => $template->id,
                        'template_name' => $template->name,
                        'platform_template_id' => $templateId,
                        'reason' => $reason,
                        'disable_info' => $disableInfo,
                    ]);
                    break;

                default:
                    Log::warning("Unknown template status event", [
                        'event' => $event,
                        'template_id' => $templateId,
                        'template_name' => $templateName,
                    ]);
                    return;
            }

            // Add other info if available
            if (isset($statusData['other_info'])) {
                $otherInfo = $statusData['other_info'];
                $updateData['additional_info'] = json_encode(array_merge(
                    json_decode($template->additional_info ?? '{}', true),
                    [
                        'last_status_update' => now()->toISOString(),
                        'status_info' => [
                            'title' => $otherInfo['title'] ?? null,
                            'description' => $otherInfo['description'] ?? null,
                        ],
                    ]
                ));
            }

            // Update the template
            $template->update($updateData);

            Log::info("Template status updated successfully", [
                'template_id' => $template->id,
                'template_name' => $template->name,
                'old_status' => $template->getOriginal('approval_status'),
                'new_status' => $updateData['approval_status'] ?? $template->approval_status,
                'platform_template_id' => $templateId,
            ]);

        } catch (\Exception $e) {
            Log::error("Failed to process template status update", [
                'company_id' => $companyId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'status_data' => $statusData,
            ]);
        }
    }
}
