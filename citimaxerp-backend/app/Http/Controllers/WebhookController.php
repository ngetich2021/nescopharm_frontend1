<?php

namespace App\Http\Controllers;

use App\Models\MetaPlatformCredential;
use App\Services\MetaChatService;
use App\Events\MessageReceived;
use App\Events\MessageStatusUpdated;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    protected MetaChatService $metaChatService;

    public function __construct(MetaChatService $metaChatService)
    {
        $this->metaChatService = $metaChatService;
    }

    /**
     * Handle WhatsApp webhook verification and incoming webhooks
     */
    public function whatsapp(Request $request): JsonResponse|string
    {
        if ($request->isMethod('GET')) {
            return $this->verifyWebhook($request, 'whatsapp');
        }

        return $this->handleIncomingWebhook($request, 'whatsapp');
    }

    /**
     * Handle Instagram webhook verification and incoming webhooks
     */
    public function instagram(Request $request): JsonResponse|string
    {
        if ($request->isMethod('GET')) {
            return $this->verifyWebhook($request, 'instagram');
        }

        return $this->handleIncomingWebhook($request, 'instagram');
    }

    /**
     * Handle Messenger webhook verification and incoming webhooks
     */
    public function messenger(Request $request): JsonResponse|string
    {
        if ($request->isMethod('GET')) {
            return $this->verifyWebhook($request, 'messenger');
        }

        return $this->handleIncomingWebhook($request, 'messenger');
    }

    /**
     * Verify webhook for Meta platforms
     */
    private function verifyWebhook(Request $request, string $platform): string
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        if ($mode === 'subscribe') {
            // Find the credential with this verify token
            $credential = MetaPlatformCredential::where('platform', $platform)
                ->get()
                ->first(function ($cred) use ($token) {
                    return $cred->webhook_verify_token === $token;
                });

            if ($credential) {
                Log::info("Webhook verified for {$platform}", [
                    'company_id' => $credential->company_id,
                    'platform' => $platform,
                ]);
                
                return $challenge;
            } else {
                Log::warning("Webhook verification failed for {$platform}", [
                    'token' => $token,
                    'available_tokens' => MetaPlatformCredential::where('platform', $platform)->count(),
                ]);
            }
        }

        return 'Invalid verification token';
    }

    /**
     * Handle incoming webhook from Meta platforms
     */
    private function handleIncomingWebhook(Request $request, string $platform): JsonResponse
    {
        try {
            $payload = $request->all();
            
            // Log incoming webhook
            Log::info("Incoming {$platform} webhook", [
                'payload' => $payload,
                'headers' => $request->headers->all(),
            ]);

            // Verify webhook signature for security
            if (!$this->verifyWebhookSignature($request, $platform)) {
                Log::warning("Invalid webhook signature for {$platform}");
                return response()->json(['error' => 'Invalid signature'], 401);
            }

            // Determine company ID from the webhook payload
            $companyId = $this->extractCompanyIdFromWebhook($payload, $platform);
            
            // If standard extraction fails, try fallback resolution
            if (!$companyId) {
                Log::info("Standard company extraction failed, trying fallback resolution", [
                    'platform' => $platform,
                ]);
                $companyId = $this->fallbackCompanyResolution($payload, $platform);
            }
            
            if (!$companyId) {
                Log::error("Could not determine company ID from {$platform} webhook", [
                    'payload' => $payload,
                    'available_credentials' => MetaPlatformCredential::where('platform', $platform)
                        ->where('is_active', true)
                        ->select('company_id', 'phone_number_id', 'page_id', 'business_account_id')
                        ->get()
                        ->toArray(),
                ]);
                return response()->json(['error' => 'Company not found'], 400);
            }

            // Process the webhook
            $result = $this->metaChatService->processWebhook($platform, $payload, $companyId);

            if ($result['success']) {
                return response()->json(['status' => 'success']);
            } else {
                Log::error("Failed to process {$platform} webhook", [
                    'error' => $result['error'],
                    'payload' => $payload,
                ]);
                return response()->json(['error' => $result['error']], 500);
            }
        } catch (\Exception $e) {
            Log::error("Exception processing {$platform} webhook", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'payload' => $request->all(),
            ]);

            return response()->json(['error' => 'Internal server error'], 500);
        }
    }

    /**
     * Verify webhook signature for security and optionally return the matching credential
     */
    private function verifyWebhookSignature(Request $request, string $platform): bool
    {
        // Get the signature from headers
        $signature = $request->header('x-hub-signature-256') ?? $request->header('X-Hub-Signature-256');
        
        if (!$signature) {
            Log::info("No webhook signature provided for {$platform} - allowing in development mode");
            // In development, allow webhooks without signatures
            // In production, you should make this more strict
            return true;
        }

        // Get the raw body
        $payload = $request->getContent();
        
        // Try to verify against all active credentials for this platform
        $credentials = MetaPlatformCredential::where('platform', $platform)
            ->where('is_active', true)
            ->get();

        foreach ($credentials as $credential) {
            $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, $credential->app_secret);
            
            if (hash_equals($expectedSignature, $signature)) {
                Log::info("Webhook signature verified for {$platform}", [
                    'company_id' => $credential->company_id,
                    'platform' => $platform,
                ]);
                return true;
            }
        }

        Log::warning("Webhook signature verification failed for {$platform}", [
            'provided_signature' => $signature,
            'available_credentials' => $credentials->count(),
        ]);

        return false;
    }

    /**
     * Extract company ID from webhook payload
     * For SaaS products, we need to map the Meta platform identifiers to companies
     */
    private function extractCompanyIdFromWebhook(array $payload, string $platform): ?string
    {
        try {
            switch ($platform) {
                case 'whatsapp':
                    return $this->extractCompanyIdFromWhatsAppWebhook($payload);
                case 'instagram':
                    return $this->extractCompanyIdFromInstagramWebhook($payload);
                case 'messenger':
                    return $this->extractCompanyIdFromMessengerWebhook($payload);
                default:
                    return null;
            }
        } catch (\Exception $e) {
            Log::error("Failed to extract company ID from {$platform} webhook", [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
            return null;
        }
    }

    /**
     * Extract company ID from WhatsApp webhook
     * Maps phone_number_id to company via MetaPlatformCredential
     */
    private function extractCompanyIdFromWhatsAppWebhook(array $payload): ?string
    {
        // Handle different WhatsApp webhook structures
        $phoneNumberId = null;
        
        // Standard message webhook structure
        if (isset($payload['entry'][0]['changes'][0]['value']['metadata']['phone_number_id'])) {
            $phoneNumberId = $payload['entry'][0]['changes'][0]['value']['metadata']['phone_number_id'];
        }
        // Alternative structure check
        elseif (isset($payload['entry'][0]['changes'][0]['value']['phone_number_id'])) {
            $phoneNumberId = $payload['entry'][0]['changes'][0]['value']['phone_number_id'];
        }
        // Direct metadata structure
        elseif (isset($payload['metadata']['phone_number_id'])) {
            $phoneNumberId = $payload['metadata']['phone_number_id'];
        }

        if (!$phoneNumberId) {
            Log::warning("No phone_number_id found in WhatsApp webhook payload", [
                'payload_structure' => array_keys($payload),
                'entry_structure' => isset($payload['entry'][0]) ? array_keys($payload['entry'][0]) : null,
            ]);
            return null;
        }

        // Find the company that owns this phone number ID
        $credential = MetaPlatformCredential::where('platform', 'whatsapp')
            ->where('phone_number_id', $phoneNumberId)
            ->where('is_active', true)
            ->first();

        if (!$credential) {
            Log::warning("No active WhatsApp credential found for phone_number_id", [
                'phone_number_id' => $phoneNumberId,
                'available_credentials' => MetaPlatformCredential::where('platform', 'whatsapp')
                    ->where('is_active', true)
                    ->pluck('phone_number_id', 'company_id')
                    ->toArray(),
            ]);
            return null;
        }

        Log::info("Successfully mapped WhatsApp webhook to company", [
            'phone_number_id' => $phoneNumberId,
            'company_id' => $credential->company_id,
        ]);

        return $credential->company_id;
    }

    /**
     * Extract company ID from Instagram webhook
     * Maps page_id to company via MetaPlatformCredential
     */
    private function extractCompanyIdFromInstagramWebhook(array $payload): ?string
    {
        $pageId = null;
        
        // Standard Instagram messaging webhook structure
        if (isset($payload['entry'][0]['id'])) {
            $pageId = $payload['entry'][0]['id'];
        }
        // Alternative structure check
        elseif (isset($payload['entry'][0]['messaging'][0]['recipient']['id'])) {
            $pageId = $payload['entry'][0]['messaging'][0]['recipient']['id'];
        }

        if (!$pageId) {
            Log::warning("No page_id found in Instagram webhook payload", [
                'payload_structure' => array_keys($payload),
                'entry_structure' => isset($payload['entry'][0]) ? array_keys($payload['entry'][0]) : null,
            ]);
            return null;
        }

        // Find the company that owns this Instagram page
        $credential = MetaPlatformCredential::where('platform', 'instagram')
            ->where('page_id', $pageId)
            ->where('is_active', true)
            ->first();

        if (!$credential) {
            Log::warning("No active Instagram credential found for page_id", [
                'page_id' => $pageId,
                'available_credentials' => MetaPlatformCredential::where('platform', 'instagram')
                    ->where('is_active', true)
                    ->pluck('page_id', 'company_id')
                    ->toArray(),
            ]);
            return null;
        }

        Log::info("Successfully mapped Instagram webhook to company", [
            'page_id' => $pageId,
            'company_id' => $credential->company_id,
        ]);

        return $credential->company_id;
    }

    /**
     * Extract company ID from Messenger webhook
     * Maps page_id to company via MetaPlatformCredential
     */
    private function extractCompanyIdFromMessengerWebhook(array $payload): ?string
    {
        $pageId = null;
        
        // Standard Messenger webhook structure
        if (isset($payload['entry'][0]['id'])) {
            $pageId = $payload['entry'][0]['id'];
        }
        // Alternative structure check
        elseif (isset($payload['entry'][0]['messaging'][0]['recipient']['id'])) {
            $pageId = $payload['entry'][0]['messaging'][0]['recipient']['id'];
        }

        if (!$pageId) {
            Log::warning("No page_id found in Messenger webhook payload", [
                'payload_structure' => array_keys($payload),
                'entry_structure' => isset($payload['entry'][0]) ? array_keys($payload['entry'][0]) : null,
            ]);
            return null;
        }

        // Find the company that owns this Messenger page
        $credential = MetaPlatformCredential::where('platform', 'messenger')
            ->where('page_id', $pageId)
            ->where('is_active', true)
            ->first();

        if (!$credential) {
            Log::warning("No active Messenger credential found for page_id", [
                'page_id' => $pageId,
                'available_credentials' => MetaPlatformCredential::where('platform', 'messenger')
                    ->where('is_active', true)
                    ->pluck('page_id', 'company_id')
                    ->toArray(),
            ]);
            return null;
        }

        Log::info("Successfully mapped Messenger webhook to company", [
            'page_id' => $pageId,
            'company_id' => $credential->company_id,
        ]);

        return $credential->company_id;
    }

    /**
     * Determine platform from webhook payload
     */
    private function determinePlatformFromPayload(array $payload): string
    {
        // Check if it's Instagram messaging
        if (isset($payload['entry'][0]['messaging'][0]['message'])) {
            $messaging = $payload['entry'][0]['messaging'][0];
            
            // Instagram messages often have specific indicators
            if (isset($messaging['sender']['id']) && isset($messaging['recipient']['id'])) {
                // You might need to check additional indicators to distinguish
                // For now, we'll assume it's Messenger unless specifically indicated as Instagram
                return 'messenger';
            }
        }

        return 'messenger';
    }

    /**
     * Generic webhook endpoint for testing
     */
    public function test(Request $request): JsonResponse
    {
        Log::info('Test webhook received', [
            'method' => $request->method(),
            'payload' => $request->all(),
            'headers' => $request->headers->all(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Test webhook received',
            'data' => [
                'method' => $request->method(),
                'payload' => $request->all(),
                'timestamp' => now()->toISOString(),
            ],
        ]);
    }

    /**
     * Health check endpoint
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'service' => 'Meta Chat Webhooks',
        ]);
    }

    /**
     * Fallback method to find company ID when standard extraction fails
     * This method tries alternative approaches to map webhooks to companies
     */
    private function fallbackCompanyResolution(array $payload, string $platform): ?string
    {
        Log::info("Attempting fallback company resolution for {$platform}", [
            'payload_keys' => array_keys($payload),
        ]);

        // Try to extract key identifiers and match against any credential
        $identifiers = $this->extractAllIdentifiers($payload, $platform);
        
        if (empty($identifiers)) {
            return null;
        }

        // Search through all active credentials for this platform
        $credentials = MetaPlatformCredential::where('platform', $platform)
            ->where('is_active', true)
            ->get();

        foreach ($credentials as $credential) {
            // Check if any identifier matches this credential
            if ($this->credentialMatchesIdentifiers($credential, $identifiers, $platform)) {
                Log::info("Fallback resolution successful", [
                    'company_id' => $credential->company_id,
                    'platform' => $platform,
                    'matched_identifiers' => $identifiers,
                ]);
                return $credential->company_id;
            }
        }

        Log::warning("Fallback company resolution failed", [
            'platform' => $platform,
            'identifiers' => $identifiers,
            'available_credentials' => $credentials->count(),
        ]);

        return null;
    }

    /**
     * Extract all possible identifiers from webhook payload
     */
    private function extractAllIdentifiers(array $payload, string $platform): array
    {
        $identifiers = [];

        switch ($platform) {
            case 'whatsapp':
                // Look for phone_number_id in various locations
                if (isset($payload['entry'][0]['changes'][0]['value']['metadata']['phone_number_id'])) {
                    $identifiers['phone_number_id'] = $payload['entry'][0]['changes'][0]['value']['metadata']['phone_number_id'];
                }
                if (isset($payload['entry'][0]['changes'][0]['value']['phone_number_id'])) {
                    $identifiers['phone_number_id'] = $payload['entry'][0]['changes'][0]['value']['phone_number_id'];
                }
                if (isset($payload['metadata']['phone_number_id'])) {
                    $identifiers['phone_number_id'] = $payload['metadata']['phone_number_id'];
                }
                // Look for business account ID
                if (isset($payload['entry'][0]['id'])) {
                    $identifiers['business_account_id'] = $payload['entry'][0]['id'];
                }
                break;

            case 'instagram':
            case 'messenger':
                // Look for page_id in various locations
                if (isset($payload['entry'][0]['id'])) {
                    $identifiers['page_id'] = $payload['entry'][0]['id'];
                }
                if (isset($payload['entry'][0]['messaging'][0]['recipient']['id'])) {
                    $identifiers['page_id'] = $payload['entry'][0]['messaging'][0]['recipient']['id'];
                }
                break;
        }

        return $identifiers;
    }

    /**
     * Check if a credential matches the extracted identifiers
     */
    private function credentialMatchesIdentifiers(MetaPlatformCredential $credential, array $identifiers, string $platform): bool
    {
        switch ($platform) {
            case 'whatsapp':
                // Check phone_number_id
                if (isset($identifiers['phone_number_id']) && $credential->phone_number_id === $identifiers['phone_number_id']) {
                    return true;
                }
                // Check business_account_id
                if (isset($identifiers['business_account_id']) && $credential->business_account_id === $identifiers['business_account_id']) {
                    return true;
                }
                break;

            case 'instagram':
            case 'messenger':
                // Check page_id
                if (isset($identifiers['page_id']) && $credential->page_id === $identifiers['page_id']) {
                    return true;
                }
                break;
        }

        return false;
    }

    /**
     * Debug endpoint to test webhook company resolution
     */
    public function debug(Request $request): JsonResponse
    {
        $platform = $request->input('platform', 'whatsapp');
        $payload = $request->all();
        
        Log::info("Debug webhook company resolution", [
            'platform' => $platform,
            'payload' => $payload,
        ]);

        // Test standard extraction
        $companyId = $this->extractCompanyIdFromWebhook($payload, $platform);
        
        // Test fallback resolution
        $fallbackCompanyId = null;
        if (!$companyId) {
            $fallbackCompanyId = $this->fallbackCompanyResolution($payload, $platform);
        }

        // Get all identifiers
        $identifiers = $this->extractAllIdentifiers($payload, $platform);

        // Get available credentials
        $credentials = MetaPlatformCredential::where('platform', $platform)
            ->where('is_active', true)
            ->select('company_id', 'phone_number_id', 'page_id', 'business_account_id')
            ->get();

        return response()->json([
            'status' => 'debug',
            'platform' => $platform,
            'company_id' => $companyId,
            'fallback_company_id' => $fallbackCompanyId,
            'extracted_identifiers' => $identifiers,
            'available_credentials' => $credentials,
            'payload_structure' => $this->getPayloadStructure($payload),
        ]);
    }

    /**
     * Get a simplified structure of the payload for debugging
     */
    private function getPayloadStructure(array $payload): array
    {
        return $this->arrayStructure($payload, 3); // Max depth of 3
    }

    /**
     * Recursively get array structure with limited depth
     */
    private function arrayStructure(array $array, int $maxDepth = 2, int $currentDepth = 0): array
    {
        if ($currentDepth >= $maxDepth) {
            return ['...'];
        }

        $structure = [];
        foreach ($array as $key => $value) {
            if (is_array($value)) {
                $structure[$key] = $this->arrayStructure($value, $maxDepth, $currentDepth + 1);
            } else {
                $structure[$key] = gettype($value) . (is_string($value) ? ' (' . strlen($value) . ' chars)' : '');
            }
        }

        return $structure;
    }
}
