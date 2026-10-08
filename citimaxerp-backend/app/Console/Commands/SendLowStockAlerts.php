<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Notifications\SystemAlert;
use App\Services\NotificationService;
use App\Services\ReportService;
use Illuminate\Console\Command;

class SendLowStockAlerts extends Command
{
    protected $signature = 'stock:send-low-stock-alerts';
    protected $description = 'Daily bell digest of low and out-of-stock items for users who manage inventory';

    public function handle(NotificationService $notifier): void
    {
        foreach (Company::pluck('id') as $companyId) {
            $report = app(ReportService::class)->forCompany($companyId)->getLowStockReport();

            $lines = collect($report['data'])
                ->where('row_type', '!=', 'parent')
                ->where('is_active', true);

            if ($lines->isEmpty()) {
                continue;
            }

            $out = $lines->where('stock_status', 'out_of_stock');
            $low = $lines->where('stock_status', 'low_stock');

            $worst = $out->concat($low)->take(3)->pluck('name')->implode(', ');
            $more = $lines->count() > 3 ? ' and ' . ($lines->count() - 3) . ' more' : '';

            $parts = [];
            if ($out->isNotEmpty()) $parts[] = $out->count() . ' out of stock';
            if ($low->isNotEmpty()) $parts[] = $low->count() . ' low';

            $sent = $notifier->notifyPermission(
                $companyId,
                ['can_update_inventory', 'can_view_inventory_reports', 'can_create_product_receipts', 'can_approve_purchase_orders'],
                new SystemAlert(
                    'stock',
                    'Stock alert: ' . implode(', ', $parts),
                    "Needs restocking: {$worst}{$more}.",
                    '/reports/inventory?tab=low_stock',
                    ['type' => 'low_stock', 'low_count' => $low->count(), 'out_count' => $out->count()],
                ),
            );

            $this->info("Company {$companyId}: {$lines->count()} item(s) flagged, {$sent} user(s) notified");
        }
    }
}
