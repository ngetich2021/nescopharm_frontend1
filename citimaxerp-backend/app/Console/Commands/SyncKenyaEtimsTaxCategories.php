<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\TaxRate;
use Database\Seeders\CountryVatCategorySeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncKenyaEtimsTaxCategories extends Command
{
    protected $signature = 'tax:sync-kenya-etims-categories {--company= : Limit to one Kenyan company id}';

    protected $description = 'Create and normalize KRA eTIMS A-E tax categories, then safely link matching Kenyan products and invoice lines.';

    public function handle(): int
    {
        $companies = Company::query()
            ->where('primary_country_code', 'KE')
            ->when($this->option('company'), fn ($query, $companyId) => $query->whereKey($companyId))
            ->get();

        if ($companies->isEmpty()) {
            $this->warn('No Kenyan companies matched the selection.');

            return self::SUCCESS;
        }

        foreach ($companies as $company) {
            (new CountryVatCategorySeeder())->forCompany((string) $company->id)->run();

            $categories = TaxRate::withoutGlobalScopes()
                ->where('company_id', $company->id)
                ->where('country_code', 'KE')
                ->whereIn('etims_tax_type_code', ['A', 'B', 'C', 'D', 'E'])
                ->get()
                ->keyBy('etims_tax_type_code');

            if ($categories->count() !== 5) {
                $this->error("{$company->name}: KRA tax category sync did not produce all A-E categories.");

                return self::FAILURE;
            }

            $result = DB::transaction(function () use ($company, $categories): array {
                // Only infer categories that are already unambiguous in the
                // catalogue: taxable 16% → B, and non-taxable → D.  A/C are
                // deliberately never guessed because their legal treatment is
                // different despite both being 0%.
                $standardProducts = DB::table('products')
                    ->where('company_id', $company->id)
                    ->whereNull('vat_category_id')
                    ->where('is_taxable', true)
                    ->whereIn('tax_rate', [0.16, 16])
                    ->update(['vat_category_id' => $categories['B']->id, 'updated_at' => now()]);

                $nonVatProducts = DB::table('products')
                    ->where('company_id', $company->id)
                    ->whereNull('vat_category_id')
                    ->where('is_taxable', false)
                    ->update(['vat_category_id' => $categories['D']->id, 'updated_at' => now()]);

                $linkedLines = 0;
                foreach ($categories as $etimsCode => $category) {
                    $expectedPercentage = round((float) $category->rate * 100, 2);
                    $snapshot = json_encode([
                        'id' => (string) $category->id,
                        'name' => $category->name,
                        'code' => $category->code,
                        'rate' => (float) $category->rate,
                        'country_code' => 'KE',
                        'etims_tax_type_code' => $etimsCode,
                    ], JSON_THROW_ON_ERROR);

                    // One set-based update per category keeps this migration
                    // fast even for years of invoice history. An explicit
                    // eTIMS code plus the matching rate is required, so A/C
                    // are never inferred from a bare 0% line.
                    $linkedLines += DB::update(<<<'SQL'
                        UPDATE invoice_line_items AS line
                        SET tax_rate_id = ?,
                            metadata = (
                                COALESCE(line.metadata::jsonb, '{}'::jsonb)
                                || jsonb_build_object('etims_tax_type_code', ?)
                                || jsonb_build_object('tax_rate_snapshot', ?::jsonb)
                            )::json,
                            updated_at = NOW()
                        FROM invoices AS invoice
                        WHERE invoice.id = line.invoice_id
                          AND invoice.company_id = ?
                          AND line.tax_rate_id IS NULL
                          AND line.metadata::jsonb ->> 'etims_tax_type_code' = ?
                          AND ROUND(line.tax_rate, 2) = ?
                    SQL, [
                        $category->id,
                        $etimsCode,
                        $snapshot,
                        $company->id,
                        $etimsCode,
                        $expectedPercentage,
                    ]);
                }

                return compact('standardProducts', 'nonVatProducts', 'linkedLines');
            });

            $this->info(sprintf(
                '%s: tax categories A-E ready; linked %d standard-rated products, %d non-VAT products, and %d historical invoice lines.',
                $company->name,
                $result['standardProducts'],
                $result['nonVatProducts'],
                $result['linkedLines'],
            ));
        }

        return self::SUCCESS;
    }
}
