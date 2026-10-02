<?php

namespace App\Http\Controllers;

use App\Models\MetaPlatformCredential;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class MetaPlatformCredentialController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Get all platform credentials for the company
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        try {
            $credentials = MetaPlatformCredential::forCompany($user->company_id)
                ->select(['id', 'platform', 'app_id', 'phone_number_id', 'page_id', 'business_account_id', 'instagram_account_id', 'is_active', 'expires_at', 'created_at'])
                ->orderBy('platform')
                ->get();

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials fetched successfully',
                'data' => $credentials,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store new platform credentials
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'platform' => 'required|in:whatsapp,instagram,messenger|unique:meta_platform_credentials,platform,NULL,id,company_id,' . $user->company_id,
            'app_id' => 'required|string',
            'access_token' => 'required|string',
            'app_secret' => 'required|string',
            'phone_number_id' => 'required_if:platform,whatsapp|nullable|string',
            'page_id' => 'required_if:platform,instagram,messenger|nullable|string',
            'business_account_id' => 'required_if:platform,whatsapp|nullable|string',
            'instagram_account_id' => 'required_if:platform,instagram|nullable|string',
            'webhook_verify_token' => 'required|string',
            'additional_config' => 'nullable|array',
            'expires_at' => 'nullable|date|after:now',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $credential = MetaPlatformCredential::create([
                'company_id' => $user->company_id,
                'platform' => $request->platform,
                'app_id' => $request->app_id,
                'access_token' => $request->access_token,
                'app_secret' => $request->app_secret,
                'phone_number_id' => $request->phone_number_id,
                'page_id' => $request->page_id,
                'business_account_id' => $request->business_account_id,
                'instagram_account_id' => $request->instagram_account_id,
                'webhook_verify_token' => $request->webhook_verify_token,
                'additional_config' => $request->additional_config ?? [],
                'expires_at' => $request->expires_at,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials saved successfully',
                'data' => $credential->makeHidden(['access_token', 'app_secret', 'webhook_verify_token']),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to save credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get specific platform credentials
     */
    public function show(Request $request, string $credentialId): JsonResponse
    {
        $user = $request->user();

        try {
            $credential = MetaPlatformCredential::forCompany($user->company_id)
                ->select(['id', 'platform', 'app_id', 'phone_number_id', 'page_id', 'business_account_id', 'instagram_account_id', 'additional_config', 'is_active', 'expires_at', 'created_at'])
                ->findOrFail($credentialId);

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials fetched successfully',
                'data' => $credential,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Credential not found: ' . $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Update platform credentials
     */
    public function update(Request $request, string $credentialId): JsonResponse
    {
        $user = $request->user();
        
        try {
            $credential = MetaPlatformCredential::forCompany($user->company_id)
                ->findOrFail($credentialId);

            $validator = Validator::make($request->all(), [
                'app_id' => 'sometimes|string',
                'access_token' => 'sometimes|string',
                'app_secret' => 'sometimes|string',
                'phone_number_id' => 'sometimes|nullable|string',
                'page_id' => 'sometimes|nullable|string',
                'business_account_id' => 'sometimes|nullable|string',
                'instagram_account_id' => 'sometimes|nullable|string',
                'webhook_verify_token' => 'sometimes|string',
                'additional_config' => 'sometimes|array',
                'expires_at' => 'sometimes|nullable|date|after:now',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'failed',
                    'message' => $validator->errors(),
                ], 400);
            }

            $credential->update($request->only([
                'app_id', 'access_token', 'app_secret', 'phone_number_id', 
                'page_id', 'business_account_id', 'instagram_account_id',
                'webhook_verify_token', 'additional_config', 'expires_at'
            ]));

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials updated successfully',
                'data' => $credential->makeHidden(['access_token', 'app_secret', 'webhook_verify_token']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete platform credentials
     */
    public function destroy(Request $request, string $credentialId): JsonResponse
    {
        $user = $request->user();

        try {
            $credential = MetaPlatformCredential::forCompany($user->company_id)
                ->findOrFail($credentialId);

            $credential->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Activate platform credentials
     */
    public function activate(Request $request, string $credentialId): JsonResponse
    {
        $user = $request->user();

        try {
            $credential = MetaPlatformCredential::forCompany($user->company_id)
                ->findOrFail($credentialId);

            $credential->update(['is_active' => true]);

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials activated successfully',
                'data' => $credential->makeHidden(['access_token', 'app_secret', 'webhook_verify_token']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to activate credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Deactivate platform credentials
     */
    public function deactivate(Request $request, string $credentialId): JsonResponse
    {
        $user = $request->user();

        try {
            $credential = MetaPlatformCredential::forCompany($user->company_id)
                ->findOrFail($credentialId);

            $credential->update(['is_active' => false]);

            return response()->json([
                'status' => 'success',
                'message' => 'Platform credentials deactivated successfully',
                'data' => $credential->makeHidden(['access_token', 'app_secret', 'webhook_verify_token']),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to deactivate credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Test platform credentials
     */
    public function testCredentials(Request $request, string $credentialId): JsonResponse
    {
        $user = $request->user();

        try {
            $credential = MetaPlatformCredential::forCompany($user->company_id)
                ->findOrFail($credentialId);

            // Perform platform-specific credential validation
            $testResult = $this->validatePlatformCredentials($credential);

            return response()->json([
                'status' => $testResult['success'] ? 'success' : 'failed',
                'message' => $testResult['message'],
                'details' => $testResult['details'] ?? null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to test credentials: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get webhook URL for platform setup
     */
    public function getWebhookUrl(Request $request, string $platform): JsonResponse
    {
        $user = $request->user();

        try {
            $webhookUrl = config('app.url') . "/api/webhooks/meta/{$platform}";
            
            return response()->json([
                'status' => 'success',
                'webhook_url' => $webhookUrl,
                'verify_token' => 'YOUR_VERIFY_TOKEN_HERE', // This should be generated/configured per company
                'instructions' => $this->getWebhookSetupInstructions($platform),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate webhook URL: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Validate platform credentials by making test API calls
     */
    private function validatePlatformCredentials(MetaPlatformCredential $credential): array
    {
        try {
            switch ($credential->platform) {
                case 'whatsapp':
                    return $this->validateWhatsAppCredentials($credential);
                case 'instagram':
                    return $this->validateInstagramCredentials($credential);
                case 'messenger':
                    return $this->validateMessengerCredentials($credential);
                default:
                    return [
                        'success' => false,
                        'message' => 'Unknown platform: ' . $credential->platform,
                    ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Validation failed: ' . $e->getMessage(),
            ];
        }
    }

    private function validateWhatsAppCredentials(MetaPlatformCredential $credential): array
    {
        // Test WhatsApp Business API credentials
        $url = "https://graph.facebook.com/v18.0/{$credential->phone_number_id}";
        
        $response = $this->makeMetaApiCall($url, 'GET', [], $credential->access_token);
        
        if ($response['success']) {
            return [
                'success' => true,
                'message' => 'WhatsApp credentials are valid',
                'data' => $response['data'],
            ];
        }
        
        return [
            'success' => false,
            'message' => 'WhatsApp credentials validation failed',
            'details' => $response['error'],
        ];
    }

    private function validateInstagramCredentials(MetaPlatformCredential $credential): array
    {
        // Test Instagram API credentials
        $url = "https://graph.facebook.com/v18.0/{$credential->instagram_account_id}";
        
        $response = $this->makeMetaApiCall($url, 'GET', [], $credential->access_token);
        
        if ($response['success']) {
            return [
                'success' => true,
                'message' => 'Instagram credentials are valid',
                'details' => $response['data'],
            ];
        }
        
        return [
            'success' => false,
            'message' => 'Instagram credentials validation failed',
            'details' => $response['error'],
        ];
    }

    private function validateMessengerCredentials(MetaPlatformCredential $credential): array
    {
        // Test Messenger API credentials
        $url = "https://graph.facebook.com/v18.0/{$credential->page_id}";
        
        $response = $this->makeMetaApiCall($url, 'GET', [], $credential->access_token);
        
        if ($response['success']) {
            return [
                'success' => true,
                'message' => 'Messenger credentials are valid',
                'data' => $response['data'],
            ];
        }
        
        return [
            'success' => false,
            'message' => 'Messenger credentials validation failed',
            'details' => $response['error'],
        ];
    }

    private function makeMetaApiCall(string $url, string $method, array $data = [], string $accessToken = null): array
    {
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json',
            ],
        ]);
        
        if ($method === 'POST' && !empty($data)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            return [
                'success' => false,
                'error' => 'cURL error: ' . $error,
            ];
        }
        
        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'data' => $decodedResponse,
            ];
        }
        
        return [
            'success' => false,
            'error' => $decodedResponse['error'] ?? 'Unknown API error',
            'http_code' => $httpCode,
        ];
    }

    private function getWebhookSetupInstructions(string $platform): array
    {
        $instructions = [
            'whatsapp' => [
                'title' => 'WhatsApp Business API Webhook Setup',
                'steps' => [
                    '1. Go to your Meta App Dashboard',
                    '2. Select your WhatsApp Business App',
                    '3. Navigate to WhatsApp > Configuration',
                    '4. In the Webhook section, click "Edit"',
                    '5. Enter the webhook URL provided above',
                    '6. Enter the verify token',
                    '7. Subscribe to webhook fields: messages, message_deliveries, message_reads',
                ],
            ],
            'instagram' => [
                'title' => 'Instagram Messaging API Webhook Setup',
                'steps' => [
                    '1. Go to your Meta App Dashboard',
                    '2. Select your Instagram App',
                    '3. Navigate to Messenger > Settings',
                    '4. In the Webhooks section, click "Add Callback URL"',
                    '5. Enter the webhook URL provided above',
                    '6. Enter the verify token',
                    '7. Subscribe to webhook fields: messages, messaging_postbacks, messaging_optins',
                ],
            ],
            'messenger' => [
                'title' => 'Messenger Platform Webhook Setup',
                'steps' => [
                    '1. Go to your Meta App Dashboard',
                    '2. Select your Messenger App',
                    '3. Navigate to Messenger > Settings',
                    '4. In the Webhooks section, click "Add Callback URL"',
                    '5. Enter the webhook URL provided above',
                    '6. Enter the verify token',
                    '7. Subscribe to webhook fields: messages, messaging_postbacks, messaging_optins',
                ],
            ],
        ];

        return $instructions[$platform] ?? [];
    }
}
