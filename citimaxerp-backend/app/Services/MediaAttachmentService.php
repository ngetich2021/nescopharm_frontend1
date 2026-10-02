<?php

namespace App\Services;

use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MetaPlatformCredential;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaAttachmentService
{
    protected string $storageDisk;

    public function __construct()
    {
        $this->storageDisk = config('chat.media.storage_disk', config('filesystems.default', 'public'));
    }

    /**
     * Download WhatsApp media file from Meta API
     */
    public function downloadWhatsAppMedia(string $mediaId, MetaPlatformCredential $credentials): array
    {
        try {
            // Step 1: Get media URL from Meta API
            $mediaInfoResponse = Http::withToken($credentials->access_token)
                ->get("https://graph.facebook.com/v18.0/{$mediaId}");

            if (!$mediaInfoResponse->successful()) {
                return [
                    'success' => false,
                    'error' => 'Failed to get media info: ' . $mediaInfoResponse->body(),
                ];
            }

            $mediaInfo = $mediaInfoResponse->json();
            $mediaUrl = $mediaInfo['url'] ?? null;
            $mimeType = $mediaInfo['mime_type'] ?? 'application/octet-stream';
            $fileSize = $mediaInfo['file_size'] ?? 0;

            if (!$mediaUrl) {
                return [
                    'success' => false,
                    'error' => 'No media URL found in response',
                ];
            }

            // Step 2: Download the actual file
            $downloadResponse = Http::withToken($credentials->access_token)
                ->timeout(60) // 60 seconds timeout for large files
                ->get($mediaUrl);

            if (!$downloadResponse->successful()) {
                return [
                    'success' => false,
                    'error' => 'Failed to download media: ' . $downloadResponse->body(),
                ];
            }

            // Step 3: Generate filename and store file
            $extension = $this->getExtensionFromMimeType($mimeType);
            $filename = 'whatsapp_' . $mediaId . '_' . time() . '.' . $extension;
            $directory = 'whatsapp/' . date('Y/m');
            $filePath = $directory . '/' . $filename;

            // Store file content using Laravel Storage
            $stored = Storage::disk($this->storageDisk)->put($filePath, $downloadResponse->body());
            $fileUrl = $this->getPublicUrl($filePath);

            if (!$stored) {
                return [
                    'success' => false,
                    'error' => 'Failed to store media file',
                ];
            }

            return [
                'success' => true,
                'file_path' => $filePath,
                'file_url' => $fileUrl,
                'filename' => $filename,
                'original_filename' => $mediaInfo['sha256'] ?? $filename, // Use hash as original name if available
                'mime_type' => $mimeType,
                'file_size' => $fileSize,
                'platform_file_id' => $mediaId,
                'metadata' => [
                    'source' => 'whatsapp_download',
                    'original_media_info' => $mediaInfo,
                    'downloaded_at' => now()->toISOString(),
                ],
            ];

        } catch (\Exception $e) {
            Log::error('Failed to download WhatsApp media', [
                'media_id' => $mediaId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Download failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Upload and store media file from agent
     */
    public function storeUploadedFile(UploadedFile $file, string $platform = 'whatsapp'): array
    {
        try {
            // Validate file
            $maxSize = config('chat.media.max_file_size', 16 * 1024 * 1024); // 16MB default
            if ($file->getSize() > $maxSize) {
                return [
                    'success' => false,
                    'error' => 'File size exceeds maximum allowed size',
                ];
            }

            // Check allowed file types
            $allowedMimeTypes = config('chat.media.allowed_mime_types', [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'video/mp4',
                'video/3gpp',
                'video/quicktime',
                'audio/aac',
                'audio/mp4',
                'audio/mpeg',
                'audio/amr',
                'audio/ogg',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain',
                'text/csv',
            ]);

            $mimeType = $file->getMimeType();
            if (!in_array($mimeType, $allowedMimeTypes)) {
                return [
                    'success' => false,
                    'error' => 'File type not allowed: ' . $mimeType,
                ];
            }

            // Generate secure filename
            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();
            $filename = Str::random(40) . '.' . $extension;
            $directory = $platform . '/' . date('Y/m');
            $filePath = $directory . '/' . $filename;

            // Store file using Laravel Storage
            $storedPath = $file->storeAs($directory, $filename, $this->storageDisk);

            if (!$storedPath) {
                return [
                    'success' => false,
                    'error' => 'Failed to store uploaded file',
                ];
            }

            // Get public URL
            $fileUrl = $this->getPublicUrl($storedPath);

            return [
                'success' => true,
                'file_path' => $storedPath,
                'file_url' => $fileUrl,
                'filename' => $filename,
                'original_filename' => $originalName,
                'mime_type' => $mimeType,
                'file_size' => $file->getSize(),
                'platform_file_id' => null,
                'storage_type' => $this->storageDisk,
                'metadata' => [
                    'source' => 'agent_upload',
                    'uploaded_at' => now()->toISOString(),
                    'original_extension' => $extension,
                    'storage_disk' => $this->storageDisk,
                ],
            ];

        } catch (\Exception $e) {
            Log::error('Failed to store uploaded file', [
                'original_name' => $file->getClientOriginalName(),
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Upload failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Create attachment record for a message
     */
    public function createAttachment(Message $message, array $fileData): MessageAttachment
    {
        return MessageAttachment::create([
            'message_id' => $message->id,
            'filename' => $fileData['filename'],
            'original_filename' => $fileData['original_filename'],
            'mime_type' => $fileData['mime_type'],
            'file_size' => $fileData['file_size'],
            'file_path' => $fileData['file_path'],
            'file_url' => $fileData['file_url'],
            'platform_file_id' => $fileData['platform_file_id'],
            'metadata' => $fileData['metadata'] ?? [],
        ]);
    }

    /**
     * Get public URL for stored file
     */
    public function getPublicUrl(string $filePath): string
    {
        try {
            // For cloud storage (S3/R2), use signed URLs by default if bucket might be private
            if ($this->storageDisk === 's3' || config("filesystems.disks.{$this->storageDisk}.driver") === 's3') {
                try {
                    return Storage::disk($this->storageDisk)->temporaryUrl(
                        $filePath,
                        now()->addHours(24) // 24 hour expiration
                    );
                } catch (\Exception $e) {
                    // Fallback to public URL if temporaryUrl is not supported
                    return Storage::disk($this->storageDisk)->url($filePath);
                }
            }

            return Storage::disk($this->storageDisk)->url($filePath);
        } catch (\Exception $e) {
            Log::warning('Failed to get public URL for file', [
                'file_path' => $filePath,
                'storage_disk' => $this->storageDisk,
                'error' => $e->getMessage()
            ]);

            return url("storage/{$filePath}");
        }
    }

    /**
     * Get MIME type for a file
     */
    private function getMimeTypeForFile(string $filePath): string
    {
        try {
            $mimeType = Storage::disk($this->storageDisk)->mimeType($filePath);
            if ($mimeType) {
                return $mimeType;
            }

            // Fallback: determine MIME type from extension
            $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            $mimeTypes = [
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png' => 'image/png',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
                'mp4' => 'video/mp4',
                '3gp' => 'video/3gpp',
                'mov' => 'video/quicktime',
                'aac' => 'audio/aac',
                'm4a' => 'audio/mp4',
                'mp3' => 'audio/mpeg',
                'amr' => 'audio/amr',
                'ogg' => 'audio/ogg',
                'pdf' => 'application/pdf',
                'doc' => 'application/msword',
                'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls' => 'application/vnd.ms-excel',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'txt' => 'text/plain',
                'csv' => 'text/csv',
            ];

            return $mimeTypes[$extension] ?? 'application/octet-stream';

        } catch (\Exception $e) {
            Log::warning('Failed to get MIME type for file', [
                'file_path' => $filePath,
                'error' => $e->getMessage()
            ]);

            return 'application/octet-stream';
        }
    }

    /**
     * Upload media to WhatsApp for sending
     */
    public function uploadToWhatsApp(string $filePath, MetaPlatformCredential $credentials): array
    {
        try {
            // Get file content from storage disk
            if (!Storage::disk($this->storageDisk)->exists($filePath)) {
                return [
                    'success' => false,
                    'error' => 'File not found: ' . $filePath,
                ];
            }

            $fileContent = Storage::disk($this->storageDisk)->get($filePath);
            $mimeType = $this->getMimeTypeForFile($filePath);
            $filename = basename($filePath);

            // Upload to WhatsApp
            $response = Http::withToken($credentials->access_token)
                ->attach('file', $fileContent, $filename)
                ->post("https://graph.facebook.com/v18.0/{$credentials->phone_number_id}/media", [
                    'messaging_product' => 'whatsapp',
                    'type' => $this->getWhatsAppMediaType($mimeType),
                ]);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'error' => 'Failed to upload to WhatsApp: ' . $response->body(),
                ];
            }

            $responseData = $response->json();
            $mediaId = $responseData['id'] ?? null;

            if (!$mediaId) {
                return [
                    'success' => false,
                    'error' => 'No media ID returned from WhatsApp',
                ];
            }

            return [
                'success' => true,
                'media_id' => $mediaId,
                'response' => $responseData,
            ];

        } catch (\Exception $e) {
            Log::error('Failed to upload media to WhatsApp', [
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Upload to WhatsApp failed: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get file extension from MIME type
     */
    private function getExtensionFromMimeType(string $mimeType): string
    {
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'video/mp4' => 'mp4',
            'video/3gpp' => '3gp',
            'video/quicktime' => 'mov',
            'audio/aac' => 'aac',
            'audio/mp4' => 'm4a',
            'audio/mpeg' => 'mp3',
            'audio/amr' => 'amr',
            'audio/ogg' => 'ogg',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'text/plain' => 'txt',
            'text/csv' => 'csv',
        ];

        return $extensions[$mimeType] ?? 'bin';
    }

    /**
     * Get WhatsApp media type from MIME type
     */
    private function getWhatsAppMediaType(string $mimeType): string
    {
        if (str_starts_with($mimeType, 'image/')) {
            return 'image';
        } elseif (str_starts_with($mimeType, 'video/')) {
            return 'video';
        } elseif (str_starts_with($mimeType, 'audio/')) {
            return 'audio';
        } else {
            return 'document';
        }
    }

    /**
     * Generate thumbnail for media (if applicable)
     */
    public function generateThumbnail(string $filePath, string $mimeType): ?string
    {
        // This is a placeholder for thumbnail generation
        if (str_starts_with($mimeType, 'image/')) {
            return $filePath;
        }

        return null;
    }

    /**
     * Clean up old media files
     */
    public function cleanupOldFiles(int $daysOld = 30): array
    {
        $cutoffDate = now()->subDays($daysOld);
        $deletedCount = 0;
        $errors = [];

        try {
            // Get old attachments
            $oldAttachments = MessageAttachment::where('created_at', '<', $cutoffDate)
                ->whereNotNull('file_path')
                ->get();

            foreach ($oldAttachments as $attachment) {
                try {
                    if (Storage::disk($this->storageDisk)->exists($attachment->file_path)) {
                        Storage::disk($this->storageDisk)->delete($attachment->file_path);
                        $deletedCount++;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Failed to delete {$attachment->file_path}: " . $e->getMessage();
                }
            }

            return [
                'success' => true,
                'deleted_count' => $deletedCount,
                'errors' => $errors,
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'deleted_count' => $deletedCount,
                'errors' => $errors,
            ];
        }
    }
}
