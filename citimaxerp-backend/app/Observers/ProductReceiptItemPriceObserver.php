<?php

namespace App\Observers;

use App\Models\ProductReceiptItem;
use App\Models\ProductPriceHistory;
use App\Services\ProductPriceHistoryService;

class ProductReceiptItemPriceObserver
{
    protected $priceHistoryService;

    public function __construct(ProductPriceHistoryService $priceHistoryService)
    {
        $this->priceHistoryService = $priceHistoryService;
    }

    /**
     * Handle the ProductReceiptItem "updated" event.
     */
    public function updated(ProductReceiptItem $receiptItem): void
    {
        // Track unit_price changes
        if ($receiptItem->isDirty('unit_price')) {
            $this->priceHistoryService->logReceiptItemPriceChange(
                $receiptItem,
                $receiptItem->unit_price,
                [
                    'source_reference' => $receiptItem->productReceipt?->product_receipt_number,
                    'metadata' => [
                        'receipt_id' => $receiptItem->product_receipt_id,
                        'quantity' => $receiptItem->quantity,
                    ],
                ]
            );
        }
    }

    /**
     * Handle the ProductReceiptItem "created" event.
     * Log initial price when receipt item is created.
     */
    public function created(ProductReceiptItem $receiptItem): void
    {
        if ($receiptItem->unit_price !== null) {
            $this->priceHistoryService->logReceiptItemPriceChange(
                $receiptItem,
                $receiptItem->unit_price,
                [
                    'source_reference' => $receiptItem->productReceipt?->product_receipt_number,
                    'change_reason' => 'Initial price from product receipt',
                    'metadata' => [
                        'receipt_id' => $receiptItem->product_receipt_id,
                        'quantity' => $receiptItem->quantity,
                    ],
                ]
            );
        }
    }
}
