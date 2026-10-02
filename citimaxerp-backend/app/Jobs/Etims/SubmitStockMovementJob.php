<?php

namespace App\Jobs\Etims;

use App\Models\Company;
use App\Models\Product;
use App\Services\TaxCompliance\EtimsStockService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SubmitStockMovementJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(
        public readonly string $companyId,
        public readonly string $productId,
        public readonly int $quantityDelta,
        public readonly string $movementType,
        public readonly string $reference,
    ) {
        $this->onQueue('etims');
    }

    public function handle(EtimsStockService $service): void
    {
        $company = Company::find($this->companyId);
        $product = Product::find($this->productId);
        if (!$company || !$product) {
            return;
        }

        $service->submitMovement($company, $product, $this->quantityDelta, $this->movementType, $this->reference);
    }
}
