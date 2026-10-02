<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Sop;
use App\Models\User;
use App\Services\SopDocumentConversionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ImportSopDocuments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * Example:
     * php artisan sops:import "/path/to/folder" COMPANY_UUID USER_UUID --year=2026 --assigned_updater_id=USER_UUID
     */
    protected $signature = 'sops:import
        {source_dir : Absolute path to folder containing SOP documents}
        {company_id : Company UUID}
        {created_by : User UUID creating the SOP records}
        {--year= : SOP year. Defaults to current year}
        {--assigned_updater_id= : Optional default assigned updater UUID}
        {--status=active : SOP status (draft|active|archived)}
        {--disk= : Filesystem disk for document storage (defaults to SOP storage disk config)}
        {--include-spreadsheets : Also import xls/xlsx files}
        {--skip-existing : Skip records with same title and year}
        {--dry-run : Preview import without writing files/records}';

    /**
     * The console command description.
     */
    protected $description = 'Bulk-import SOP documents from a local folder into SOP records';

    public function __construct(protected SopDocumentConversionService $documentConversionService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $sourceDir = (string) $this->argument('source_dir');
        $companyId = (string) $this->argument('company_id');
        $createdBy = (string) $this->argument('created_by');
        $assignedUpdater = $this->option('assigned_updater_id') ?: null;
        $year = (int) ($this->option('year') ?: now()->year);
        $status = (string) ($this->option('status') ?: 'active');
        $disk = (string) ($this->option('disk') ?: config('sop.storage_disk', config('filesystems.default', 'public')));
        $skipExisting = (bool) $this->option('skip-existing');
        $dryRun = (bool) $this->option('dry-run');

        if (!in_array($status, ['draft', 'active', 'archived'], true)) {
            $this->error('Invalid --status value. Use draft, active, or archived.');
            return self::FAILURE;
        }

        if (!is_dir($sourceDir)) {
            $this->error('Source directory does not exist: ' . $sourceDir);
            return self::FAILURE;
        }

        if (!Company::where('id', $companyId)->exists()) {
            $this->error('Company not found: ' . $companyId);
            return self::FAILURE;
        }

        $creator = User::where('id', $createdBy)->where('company_id', $companyId)->first();
        if (!$creator) {
            $this->error('Created-by user must exist and belong to the provided company.');
            return self::FAILURE;
        }

        if ($assignedUpdater) {
            $updater = User::where('id', $assignedUpdater)->where('company_id', $companyId)->first();
            if (!$updater) {
                $this->error('Assigned updater must exist and belong to the provided company.');
                return self::FAILURE;
            }
        }

        $allowedExtensions = ['pdf', 'doc', 'docx'];
        if ($this->option('include-spreadsheets')) {
            $allowedExtensions[] = 'xls';
            $allowedExtensions[] = 'xlsx';
        }
        $files = array_values(array_filter(scandir($sourceDir) ?: [], function ($item) use ($sourceDir, $allowedExtensions) {
            $fullPath = rtrim($sourceDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $item;
            if (!is_file($fullPath)) {
                return false;
            }

            $extension = strtolower(pathinfo($item, PATHINFO_EXTENSION));
            return in_array($extension, $allowedExtensions, true);
        }));

        if (count($files) === 0) {
            $this->warn('No supported SOP files found in folder.');
            return self::SUCCESS;
        }

        $this->info('Found ' . count($files) . ' file(s). Starting import...');
        $imported = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($files as $fileName) {
            $fullPath = rtrim($sourceDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $fileName;
            $title = $this->buildTitleFromFileName($fileName);
            $sopNumber = $this->extractSopNumber($fileName);

            if ($skipExisting) {
                $exists = Sop::where('company_id', $companyId)
                    ->where('title', $title)
                    ->where('year', $year)
                    ->exists();

                if ($exists) {
                    $this->line('SKIP (exists): ' . $fileName);
                    $skipped++;
                    continue;
                }
            }

            try {
                if ($dryRun) {
                    $this->line('DRY RUN: ' . $fileName . ' -> title="' . $title . '"');
                    $imported++;
                    continue;
                }

                $sourceMimeType = mime_content_type($fullPath) ?: null;
                $conversionResult = $this->documentConversionService->ensurePdfFromLocalFile(
                    $fullPath,
                    $fileName,
                    $sourceMimeType
                );

                try {
                    $targetExtension = strtolower(pathinfo($conversionResult['file_name'], PATHINFO_EXTENSION) ?: 'pdf');
                    $targetBaseName = pathinfo($conversionResult['file_name'], PATHINFO_FILENAME) ?: pathinfo($fileName, PATHINFO_FILENAME);
                    $storedFileName = Str::uuid()->toString() . '-' . Str::slug($targetBaseName) . '.' . $targetExtension;
                    $storagePath = 'sops/' . $companyId . '/' . $year . '/' . $storedFileName;

                    $fileContents = file_get_contents($conversionResult['local_path']);
                    if ($fileContents === false) {
                        throw new RuntimeException('Failed to read processed document content.');
                    }

                    Storage::disk($disk)->put($storagePath, $fileContents, [
                        'ContentType' => $conversionResult['mime_type'],
                    ]);

                    Sop::create([
                        'company_id' => $companyId,
                        'sop_number' => $sopNumber,
                        'title' => $title,
                        'description' => null,
                        'year' => $year,
                        'status' => $status,
                        'assigned_updater_id' => $assignedUpdater,
                        'effective_date' => null,
                        'review_date' => null,
                        'document_path' => $storagePath,
                        'storage_disk' => $disk,
                        'original_file_name' => $conversionResult['file_name'],
                        'mime_type' => $conversionResult['mime_type'],
                        'file_size' => $conversionResult['file_size'],
                        'metadata' => [
                            'imported_via' => 'sops:import',
                            'source_file_name' => $fileName,
                            'source_mime_type' => $sourceMimeType,
                            'converted_to_pdf' => (bool) $conversionResult['was_converted'],
                            'conversion_engine' => $conversionResult['converter'],
                            'converted_at' => $conversionResult['was_converted'] ? now()->toIso8601String() : null,
                        ],
                        'created_by' => $createdBy,
                    ]);
                } finally {
                    $this->documentConversionService->cleanupTempResult($conversionResult);
                }

                $this->line('IMPORTED: ' . $fileName);
                $imported++;
            } catch (\Throwable $e) {
                $this->error('FAILED: ' . $fileName . ' -> ' . $e->getMessage());
                $failed++;
            }
        }

        $this->newLine();
        $this->info('Import finished.');
        $this->line('Imported: ' . $imported);
        $this->line('Skipped: ' . $skipped);
        $this->line('Failed: ' . $failed);

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    protected function buildTitleFromFileName(string $fileName): string
    {
        $base = pathinfo($fileName, PATHINFO_FILENAME);
        $clean = preg_replace('/\s+/', ' ', trim($base)) ?: $base;
        return trim($clean);
    }

    protected function extractSopNumber(string $fileName): ?string
    {
        if (preg_match('/\b(SOP[\s\-]?[0-9A-Za-z\/\.-]+)\b/i', $fileName, $matches)) {
            return strtoupper(str_replace(' ', '-', $matches[1]));
        }

        return null;
    }
}
