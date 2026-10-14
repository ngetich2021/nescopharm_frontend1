<?php

namespace Tests\Unit;

use App\Models\ProductVariant;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ProductVariantSizedNameTest extends TestCase
{
    public static function names(): array
    {
        return [
            'glued prefix' => ['Endobronchial Tubes Left Fr26,28,31', 'Fr28', 'Endobronchial Tubes Left Fr28'],
            'spaced prefix stays' => ['Et Tubes Cuffed Id 2.0,2.5,3', '2.5', 'Et Tubes Cuffed Id 2.5'],
            'hash sizes' => ['Anaesthetic Mask PVC #1,2,3,4,5', '#3', 'Anaesthetic Mask PVC #3'],
            'slash with unit' => ['Spinal Needle Quinckle 90mm 22G/25G', '25G', 'Spinal Needle Quinckle 90mm 25G'],
            'percent' => ['Venturi Mask Adult/Paediatric Oxygen Concentration 24%/28%/31%', '28%', 'Venturi Mask Adult/Paediatric Oxygen Concentration 28%'],
            'letter sizes' => ['Silicone Full Face CPAP Mask-S/M/L', 'M', 'Silicone Full Face CPAP Mask M'],
            'bracketed letters' => ['Disposable PE gloves (M,L)', 'L', 'Disposable PE gloves L'],
            'age groups' => ['HME Filter Adult,Child,Infant', 'Infant', 'HME Filter Infant'],
            'no list appends' => ['Feeding tube', '6', 'Feeding tube 6'],
            'no size' => ['Feeding tube 6', '', 'Feeding tube 6'],
            'word inside a name is not a size' => ['Oxygen Mask Adults', 'L', 'Oxygen Mask Adults L'],
        ];
    }

    #[DataProvider('names')]
    public function test_sized_name(string $product, string $size, string $expected): void
    {
        $this->assertSame($expected, ProductVariant::sizedName($product, $size));
    }
}
