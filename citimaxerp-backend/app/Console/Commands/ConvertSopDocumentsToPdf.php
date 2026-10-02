<?php

namespace App\Console\Commands;

use App\Models\Sop;
use App\Services\SopDocumentConversionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ConvertSopDocumentsToPdf extends Command
{
    protected $signature = 'sops:convert-documents-to-pdf
        {--company_id= : Optional company UUID filter}
        {--sop_id=* : Optional SOP UUID(s) to convert}
        {--disk= : Force storage disk instead of per-record disk}
        {--delete-original : Delete the original non-PDF file after successful conversion}
        {--dry-run : Preview conversions without writing changes}';

    protected $description = 'Convert existing SOP documents to PDF and update SOP records';

    public function __construct(protected SopDocumentConversionService $documentConversionService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $query = Sop::query()->whereNotNull('document_path');
        $companyId = $this->option('company_id');
        $sopIds = (array) $this->option('sop_id');
        $forcedDisk = $this->option('disk') ?: null;
        $deleteOriginal = (bool) $this->option('delete-original');
        $dryRun = (bool) $this->option('dry-run');

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        if (count($sopIds) > 0) {
            $query->whereIn('id', $sopIds);
        }

        $total = $query->count();
        if ($total === 0) {
            $this->warn('No SOP records found for conversion.');
            return self::SUCCESS;
        }

        $this->info('Processing ' . $total . ' SOP record(s)...');

        $converted = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($query->orderBy('created_at')->cursor() as $sop) {
            $disk = $forcedDisk ?: ($sop->storage_disk ?: config('sop.storage_disk', config('filesystems.default', 'public')));
            $documentPath = (string) $sop->document_path;

            if ($documentPath === '') {
                $skipped++;
                $this->line('SKIP (no document path): ' . $sop->id);
                continue;
            }

            $extension = strtolower((string) pathinfo($documentPath, PATHINFO_EXTENSION));
            $isPdf = strtolower((string) $sop->mime_type) === SopDocumentConversionService::PDF_MIME || $extension === 'pdf';
            if ($isPdf) {
                $skipped++;
                $this->line('SKIP (already PDF): ' . $sop->id);
                continue;
            }

            if (!Storage::disk($disk)->exists($documentPath)) {
                $failed++;
                $this->error('FAILED (missing file): ' . $sop->id . ' [' . $documentPath . ']');
                continue;
            }

            if ($dryRun) {
                $converted++;
                $this->line('DRY RUN: would convert SOP ' . $sop->id . ' from ' . $documentPath);
                continue;
            }

            $tmpSourcePath = null;
            $conversionResult = null;

            try {
                $tmpSourcePath = $this->downloadToTempFile($disk, $documentPath, $sop->original_file_name);
                $sourceName = $sop->original_file_name ?: basename($documentPath);

                $conversionResult = $this->documentConversionService->ensurePdfFromLocalFile(
                    $tmpSourcePath,
                    $sourceName,
                    $sop->mime_type
                );

                if (($conversionResult['mime_type'] ?? null) !== SopDocumentConversionService::PDF_MIME) {
                    throw new RuntimeException('Unsupported file type for PDF conversion.');
                }

                $pdfBytes = file_get_contents($conversionResult['local_path']);
                if ($pdfBytes === false) {
                    throw new RuntimeException('Failed to read converted PDF output.');
                }

                $pdfPath = $this->buildPdfPath($documentPath);
                Storage::disk($disk)->put($pdfPath, $pdfBytes, [
                    'ContentType' => SopDocumentConversionService::PDF_MIME,
                ]);

                $metadata = (array) ($sop->metadata ?? []);
                $metadata['converted_to_pdf'] = true;
                $metadata['conversion_engine'] = $conversionResult['converter'];
                $metadata['converted_at'] = now()->toIso8601String();
                $metadata['conversion_source_file_name'] = $sourceName;
                $metadata['conversion_source_mime_type'] = $sop->mime_type;

                $sop->document_path = $pdfPath;
                $sop->storage_disk = $disk;
                $sop->original_file_name = $this->toPdfFileName($sourceName, $pdfPath);
                $sop->mime_type = SopDocumentConversionService::PDF_MIME;
                $sop->file_size = (int) (filesize($conversionResult['local_path']) ?: strlen($pdfBytes));
                $sop->metadata = $metadata;
                $sop->save();

                if ($deleteOriginal && $pdfPath !== $documentPath && Storage::disk($disk)->exists($documentPath)) {
                    Storage::disk($disk)->delete($documentPath);
                }

                $converted++;
                $this->line('CONVERTED: ' . $sop->id . ' -> ' . $pdfPath);
            } catch (\Throwable $e) {
                $failed++;
                $this->error('FAILED: ' . $sop->id . ' -> ' . $e->getMessage());
            } finally {
                if (is_string($tmpSourcePath) && $tmpSourcePath !== '' && is_file($tmpSourcePath)) {
                    @unlink($tmpSourcePath);
                }
                if (is_array($conversionResult)) {
                    $this->documentConversionService->cleanupTempResult($conversionResult);
                }
            }
        }

        $this->newLine();
        $this->info('Conversion finished.');
        $this->line('Converted: ' . $converted);
        $this->line('Skipped: ' . $skipped);
        $this->line('Failed: ' . $failed);

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    protected function buildPdfPath(string $existingPath): string
    {
        $pathInfo = pathinfo($existingPath);
        $directory = ($pathInfo['dirname'] ?? '.') === '.' ? '' : ($pathInfo['dirname'] . '/');
        $filename = $pathInfo['filename'] ?? Str::uuid()->toString();

        return $directory . $filename . '.pdf';
    }

    protected function toPdfFileName(string $sourceName, string $pdfPath): string
    {
        $base = pathinfo($sourceName, PATHINFO_FILENAME);
        if ($base === '') {
            $base = pathinfo($pdfPath, PATHINFO_FILENAME);
        }

        return $base . '.pdf';
    }

    protected function downloadToTempFile(string $disk, string $path, ?string $originalFileName = null): string
    {
        $extension = strtolower((string) pathinfo((string) ($originalFileName ?: $path), PATHINFO_EXTENSION));
        $tempFile = tempnam(sys_get_temp_dir(), 'sop-src-');
        if ($tempFile === false) {
            throw new RuntimeException('Unable to create temporary source file.');
        }

        $tempWithExt = $tempFile . ($extension ? ('.' . $extension) : '');
        if (!rename($tempFile, $tempWithExt)) {
            @unlink($tempFile);
            throw new RuntimeException('Unable to prepare temporary source filename.');
        }

        $contents = Storage::disk($disk)->get($path);
        if (file_put_contents($tempWithExt, $contents) === false) {
            @unlink($tempWithExt);
            throw new RuntimeException('Unable to write temporary source file.');
        }

        return $tempWithExt;
    }
}
