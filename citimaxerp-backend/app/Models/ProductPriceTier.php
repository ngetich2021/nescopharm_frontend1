<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ProductPriceTier extends Model
{
    use HasUuids;

    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'product_id',
        'variant_id',
        'tier_name',
        'item_code',
        'price',
        'unit_of_measure',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    protected $appends = ['code'];

    // The company's price lists. A code carrying one of these prefixes belongs to that list.
    public const LISTS = ['NSPV', 'NSPH', 'NSPO', 'NSPD'];

    protected static function booted(): void
    {
        // Every save goes through here (uploads, product forms, item imports): a code is stored
        // without its own list's prefix ("NSPV 001" on NSPV is 001), and a code belonging to
        // another list is refused (an NSPO code on the NSPV list).
        static::saving(function (ProductPriceTier $tier) {
            $tier->item_code = self::cleanCode((string) $tier->tier_name, $tier->item_code);
            if ($foreign = self::foreignList((string) $tier->tier_name, $tier->item_code)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'item_code' => [self::foreignMessage((string) $tier->tier_name, $tier->item_code, $foreign)],
                ]);
            }
        });
    }

    /** The code without spaces and without its own list's prefix; null when empty. */
    public static function cleanCode(string $list, ?string $code): ?string
    {
        $value = preg_replace('/\s+/', '', trim((string) $code));
        $list = strtoupper(trim($list));
        if ($list !== '' && stripos($value, $list) === 0) {
            $value = substr($value, strlen($list));
        }
        return $value !== '' ? $value : null;
    }

    /** The other list a code belongs to (e.g. NSPO for "NSPO001" on NSPV), or null. */
    public static function foreignList(string $list, ?string $code): ?string
    {
        $value = strtoupper(preg_replace('/\s+/', '', (string) $code));
        foreach (self::LISTS as $other) {
            if ($other !== strtoupper(trim($list)) && str_starts_with($value, $other)) {
                return $other;
            }
        }
        return null;
    }

    public static function foreignMessage(string $list, ?string $code, string $foreign): string
    {
        $number = substr(preg_replace('/\s+/', '', (string) $code), strlen($foreign));
        return "{$foreign} {$number} is an {$foreign} code - it can't go on the {$list} list. "
            . "Upload it on {$foreign}, or give it its {$list} number.";
    }

    // The code staff type on quotes/orders/invoices, e.g. "NSPD 001"; just "NSPD" when no item code is set.
    public function getCodeAttribute(): string
    {
        return trim($this->tier_name . ' ' . ($this->item_code ?? ''));
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
