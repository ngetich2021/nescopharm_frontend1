<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class SopDocumentConversionService
{
    public const PDF_MIME = 'application/pdf';

    /**
     * Extensions we can normalize to PDF.
     *
     * @var array<int, string>
     */
    protected array $convertibleExtensions = [
        'doc',
        'docx',
        'xls',
        'xlsx',
        'odt',
        'rtf',
        'txt',
        'htm',
        'html',
    ];

    /**
     * @return array{
     *   local_path: string,
     *   file_name: string,
     *   mime_type: string,
     *   file_size: int,
     *   was_converted: bool,
     *   cleanup: bool,
     *   temp_dir: string|null,
     *   converter: string|null
     * }
     */
    public function ensurePdfFromLocalFile(string $inputPath, string $originalFileName, ?string $mimeType = null): array
    {
        if (!is_file($inputPath)) {
            throw new RuntimeException('Document file not found for conversion.');
        }

        if (!$this->shouldConvertToPdf($mimeType, $originalFileName, $inputPath)) {
            return [
                'local_path' => $inputPath,
                'file_name' => $originalFileName,
                'mime_type' => $mimeType ?: (mime_content_type($inputPath) ?: 'application/octet-stream'),
                'file_size' => (int) (filesize($inputPath) ?: 0),
                'was_converted' => false,
                'cleanup' => false,
                'temp_dir' => null,
                'converter' => null,
            ];
        }

        $extension = $this->resolveExtension($originalFileName, $inputPath) ?: 'bin';
        $tempDir = $this->makeTempDir();
        $localInput = $tempDir . DIRECTORY_SEPARATOR . 'source.' . $extension;

        if (!copy($inputPath, $localInput)) {
            throw new RuntimeException('Unable to prepare file for PDF conversion.');
        }

        $localPdfPath = $tempDir . DIRECTORY_SEPARATOR . 'converted.pdf';
        $converter = null;

        try {
            $textUtilBinary = $this->binaryExists('/usr/bin/textutil')
                ? '/usr/bin/textutil'
                : ($this->binaryExists('textutil') ? 'textutil' : null);

            if ($textUtilBinary !== null) {
                $localHtmlPath = $tempDir . DIRECTORY_SEPARATOR . 'converted.html';
                $this->convertWithTextUtil($textUtilBinary, $localInput, $localHtmlPath);
                $this->convertHtmlToPdf($localHtmlPath, $localPdfPath);
                $converter = 'textutil+dompdf';
            } elseif ($this->binaryExists('soffice')) {
                $this->convertWithSoffice($localInput, $tempDir);
                $converter = 'soffice';
            } else {
                // No converter available — store original file without conversion.
                $this->deleteDirectory($tempDir);
                return [
                    'local_path' => $inputPath,
                    'file_name' => $originalFileName,
                    'mime_type' => $mimeType ?: (mime_content_type($inputPath) ?: 'application/octet-stream'),
                    'file_size' => (int) (filesize($inputPath) ?: 0),
                    'was_converted' => false,
                    'cleanup' => false,
                    'temp_dir' => null,
                    'converter' => null,
                ];
            }
        } catch (\Throwable $e) {
            $this->deleteDirectory($tempDir);
            throw $e;
        }

        if (!is_file($localPdfPath)) {
            $this->deleteDirectory($tempDir);
            throw new RuntimeException('Document conversion produced no PDF output.');
        }

        $pdfBaseName = pathinfo($originalFileName, PATHINFO_FILENAME) ?: pathinfo($inputPath, PATHINFO_FILENAME);

        return [
            'local_path' => $localPdfPath,
            'file_name' => $pdfBaseName . '.pdf',
            'mime_type' => self::PDF_MIME,
            'file_size' => (int) (filesize($localPdfPath) ?: 0),
            'was_converted' => true,
            'cleanup' => true,
            'temp_dir' => $tempDir,
            'converter' => $converter,
        ];
    }

    public function cleanupTempResult(array $result): void
    {
        if (!($result['cleanup'] ?? false)) {
            return;
        }

        $tempDir = $result['temp_dir'] ?? null;
        if (is_string($tempDir) && $tempDir !== '' && is_dir($tempDir)) {
            $this->deleteDirectory($tempDir);
        }
    }

    public function shouldConvertToPdf(?string $mimeType = null, ?string $fileName = null, ?string $path = null): bool
    {
        if (is_string($mimeType) && strtolower(trim($mimeType)) === self::PDF_MIME) {
            return false;
        }

        $extension = $this->resolveExtension($fileName, $path);
        if ($extension === null) {
            return false;
        }

        if ($extension === 'pdf') {
            return false;
        }

        return in_array($extension, $this->convertibleExtensions, true);
    }

    protected function convertWithTextUtil(string $binary, string $inputPath, string $htmlOutputPath): void
    {
        $process = new Process([$binary, '-convert', 'html', '-output', $htmlOutputPath, $inputPath]);
        $process->setTimeout(120);
        $process->run();

        if (!$process->isSuccessful() || !is_file($htmlOutputPath)) {
            throw new RuntimeException('textutil conversion failed: ' . trim($process->getErrorOutput() ?: $process->getOutput()));
        }
    }

    protected function convertHtmlToPdf(string $htmlPath, string $pdfOutputPath): void
    {
        $html = file_get_contents($htmlPath);
        if ($html === false) {
            throw new RuntimeException('Failed to read converted HTML for PDF rendering.');
        }

        $options = new Options();
        $options->set('isRemoteEnabled', true);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        $bytes = $dompdf->output();
        if (file_put_contents($pdfOutputPath, $bytes) === false) {
            throw new RuntimeException('Failed to write generated PDF output.');
        }
    }

    protected function convertWithSoffice(string $inputPath, string $outputDir): void
    {
        $process = new Process([
            'soffice',
            '--headless',
            '--convert-to',
            'pdf:writer_pdf_Export',
            '--outdir',
            $outputDir,
            $inputPath,
        ]);
        $process->setTimeout(180);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new RuntimeException('soffice conversion failed: ' . trim($process->getErrorOutput() ?: $process->getOutput()));
        }

        $pdfCandidate = $outputDir . DIRECTORY_SEPARATOR . pathinfo($inputPath, PATHINFO_FILENAME) . '.pdf';
        $targetPath = $outputDir . DIRECTORY_SEPARATOR . 'converted.pdf';

        if (!is_file($pdfCandidate)) {
            throw new RuntimeException('soffice did not produce an output PDF.');
        }

        if (!rename($pdfCandidate, $targetPath)) {
            throw new RuntimeException('Failed to finalize PDF generated by soffice.');
        }
    }

    protected function resolveExtension(?string $fileName = null, ?string $path = null): ?string
    {
        $candidate = $fileName ?: $path;
        if (!$candidate) {
            return null;
        }

        $extension = strtolower((string) pathinfo($candidate, PATHINFO_EXTENSION));
        return $extension !== '' ? $extension : null;
    }

    protected function makeTempDir(): string
    {
        $baseDir = storage_path('app/tmp/sop-conversion');
        if (!is_dir($baseDir) && !mkdir($baseDir, 0775, true) && !is_dir($baseDir)) {
            throw new RuntimeException('Unable to create temporary conversion directory.');
        }

        $tempDir = $baseDir . DIRECTORY_SEPARATOR . Str::uuid()->toString();
        if (!mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
            throw new RuntimeException('Unable to create conversion work directory.');
        }

        return $tempDir;
    }

    protected function deleteDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        $items = scandir($directory);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $directory . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->deleteDirectory($path);
                continue;
            }

            @unlink($path);
        }

        @rmdir($directory);
    }

    protected function binaryExists(string $binary): bool
    {
        if (str_starts_with($binary, '/')) {
            return is_executable($binary);
        }

        $process = new Process(['which', $binary]);
        $process->run();

        return $process->isSuccessful();
    }
}
