<?php

namespace App\Services;

use App\Models\InventoryBatch;
use App\Models\Order;
use App\Models\Payment;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;

/**
 * An order only takes stock out of inventory once a receipt (payment) has been recorded
 * against it. Until then its lines leave stock untouched.
 */
class OrderStockService
{
    public function hasReceipt(Order $order): bool
    {
        $invoiceIds = DB::table('invoices')->where('order_id', $order->id)->pluck('id');

        return Payment::query()
            ->where('amount_paid', '>', 0)
            ->where('status', '!=', 'refunded')
            ->whereRaw('amount_paid - COALESCE(amount_refunded, 0) > 0')
            ->where(function ($q) use ($order, $invoiceIds) {
                $q->where('order_id', $order->id);
                if ($invoiceIds->isNotEmpty()) {
                    $q->orWhereIn('invoice_id', $invoiceIds)
                        ->orWhereIn('id', DB::table('payment_allocations')->whereIn('invoice_id', $invoiceIds)->select('payment_id'));
                }
            })
            ->exists();
    }

    public function sync(Order $order): void
    {
        if ($this->hasReceipt($order)) {
            $this->deduct($order);
        } else {
            $this->restore($order, "Order {$order->order_number}: receipt removed");
        }
    }

    public function deduct(Order $order): void
    {
        if ($order->stock_deducted_at || $order->status === 'cancelled') {
            return;
        }

        $order->loadMissing('orderItems.product', 'orderItems.variant');
        if ($order->orderItems->isEmpty()) {
            return;
        }

        DB::transaction(function () use ($order) {
            foreach ($order->orderItems as $item) {
                if (!$item->product || !$item->product->track_inventory) {
                    continue;
                }
                $target = $item->variant_id ? ($item->variant ?? ProductVariant::find($item->variant_id)) : $item->product;
                if (!$target) {
                    continue;
                }
                $qty = (int) ($item->base_quantity ?: $item->quantity);

                $result = $target->allocateStockFEFO($qty, [
                    'reference_type' => 'order',
                    'reference_id' => $order->id,
                    'reference_number' => $order->order_number,
                    'notes' => "Order {$order->order_number} receipted",
                ]);
                $item->batch_allocations = $result['allocations'] ?: null;
                $item->save();
                $target->decrement('stock_quantity', $qty);
                $this->stampInvoiceLines($order, $item->product_id, $item->variant_id, $result['allocations']);
            }

            $order->stock_deducted_at = now();
            $order->saveQuietly();
        });
    }

    public function restore(Order $order, string $note): void
    {
        if (!$order->stock_deducted_at) {
            return;
        }

        DB::transaction(function () use ($order, $note) {
            $order->loadMissing('orderItems.product');

            foreach ($order->orderItems as $item) {
                if ($item->product && $item->product->track_inventory) {
                    $target = $item->variant_id ? ProductVariant::find($item->variant_id) : $item->product;
                    $target?->increment('stock_quantity', (int) ($item->base_quantity ?: $item->quantity));
                }
                foreach ($item->batch_allocations ?? [] as $allocation) {
                    InventoryBatch::find($allocation['batch_id'] ?? null)?->restoreFromSale((int) $allocation['quantity'], [
                        'reference_type' => 'order',
                        'reference_id' => $order->id,
                        'reference_number' => $order->order_number,
                    ], $note);
                }
                $item->batch_allocations = null;
                $item->save();
            }

            $order->stock_deducted_at = null;
            $order->saveQuietly();
        });
    }

    // An invoice raised before the receipt has no batches yet; give its lines the ones just drawn.
    protected function stampInvoiceLines(Order $order, string $productId, ?string $variantId, array $allocations): void
    {
        if (empty($allocations)) {
            return;
        }
        $lines = \App\Models\InvoiceLineItem::whereIn('invoice_id', DB::table('invoices')->where('order_id', $order->id)->pluck('id'))
            ->where('product_id', $productId)
            ->when($variantId, fn ($q) => $q->where('variant_id', $variantId), fn ($q) => $q->whereNull('variant_id'))
            ->whereNull('batch_number')
            ->get();

        foreach ($lines as $line) {
            $metadata = $line->metadata ?? [];
            $metadata['batches'] = collect($allocations)->map(fn ($a) => [
                'batch_number' => $a['batch_number'] ?? null,
                'expiry_date' => $a['expiry_date'] ?? null,
                'quantity' => $a['quantity'] ?? null,
            ])->values()->all();
            $line->batch_number = collect($allocations)->pluck('batch_number')->filter()->unique()->implode(', ');
            $line->expiry_date = collect($allocations)->pluck('expiry_date')->filter()->sort()->first();
            $line->metadata = $metadata;
            $line->saveQuietly();
        }
    }

    /** Orders a payment counts as a receipt for: directly, through its invoice, or through allocations. */
    public function ordersForPayment(Payment $payment): \Illuminate\Support\Collection
    {
        $invoiceIds = collect([$payment->invoice_id])
            ->merge(DB::table('payment_allocations')->where('payment_id', $payment->id)->pluck('invoice_id'))
            ->filter();
        $orderIds = DB::table('invoices')->whereIn('id', $invoiceIds)->pluck('order_id')
            ->push($payment->order_id)
            ->filter()
            ->unique();

        return Order::whereIn('id', $orderIds)->get();
    }
}
