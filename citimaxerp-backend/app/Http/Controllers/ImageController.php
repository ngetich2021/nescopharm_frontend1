<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ImageController extends Controller
{
    protected string $disk;

    public function __construct()
    {
        $this->middleware('auth:sanctum');
        $this->disk = config('filesystems.default', 's3');
    }

    /**
     * Serve an image from Supabase Storage (for private buckets)
     * This acts as a proxy, requiring authentication
     * 
     * @param Request $request
     * @return \Illuminate\Http\Response
     */
    public function show(Request $request)
    {
        try {
            // Get the path from query parameter
            $path = $request->query('path');

            if (!$path) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Image path is required'
                ], 400);
            }

            // Validate user has permission to view images
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized'
                ], 401);
            }

            // Check if file exists
            if (!Storage::disk($this->disk)->exists($path)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Image not found'
                ], 404);
            }

            // Return the image
            $content = Storage::disk($this->disk)->get($path);
            $mimeType = Storage::disk($this->disk)->mimeType($path);

            return response($content)
                ->header('Content-Type', $mimeType)
                ->header('Cache-Control', 'private, max-age=3600')
                ->header('X-Content-Type-Options', 'nosniff');

        } catch (\Exception $e) {
            Log::error('Image serving error', [
                'error' => $e->getMessage(),
                'path' => $request->query('path')
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to serve image'
            ], 500);
        }
    }

    /**
     * Generate a temporary signed URL for an image
     * Useful for frontend apps that need direct image access for a limited time
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSignedUrl(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized'
                ], 401);
            }

            $path = $request->input('path');
            $expiresIn = $request->input('expires_in', 3600); // Default 1 hour

            if (!$path) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Image path is required'
                ], 400);
            }

            // Generate signed URL
            try {
                $signedUrl = Storage::disk($this->disk)->temporaryUrl(
                    $path,
                    now()->addSeconds($expiresIn)
                );
            } catch (\Exception $e) {
                // Fallback to url() if temporaryUrl() is not supported by driver
                $signedUrl = Storage::disk($this->disk)->url($path);
            }

            return response()->json([
                'status' => 'success',
                'data' => [
                    'signed_url' => $signedUrl,
                    'expires_in' => $expiresIn,
                    'expires_at' => now()->addSeconds($expiresIn)->toISOString()
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Signed URL generation error', [
                'error' => $e->getMessage(),
                'path' => $request->input('path')
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate signed URL'
            ], 500);
        }
    }

    /**
     * Get multiple signed URLs at once
     * Useful for batch operations like loading product galleries
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getBatchSignedUrls(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Unauthorized'
                ], 401);
            }

            $paths = $request->input('paths', []);
            $expiresIn = $request->input('expires_in', 3600); // Default 1 hour

            if (empty($paths) || !is_array($paths)) {
                return response()->json([
                    'status' => 'failed',
                    'message' => 'Paths array is required'
                ], 400);
            }

            $signedUrls = [];
            $errors = [];

            foreach ($paths as $path) {
                try {
                    $signedUrls[$path] = Storage::disk($this->disk)->temporaryUrl(
                        $path,
                        now()->addSeconds($expiresIn)
                    );
                } catch (\Exception $e) {
                    $signedUrls[$path] = Storage::disk($this->disk)->url($path);
                }
            }

            return response()->json([
                'status' => 'success',
                'data' => [
                    'signed_urls' => $signedUrls,
                    'errors' => $errors,
                    'expires_in' => $expiresIn
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Batch signed URL generation error', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to generate signed URLs'
            ], 500);
        }
    }
}
