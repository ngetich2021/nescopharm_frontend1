<?php

namespace App\Http\Controllers;

use App\Models\Sop;
use App\Models\User;
use App\Services\SopDocumentConversionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;

class SopController extends Controller
{
    public function __construct(protected SopDocumentConversionService $documentConversionService)
    {
        $this->middleware('auth:sanctum')->except(['publicViewDocument']);
    }

    protected function hasPermission(Request $request, string $permission, ?string $resourceCompanyId = null): bool
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
            return $resourceCompanyId === null || $user->company_id === $resourceCompanyId;
        }

        return $role->hasPermission($permission);
    }

    protected function ensureAssignedUpdaterIsValid(string $companyId, ?string $userId): ?string
    {
        if (!$userId) {
            return null;
        }

        $exists = User::where('id', $userId)->where('company_id', $companyId)->exists();
        return $exists ? null : 'Assigned updater must belong to your company.';
    }

    protected function resolveStorageDisk(?Sop $sop = null): string
    {
        return $sop?->storage_disk
            ?? config('sop.storage_disk', config('filesystems.default', 'public'));
    }

    /**
     * @return array{
     *   document_path: string,
     *   original_file_name: string,
     *   mime_type: string,
     *   file_size: int,
     *   metadata: array<string, mixed>
     * }
     */
    protected function storeUploadedDocument(UploadedFile $file, string $companyId, int $year, string $disk): array
    {
        $sourceName = $file->getClientOriginalName() ?: 'sop-document';
        $sourceMime = $file->getClientMimeType() ?: null;
        $sourcePath = $file->getRealPath() ?: $file->getPathname();
        if (!$sourcePath) {
            throw new RuntimeException('Unable to read uploaded SOP document.');
        }

        $conversionResult = $this->documentConversionService->ensurePdfFromLocalFile(
            $sourcePath,
            $sourceName,
            $sourceMime
        );

        try {
            $targetExtension = strtolower(pathinfo($conversionResult['file_name'], PATHINFO_EXTENSION) ?: 'pdf');
            $targetBaseName = pathinfo($conversionResult['file_name'], PATHINFO_FILENAME) ?: 'sop-document';
            $storedFileName = Str::uuid()->toString() . '-' . Str::slug($targetBaseName) . '.' . $targetExtension;
            $storagePath = 'sops/' . $companyId . '/' . $year . '/' . $storedFileName;

            $fileContents = file_get_contents($conversionResult['local_path']);
            if ($fileContents === false) {
                throw new RuntimeException('Failed to read processed SOP document.');
            }

            Storage::disk($disk)->put($storagePath, $fileContents, [
                'ContentType' => $conversionResult['mime_type'],
            ]);

            return [
                'document_path' => $storagePath,
                'original_file_name' => $conversionResult['file_name'],
                'mime_type' => $conversionResult['mime_type'],
                'file_size' => $conversionResult['file_size'],
                'metadata' => [
                    'upload_original_file_name' => $sourceName,
                    'upload_original_mime_type' => $sourceMime,
                    'converted_to_pdf' => (bool) $conversionResult['was_converted'],
                    'conversion_engine' => $conversionResult['converter'],
                    'converted_at' => $conversionResult['was_converted'] ? now()->toIso8601String() : null,
                ],
            ];
        } finally {
            $this->documentConversionService->cleanupTempResult($conversionResult);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = Sop::with([
            'assignedUpdater:id,first_name,last_name,email',
            'createdBy:id,first_name,last_name,email',
        ])
            ->withCount(['annexures', 'comments'])
            ->where('company_id', $companyId);

        if ($request->filled('year')) {
            $query->where('year', (int) $request->year);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('assigned_updater_id')) {
            $query->where('assigned_updater_id', $request->assigned_updater_id);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', '%' . $search . '%')
                    ->orWhere('sop_number', 'ilike', '%' . $search . '%');
            });
        }

        $perPage = max(1, min((int) $request->get('per_page', 15), 100));
        $sops = $query->orderByDesc('year')->orderBy('title')->paginate($perPage);

        return response()->json($sops);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_create_sops', $companyId)
            && !$this->hasPermission($request, 'can_create_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'sop_number' => 'nullable|string|max:100',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'year' => 'required|integer|min:2000|max:2100',
            'status' => 'sometimes|string|in:draft,active,archived',
            'assigned_updater_id' => 'nullable|uuid|exists:users,id',
            'effective_date' => 'nullable|date',
            'review_date' => 'nullable|date|after_or_equal:effective_date',
            'metadata' => 'nullable|array',
            'document' => 'nullable|file|max:51200|mimes:pdf,doc,docx,xlsx,xls',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $assignmentError = $this->ensureAssignedUpdaterIsValid($companyId, $request->assigned_updater_id);
        if ($assignmentError) {
            return response()->json(['message' => $assignmentError], 422);
        }

        $documentPath = null;
        $storageDisk = $this->resolveStorageDisk();
        $originalFileName = null;
        $mimeType = null;
        $fileSize = null;
        $documentMetadata = null;

        if ($request->hasFile('document')) {
            try {
                $documentInfo = $this->storeUploadedDocument(
                    $request->file('document'),
                    $companyId,
                    (int) $request->year,
                    $storageDisk
                );
                $documentPath = $documentInfo['document_path'];
                $originalFileName = $documentInfo['original_file_name'];
                $mimeType = $documentInfo['mime_type'];
                $fileSize = $documentInfo['file_size'];
                $documentMetadata = $documentInfo['metadata'];
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Failed to process SOP document: ' . $e->getMessage(),
                ], 422);
            }
        }

        $sop = Sop::create([
            'company_id' => $companyId,
            'sop_number' => $request->sop_number,
            'title' => $request->title,
            'description' => $request->description,
            'year' => (int) $request->year,
            'status' => $request->status ?? 'active',
            'assigned_updater_id' => $request->assigned_updater_id,
            'effective_date' => $request->effective_date,
            'review_date' => $request->review_date,
            'document_path' => $documentPath,
            'storage_disk' => $documentPath ? $storageDisk : null,
            'original_file_name' => $originalFileName,
            'mime_type' => $mimeType,
            'file_size' => $fileSize,
            'metadata' => array_merge($request->metadata ?? [], $documentMetadata ?? []),
            'created_by' => $user->id,
        ]);

        return response()->json([
            'message' => 'SOP created successfully',
            'data' => $sop->load([
                'assignedUpdater:id,first_name,last_name,email',
                'createdBy:id,first_name,last_name,email',
            ]),
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = Sop::with([
            'assignedUpdater:id,first_name,last_name,email',
            'createdBy:id,first_name,last_name,email',
            'annexures' => function ($query) {
                $query->withCount('entries')->orderBy('created_at');
            },
            'comments' => function ($query) {
                $query->with('commentedBy:id,first_name,last_name,email')
                    ->orderByDesc('created_at')
                    ->limit(100);
            },
        ])
            ->where('company_id', $companyId)
            ->findOrFail($id);

        return response()->json($sop);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_update_sops', $companyId)
            && !$this->hasPermission($request, 'can_update_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = Sop::where('company_id', $companyId)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'sop_number' => 'sometimes|nullable|string|max:100',
            'title' => 'sometimes|required|string|max:255',
            'description' => 'sometimes|nullable|string',
            'year' => 'sometimes|integer|min:2000|max:2100',
            'status' => 'sometimes|string|in:draft,active,archived',
            'assigned_updater_id' => 'sometimes|nullable|uuid|exists:users,id',
            'effective_date' => 'sometimes|nullable|date',
            'review_date' => 'sometimes|nullable|date|after_or_equal:effective_date',
            'metadata' => 'sometimes|nullable|array',
            'document' => 'sometimes|nullable|file|max:51200|mimes:pdf,doc,docx,xlsx,xls',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        if ($request->has('assigned_updater_id')) {
            $assignmentError = $this->ensureAssignedUpdaterIsValid($companyId, $request->assigned_updater_id);
            if ($assignmentError) {
                return response()->json(['message' => $assignmentError], 422);
            }
        }

        $updateData = $request->only([
            'sop_number',
            'title',
            'description',
            'year',
            'status',
            'assigned_updater_id',
            'effective_date',
            'review_date',
            'metadata',
        ]);

        if ($request->hasFile('document')) {
            $targetYear = $request->input('year', $sop->year ?? now()->year);
            $oldDisk = $this->resolveStorageDisk($sop);
            $newDisk = $this->resolveStorageDisk();
            try {
                $documentInfo = $this->storeUploadedDocument(
                    $request->file('document'),
                    $companyId,
                    (int) $targetYear,
                    $newDisk
                );
            } catch (\Throwable $e) {
                return response()->json([
                    'message' => 'Failed to process SOP document: ' . $e->getMessage(),
                ], 422);
            }

            if ($sop->document_path && Storage::disk($oldDisk)->exists($sop->document_path)) {
                Storage::disk($oldDisk)->delete($sop->document_path);
            }

            $updateData['document_path'] = $documentInfo['document_path'];
            $updateData['storage_disk'] = $newDisk;
            $updateData['original_file_name'] = $documentInfo['original_file_name'];
            $updateData['mime_type'] = $documentInfo['mime_type'];
            $updateData['file_size'] = $documentInfo['file_size'];
            $updateData['metadata'] = array_merge(
                (array) ($sop->metadata ?? []),
                (array) ($updateData['metadata'] ?? []),
                (array) ($documentInfo['metadata'] ?? [])
            );
        }

        $sop->update($updateData);

        return response()->json([
            'message' => 'SOP updated successfully',
            'data' => $sop->fresh([
                'assignedUpdater:id,first_name,last_name,email',
                'createdBy:id,first_name,last_name,email',
            ]),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_delete_sops', $companyId)
            && !$this->hasPermission($request, 'can_delete_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = Sop::where('company_id', $companyId)->findOrFail($id);
        $disk = $this->resolveStorageDisk($sop);

        if ($sop->document_path && Storage::disk($disk)->exists($sop->document_path)) {
            Storage::disk($disk)->delete($sop->document_path);
        }

        $sop->delete();

        return response()->json(['message' => 'SOP deleted successfully']);
    }

    public function downloadDocument(Request $request, string $id)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = Sop::where('company_id', $companyId)->findOrFail($id);

        if (!$sop->document_path) {
            return response()->json(['message' => 'SOP document not found'], 404);
        }

        $disk = $this->resolveStorageDisk($sop);
        $fileName = $sop->original_file_name ?: basename($sop->document_path);
        $mimeType = $sop->mime_type ?: 'application/octet-stream';

        try {
            $url = Storage::disk($disk)->temporaryUrl(
                $sop->document_path,
                now()->addMinutes(30),
                [
                    'ResponseContentType' => $mimeType,
                    'ResponseContentDisposition' => 'attachment; filename="' . addslashes($fileName) . '"',
                ]
            );
            return redirect($url);
        } catch (\Throwable $e) {
            if (!Storage::disk($disk)->exists($sop->document_path)) {
                return response()->json(['message' => 'SOP document not found'], 404);
            }
            return Storage::disk($disk)->download($sop->document_path, $fileName);
        }
    }

    public function viewDocument(Request $request, string $id)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = Sop::where('company_id', $companyId)->findOrFail($id);

        if (!$sop->document_path) {
            return response()->json(['message' => 'SOP document not found'], 404);
        }

        $disk = $this->resolveStorageDisk($sop);
        $displayName = $sop->original_file_name ?: basename($sop->document_path);
        $mimeType = $sop->mime_type ?: 'application/octet-stream';

        try {
            $url = Storage::disk($disk)->temporaryUrl(
                $sop->document_path,
                now()->addMinutes(30),
                [
                    'ResponseContentType' => $mimeType,
                    'ResponseContentDisposition' => 'inline; filename="' . addslashes($displayName) . '"',
                ]
            );
            return redirect($url);
        } catch (\Throwable $e) {
            if (!Storage::disk($disk)->exists($sop->document_path)) {
                return response()->json(['message' => 'SOP document not found'], 404);
            }
            return Storage::disk($disk)->response(
                $sop->document_path,
                $displayName,
                [
                    'Content-Disposition' => 'inline; filename="' . addslashes($displayName) . '"',
                    'X-Content-Type-Options' => 'nosniff',
                    'Cache-Control' => 'private, max-age=0, must-revalidate',
                ]
            );
        }
    }

    public function getDocumentAccessUrl(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sop = Sop::where('company_id', $companyId)->findOrFail($id);
        $disk = $this->resolveStorageDisk($sop);

        if (!$sop->document_path || !Storage::disk($disk)->exists($sop->document_path)) {
            return response()->json(['message' => 'SOP document not found'], 404);
        }

        $ttlMinutes = max(1, min((int) $request->query('ttl_minutes', 15), 120));
        $expiresAt = now()->addMinutes($ttlMinutes);
        $fileName = $sop->original_file_name ?: basename($sop->document_path);
        $mimeType = $sop->mime_type ?: 'application/pdf';
        $viewUrl = URL::temporarySignedRoute(
            'sops.document.public-view',
            $expiresAt,
            ['id' => $sop->id]
        );
        $source = 'signed_backend_url';
        $useStorageTemporaryUrl = filter_var(
            $request->query('use_storage_temporary_url', false),
            FILTER_VALIDATE_BOOLEAN
        );

        if ($useStorageTemporaryUrl) {
            try {
                $viewUrl = Storage::disk($disk)->temporaryUrl(
                    $sop->document_path,
                    $expiresAt,
                    [
                        'ResponseContentType' => $mimeType,
                        'ResponseContentDisposition' => 'inline; filename="' . addslashes($fileName) . '"',
                    ]
                );
                $source = 'storage_temporary_url';
            } catch (\Throwable $e) {
                // Keep signed backend URL fallback for reliability across storage providers.
            }
        }

        return response()->json([
            'data' => [
                'view_url' => $viewUrl,
                'expires_at' => $expiresAt->toIso8601String(),
                'ttl_minutes' => $ttlMinutes,
                'source' => $source,
            ],
        ]);
    }

    public function publicViewDocument(Request $request, string $id)
    {
        $sop = Sop::findOrFail($id);

        if (!$sop->document_path) {
            return response()->json(['message' => 'SOP document not found'], 404);
        }

        $disk = $this->resolveStorageDisk($sop);
        $displayName = $sop->original_file_name ?: basename($sop->document_path);
        $mimeType = $sop->mime_type ?: 'application/octet-stream';

        try {
            $url = Storage::disk($disk)->temporaryUrl(
                $sop->document_path,
                now()->addMinutes(30),
                [
                    'ResponseContentType' => $mimeType,
                    'ResponseContentDisposition' => 'inline; filename="' . addslashes($displayName) . '"',
                ]
            );
            return redirect($url);
        } catch (\Throwable $e) {
            if (!Storage::disk($disk)->exists($sop->document_path)) {
                return response()->json(['message' => 'SOP document not found'], 404);
            }
            return Storage::disk($disk)->response(
                $sop->document_path,
                $displayName,
                [
                    'Content-Disposition' => 'inline; filename="' . addslashes($displayName) . '"',
                    'X-Content-Type-Options' => 'nosniff',
                    'Cache-Control' => 'private, max-age=0, must-revalidate',
                ]
            );
        }
    }

    public function printData(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');

        $sop = Sop::with([
            'assignedUpdater:id,first_name,last_name,email',
            'createdBy:id,first_name,last_name,email',
            'annexures' => function ($annexureQuery) use ($dateFrom, $dateTo) {
                $annexureQuery->with([
                    'entries' => function ($entriesQuery) use ($dateFrom, $dateTo) {
                        if ($dateFrom) {
                            $entriesQuery->whereDate('entry_date', '>=', $dateFrom);
                        }
                        if ($dateTo) {
                            $entriesQuery->whereDate('entry_date', '<=', $dateTo);
                        }
                        $entriesQuery->with('updatedBy:id,first_name,last_name,email')
                            ->orderBy('entry_date');
                    },
                ])->orderBy('created_at');
            },
            'comments' => function ($commentQuery) {
                $commentQuery->with('commentedBy:id,first_name,last_name,email')
                    ->orderBy('created_at');
            },
        ])
            ->where('company_id', $companyId)
            ->findOrFail($id);

        $annexuresPayload = $sop->annexures->map(function ($annexure) {
            $entries = $annexure->entries->map(function ($entry) {
                return [
                    'id' => $entry->id,
                    'sop_annexure_id' => $entry->sop_annexure_id,
                    'sop_id' => $entry->sop_id,
                    'entry_date' => $entry->entry_date,
                    'data_payload' => $entry->data_payload,
                    'updated_by' => $entry->updated_by,
                    'updated_by_user' => $entry->updatedBy ? [
                        'id' => $entry->updatedBy->id,
                        'first_name' => $entry->updatedBy->first_name,
                        'last_name' => $entry->updatedBy->last_name,
                        'email' => $entry->updatedBy->email,
                    ] : null,
                    'created_at' => $entry->created_at,
                    'updated_at' => $entry->updated_at,
                ];
            });

            return [
                'annexure' => [
                    'id' => $annexure->id,
                    'sop_id' => $annexure->sop_id,
                    'name' => $annexure->name,
                    'description' => $annexure->description,
                    'update_frequency' => $annexure->update_frequency,
                    'columns_definition' => $annexure->columns_definition,
                    'is_active' => $annexure->is_active,
                    'entries_count' => $entries->count(),
                ],
                'entries' => $entries,
            ];
        });

        $commentsPayload = $sop->comments->map(function ($comment) {
            return [
                'id' => $comment->id,
                'sop_id' => $comment->sop_id,
                'sop_annexure_id' => $comment->sop_annexure_id,
                'sop_annexure_entry_id' => $comment->sop_annexure_entry_id,
                'comment_type' => $comment->comment_type,
                'comment' => $comment->comment,
                'commented_by' => $comment->commented_by,
                'commented_by_user' => $comment->commentedBy ? [
                    'id' => $comment->commentedBy->id,
                    'first_name' => $comment->commentedBy->first_name,
                    'last_name' => $comment->commentedBy->last_name,
                    'email' => $comment->commentedBy->email,
                ] : null,
                'created_at' => $comment->created_at,
            ];
        });

        // Unload relations so they don't appear in the sop payload.
        $sop->unsetRelation('annexures');
        $sop->unsetRelation('comments');

        return response()->json([
            'message' => 'SOP print data generated successfully',
            'data' => [
                'sop' => $sop,
                'annexures' => $annexuresPayload,
                'comments' => $commentsPayload,
            ],
        ]);
    }

    public function emailDocument(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $companyId = $user->company_id;

        if (
            !$this->hasPermission($request, 'can_view_sops', $companyId)
            && !$this->hasPermission($request, 'can_view_reports', $companyId)
        ) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'recipients' => 'required|array|min:1|max:20',
            'recipients.*' => 'required|email',
            'subject' => 'nullable|string|max:255',
            'message' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        $sop = Sop::where('company_id', $companyId)->findOrFail($id);
        $disk = $this->resolveStorageDisk($sop);

        if (!$sop->document_path || !Storage::disk($disk)->exists($sop->document_path)) {
            return response()->json(['message' => 'SOP document not found'], 404);
        }

        $fileContents = Storage::disk($disk)->get($sop->document_path);
        $attachmentName = $sop->original_file_name ?: basename($sop->document_path);
        $mimeType = $sop->mime_type ?: 'application/octet-stream';
        $subject = $request->subject ?: ('SOP Document: ' . $sop->title);
        $body = $request->message ?: ('Please find the SOP attached: ' . $sop->title);

        foreach ($request->recipients as $recipient) {
            Mail::raw($body, function ($mail) use ($recipient, $subject, $fileContents, $attachmentName, $mimeType) {
                $mail->to($recipient)
                    ->subject($subject)
                    ->attachData($fileContents, $attachmentName, ['mime' => $mimeType]);
            });
        }

        return response()->json([
            'message' => 'SOP emailed successfully',
            'sent_to' => $request->recipients,
        ]);
    }
}
