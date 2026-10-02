<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Generic authenticated file upload for ad-hoc attachments that are not tied
 * to a pre-existing documentable entity (e.g. an expense receipt uploaded
 * before the Expense record itself exists). Mirrors the storage/signed-URL
 * pattern used by DocumentController::store() and ProductImageService.
 */
class MediaController extends Controller
{
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

    /**
     * Upload a single file (e.g. an expense receipt) and return its signed URL.
     * Matches the FormData shape sent by lib/uploadMedia.ts: `file` + `folder`.
     */
    public function upload(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_expenses', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to upload files.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:10240',
            'folder' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors(),
            ], 400);
        }

        $file = $request->file('file');
        // Sanitize the folder name to prevent path traversal; default matches
        // the frontend's default folder for this endpoint.
        $folder = preg_replace('/[^A-Za-z0-9_\-]/', '-', $request->input('folder', 'uploads'));

        try {
            $path = $folder . '/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $file->getClientOriginalExtension();
            $stored = Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

            if (!$stored) {
                throw new \Exception('Failed to store file');
            }

            return response()->json([
                'status' => 'success',
                'message' => 'File uploaded successfully.',
                'data' => [
                    'url' => $this->getStorageUrl($path),
                    'path' => $path,
                ],
            ], 201);
        } catch (\Exception $e) {
            Log::error('Media upload failed', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'failed',
                'message' => 'File upload failed: ' . $e->getMessage(),
            ], 500);
        }
    }
}
