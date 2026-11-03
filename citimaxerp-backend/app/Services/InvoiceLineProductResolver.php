<?php

namespace App\Services;

use App\Models\InvoiceLineItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\TaxCompliance\EtimsSaleAmountAllocator;
use Illuminate\Support\Collection;

/**
 * Finds the live product an invoice line is for, when the line has no product or points at one
 * that was deleted - e.g. the old "Bandage" product whose sizes were moved into products of their
 * own ("Crepe Bandage 2\" X 4.5m ..."). It never creates a product: a line it cannot place on
 * exactly one existing product is reported instead, so the catalogue is never duplicated.
 *
 * Tried in turn: the line text without the old product name in front ("Bandage - ..."), the full
 * text, and only then the line's old size name; each first exactly (ignoring case, spaces and punctuation),
 * then without a pack-count suffix ("100's", "(10s)"), then as the one product whose name starts
 * the same way.
 */
class InvoiceLineProductResolver
{
    /** @var array<string, array{byKey: array<string, array<int, array{0: Product, 1: ?ProductVariant}>>, keys: array<string, array{0: Product, 1: ?ProductVariant}>}> */
    private array $catalogues = [];

    /** @return array{0: ?Product, 1: ?ProductVariant, 2: ?string} [product, variant, error] */
    public function resolve(InvoiceLineItem $line, string $companyId): array
    {
        $catalogue = $this->catalogue($companyId);

        $old = $line->product_id ? Product::withTrashed()->withoutGlobalScope('company')->find($line->product_id) : null;
        $oldVariant = $line->variant_id ? ProductVariant::find($line->variant_id) : null;
        $description = trim((string) $line->description);

        $textCandidates = [];
        if ($old && $old->name && stripos($description, $old->name) === 0) {
            $textCandidates[] = ltrim(substr($description, strlen($old->name)), " -\t");
        }
        if (preg_match('/^[^-]{2,40}\s-\s(.+)$/', $description, $m)) {
            $textCandidates[] = $m[1];
        }
        $textCandidates[] = $description;
        $textCandidates = array_values(array_unique(array_filter(array_map('trim', $textCandidates))));

        // The printed text is what the customer was billed for and what KRA receives, so it wins
        // when the size recorded on the line names a different product (text "Nylon 2", size
        // "Nylon 2/0" - different products). The size is used only when the text matches nothing.
        [$hit] = $this->match($catalogue, $textCandidates);
        if (! $hit && $oldVariant) {
            [$hit] = $this->match($catalogue, [$oldVariant->name]);
        }
        if ($hit) {
            return [$hit[0], $hit[1], null];
        }

        return [null, null, "No single product matches \"{$description}\"."];
    }

    /** @return array{0: ?array{0: Product, 1: ?ProductVariant}} the one product the texts name, if any */
    private function match(array $catalogue, array $candidates): array
    {
        foreach ([fn ($k) => $k, fn ($k) => $this->withoutPackCount($k)] as $normalise) {
            foreach ($candidates as $text) {
                $key = $normalise($this->key($text));
                $hits = $this->hits($catalogue, $key, $normalise);
                if (count($hits) === 1) {
                    return [$hits[0]];
                }
            }
        }

        // The one product whose name begins with the line's text (or the other way round).
        foreach ($candidates as $text) {
            $key = $this->withoutPackCount($this->key($text));
            if (strlen($key) < 8) {
                continue;
            }
            $hits = [];
            foreach ($catalogue['keys'] as $productKey => $entry) {
                $productKey = $this->withoutPackCount($productKey);
                if (str_starts_with($productKey, $key) || str_starts_with($key, $productKey) && strlen($productKey) >= 8) {
                    $hits[$entry[0]->id . ($entry[1]?->id ?? '')] = $entry;
                }
            }
            if (count($hits) === 1) {
                return [array_values($hits)[0]];
            }
        }

        return [null];
    }

    private function hits(array $catalogue, string $key, \Closure $normalise): array
    {
        if ($key === '') {
            return [];
        }
        $hits = [];
        foreach ($catalogue['keys'] as $productKey => $entry) {
            if ($normalise($productKey) === $key) {
                $hits[$entry[0]->id . ($entry[1]?->id ?? '')] = $entry;
            }
        }

        return array_values($hits);
    }

    private function catalogue(string $companyId): array
    {
        if (isset($this->catalogues[$companyId])) {
            return $this->catalogues[$companyId];
        }
        $products = Product::withoutGlobalScope('company')
            ->where('company_id', $companyId)
            ->catalogue()
            ->where(fn ($q) => $q->whereNull('product_code')->orWhere('product_code', 'not like', 'ETIMS-%'))
            ->get();
        $variants = ProductVariant::whereIn('product_id', $products->pluck('id'))->get()->groupBy('product_id');

        $keys = [];
        foreach ($products as $product) {
            $keys[$this->key($product->name)] = [$product, null];
            foreach ($variants->get($product->id, collect()) as $variant) {
                $keys[$this->key(ProductVariant::sizedName($product->name, $variant->name))] = [$product, $variant];
            }
        }

        return $this->catalogues[$companyId] = ['keys' => $keys];
    }

    private function key(string $text): string
    {
        return preg_replace('/[^a-z0-9]/', '', mb_strtolower($text));
    }

    // "...100s", "...10s", "packof100", "perpiece" at the end say how it is packed, not what it is.
    private function withoutPackCount(string $key): string
    {
        return preg_replace('/(\d+s|packof\d+|per(piece|pack)\w*|pcs)$/', '', $key);
    }
}
