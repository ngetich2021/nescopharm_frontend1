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
use App\Observers\LedgerSyncObserver;
use App\Observers\CompanyAccountingObserver;
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

        // General ledger: every financial document posts (and re-posts on
        // change) through LedgerPostingService.
        foreach ([
            Invoice::class,
            \App\Models\Payment::class,
            \App\Models\PaymentAllocation::class,
            \App\Models\PaymentRefund::class,
            \App\Models\CreditNote::class,
            \App\Models\Expense::class,
            \App\Models\ProductReceipt::class,
            ProductReceiptItem::class,
            \App\Models\OrderDispatch::class,
            \App\Models\OrderDispatchItem::class,
            \App\Models\SupplierPayment::class,
            \App\Models\PayrollRun::class,
            \App\Models\PayrollPayslip::class,
        ] as $model) {
            $model::observe(LedgerSyncObserver::class);
        }

        \App\Models\Company::observe(CompanyAccountingObserver::class);

        $this->resolveApprovalAlertsWhenDecided();
    }

    private function resolveApprovalAlertsWhenDecided(): void
    {
        // model => [alert type, alert data key, status column, values that still await a decision]
        $map = [
            \App\Models\PurchaseOrder::class => ['purchase_order_pending', 'purchase_order_id', 'approval_status', ['pending']],
            \App\Models\Requisition::class => ['requisition_pending', 'requisition_id', 'approval_status', ['pending', 'in_review']],
            \App\Models\Expense::class => ['expense_pending', 'expense_id', 'status', ['pending']],
            \App\Models\Breakage::class => ['breakage_pending', 'breakage_id', 'approval_status', ['pending']],
            \App\Models\StockAdjustment::class => ['stock_adjustment_pending', 'stock_adjustment_id', 'status', ['pending']],
            \App\Models\OrderDispatch::class => ['dispatch_pending', 'dispatch_id', 'approval_status', ['pending', 'in_progress']],
            \App\Models\ApprovalWorkflowStepInstance::class => ['workflow_step_pending', 'step_instance_id', 'status', ['pending']],
        ];

        foreach ($map as $model => [$type, $key, $column, $pending]) {
            $model::saved(function ($record) use ($type, $key, $column, $pending) {
                if ($record->wasChanged($column) && $record->{$column} !== null && !in_array($record->{$column}, $pending, true)) {
                    app(\App\Services\NotificationService::class)->resolve($type, $key, $record->id);
                }
            });
            $model::deleted(fn ($record) => app(\App\Services\NotificationService::class)->resolve($type, $key, $record->id));
        }
    }
}

