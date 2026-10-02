<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    /**
     * Generate a unique document number for the company.
     * Format: DOC-{companyId8}-{sequential 4 digits}
     */
    protected function generateDocumentNumber($companyId)
    {
        $prefix = 'DOC-' . substr($companyId, 0, 8) . '-';

        // Use raw query to avoid model accessors interfering
        $lastDocument = DB::table('documents')
            ->select('document_number')
            ->where('company_id', $companyId)
            ->where('document_number', 'like', $prefix . '%')
            ->orderBy('document_number', 'desc')
            ->lockForUpdate()
            ->first();

        $nextNumber = $lastDocument ? (int) substr($lastDocument->document_number, strlen($prefix)) + 1 : 1;
        return $prefix . str_pad($nextNumber, 4, '0', STR_PAD_LEFT);
    }


    protected string $disk;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
        $this->disk = config('filesystems.default', 's3');
    }

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

    /**
     * Resolve a browser-accessible URL for a stored path. Cloud disks (S3/R2)
     * require a signed, time-limited URL since the bucket is not publicly
     * readable — mirrors ProductImageService::getUrl().
     */
    protected function getStorageUrl(string $path): string
    {
        if ($this->disk === 's3' || config("filesystems.disks.{$this->disk}.driver") === 's3') {
            try {
                return Storage::disk($this->disk)->temporaryUrl(
                    $path,
                    now()->addHours(24)
                );
            } catch (\Exception $e) {
                return Storage::disk($this->disk)->url($path);
            }
        }

        return Storage::disk($this->disk)->url($path);
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_documents', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view documents.',
                'data' => null
            ], 403);
        }
        $documents = Document::where('company_id', $user->company_id)->get();
        return response()->json([
            'status' => 'success',
            'message' => 'Documents retrieved successfully.',
            'data' => $documents
        ]);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_documents', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view documents.',
                'data' => null
            ], 403);
        }
        $document = Document::find($id);
        if (!$document) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Document not found.'
            ], 404);
        }
        if ($document->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view this document.'
            ], 403);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Document retrieved successfully.',
            'data' => $document
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_documents', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create documents.',
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'document_name' => 'required|string|max:255',
            'reference_number' => 'nullable|string|max:100',
            'expiry_date' => 'nullable|date',
            'regulatory_body' => 'nullable|string|max:255',
            'documentable_type' => 'required|string',
            'documentable_id' => 'required|uuid',
            'other_information' => 'nullable|string',
            'document_image' => 'nullable|file|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $documentImageUrl = null;
        if ($request->hasFile('document_image')) {
            $file = $request->file('document_image');
            try {
                $path = 'documents/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
                $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

                if ($stored) {
                    $documentImageUrl = $this->getStorageUrl($path);
                } else {
                    throw new \Exception('Failed to store document image');
                }
            } catch (\Exception $e) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Document image upload failed: ' . $e->getMessage(),
                ], 500);
            }
        }

        try {
            $documentNumber = $this->generateDocumentNumber($user->company_id);
            $document = Document::create([
                'id' => (string) Str::uuid(),
                'document_name' => $request->input('document_name'),
                'document_number' => $documentNumber,
                'reference_number' => $request->input('reference_number'),
                'expiry_date' => $request->input('expiry_date'),
                'regulatory_body' => $request->input('regulatory_body'),
                'document_image' => $documentImageUrl,
                'documentable_type' => $request->input('documentable_type'),
                'documentable_id' => $request->input('documentable_id'),
                'company_id' => $user->company_id,
                'created_by' => $user->id,
                'other_information' => $request->input('other_information'),
            ]);
            return response()->json([
                'status' => 'success',
                'message' => 'Document created successfully.',
                'data' => $document,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create document', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to create document: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_documents', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update documents.',
            ], 403);
        }
        $document = Document::find($id);
        if (!$document) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Document not found.'
            ], 404);
        }
        if ($document->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update this document.'
            ], 403);
        }
        $validator = Validator::make($request->all(), [
            'document_name' => 'sometimes|required|string|max:255',
            'reference_number' => 'nullable|string|max:100',
            'expiry_date' => 'nullable|date',
            'regulatory_body' => 'nullable|string|max:255',
            'other_information' => 'nullable|string',
            'document_image' => 'nullable|file|max:5120',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $documentImageUrl = $document->document_image;
        if ($request->hasFile('document_image')) {
            $file = $request->file('document_image');
            try {
                $path = 'documents/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
                $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

                if ($stored) {
                    $documentImageUrl = $this->getStorageUrl($path);
                } else {
                    throw new \Exception('Failed to store document image');
                }
            } catch (\Exception $e) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Document image upload failed: ' . $e->getMessage(),
                ], 500);
            }
        }

        try {
            $document->forceFill([
                'document_name' => $request->input('document_name', $document->document_name),
                'reference_number' => $request->input('reference_number', $document->reference_number),
                'expiry_date' => $request->input('expiry_date', $document->expiry_date),
                'regulatory_body' => $request->input('regulatory_body', $document->regulatory_body),
                'other_information' => $request->input('other_information', $document->other_information),
                'document_image' => $documentImageUrl,
            ])->save();
            return response()->json([
                'status' => 'success',
                'message' => 'Document updated successfully.',
                'data' => $document,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to update document', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to update document: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_delete_documents', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete documents.',
            ], 403);
        }
        $document = Document::find($id);
        if (!$document) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Document not found.'
            ], 404);
        }
        if ($document->company_id !== $user->company_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to delete this document.'
            ], 403);
        }
        try {
            $document->delete();
            return response()->json([
                'status' => 'success',
                'message' => 'Document deleted successfully.'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Failed to delete document', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to delete document: ' . $e->getMessage(),
            ], 500);
        }
    }
}
