<?php

namespace App\Jobs;

use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MetaPlatformCredential;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProcessMetaMediaJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected Message $message;
    protected string $mediaId;
    protected string $platform;

    public function __construct(Message $message, string $mediaId, string $platform)
    {
        $this->message = $message;
        $this->mediaId = $mediaId;
        $this->platform = $platform;
    }

    public function handle(): void
    {
        try {
            // Get platform credentials
            $credentials = MetaPlatformCredential::forCompany($this->message->conversation->company_id)
                ->forPlatform($this->platform)
                ->active()
                ->first();

            if (!$credentials) {
                throw new \Exception('No active credentials found for platform: ' . $this->platform);
            }

            // Download media from Meta servers
            $mediaInfo = $this->getMediaInfo($credentials);
            $mediaData = $this->downloadMedia($mediaInfo['url'], $credentials);

            // Store the media file
            $filename = $this->generateFilename($mediaInfo);
            $path = $this->storeMedia($mediaData, $filename);

            // Update message with media info
            $this->message->update([
                'media_url' => Storage::url($path),
                'media_type' => $mediaInfo['mime_type'],
                'media_size' => strlen($mediaData),
            ]);

            // Create attachment record
            MessageAttachment::create([
                'message_id' => $this->message->id,
                'filename' => $filename,
                'original_filename' => $mediaInfo['filename'] ?? $filename,
                'mime_type' => $mediaInfo['mime_type'],
                'file_size' => strlen($mediaData),
                'file_path' => $path,
                'file_url' => Storage::url($path),
                'platform_file_id' => $this->mediaId,
                'metadata' => $mediaInfo,
            ]);

            Log::info('Media processed successfully', [
                'message_id' => $this->message->id,
                'media_id' => $this->mediaId,
                'platform' => $this->platform,
                'file_size' => strlen($mediaData),
                'mime_type' => $mediaInfo['mime_type'],
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to process media', [
                'message_id' => $this->message->id,
                'media_id' => $this->mediaId,
                'platform' => $this->platform,
                'error' => $e->getMessage(),
            ]);

            // Mark message as failed
            $this->message->update([
                'status' => 'failed',
                'error_message' => 'Failed to process media: ' . $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function getMediaInfo(MetaPlatformCredential $credentials): array
    {
        $url = match($this->platform) {
            'whatsapp' => "https://graph.facebook.com/v18.0/{$this->mediaId}",
            'instagram', 'messenger' => "https://graph.facebook.com/v18.0/{$this->mediaId}",
            default => throw new \Exception('Unsupported platform: ' . $this->platform)
        };

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $credentials->access_token,
        ])->get($url);

        if (!$response->successful()) {
            throw new \Exception('Failed to get media info: ' . $response->body());
        }

        return $response->json();
    }

    private function downloadMedia(string $mediaUrl, MetaPlatformCredential $credentials): string
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $credentials->access_token,
        ])->timeout(60)->get($mediaUrl);

        if (!$response->successful()) {
            throw new \Exception('Failed to download media: ' . $response->status());
        }

        return $response->body();
    }

    private function generateFilename(array $mediaInfo): string
    {
        $extension = $this->getExtensionFromMimeType($mediaInfo['mime_type']);
        $timestamp = now()->format('Ymd_His');
        $random = Str::random(8);
        
        return "{$this->platform}_{$timestamp}_{$random}.{$extension}";
    }

    private function getExtensionFromMimeType(string $mimeType): string
    {
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'video/mp4' => 'mp4',
            'video/3gpp' => '3gp',
            'audio/aac' => 'aac',
            'audio/mp3' => 'mp3',
            'audio/mpeg' => 'mp3',
            'audio/amr' => 'amr',
            'audio/ogg' => 'ogg',
            'application/pdf' => 'pdf',
            'application/msword' => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel' => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'application/vnd.ms-powerpoint' => 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
            'text/plain' => 'txt',
        ];

        return $extensions[$mimeType] ?? 'bin';
    }

    private function storeMedia(string $mediaData, string $filename): string
    {
        $disk = config('chat.storage.disk', 'public');
        $basePath = config('chat.storage.media_path', 'chat-media');
        
        $path = "{$basePath}/{$this->platform}/" . date('Y/m/d') . "/{$filename}";
        
        Storage::disk($disk)->put($path, $mediaData);
        
        return $path;
    }
}
