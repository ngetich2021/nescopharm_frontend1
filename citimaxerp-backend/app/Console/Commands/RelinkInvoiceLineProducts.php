<?php

namespace App\Console\Commands;

use App\Models\Etims\EtimsItemRegistration;
use App\Models\InvoiceLineItem;
use App\Models\Product;
use App\Services\InvoiceLineProductResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Old invoices point at products deleted when sizes were moved into products of their own (or at
 * nothing). Sending such an invoice to eTIMS used to make a new product from the line text, e.g.
 * "Plaster - Plaster Of Paris 8\"" beside the real "Plaster Of Paris 8\"". This puts every such
 * line on the live product it is for (InvoiceLineProductResolver), and merges each product the
 * eTIMS sync made (ETIMS-AUTO-...) into the real one: its invoice lines, its KRA registration
 * (when the real product has none for that tax type) and anything else that points at it; then
 * it is deleted. Previews unless --apply.
 */
class RelinkInvoiceLineProducts extends Command
{
    protected $signature = 'invoices:relink-products {--apply : Save the changes (otherwise only a preview)}';

    protected $description = 'Link old invoice lines to their live products and merge products the eTIMS sync created into the real ones.';

    public function handle(InvoiceLineProductResolver $resolver): int
    {
        $apply = (bool) $this->option('apply');
        $autoIds = Product::withoutGlobalScope('company')->where('product_code', 'like', 'ETIMS-AUTO-%')->pluck('id');

        $lines = InvoiceLineItem::query()
            ->with('invoice:id,company_id')
            ->where(fn ($q) => $q->whereNull('product_id')
                ->orWhereNotIn('product_id', Product::withoutGlobalScope('company')->select('id'))
                ->orWhereIn('product_id', $autoIds))
            ->get();

        $this->info(($apply ? 'Linking' : 'Preview:') . " {$lines->count()} invoice lines with no live product");
        $linked = 0;
        $unresolved = [];
        $unresolvedByCompany = [];
        $mergeInto = []; // ETIMS-AUTO product id => real product id

        DB::beginTransaction();
        try {
            foreach ($lines as $line) {
                if (!$line->invoice) {
                    continue;
                }
                [$product, $variant] = $resolver->resolve($line, (string) $line->invoice->company_id);
                if (!$product) {
                    $unresolved[$line->description] = ($unresolved[$line->description] ?? 0) + 1;
                    $unresolvedByCompany[$line->invoice->company_id] = ($unresolvedByCompany[$line->invoice->company_id] ?? 0) + 1;
                    continue;
                }
                if ($autoIds->contains($line->product_id)) {
                    $mergeInto[$line->product_id] = $product->id;
                }
                $line->forceFill(['product_id' => $product->id, 'variant_id' => $variant?->id])->saveQuietly();
                $linked++;
            }

            foreach ($mergeInto as $autoId => $realId) {
                $this->mergeProduct($autoId, $realId);
            }

            $apply ? DB::commit() : DB::rollBack();
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Stopped, nothing saved: ' . $e->getMessage());

            return self::FAILURE;
        }

        $this->info("Linked {$linked} lines; merged " . count($mergeInto) . ' eTIMS-made products into the real ones.');
        foreach ($mergeInto as $autoId => $realId) {
            $this->line('  ' . Product::withTrashed()->withoutGlobalScope('company')->find($autoId)?->name . ' -> ' . Product::withoutGlobalScope('company')->find($realId)?->name);
        }
        if ($apply) {
            // Ask those who edit invoices to link what is left (eTIMS > Lines to link).
            foreach ($unresolvedByCompany as $companyId => $count) {
                app(\App\Services\NotificationService::class)->invoiceLinesToLink((string) $companyId, $count);
            }
        }
        if ($unresolved) {
            arsort($unresolved);
            $this->warn(array_sum($unresolved) . ' lines match no single product (left as they are; they will not be sent to eTIMS until linked):');
            foreach ($unresolved as $text => $n) {
                $this->line("  x{$n}  {$text}");
            }
        }
        if (!$apply) {
            $this->comment('Preview only - run with --apply to save.');
        }

        return self::SUCCESS;
    }

    private function mergeProduct(string $autoId, string $realId): void
    {
        // Its KRA registration moves over unless the real product already has one for that tax type.
        foreach (EtimsItemRegistration::where('product_id', $autoId)->get() as $registration) {
            $taken = EtimsItemRegistration::where('product_id', $realId)->where('tax_type_code', $registration->tax_type_code)->exists();
            $taken ? $registration->delete() : $registration->forceFill(['product_id' => $realId])->save();
        }

        // Anything else that points at it.
        $tables = DB::table('information_schema.columns')
            ->where('table_schema', 'public')->where('column_name', 'product_id')
            ->whereNotIn('table_name', ['etims_item_registrations'])
            ->pluck('table_name');
        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->where('product_id', $autoId)->update(['product_id' => $realId]);
            }
        }

        Product::withoutGlobalScope('company')->find($autoId)?->delete();
    }
}
