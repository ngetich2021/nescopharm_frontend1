<?php

namespace App\Services\Pdf;

use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\QrCode;
use Endroid\QrCode\RoundBlockSizeMode;
use Endroid\QrCode\Writer\PngWriter;

final class QrCodeDataUriGenerator
{
    public function generate(string $value, int $size = 180): string
    {
        $qrCode = QrCode::create($value)
            ->setEncoding(new Encoding('UTF-8'))
            ->setErrorCorrectionLevel(ErrorCorrectionLevel::Medium)
            ->setSize($size)
            ->setMargin(8)
            ->setRoundBlockSizeMode(RoundBlockSizeMode::Margin);

        return (new PngWriter)->write($qrCode)->getDataUri();
    }
}
