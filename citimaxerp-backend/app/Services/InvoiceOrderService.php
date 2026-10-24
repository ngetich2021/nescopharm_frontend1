<?php

namespace App\Services;

use App\Http\Controllers\InvoiceController;
use App\Models\Invoice;
use App\Models\InvoiceLineItem;
use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\TaxCompliance\EtimsTaxType;
use Illuminate\Http\Request;

/**
 * Keeps an order and its invoice in step: creates the invoice a completed order is missing,
 * and brings an invoice back in line after its order was corrected.
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
}
