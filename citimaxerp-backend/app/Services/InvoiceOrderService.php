<?php

namespace App\Services;

use App\Http\Controllers\InvoiceController;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Order;
use App\Models\OrderDispatch;
use App\Models\OrderDispatchItem;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\TaxCompliance\EtimsTaxType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Keeps an order and its invoice in step: creates the invoice a completed order is missing,
 * and brings an invoice back in line after its order was corrected. A past (pre-go-live) sale
 * also gets a delivered dispatch on record, kept matching the order when it is edited.
 */
class InvoiceOrderService
{
    /**
     * An invoiced order that's corrected (e.g. VAT added to a past sale) takes its invoice
     * with it: same lines, discount and VAT, keeping what's already been paid against it.
     * Built the way InvoiceController::createFromOrder builds an invoice from an order.
     */
    public function syncWithOrder(Order $order, Invoice $invoice): void
    {
        $order->load('orderItems.product', 'orderItems.variant');
        $previous = $invoice->lineItems()->get()->keyBy(fn ($l) => $l->product_id . '|' . $l->variant_id);
        $subtotal = (float) $order->orderItems->sum(fn ($i) => (float) $i->quantity * (float) $i->unit_price);
        $discountRatio = $subtotal > 0 ? min(1, (float) ($order->discount ?? 0) / $subtotal) : 0;

        $invoice->lineItems()->delete();
        foreach ($order->orderItems as $item) {
            // A 0% line keeps the product's own exempt / zero-rated classification.
            $rate = (float) ($item->tax_rate ?? 0);
            $code = EtimsTaxType::fromInput(null, $rate);
            if ($rate == 0.0 && $item->product) {
                $productCode = EtimsTaxType::forProduct($item->product);
                $code = in_array($productCode, ['A', 'C', 'D'], true) ? $productCode : 'D';
            }
            // Batch / expiry details carry over from the line it replaces.
            $old = $previous->get($item->product_id . '|' . $item->variant_id);
            InvoiceLineItem::create([
                'invoice_id' => $invoice->id,
                'product_id' => $item->product_id,
                'variant_id' => $item->variant_id,
                'description' => $item->product
                    ? ProductVariant::sizedName($item->product->name, $item->variant?->name)
                    : ($old?->description ?? 'Item'),
                'quantity' => $item->quantity,
                'unit' => $item->price_unit ?: ($old?->unit ?? 'pcs'),
                'batch_number' => $old?->batch_number,
                'expiry_date' => $old?->expiry_date,
                'unit_price' => $item->unit_price,
                'discount_amount' => round((float) $item->quantity * (float) $item->unit_price * $discountRatio, 2),
                'tax_rate' => EtimsTaxType::rate($code),
                'metadata' => array_merge($old?->metadata ?? [], ['etims_tax_type_code' => $code, 'price_label' => $item->price_label]),
            ]);
        }

        $invoice->customer_id = $order->customer_id;
        $invoice->amount_paid = (float) $invoice->getTotalAllocatedAmount();
        $invoice->load('lineItems');
        $invoice->calculateTotals();

        $paid = (float) $invoice->amount_paid;
        $total = (float) $invoice->total_amount;
        if (!in_array($invoice->status, ['draft', 'cancelled'], true)) {
            $invoice->update([
                'status' => $paid >= $total - 0.01 ? 'paid'
                    : ($invoice->due_date && now()->startOfDay()->isAfter($invoice->due_date) ? 'overdue'
                    : ($paid > 0 ? 'partially_paid' : 'sent')),
            ]);
        }

        // The order form resends the payment fields it loaded; the invoice is what was actually paid.
        $order->update([
            'amount_paid' => $paid,
            'payment_status' => $paid >= $total - 0.01 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
        ]);
    }

    /**
     * Invoice a completed order that never got one, the same way "Create invoice" on the order does.
     * The sale already happened, so it is invoiced on the order date, never sent to eTIMS, and
     * any payment already taken on the order is allocated to it.
     *
     * @return array{ok: bool, message: string, invoice_number?: string}
     */
    public function createForOrder(Order $order, User $user): array
    {
        if ($order->status !== 'completed') {
            return ['ok' => false, 'message' => 'Only completed orders are invoiced here'];
        }
        if (Invoice::where('order_id', $order->id)->exists()) {
            return ['ok' => false, 'message' => 'Already invoiced'];
        }
        // Delivered and completed: invoicing approval is a formality by now.
        if (!$order->isInvoiceApproved()) {
            $order->forceFill(['invoice_approved_at' => now(), 'invoice_approved_by' => $user->id])->save();
        }

        $request = Request::create('/api/invoices/from-order/' . $order->id, 'POST', [
            'invoice_date' => optional($order->order_date)->toDateString() ?? now()->toDateString(),
            'payment_option' => 'credit',
            'generate_etims_receipt' => false,
            'notes' => 'Invoice created from the Filing tab for a completed order that had none.',
        ]);
        $request->setUserResolver(fn () => $user);

        $response = app(InvoiceController::class)->createFromOrder($request, $order->id);
        $data = $response->getData(true);
        if ($response->getStatusCode() >= 300) {
            $message = $data['message'] ?? 'Could not create the invoice';
            return ['ok' => false, 'message' => is_string($message) ? $message : json_encode($message)];
        }

        $invoice = Invoice::where('order_id', $order->id)->first();
        return ['ok' => true, 'message' => 'Invoice created', 'invoice_number' => $invoice?->invoice_number];
    }

    public function isPastSale(Order $order): bool
    {
        return (bool) $order->is_historical || Order::isHistoricalDate($order->order_date);
    }

    /**
     * A completed past sale has its invoice and a delivered dispatch, both matching the order.
     * Nothing here moves stock: past sales never do (see OrderStockService).
     *
     * @return array{invoice: ?string, dispatch: ?string}
     */
    public function ensurePastOrderRecords(Order $order, User $user): array
    {
        $done = ['invoice' => null, 'dispatch' => null];
        if (!$this->isPastSale($order) || $order->status !== 'completed' || !$order->orderItems()->exists()) {
            return $done;
        }

        $invoice = Invoice::where('order_id', $order->id)->first();
        if (!$invoice) {
            $result = $this->createForOrder($order, $user);
            $done['invoice'] = $result['ok'] ? 'created' : $result['message'];
        }

        $dispatch = OrderDispatch::where('order_id', $order->id)
            ->where('status', '!=', 'cancelled')
            ->where('approval_status', '!=', 'rejected')
            ->orderBy('created_at')
            ->first();
        if (!$dispatch) {
            $this->createPastDispatch($order->fresh(), $user);
            $done['dispatch'] = 'created';
        }

        return $done;
    }

    /** The goods went out on the sale date: record the dispatch as approved and delivered then. */
    protected function createPastDispatch(Order $order, User $user): OrderDispatch
    {
        return DB::transaction(function () use ($order, $user) {
            $saleDate = $order->order_date ?? now();
            $dispatch = new OrderDispatch();
            $dispatch->id = (string) Str::uuid();
            // Next number across every dispatch row, deleted ones included (the number is unique).
            $prefix = 'ODI-' . substr($order->company_id, 0, 8) . '-';
            $last = DB::table('order_dispatches')->where('dispatch_number', 'like', $prefix . '%')
                ->selectRaw("MAX(CAST(SUBSTRING(dispatch_number FROM ?) AS INTEGER)) AS n", [strlen($prefix) + 1])
                ->whereRaw("SUBSTRING(dispatch_number FROM ?) ~ '^[0-9]+$'", [strlen($prefix) + 1])
                ->value('n');
            $dispatch->dispatch_number = $prefix . str_pad(((int) $last) + 1, 4, '0', STR_PAD_LEFT);
            $dispatch->order_id = $order->id;
            $dispatch->company_id = $order->company_id;
            $dispatch->delivery_location_id = $order->delivery_location_id;
            $dispatch->approvers = [];
            $dispatch->approval_status = 'approved';
            $dispatch->status = 'delivered';
            $dispatch->dispatch_date = $saleDate;
            $dispatch->actual_delivery_date = $saleDate;
            $dispatch->final_approved_at = now();
            $dispatch->notes = 'Recorded for a past sale';
            $dispatch->created_by = $user->id;
            $dispatch->save();

            $this->writeDispatchItems($order, $dispatch);

            $order->dispatch_status = 'delivered';
            $order->saveQuietly();

            return $dispatch;
        });
    }

    /** After a past sale is edited, its delivered dispatch lists the same lines. */
    public function syncPastDispatches(Order $order): void
    {
        if (!$this->isPastSale($order)) {
            return;
        }
        OrderDispatch::where('order_id', $order->id)
            ->where('status', '!=', 'cancelled')
            ->where('approval_status', '!=', 'rejected')
            ->get()
            ->each(fn (OrderDispatch $dispatch) => DB::transaction(function () use ($order, $dispatch) {
                OrderDispatchItem::where('order_dispatch_id', $dispatch->id)->delete();
                $this->writeDispatchItems($order, $dispatch);
            }));
    }

    protected function writeDispatchItems(Order $order, OrderDispatch $dispatch): void
    {
        $delivered = $dispatch->status === 'delivered';
        foreach ($order->orderItems()->with('product')->get() as $item) {
            OrderDispatchItem::create([
                'id' => (string) Str::uuid(),
                'order_dispatch_id' => $dispatch->id,
                'order_item_id' => $item->id,
                'product_id' => $item->product_id,
                'variant_id' => $item->variant_id,
                'product_code' => $item->product->product_code ?? null,
                'quantity' => $item->quantity,
                'base_quantity' => $item->base_quantity,
                'packaging_breakdown' => $item->packaging_breakdown ?? null,
                'batch_allocations' => $item->batch_allocations ?: null,
                'delivered_quantity' => $delivered ? $item->quantity : 0,
                'damaged_quantity' => 0,
            ]);
        }
    }
}
