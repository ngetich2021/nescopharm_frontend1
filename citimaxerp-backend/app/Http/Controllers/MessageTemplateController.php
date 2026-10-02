<?php

namespace App\Http\Controllers;

use App\Models\MessageTemplate;
use App\Services\MetaChatService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class MessageTemplateController extends Controller
{
    protected $metaChatService;

    public function __construct(MetaChatService $metaChatService)
    {
        $this->middleware('auth:sanctum');
        $this->metaChatService = $metaChatService;
    }

    /**
     * Get all message templates for the company
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'platform' => 'nullable|in:whatsapp,instagram,messenger,all',
            'category' => 'nullable|in:marketing,utility,authentication,general',
            'template_type' => 'nullable|in:text,media,interactive,list,button',
            'is_active' => 'nullable|boolean',
            'approval_status' => 'nullable|in:pending,approved,rejected',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $query = MessageTemplate::with(['creator'])
                ->forCompany($user->company_id)
                ->orderBy('created_at', 'desc');

            // Apply filters
            if ($request->platform) {
                $query->forPlatform($request->platform);
            }

            if ($request->category) {
                $query->byCategory($request->category);
            }

            if ($request->template_type) {
                $query->where('template_type', $request->template_type);
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            if ($request->approval_status) {
                $query->where('approval_status', $request->approval_status);
            }

            $templates = $query->paginate($request->per_page ?? 20);

            return response()->json([
                'status' => 'success',
                'templates' => $templates,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch templates: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create a new message template
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:message_templates,name,NULL,id,company_id,' . $user->company_id,
            'description' => 'nullable|string|max:500',
            'platform' => 'required|in:whatsapp,instagram,messenger',
            'category' => 'required|in:marketing,utility,authentication,general',
            'template_type' => 'required|in:text,media,interactive,list,button',
            'content' => 'required|string',
            'language_code' => 'nullable|string|max:10',
            'message_send_ttl_seconds' => 'nullable|integer|min:30|max:2592000',
            'create_on_platform' => 'nullable|boolean',
            
            // Header component
            'header' => 'nullable|array',
            'header.format' => 'required_with:header|in:TEXT,IMAGE,VIDEO,DOCUMENT',
            'header.text' => 'required_if:header.format,TEXT|string|max:60',
            'header.example' => 'nullable|string',
            
            // Footer component
            'footer' => 'nullable|string|max:60',
            
            // Variables for body text
            'variables' => 'nullable|array',
            'variables.*.name' => 'required|string|max:50',
            'variables.*.example' => 'required|string|max:100',
            
            // Buttons component
            'buttons' => 'nullable|array|max:10',
            'buttons.*.type' => 'required|in:URL,PHONE_NUMBER,QUICK_REPLY',
            'buttons.*.text' => 'required|string|max:25',
            'buttons.*.url' => 'required_if:buttons.*.type,URL|url',
            'buttons.*.phone_number' => 'required_if:buttons.*.type,PHONE_NUMBER|string',
            'buttons.*.example' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $createOnPlatform = $request->boolean('create_on_platform', true);
            $templateData = $request->all();
            $templateData['company_id'] = $user->company_id;
            $templateData['created_by'] = $user->id;
            $templateData['language_code'] = $request->language_code ?? 'en_US';
            
            // If creating on platform (WhatsApp API), create it first
            if ($createOnPlatform && $request->platform === 'whatsapp') {
                $apiResult = $this->metaChatService->createWhatsAppTemplate($templateData, $user->company_id);
                
                if (!$apiResult['success']) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Failed to create template on WhatsApp: ' . $apiResult['error'],
                        'details' => $apiResult,
                    ], 400);
                }
                
                // Add platform data to template
                $templateData['platform_template_id'] = $apiResult['platform_template_id'];
                $templateData['approval_status'] = $apiResult['status'] === 'APPROVED' ? 'approved' : 'pending';
            }

            // Create template in database
            $template = MessageTemplate::create([
                'company_id' => $user->company_id,
                'name' => $templateData['name'],
                'description' => $templateData['description'],
                'platform' => $templateData['platform'],
                'category' => $templateData['category'],
                'template_type' => $templateData['template_type'],
                'content' => $templateData['content'],
                'rich_content' => [
                    'header' => $templateData['header'] ?? null,
                    'footer' => $templateData['footer'] ?? null,
                    'buttons' => $templateData['buttons'] ?? [],
                ],
                'variables' => $templateData['variables'] ?? [],
                'language_code' => $templateData['language_code'],
                'message_send_ttl_seconds' => $templateData['message_send_ttl_seconds'] ?? null,
                'platform_template_id' => $templateData['platform_template_id'] ?? null,
                'approval_status' => $templateData['approval_status'] ?? 'pending',
                'created_by' => $user->id,
            ]);

            $response = [
                'status' => 'success',
                'message' => 'Template created successfully',
                'template' => $template->load('creator'),
            ];

            if ($createOnPlatform && $request->platform === 'whatsapp') {
                $response['platform_creation'] = [
                    'platform_template_id' => $apiResult['platform_template_id'],
                    'status' => $apiResult['status'],
                    'category' => $apiResult['category'],
                ];
            }

            return response()->json($response, 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a specific template
     */
    public function show(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::with(['creator'])
                ->forCompany($user->company_id)
                ->findOrFail($templateId);

            return response()->json([
                'status' => 'success',
                'template' => $template,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Template not found: ' . $e->getMessage(),
            ], 404);
        }
    }

    /**
     * Update a template
     */
    public function update(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255|unique:message_templates,name,' . $templateId . ',id,company_id,' . $user->company_id,
            'description' => 'nullable|string|max:500',
            'platform' => 'sometimes|in:whatsapp,instagram,messenger,all',
            'category' => 'sometimes|in:marketing,utility,authentication,general',
            'template_type' => 'sometimes|in:text,media,interactive,list,button',
            'content' => 'sometimes|string',
            'rich_content' => 'nullable|array',
            'variables' => 'nullable|array',
            'language_code' => 'nullable|string|max:5',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $template->update($request->only([
                'name', 'description', 'platform', 'category', 'template_type',
                'content', 'rich_content', 'variables', 'language_code'
            ]));

            return response()->json([
                'status' => 'success',
                'message' => 'Template updated successfully',
                'template' => $template->load('creator'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a template
     */
    public function destroy(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $template->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Template deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Activate a template
     */
    public function activate(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $template->activate();

            return response()->json([
                'status' => 'success',
                'message' => 'Template activated successfully',
                'template' => $template,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to activate template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Deactivate a template
     */
    public function deactivate(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $template->deactivate();

            return response()->json([
                'status' => 'success',
                'message' => 'Template deactivated successfully',
                'template' => $template,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to deactivate template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Approve a template
     */
    public function approve(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $template->approve();

            return response()->json([
                'status' => 'success',
                'message' => 'Template approved successfully',
                'template' => $template,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to approve template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject a template
     */
    public function reject(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $template->reject();

            return response()->json([
                'status' => 'success',
                'message' => 'Template rejected successfully',
                'template' => $template,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to reject template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Preview a template with variables
     */
    public function preview(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'variables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $variables = $request->variables ?? [];
            $renderedContent = $template->renderContent($variables);

            return response()->json([
                'status' => 'success',
                'preview' => [
                    'original_content' => $template->content,
                    'rendered_content' => $renderedContent,
                    'variables_used' => $variables,
                    'available_variables' => $template->getVariablePlaceholders(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to preview template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get template categories and types
     */
    public function getMetadata(): JsonResponse
    {
        try {
            $metadata = [
                'categories' => [
                    'marketing' => 'Marketing Templates',
                    'utility' => 'Utility Templates',
                    'authentication' => 'Authentication Templates',
                    'general' => 'General Templates',
                ],
                'template_types' => [
                    'text' => 'Text Only',
                    'media' => 'Media (Image/Video)',
                    'interactive' => 'Interactive Buttons',
                    'list' => 'List Selection',
                    'button' => 'Call-to-Action Buttons',
                ],
                'platforms' => [
                    'whatsapp' => 'WhatsApp',
                    'instagram' => 'Instagram',
                    'messenger' => 'Messenger',
                ],
                'approval_statuses' => [
                    'pending' => 'Pending Approval',
                    'approved' => 'Approved',
                    'rejected' => 'Rejected',
                ],
                'header_formats' => [
                    'TEXT' => 'Text Header',
                    'IMAGE' => 'Image Header',
                    'VIDEO' => 'Video Header',
                    'DOCUMENT' => 'Document Header',
                ],
                'button_types' => [
                    'URL' => 'Website URL',
                    'PHONE_NUMBER' => 'Phone Call',
                    'QUICK_REPLY' => 'Quick Reply',
                ],
                'language_codes' => [
                    'en_US' => 'English (US)',
                    'en_GB' => 'English (UK)',
                    'es_ES' => 'Spanish (Spain)',
                    'es_MX' => 'Spanish (Mexico)',
                    'fr_FR' => 'French (France)',
                    'de_DE' => 'German',
                    'it_IT' => 'Italian',
                    'pt_BR' => 'Portuguese (Brazil)',
                    'ru_RU' => 'Russian',
                    'ar_AR' => 'Arabic',
                    'hi_IN' => 'Hindi',
                    'ja_JP' => 'Japanese',
                    'ko_KR' => 'Korean',
                    'zh_CN' => 'Chinese (Simplified)',
                    'zh_TW' => 'Chinese (Traditional)',
                ],
                'ttl_limits' => [
                    'authentication' => ['min' => 30, 'max' => 900, 'default' => 900],
                    'utility' => ['min' => 30, 'max' => 43200, 'default' => 43200],
                    'marketing' => ['min' => 43200, 'max' => 2592000, 'default' => 2592000],
                ],
                'validation_rules' => [
                    'template_name' => 'Max 512 characters, lowercase, underscore, numbers only',
                    'header_text' => 'Max 60 characters',
                    'footer_text' => 'Max 60 characters',
                    'button_text' => 'Max 25 characters',
                    'max_buttons' => 10,
                    'max_variables' => 'No strict limit, but keep reasonable',
                ],
            ];

            return response()->json([
                'status' => 'success',
                'metadata' => $metadata,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to fetch metadata: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Submit template to Meta for approval
     */
    public function submitForApproval(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            // Check if template can be submitted
            if ($template->approval_status === 'approved') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Template is already approved',
                ], 400);
            }

            if ($template->platform === 'all') {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Cannot submit "all platforms" template. Please create platform-specific templates.',
                ], 400);
            }

            $result = $this->metaChatService->submitTemplate($template);

            if ($result['success']) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Template submitted for approval successfully',
                    'template' => $template->fresh(),
                    'submission_result' => $result,
                ]);
            } else {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to submit template: ' . $result['error'],
                    'details' => $result,
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to submit template: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check template approval status on Meta platform
     */
    public function checkApprovalStatus(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $result = $this->metaChatService->checkTemplateStatus($template);

            if ($result['success']) {
                return response()->json([
                    'status' => 'success',
                    'template' => $template->fresh(),
                    'platform_status' => $result['data'],
                ]);
            } else {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to check status: ' . $result['error'],
                    'details' => $result,
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to check template status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete template from Meta platform
     */
    public function deleteFromPlatform(Request $request, string $templateId): JsonResponse
    {
        $user = $request->user();

        try {
            $template = MessageTemplate::forCompany($user->company_id)
                ->findOrFail($templateId);

            $result = $this->metaChatService->deleteTemplate($template);

            if ($result['success']) {
                // Clear platform-specific data after successful deletion
                $template->update([
                    'platform_template_id' => null,
                    'approval_status' => 'pending',
                ]);

                return response()->json([
                    'status' => 'success',
                    'message' => 'Template deleted from platform successfully',
                    'template' => $template->fresh(),
                ]);
            } else {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to delete template from platform: ' . $result['error'],
                    'details' => $result,
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete template from platform: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create template directly on WhatsApp platform (for testing)
     */
    public function createOnPlatform(Request $request): JsonResponse
    {
        $user = $request->user();
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'platform' => 'required|in:whatsapp',
            'category' => 'required|in:marketing,utility,authentication',
            'content' => 'required|string',
            'language_code' => 'nullable|string|max:10',
            'message_send_ttl_seconds' => 'nullable|integer|min:30|max:2592000',
            
            // Header component
            'header' => 'nullable|array',
            'header.format' => 'required_with:header|in:TEXT,IMAGE,VIDEO,DOCUMENT',
            'header.text' => 'required_if:header.format,TEXT|string|max:60',
            'header.example' => 'nullable|string',
            
            // Footer component
            'footer' => 'nullable|string|max:60',
            
            // Variables for body text
            'variables' => 'nullable|array',
            'variables.*.name' => 'required|string|max:50',
            'variables.*.example' => 'required|string|max:100',
            
            // Buttons component
            'buttons' => 'nullable|array|max:10',
            'buttons.*.type' => 'required|in:URL,PHONE_NUMBER,QUICK_REPLY',
            'buttons.*.text' => 'required|string|max:25',
            'buttons.*.url' => 'required_if:buttons.*.type,URL|url',
            'buttons.*.phone_number' => 'required_if:buttons.*.type,PHONE_NUMBER|string',
            'buttons.*.example' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        try {
            $templateData = $request->all();
            $templateData['language_code'] = $request->language_code ?? 'en_US';
            
            $result = $this->metaChatService->createWhatsAppTemplate($templateData, $user->company_id);
            
            if ($result['success']) {
                return response()->json([
                    'status' => 'success',
                    'message' => 'Template created on WhatsApp successfully',
                    'platform_template_id' => $result['platform_template_id'],
                    'approval_status' => $result['status'],
                    'category' => $result['category'],
                    'payload_sent' => $result['payload'],
                ]);
            } else {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Failed to create template on WhatsApp: ' . $result['error'],
                    'details' => $result,
                ], 400);
            }
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create template: ' . $e->getMessage(),
            ], 500);
        }
    }
}
