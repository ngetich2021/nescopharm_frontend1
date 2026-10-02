<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SupabaseStorageService
{
    protected Client $httpClient;
    protected string $projectId;
    protected string $serviceRoleKey;
    protected string $bucket;
    protected string $baseUrl;

    public function __construct()
    {
        $this->projectId = config('services.supabase.project_id');
        $this->serviceRoleKey = config('services.supabase.service_role_key');
        $this->bucket = config('services.supabase.storage_bucket', 'Cherry360');
        $this->baseUrl = "https://{$this->projectId}.supabase.co/storage/v1";

        $this->httpClient = new Client([
            'timeout' => 30,
        ]);
    }

    /**
     * Upload a file to Supabase Storage
     */
    public function uploadFile(UploadedFile $file, ?string $path = null): array
    {
        try {
            // Generate unique filename if path not provided
            if (!$path) {
                $extension = $file->getClientOriginalExtension();
                $path = 'uploads/' . date('Y/m/d') . '/' . Str::uuid() . '.' . $extension;
            }

            // Prepare file data
            $fileContent = file_get_contents($file->getPathname());
            $mimeType = $file->getMimeType();

            // Upload to Supabase
            $response = $this->httpClient->post("{$this->baseUrl}/object/{$this->bucket}/{$path}", [
                'headers' => [
                    'Content-Type' => $mimeType,
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                ],
                'body' => $fileContent,
            ]);

            // Supabase returns 200 for successful uploads
            if ($response->getStatusCode() === 200 || $response->getStatusCode() === 201) {
                $responseData = json_decode($response->getBody(), true);
                
                return [
                    'success' => true,
                    'file_path' => $path,
                    'file_url' => $this->getPublicUrl($path),
                    'filename' => basename($path),
                    'original_filename' => $file->getClientOriginalName(),
                    'mime_type' => $mimeType,
                    'file_size' => $file->getSize(),
                    'supabase_key' => $responseData['Key'] ?? $path,
                ];
            }

            throw new \Exception('Upload failed with status: ' . $response->getStatusCode() . ' - Response: ' . $response->getBody());

        } catch (RequestException $e) {
            Log::error('Supabase upload failed', [
                'error' => $e->getMessage(),
                'file' => $file->getClientOriginalName(),
                'path' => $path,
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null,
            ]);

            return [
                'success' => false,
                'error' => 'Upload failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase upload error', [
                'error' => $e->getMessage(),
                'file' => $file->getClientOriginalName(),
                'path' => $path,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Download a file from Supabase Storage
     */
    public function downloadFile(string $path): array
    {
        try {
            $response = $this->httpClient->get("{$this->baseUrl}/object/{$this->bucket}/{$path}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                return [
                    'success' => true,
                    'content' => $response->getBody()->getContents(),
                    'content_type' => $response->getHeader('Content-Type')[0] ?? 'application/octet-stream',
                ];
            }

            throw new \Exception('Download failed with status: ' . $response->getStatusCode());

        } catch (RequestException $e) {
            Log::error('Supabase download failed', [
                'error' => $e->getMessage(),
                'path' => $path,
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null,
            ]);

            return [
                'success' => false,
                'error' => 'Download failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase download error', [
                'error' => $e->getMessage(),
                'path' => $path,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get public URL for a file
     */
    public function getPublicUrl(string $path): string
    {
        return "https://{$this->projectId}.supabase.co/storage/v1/object/public/{$this->bucket}/{$path}";
    }

    /**
     * Delete a file from Supabase Storage
     */
    public function deleteFile(string $path): array
    {
        try {
            $response = $this->httpClient->delete("{$this->baseUrl}/object/{$this->bucket}/{$path}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                return [
                    'success' => true,
                ];
            }

            throw new \Exception('Delete failed with status: ' . $response->getStatusCode());

        } catch (RequestException $e) {
            Log::error('Supabase delete failed', [
                'error' => $e->getMessage(),
                'path' => $path,
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null,
            ]);

            return [
                'success' => false,
                'error' => 'Delete failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase delete error', [
                'error' => $e->getMessage(),
                'path' => $path,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Check if file exists
     */
    public function fileExists(string $path): bool
    {
        try {
            $response = $this->httpClient->head("{$this->baseUrl}/object/{$this->bucket}/{$path}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                ],
            ]);

            return $response->getStatusCode() === 200;

        } catch (\Exception $e) {
            return false;
        }
    }

        /**
     * Create storage bucket if it doesn't exist
     */
    public function createBucket(): array
    {
        try {
            $response = $this->httpClient->post("{$this->baseUrl}/bucket", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'id' => $this->bucket,
                    'name' => $this->bucket,
                    'public' => true,
                    'file_size_limit' => null,
                    'allowed_mime_types' => null,
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                return [
                    'success' => true,
                    'message' => 'Bucket created successfully',
                ];
            }

            throw new \Exception('Bucket creation failed with status: ' . $response->getStatusCode());

        } catch (RequestException $e) {
            $responseBody = $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null;
            
            // Check if bucket already exists
            if ($e->getCode() === 409 || (str_contains($responseBody, 'already exists'))) {
                return [
                    'success' => true,
                    'message' => 'Bucket already exists',
                ];
            }

            Log::error('Supabase bucket creation failed', [
                'error' => $e->getMessage(),
                'bucket' => $this->bucket,
                'response' => $responseBody,
            ]);

            return [
                'success' => false,
                'error' => 'Bucket creation failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase bucket creation error', [
                'error' => $e->getMessage(),
                'bucket' => $this->bucket,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update bucket to make it public
     */
    public function makeBucketPublic(): array
    {
        try {
            $response = $this->httpClient->put("{$this->baseUrl}/bucket/{$this->bucket}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'public' => true,
                    'file_size_limit' => null,
                    'allowed_mime_types' => null,
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                return [
                    'success' => true,
                    'message' => 'Bucket updated to public successfully',
                ];
            }

            throw new \Exception('Bucket update failed with status: ' . $response->getStatusCode() . ' - ' . $response->getBody());

        } catch (RequestException $e) {
            $responseBody = $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null;
            
            Log::error('Supabase bucket update failed', [
                'error' => $e->getMessage(),
                'bucket' => $this->bucket,
                'response' => $responseBody,
            ]);

            return [
                'success' => false,
                'error' => 'Bucket update failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase bucket update error', [
                'error' => $e->getMessage(),
                'bucket' => $this->bucket,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update bucket to make it private (authenticated access only)
     */
    public function makeBucketPrivate(): array
    {
        try {
            $response = $this->httpClient->put("{$this->baseUrl}/bucket/{$this->bucket}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'public' => false,
                    'file_size_limit' => null,
                    'allowed_mime_types' => null,
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                return [
                    'success' => true,
                    'message' => 'Bucket updated to private successfully',
                ];
            }

            throw new \Exception('Bucket update failed with status: ' . $response->getStatusCode() . ' - ' . $response->getBody());

        } catch (RequestException $e) {
            $responseBody = $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null;
            
            Log::error('Supabase bucket update failed', [
                'error' => $e->getMessage(),
                'bucket' => $this->bucket,
                'response' => $responseBody,
            ]);

            return [
                'success' => false,
                'error' => 'Bucket update failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase bucket update error', [
                'error' => $e->getMessage(),
                'bucket' => $this->bucket,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Generate a signed URL for private file access (temporary URL with expiration)
     */
    public function getSignedUrl(string $path, int $expiresIn = 3600): array
    {
        try {
            $response = $this->httpClient->post("{$this->baseUrl}/object/sign/{$this->bucket}/{$path}", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => [
                    'expiresIn' => $expiresIn, // Expiration in seconds
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                $data = json_decode($response->getBody(), true);
                $signedUrl = "https://{$this->projectId}.supabase.co/storage/v1{$data['signedURL']}";
                
                return [
                    'success' => true,
                    'signed_url' => $signedUrl,
                    'expires_in' => $expiresIn,
                    'expires_at' => now()->addSeconds($expiresIn)->toISOString(),
                ];
            }

            throw new \Exception('Signed URL generation failed with status: ' . $response->getStatusCode());

        } catch (RequestException $e) {
            Log::error('Supabase signed URL generation failed', [
                'error' => $e->getMessage(),
                'path' => $path,
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null,
            ]);

            return [
                'success' => false,
                'error' => 'Signed URL generation failed: ' . $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Supabase signed URL error', [
                'error' => $e->getMessage(),
                'path' => $path,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Test connection to Supabase Storage
     */
    public function testConnection(): array
    {
        try {
            // Try to list buckets
            $response = $this->httpClient->get("{$this->baseUrl}/bucket", [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->serviceRoleKey,
                    'apikey' => $this->serviceRoleKey,
                ],
            ]);

            if ($response->getStatusCode() === 200) {
                $buckets = json_decode($response->getBody(), true);
                
                return [
                    'success' => true,
                    'message' => 'Connection successful',
                    'buckets' => $buckets,
                ];
            }

            throw new \Exception('Connection test failed with status: ' . $response->getStatusCode());

        } catch (\Exception $e) {
            Log::error('Supabase connection test failed', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
