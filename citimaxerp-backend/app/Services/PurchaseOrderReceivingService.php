<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductReceiptItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;

/**
 * A purchase order records what was ordered; product receipts record what actually arrived
 * (and push it into stock with its batches). This keeps each PO's received quantities,
 * status and amount owed in line with the receipts recorded against it.
 */
class PurchaseOrderReceivingService
{
    /**
     * Check a receipt's PO link and attach each receipt line to its PO line. Only what is on the
     * order can be received, and no PO line beyond its outstanding quantity; anything extra needs
     * a fresh purchase order. $receiptId (when editing) is left out of "already received".
     *
     * @return array{0: PurchaseOrder|null, 1: array, 2: string|null} [order, items, error]
     */
    public function linkReceiptItems(?string $purchaseOrderId, string $companyId, array $items, ?string $receiptId = null, bool $requireOrder = true): array
    {
        if (!$purchaseOrderId) {
            if ($requireOrder) {
                return [null, $items, 'Pick the purchase order these goods were delivered against. Stock can only be received on an approved purchase order.'];
            }
            return [null, array_map(fn ($i) => array_merge($i, ['purchase_order_item_id' => null]), $items), null];
        }

        $order = PurchaseOrder::with(['items.product:id,name', 'items.variant:id,name'])->where('company_id', $companyId)->find($purchaseOrderId);
        if (!$order) {
            return [null, $items, 'Purchase order not found.'];
        }
        if ($order->status === 'cancelled') {
            return [null, $items, "{$order->order_number} is cancelled."];
        }
        if ($order->approval_status !== 'approved') {
            return [null, $items, "{$order->order_number} must be approved before stock can be received against it."];
        }

        $poItems = $order->items->keyBy('id');
        foreach ($items as $index => $item) {
            $lineId = $item['purchase_order_item_id'] ?? null;
            if ($lineId) {
                $poItem = $poItems[$lineId] ?? null;
                if (!$poItem) {
                    return [null, $items, 'Line ' . ($index + 1) . " is not on {$order->order_number}."];
                }
                if ($poItem->product_id !== ($item['product_id'] ?? null) || ($poItem->variant_id ?? null) !== ($item['variant_id'] ?? null)) {
                    return [null, $items, 'Line ' . ($index + 1) . " does not match the item or size ordered on {$order->order_number}."];
                }
                continue;
            }
            $match = $order->items->first(fn (PurchaseOrderItem $p) => $p->product_id === ($item['product_id'] ?? null)
                && ($p->variant_id ?? null) === (($item['variant_id'] ?? null) ?: null));
            if (!$match) {
                return [null, $items, 'Line ' . ($index + 1) . " is not on {$order->order_number}. Only ordered items can be received; raise a new purchase order for anything extra."];
            }
            $items[$index]['purchase_order_item_id'] = $match->id;
        }

        $receivedElsewhere = ProductReceiptItem::whereIn('purchase_order_item_id', $order->items->pluck('id'))
            ->when($receiptId, fn ($q) => $q->where('product_receipt_id', '!=', $receiptId))
            ->selectRaw('purchase_order_item_id, SUM(quantity) as qty')
            ->groupBy('purchase_order_item_id')
            ->pluck('qty', 'purchase_order_item_id');

        $receivingNow = collect($items)->groupBy('purchase_order_item_id')->map(fn ($lines) => $lines->sum(fn ($l) => (int) ($l['quantity'] ?? 0)));
        foreach ($receivingNow as $lineId => $qty) {
            $poItem = $poItems[$lineId];
            $outstanding = max(0, $poItem->quantity - (int) ($receivedElsewhere[$lineId] ?? 0));
            if ($qty > $outstanding) {
                $name = $poItem->variant_id
                    ? \App\Models\ProductVariant::sizedName($poItem->product?->name, $poItem->variant?->name)
                    : ($poItem->product?->name ?? 'An item');
                return [null, $items, "{$name}: receiving {$qty} but only {$outstanding} is outstanding on {$order->order_number}. Raise a new purchase order for the extra " . ($qty - $outstanding) . '.'];
            }
        }

        return [$order, $items, null];
    }

    /** Re-derive received quantities, line amounts, status and total from the linked receipts. */
    public function sync(?PurchaseOrder $order): void
    {
        if (!$order) {
            return;
        }
        $order->loadMissing('items');

        $received = ProductReceiptItem::whereIn('purchase_order_item_id', $order->items->pluck('id'))
            ->selectRaw('purchase_order_item_id, SUM(quantity) as qty')
            ->groupBy('purchase_order_item_id')
            ->pluck('qty', 'purchase_order_item_id');

        $allIn = $order->items->isNotEmpty();
        $anyIn = false;
        foreach ($order->items as $item) {
            $item->received_quantity = (int) ($received[$item->id] ?? 0);
            // Extra stock that arrives is owed for too; returns come off.
            $billable = max($item->quantity, $item->received_quantity) - $item->returned_quantity;
            $item->subtotal = max(0, $billable) * (float) $item->unit_price;
            $item->save();

            $anyIn = $anyIn || $item->received_quantity > 0;
            $allIn = $allIn && $item->received_quantity >= $item->quantity;
        }

        if ($order->status !== 'cancelled') {
            $order->status = $allIn ? 'received' : ($anyIn ? 'partial' : 'pending');
            $order->save();
        }
        $this->recalculateTotal($order);
    }

    // Shipping and logistics are recorded on product receipts, not on the order.
    public function recalculateTotal(PurchaseOrder $order): void
    {
        $totalAmount = max(0, (float) $order->items()->sum('subtotal') - (float) $order->discount);

        $amountPaid = (float) $order->amount_paid;
        $status = 'unpaid';
        if ($totalAmount > 0 && $amountPaid >= $totalAmount) {
            $status = 'paid';
        } elseif ($amountPaid > 0) {
            $status = 'partial';
        }

        $order->update(['total_amount' => $totalAmount, 'payment_status' => $status]);
    }

    // The item's parent total is the sum of its sizes.
    public function syncParentStock(Product $product): void
    {
        if ($product->has_variations) {
            $product->update([
                'stock_quantity' => (int) $product->variants()->sum('stock_quantity'),
                'on_hand' => (int) $product->variants()->sum('on_hand'),
            ]);
        }
    }
}
