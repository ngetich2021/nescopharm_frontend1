<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Keeps the spreadsheets people upload (price lists, product / batch imports, Data Import) so the
 * import history can hand them back. They go to the cloud bucket: the app server's own disk is
 * wiped on every deploy, which is why older history downloads stopped working.
 */
class ImportFileStore
{
    public static function store(UploadedFile $file, string $dir, string $name): ?string
    {
        try {
            if ($path = $file->storeAs($dir, $name, 's3')) {
                return $path;
            }
        } catch (\Throwable $e) {
            Log::warning('Import file not saved to the bucket, keeping it on the server', ['error' => $e->getMessage()]);
        }

        return $file->storeAs($dir, $name, 'local') ?: null;
    }

    // The stored file as a download, from the bucket or (older imports) the server; null when gone.
    public static function download(?string $path, string $name)
    {
        if (!$path) {
            return null;
        }
        foreach (['s3', 'local'] as $disk) {
            try {
                if (Storage::disk($disk)->exists($path)) {
                    return Storage::disk($disk)->download($path, $name);
                }
            } catch (\Throwable $e) {
                // Bucket not reachable from here - try the next place.
            }
        }

        return null;
    }
}
