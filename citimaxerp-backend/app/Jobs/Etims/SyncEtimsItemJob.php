<?php

namespace App\Jobs\Etims;

use App\Models\Company;
use App\Models\Product;
use App\Services\TaxCompliance\EtimsItemSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncEtimsItemJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    public int $backoff = 30;

    public function __construct(
        public readonly string $companyId,
        public readonly string $productId,
    ) {
        $this->onQueue('etims');
    }

    public function handle(EtimsItemSyncService $service): void
    {
        $company = Company::find($this->companyId);
        $product = Product::find($this->productId);
        if (! $company || ! $product) {
            Log::warning('SyncEtimsItemJob: company or product missing', $this->context());

            return;
        }

        $result = $service->syncProduct($company, $product);
        if ($result->status === 'failed'
            && ($result->statusCode === null || $result->statusCode >= 500)) {
            // Let the retry mechanism re-dispatch with backoff
            $this->release($this->backoff);
        }
    }

    public function failed(\Throwable $e): void
    {
        Log::error('SyncEtimsItemJob exhausted retries', $this->context() + ['error' => $e->getMessage()]);
    }

    private function context(): array
    {
        return ['company_id' => $this->companyId, 'product_id' => $this->productId];
    }
}
