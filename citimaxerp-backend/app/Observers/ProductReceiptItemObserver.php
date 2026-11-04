<?php

namespace App\Observers;

use App\Jobs\Etims\SubmitStockMovementJob;
use App\Models\CompanyEtimsConfig;
use App\Models\ProductReceiptItem;

class ProductReceiptItemObserver
{
    public function created(ProductReceiptItem $item): void
    {
        $companyId = $item->company_id
            ?? $item->product?->company_id
            ?? $item->productReceipt?->company_id
            ?? null;
        if (!$companyId) {
            return;
        }

        if (!CompanyEtimsConfig::isLiveFor((string) $companyId)) {
            return;
        }

        SubmitStockMovementJob::dispatch(
            companyId: (string) $companyId,
            productId: (string) $item->product_id,
            quantityDelta: (int) $item->quantity,
            movementType: 'receipt',
            reference: 'product_receipt_item:' . $item->id,
        );
    }
}
