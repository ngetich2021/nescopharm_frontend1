<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Message;
use App\Models\MessageTemplate;
use App\Models\MetaPlatformCredential;
use App\Services\MetaChatService;
use App\Services\MediaAttachmentService;
use App\Events\MessageSent;
use App\Events\MessageReceived;
use App\Events\ConversationUpdated;
use App\Events\MessageStatusUpdated;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    protected MetaChatService $metaChatService;
    protected MediaAttachmentService $mediaService;

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    public function __construct(MetaChatService $metaChatService, MediaAttachmentService $mediaService)
    {
        $this->middleware('auth:sanctum');
        $this->metaChatService = $metaChatService;
        $this->mediaService = $mediaService;
    }

    /**
     * Get all conversations for the authenticated user's company
     */
    public function getConversations(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'platform' => 'nullable|in:whatsapp,instagram,messenger',
            'status' => 'nullable|in:active,closed,pending,spam',
            'assigned_to' => 'nullable|uuid',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $query = Conversation::with([
                'customer',
                'assignedAgent',
                'latestMessage'
            ])
                ->forCompany($user->company_id)
                ->orderBy('last_message_at', 'desc');

            // Apply filters
            if ($request->platform) {
                $query->forPlatform($request->platform);
            }

            if ($request->status) {
                $query->where('status', $request->status);
            }

            if ($request->assigned_to) {
                $query->assignedTo($request->assigned_to);
            }

            if ($request->unassigned) {
                $query->unassigned();
            }

            $conversations = $query->paginate($request->per_page ?? 20);

            return response()->json([
                'status' => 'success',
                'conversations' => $conversations,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch conversations: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a specific conversation with messages
     */
    public function getConversation(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();

        try {
            // Validate UUID format
            if (!Str::isUuid($conversationId)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Invalid conversation ID format',
                ], 400);
            }

            // Use separate queries to avoid PostgreSQL prepared statement issues
            $conversation = Conversation::with([
                'customer',
                'assignedAgent',
                'messages.sender',
                'messages.attachments',
                'messages.replyToMessage',
                'participants.user'
            ])
                ->forCompany($user->company_id)
                ->findOrFail($conversationId);

            // Load events separately to avoid UUID binding issues
            $conversation->load([
                'events' => function ($query) {
                    $query->with('triggeredBy')->orderBy('created_at', 'desc');
                }
            ]);

            // Mark messages as read if user is viewing
            $conversation->markAsRead();

            return response()->json([
                'status' => 'success',
                'conversation' => $conversation,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Conversation not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Failed to fetch conversation', [
                'conversation_id' => $conversationId,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send a message in a conversation
     */
    public function sendMessage(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'message_type' => 'required|in:text,image,video,audio,document,template,interactive',
            'content' => 'required_if:message_type,text|nullable|string',
            'template_id' => 'required_if:message_type,template|nullable|uuid',
            'template_variables' => 'nullable|array',
            'media_file' => 'required_if:message_type,image,video,audio,document|file',
            'caption' => 'nullable|string',
            'reply_to_message_id' => 'nullable|uuid|exists:messages,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            // Handle different message types
            $messageData = [
                'conversation_id' => $conversation->id,
                'direction' => 'outbound',
                'sender_type' => 'agent',
                'sender_id' => $user->id,
                'sender_name' => $user->first_name . ' ' . $user->last_name,
                'message_type' => $request->message_type,
                'reply_to_message_id' => $request->reply_to_message_id,
            ];

            if ($request->message_type === 'text') {
                $messageData['content'] = $request->content;
            } elseif ($request->message_type === 'template') {
                $template = MessageTemplate::forCompany($user->company_id)
                    ->findOrFail($request->template_id);

                $messageData['content'] = $template->renderContent($request->template_variables ?? []);
                $messageData['rich_content'] = [
                    'template_id' => $template->id,
                    'variables' => $request->template_variables ?? [],
                ];
            } elseif (in_array($request->message_type, ['image', 'video', 'audio', 'document'])) {
                if ($request->hasFile('media_file')) {
                    $file = $request->file('media_file');

                    // Use MediaAttachmentService to store the file in Supabase
                    $uploadResult = $this->mediaService->storeUploadedFile($file, $conversation->platform);

                    if (!$uploadResult['success']) {
                        return response()->json([
                            'status' => 'failed',
                            'message' => 'Failed to upload media: ' . $uploadResult['error'],
                        ], 400);
                    }

                    $messageData['media_url'] = $uploadResult['file_url'];
                    $messageData['media_type'] = $uploadResult['mime_type'];
                    $messageData['media_size'] = $uploadResult['file_size'];
                    $messageData['caption'] = $request->caption;

                    // Store file data for attachment creation
                    $fileData = $uploadResult;
                }
            }

            // Create message record
            $message = Message::create($messageData);

            // Create attachment if we have file data
            if (isset($fileData)) {
                $this->mediaService->createAttachment($message, $fileData);
            }

            // Send via Meta API
            $result = $this->metaChatService->sendMessage($conversation, $message);

            if ($result['success']) {
                $message->update([
                    'platform_message_id' => $result['message_id'],
                    'status' => 'sent',
                ]);

                // Update conversation timestamps
                $conversation->updateLastMessageTime();
                $conversation->updateLastAgentMessageTime();

                // Load relationships conditionally
                $messageWithRelations = $message->load(['sender']);

                // Only load attachments if the message type supports them
                if (in_array($message->message_type, ['image', 'video', 'audio', 'document'])) {
                    $messageWithRelations->load('attachments');
                }

                // Broadcast the message sent event
                broadcast(new MessageSent($messageWithRelations, $conversation))->toOthers();

                return response()->json([
                    'status' => 'success',
                    'message' => 'Message sent successfully',
                    'data' => $messageWithRelations,
                ]);
            } else {
                $message->markAsFailed($result['error']);
                $messageWithRelations = $message->load(['sender']);

                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to send message: ' . $result['error'],
                ], 500);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to send message: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload media file for chat
     */
    public function uploadMedia(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'file' => 'required|file',
            'conversation_id' => 'required|uuid|exists:conversations,id',
            'platform' => 'nullable|in:whatsapp,instagram,messenger',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($request->conversation_id);

            $file = $request->file('file');
            $platform = $request->platform ?? $conversation->platform;

            // Use MediaAttachmentService to store the file in Supabase
            $uploadResult = $this->mediaService->storeUploadedFile($file, $platform);

            if (!$uploadResult['success']) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to upload media: ' . $uploadResult['error'],
                ], 400);
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Media uploaded successfully to Supabase',
                'data' => [
                    'file_url' => $uploadResult['file_url'],
                    'file_path' => $uploadResult['file_path'],
                    'filename' => $uploadResult['filename'],
                    'original_filename' => $uploadResult['original_filename'],
                    'mime_type' => $uploadResult['mime_type'],
                    'file_size' => $uploadResult['file_size'],
                    'upload_data' => $uploadResult, // For creating attachment later
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to upload media: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test Supabase storage connection
     */
    public function testSupabaseStorage(): JsonResponse
    {
        try {
            // Test local storage first
            $testContent = 'Test file for storage connection - ' . now()->toISOString();
            $testPath = 'test/connection-test-' . time() . '.txt';

            $storageDisk = config('chat.media.storage_disk', 'local');

            // Test local storage
            $stored = Storage::disk($storageDisk)->put($testPath, $testContent);

            if (!$stored) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to write test file to local storage',
                ], 500);
            }

            // Test read
            $readContent = Storage::disk($storageDisk)->get($testPath);

            if ($readContent !== $testContent) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'File content mismatch when reading from local storage',
                ], 500);
            }

            // Test URL generation
            $publicUrl = $this->mediaService->getPublicUrl($testPath);

            // Test delete
            $deleted = Storage::disk($storageDisk)->delete($testPath);

            $results = [
                'storage_disk' => $storageDisk,
                'test_file_path' => $testPath,
                'public_url' => $publicUrl,
                'write_success' => $stored,
                'read_success' => ($readContent === $testContent),
                'delete_success' => $deleted,
                'storage_test' => 'passed',
            ];

            return response()->json([
                'status' => 'success',
                'message' => 'Storage test completed successfully',
                'data' => $results,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Storage test failed: ' . $e->getMessage(),
                'error_details' => [
                    'exception' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ],
            ], 500);
        }
    }

    /**
     * Get customer ID from phone number
     */
    public function getCustomerByPhone(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|min:9|max:15',
            'platform' => 'nullable|in:whatsapp,instagram,messenger',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $phone = $request->phone;
            $platform = $request->platform ?? 'whatsapp';

            // Normalize phone number and try multiple variations
            $phoneVariations = $this->generatePhoneVariations($phone);

            $customer = null;
            foreach ($phoneVariations as $variation) {
                $customer = Customer::where('company_id', $user->company_id)
                    ->where('phone', $variation)
                    ->first();

                if ($customer) {
                    break;
                }
            }

            if (!$customer) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Customer not found with phone number: ' . $phone,
                    'searched_variations' => $phoneVariations,
                ], 404);
            }

            // Check if customer has platform identifier
            $platformUserId = $this->getCustomerPlatformId($customer, $platform);

            $customerData = [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'status' => $customer->status,
                'platform_available' => true,
                'last_contact_date' => $customer->last_contact_date,
                'platform_user_id' => $platformUserId,
            ];

            // Check for existing conversations
            if ($platformUserId) {
                $existingConversation = Conversation::forCompany($user->company_id)
                    ->where('platform', $platform)
                    ->where('platform_conversation_id', $platformUserId)
                    ->first();

                if ($existingConversation) {
                    $customerData['existing_conversation'] = [
                        'id' => $existingConversation->id,
                        'status' => $existingConversation->status,
                        'last_message_at' => $existingConversation->last_message_at,
                    ];
                }
            }

            return response()->json([
                'status' => 'success',
                'customer' => $customerData,
                'platform' => $platform,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to search customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send message by phone number (creates customer and conversation if needed)
     */
    public function sendMessageByPhone(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^\+[1-9]\d{1,14}$/',
            'customer_name' => 'nullable|string|max:255',
            'initial_message' => 'required|array',
            'initial_message.message_type' => 'required|in:text,template',
            'initial_message.content' => 'required_if:initial_message.message_type,text|string|max:1000',
            'initial_message.template_id' => 'required_if:initial_message.message_type,template|nullable|uuid|exists:message_templates,id',
            'initial_message.template_variables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            // Find or create customer
            $customer = $this->findOrCreateCustomerByPhone($request->phone, $request->customer_name, $user);

            if (!$customer) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Customer could not be created or found',
                ], 400);
            }

            // Use the existing initiate conversation logic
            $conversationRequest = new Request([
                'customer_id' => $customer->id,
                'platform' => 'whatsapp',
                'initial_message' => $request->initial_message,
            ]);

            $conversationRequest->setUserResolver(function () use ($user) {
                return $user;
            });

            return $this->initiateConversation($conversationRequest);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to start WhatsApp conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Initiate a new conversation with a customer
     */
    public function initiateConversation(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|uuid|exists:customers,id',
            'platform' => 'required|in:whatsapp,instagram,messenger',
            'initial_message' => 'required|array',
            'initial_message.message_type' => 'required|in:text,template',
            'initial_message.content' => 'required_if:initial_message.message_type,text|string|max:1000',
            'initial_message.template_id' => 'required_if:initial_message.message_type,template|nullable|uuid|exists:message_templates,id',
            'initial_message.template_variables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            // Get the customer
            $customer = $user->company->customers()->findOrFail($request->customer_id);

            // Check if customer has platform identifier for the requested platform
            $platformUserId = $this->getCustomerPlatformId($customer, $request->platform);

            if (!$platformUserId) {
                return response()->json([
                    'status' => 'failed',
                    'message' => "Customer doesn't have a {$request->platform} identifier. Cannot initiate conversation.",
                ], 400);
            }

            // Find or create conversation for this customer on this platform
            $conversation = Conversation::firstOrCreate(
                [
                    'company_id' => $user->company_id,
                    'platform' => $request->platform,
                    'platform_conversation_id' => $platformUserId,
                ],
                [
                    'customer_id' => $customer->id,
                    'platform_user_id' => $platformUserId,
                    'customer_name' => $customer->name,
                    'customer_phone' => $customer->phone,
                    'customer_email' => $customer->email,
                    'status' => 'active',
                    'assigned_agent_id' => $user->id,
                    'is_bot_active' => false,
                    'last_message_at' => now(),
                    'last_agent_message_at' => now(),
                ]
            );

            $isExisting = $conversation->wasRecentlyCreated === false;

            // Update existing conversation if needed
            if ($isExisting) {
                $conversation->update([
                    'status' => 'active',
                    'assigned_agent_id' => $user->id,
                    'last_message_at' => now(),
                    'last_agent_message_at' => now(),
                ]);
            }

            // Extract initial message details
            $initialMessage = $request->initial_message;
            $messageType = $initialMessage['message_type'];

            // Prepare message data
            $messageData = [
                'conversation_id' => $conversation->id,
                'direction' => 'outbound',
                'sender_type' => 'agent',
                'sender_id' => $user->id,
                'sender_name' => $user->first_name . ' ' . $user->last_name,
                'message_type' => $messageType,
            ];

            // Handle different message types
            if ($messageType === 'template') {
                $template = MessageTemplate::forCompany($user->company_id)
                    ->findOrFail($initialMessage['template_id']);

                $messageData['content'] = $template->renderContent($initialMessage['template_variables'] ?? []);
                $messageData['rich_content'] = [
                    'template_id' => $template->id,
                    'variables' => $initialMessage['template_variables'] ?? [],
                ];
            } else {
                // Text message
                $messageData['content'] = $initialMessage['content'];
            }

            // Create the initial message
            $message = Message::create($messageData);

            // Send via Meta API
            $result = $this->metaChatService->sendMessage($conversation, $message);

            if ($result['success']) {
                $message->update([
                    'platform_message_id' => $result['message_id'],
                    'status' => 'sent',
                ]);

                // Log conversation event
                $eventType = $isExisting ? 'message_sent' : 'conversation_created';
                $description = $isExisting
                    ? "Agent {$user->first_name} {$user->last_name} sent message in existing conversation on {$request->platform}"
                    : "Agent {$user->first_name} {$user->last_name} initiated conversation on {$request->platform}";

                $conversation->events()->create([
                    'event_type' => $eventType,
                    'triggered_by' => $user->id,
                    'description' => $description,
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => $isExisting ? 'Message sent successfully' : 'Conversation initiated successfully',
                    'conversation' => $conversation->load(['customer', 'assignedAgent', 'messages']),
                    'initial_message' => $message->load(['sender']),
                ]);
            } else {
                // If sending fails, mark message as failed but keep conversation
                $message->markAsFailed($result['error']);

                return response()->json([
                    'status' => 'partial_success',
                    'message' => 'Conversation created but initial message failed to send: ' . $result['error'],
                    'conversation' => $conversation->load(['customer', 'assignedAgent']),
                    'error' => $result['error'],
                ], 207);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to initiate conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    // Helper methods
    private function getCustomerPlatformId(Customer $customer, string $platform): ?string
    {
        switch ($platform) {
            case 'whatsapp':
                return $customer->getWhatsAppPhone();
            case 'instagram':
                return $customer->getInstagramUserId();
            case 'messenger':
                return $customer->getMessengerPsid();
            default:
                return null;
        }
    }

    private function generatePhoneVariations(string $phone): array
    {
        $variations = [];
        $clean = preg_replace('/[^\d+]/', '', $phone);

        $variations[] = $clean;

        if (str_starts_with($clean, '+')) {
            $variations[] = substr($clean, 1);
        } else {
            $variations[] = '+' . $clean;
        }

        if (str_starts_with($clean, '+254')) {
            $variations[] = '0' . substr($clean, 4);
        } elseif (str_starts_with($clean, '254')) {
            $variations[] = '0' . substr($clean, 3);
            $variations[] = '+' . $clean;
        } elseif (str_starts_with($clean, '0')) {
            $variations[] = '+254' . substr($clean, 1);
            $variations[] = '254' . substr($clean, 1);
        }

        return array_unique($variations);
    }

    private function findOrCreateCustomerByPhone(string $phone, ?string $name, $user): ?Customer
    {
        $phoneVariations = $this->generatePhoneVariations($phone);

        $customer = null;
        foreach ($phoneVariations as $variation) {
            $customer = Customer::where('company_id', $user->company_id)
                ->where('phone', $variation)
                ->first();

            if ($customer) {
                break;
            }
        }

        if (!$customer) {
            $customer = Customer::create([
                'company_id' => $user->company_id,
                'name' => $name ?? 'WhatsApp Customer',
                'phone' => $phone,
                'status' => 'active',
                'customer_type' => 'individual',
                'preferred_communication_channel' => 'whatsapp',
                'last_contact_date' => now(),
                'tags' => ['whatsapp_user', 'whatsapp_phone:' . $phone],
            ]);
        }

        return $customer;
    }

    /**
     * Smart conversation initiation - routes to existing conversation or creates new one
     */
    public function startOrContinueConversation(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|uuid|exists:customers,id',
            'platform' => 'required|in:whatsapp,instagram,messenger',
            'message' => 'required|array',
            'message.message_type' => 'required|in:text,template',
            'message.content' => 'required_if:message.message_type,text|nullable|string|max:1000',
            'message.template_id' => 'required_if:message.message_type,template|nullable|uuid|exists:message_templates,id',
            'message.template_variables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            // Get the customer
            $customer = $user->company->customers()->findOrFail($request->customer_id);
            $platformUserId = $this->getCustomerPlatformId($customer, $request->platform);

            if (!$platformUserId) {
                return response()->json([
                    'status' => 'failed',
                    'message' => "Customer doesn't have a {$request->platform} identifier. Cannot start conversation.",
                ], 400);
            }

            // Check if conversation already exists
            $conversation = Conversation::forCompany($user->company_id)
                ->where('platform', $request->platform)
                ->where('platform_conversation_id', $platformUserId)
                ->first();

            if ($conversation) {
                // Use existing conversation - send message directly
                Log::info('Found existing conversation for startOrContinueConversation', [
                    'conversation_id' => $conversation->id,
                    'platform' => $request->platform,
                    'platform_user_id' => $platformUserId,
                ]);

                $messageRequest = new Request([
                    'message_type' => $request->message['message_type'],
                    'content' => $request->message['content'] ?? null,
                    'template_id' => $request->message['template_id'] ?? null,
                    'template_variables' => $request->message['template_variables'] ?? null,
                ]);

                $messageRequest->setUserResolver(function () use ($user) {
                    return $user;
                });

                return $this->sendMessage($messageRequest, (string) $conversation->id);
            } else {
                // No existing conversation - create new one
                $initiateRequest = new Request([
                    'customer_id' => $request->customer_id,
                    'platform' => $request->platform,
                    'initial_message' => $request->message,
                ]);

                $initiateRequest->setUserResolver(function () use ($user) {
                    return $user;
                });

                return $this->initiateConversation($initiateRequest);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to start conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start a conversation with a customer by phone number (WhatsApp)
     */
    public function startWhatsAppConversation(Request $request): JsonResponse
    {
        // This is an alias for sendMessageByPhone for backward compatibility
        return $this->sendMessageByPhone($request);
    }

    /**
     * Get available customers for conversation initiation
     */
    public function getAvailableCustomers(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'platform' => 'nullable|in:whatsapp,instagram,messenger',
            'search' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $platform = $request->platform ?? 'whatsapp';
            $query = Customer::where('company_id', $user->company_id);

            // Platform-specific filtering
            switch ($platform) {
                case 'whatsapp':
                    $query->whereNotNull('phone');
                    break;
                case 'instagram':
                    $query->whereJsonContains('tags', 'instagram_user');
                    break;
                case 'messenger':
                    $query->whereJsonContains('tags', 'messenger_user');
                    break;
            }

            // Search functionality
            if ($request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'LIKE', "%{$search}%")
                        ->orWhere('email', 'LIKE', "%{$search}%")
                        ->orWhere('phone', 'LIKE', "%{$search}%");
                });
            }

            // Don't exclude any customers - agents can always send messages to existing conversations
            // This ensures continuity of conversations
            $customers = $query->select(['id', 'name', 'email', 'phone', 'tags', 'last_contact_date'])
                ->orderBy('last_contact_date', 'desc')
                ->paginate($request->per_page ?? 20);

            // Add platform-specific identifiers to each customer
            $customers->transform(function ($customer) use ($platform) {
                $customer->platform_id = $this->getCustomerPlatformId($customer, $platform);
                $customer->can_initiate = !is_null($customer->platform_id);

                // Check if customer has any existing conversations on this platform
                $existingConversation = $customer->conversations()
                    ->where('platform', $platform)
                    ->first();

                if ($existingConversation) {
                    $customer->conversation_status = $existingConversation->status;
                    $customer->has_existing_conversation = true;
                    $customer->conversation_id = $existingConversation->id;
                    $customer->action_type = 'continue_conversation';
                } else {
                    $customer->action_type = 'initiate_conversation';
                    $customer->conversation_status = null;
                    $customer->has_existing_conversation = false;
                    $customer->conversation_id = null;
                }

                return $customer;
            });

            return response()->json([
                'status' => 'success',
                'customers' => $customers,
                'platform' => $platform,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch customers: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Debug phone search variations
     */
    public function debugPhoneSearch(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|min:9|max:15',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $phone = $request->phone;
            $phoneVariations = $this->generatePhoneVariations($phone);

            $searchResults = [];
            foreach ($phoneVariations as $variation) {
                $customer = Customer::where('company_id', $user->company_id)
                    ->where('phone', $variation)
                    ->first();

                $searchResults[$variation] = [
                    'found' => !is_null($customer),
                    'customer_id' => $customer?->id,
                    'customer_name' => $customer?->name,
                ];
            }

            return response()->json([
                'status' => 'success',
                'original_phone' => $phone,
                'variations_generated' => $phoneVariations,
                'search_results' => $searchResults,
                'total_variations' => count($phoneVariations),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to debug phone search: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Assign conversation to an agent
     */
    public function assignConversation(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'agent_id' => 'required|uuid|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            $agent = $user->company->users()->findOrFail($request->agent_id);
            $conversation->assignToAgent($agent);

            // Broadcast conversation update
            broadcast(new ConversationUpdated($conversation, 'assigned', [
                'agent_id' => $agent->id,
                'agent_name' => $agent->first_name . ' ' . $agent->last_name,
            ]));

            return response()->json([
                'status' => 'success',
                'message' => 'Conversation assigned successfully',
                'conversation' => $conversation->load('assignedAgent'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to assign conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Close a conversation
     */
    public function closeConversation(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            $conversation->close($user);

            return response()->json([
                'status' => 'success',
                'message' => 'Conversation closed successfully',
                'conversation' => $conversation,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to close conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reopen a conversation
     */
    public function reopenConversation(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            $conversation->reopen($user);

            return response()->json([
                'status' => 'success',
                'message' => 'Conversation reopened successfully',
                'conversation' => $conversation,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to reopen conversation: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Add tags to conversation
     */
    public function addConversationTags(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'tags' => 'required|array',
            'tags.*' => 'string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            foreach ($request->tags as $tag) {
                $conversation->addTag($tag);
            }

            // Log event
            $conversation->events()->create([
                'event_type' => 'tags_updated',
                'triggered_by' => $user->id,
                'event_data' => ['added_tags' => $request->tags],
                'description' => 'Tags added: ' . implode(', ', $request->tags),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Tags added successfully',
                'conversation' => $conversation,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to add tags: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove tags from conversation
     */
    public function removeConversationTags(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'tags' => 'required|array',
            'tags.*' => 'string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            foreach ($request->tags as $tag) {
                $conversation->removeTag($tag);
            }

            // Log event
            $conversation->events()->create([
                'event_type' => 'tags_updated',
                'triggered_by' => $user->id,
                'event_data' => ['removed_tags' => $request->tags],
                'description' => 'Tags removed: ' . implode(', ', $request->tags),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Tags removed successfully',
                'conversation' => $conversation,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to remove tags: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Add note to conversation
     */
    public function addConversationNote(Request $request, string $conversationId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'note' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $conversation = Conversation::forCompany($user->company_id)
                ->findOrFail($conversationId);

            $existingNotes = $conversation->notes ?? '';
            $timestamp = now()->format('Y-m-d H:i:s');
            $newNote = "\n[{$timestamp}] {$user->first_name} {$user->last_name}: {$request->note}";

            $conversation->update([
                'notes' => $existingNotes . $newNote
            ]);

            // Log event
            $conversation->events()->create([
                'event_type' => 'note_added',
                'triggered_by' => $user->id,
                'description' => 'Note added to conversation',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Note added successfully',
                'conversation' => $conversation,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to add note: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get conversation statistics
     */
    public function getConversationStats(Request $request): JsonResponse
    {
        $user = $request->user();

        try {
            $stats = [
                'total_conversations' => Conversation::forCompany($user->company_id)->count(),
                'active_conversations' => Conversation::forCompany($user->company_id)->active()->count(),
                'unassigned_conversations' => Conversation::forCompany($user->company_id)->unassigned()->count(),
                'conversations_with_unread' => Conversation::forCompany($user->company_id)->withUnreadMessages()->count(),
                'conversations_by_platform' => [],
                'conversations_by_status' => [],
                'recent_activity' => [],
            ];

            // Platform breakdown
            $platformStats = Conversation::forCompany($user->company_id)
                ->selectRaw('platform, COUNT(*) as count')
                ->groupBy('platform')
                ->get();

            foreach ($platformStats as $stat) {
                $stats['conversations_by_platform'][$stat->platform] = $stat->count;
            }

            // Status breakdown
            $statusStats = Conversation::forCompany($user->company_id)
                ->selectRaw('status, COUNT(*) as count')
                ->groupBy('status')
                ->get();

            foreach ($statusStats as $stat) {
                $stats['conversations_by_status'][$stat->status] = $stat->count;
            }

            // Recent activity (last 24 hours)
            $recentMessages = Message::whereHas('conversation', function ($q) use ($user) {
                $q->forCompany($user->company_id);
            })
                ->where('created_at', '>=', now()->subDay())
                ->count();

            $stats['recent_activity'] = [
                'messages_last_24h' => $recentMessages,
            ];

            return response()->json([
                'status' => 'success',
                'stats' => $stats,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch stats: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Handle database connection issues and retry operations
     */
    private function withDatabaseRetry(callable $callback, int $maxRetries = 2)
    {
        $attempts = 0;

        while ($attempts < $maxRetries) {
            try {
                return $callback();
            } catch (\Exception $e) {
                $attempts++;

                // Check if it's a connection/prepared statement issue
                if ($this->isDatabaseConnectionError($e) && $attempts < $maxRetries) {
                    Log::warning('Database connection issue, retrying...', [
                        'attempt' => $attempts,
                        'error' => $e->getMessage()
                    ]);

                    // Clear connection and reconnect
                    DB::disconnect();
                    DB::reconnect();

                    // Small delay before retry
                    usleep(100000); // 100ms
                    continue;
                }

                throw $e;
            }
        }
    }

    /**
     * Check if error is related to database connection issues
     */
    private function isDatabaseConnectionError(\Exception $e): bool
    {
        $errorMessage = strtolower($e->getMessage());

        return str_contains($errorMessage, 'prepared statement') ||
            str_contains($errorMessage, 'connection') ||
            str_contains($errorMessage, 'server has gone away') ||
            str_contains($errorMessage, 'lost connection');
    }
}
