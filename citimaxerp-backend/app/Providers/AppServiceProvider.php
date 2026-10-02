<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductPackagingUnit;
use App\Models\ProductReceiptItem;
use App\Models\Invoice;
use App\Observers\InvoiceObserver;
use App\Observers\ProductReceiptItemObserver;
use App\Observers\ProductPriceObserver;
use App\Observers\ProductVariantPriceObserver;
use App\Observers\ProductPackagingUnitPriceObserver;
use App\Observers\ProductReceiptItemPriceObserver;
use App\Services\AccountingIntegrationService;
use App\Services\TaxCompliance\Contracts\TaxComplianceProvider;
use App\Services\TaxCompliance\Providers\Kenya\EtimsProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register AccountingIntegrationService as a singleton
        $this->app->singleton(AccountingIntegrationService::class, function ($app) {
            return new AccountingIntegrationService();
        });

        // Kenya eTIMS via DigiTax. Multi-country callers resolve through
        // TaxComplianceProviderRegistry; this binding supports direct DI.
        $this->app->bind(TaxComplianceProvider::class, EtimsProvider::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // CRITICAL FIX: For Supabase PgBouncer in transaction mode, we MUST use emulated prepares
        // The connection pooler deallocates prepared statements when returning connections to the pool
        // Using native prepared statements causes "prepared statement does not exist" errors
        // These settings are configured in config/database.php and should NOT be overridden here
        
        // The PDO::ATTR_STRINGIFY_FETCHES setting is already in config/database.php
        // No need to set it here as that would create a premature database connection

        // Register observers for automatic price tracking
        Product::observe(ProductPriceObserver::class);
        ProductVariant::observe(ProductVariantPriceObserver::class);
        ProductPackagingUnit::observe(ProductPackagingUnitPriceObserver::class);
        ProductReceiptItem::observe(ProductReceiptItemPriceObserver::class);

        Invoice::observe(InvoiceObserver::class);
        ProductReceiptItem::observe(ProductReceiptItemObserver::class);
    }
}

