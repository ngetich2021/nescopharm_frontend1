<?php

namespace App\Console\Commands;

use App\Jobs\Etims\SyncEtimsItemJob;
use App\Models\Company;
use App\Models\CompanyEtimsConfig;
use App\Models\Etims\EtimsItemRegistration;
use App\Models\Product;
use Illuminate\Console\Command;

/**
 * Phase 8 / plan eng review item 17: pre-registration sweep gate at go-live.
 *
 * Before a company's first sale post-go-live, every product they sell must
 * have been registered as a KRA item. This command sweeps all not-yet-registered
 * products and queues sync jobs for them. Recommended cron: run once at the
 * configured `go_live_date - 1 day`, and also a polling-style nudge every hour
 * during onboarding.
 *
 * Usage:
 *   php artisan etims:pre-registration-sweep --company=<uuid>
 *   php artisan etims:pre-registration-sweep   (all enabled companies)
 */
class EtimsPreRegistrationSweepCommand extends Command
{
    protected $signature = 'etims:pre-registration-sweep
        {--company= : Limit to one company UUID}
        {--limit=500 : Max products to queue per company per run}';

    protected $description = 'Queue eTIMS item registration for any products not yet synced.';

    public function handle(): int
    {
        $companyId = $this->option('company');
        $limit = (int) $this->option('limit');

        $configs = CompanyEtimsConfig::query()
            ->notSuperseded()
            ->whereRaw('enabled = true')
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->get();

        if ($configs->isEmpty()) {
            $this->warn('No enabled eTIMS configs found.');

            return self::SUCCESS;
        }

        $totalQueued = 0;
        foreach ($configs as $config) {
            $company = Company::find($config->company_id);
            if (! $company) {
                continue;
            }

            $registeredIds = EtimsItemRegistration::query()
                ->join('products', 'products.id', '=', 'etims_item_registrations.product_id')
                ->where('etims_item_registrations.company_id', $config->company_id)
                ->where('etims_item_registrations.sync_status', EtimsItemRegistration::STATUS_SYNCED)
                ->whereNotNull('etims_item_registrations.digitax_item_id')
                ->where(function ($query) {
                    $query
                        ->where(function ($service) {
                            $service
                                ->where('products.type', 'service')
                                ->where('etims_item_registrations.item_type_code', '3');
                        })
                        ->orWhere(function ($product) {
                            $product
                                ->where(function ($type) {
                                    $type
                                        ->whereNull('products.type')
                                        ->orWhere('products.type', '!=', 'service');
                                })
                                ->where('etims_item_registrations.item_type_code', '2');
                        });
                })
                ->pluck('etims_item_registrations.product_id');

            $toSync = Product::query()
                ->where('company_id', $config->company_id)
                ->where('is_active', true)
                ->whereNotIn('id', $registeredIds)
                ->limit($limit)
                ->pluck('id');

            foreach ($toSync as $productId) {
                SyncEtimsItemJob::dispatch((string) $config->company_id, (string) $productId);
                $totalQueued++;
            }
            $this->info("Company {$config->company_id}: queued {$toSync->count()} products");
        }

        $this->info("Total products queued: {$totalQueued}");

        return self::SUCCESS;
    }
}
