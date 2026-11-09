<?php

namespace App\Services;

use App\Models\AccountsPayable;
use App\Models\InventoryBatch;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\ProductReceipt;
use App\Models\ProductReceiptItem;
use App\Models\ProductVariant;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Observers\InventoryMovementEtimsObserver;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A debit note to a supplier for goods sent back from a goods receipt: the supplier's credit note
 * the other way round. It is a supplier invoice of kind debit_note (DN- series, AccountsPayable) with
 * item lines (line_items) and metadata.returns_receipt_id, and it:
 *  - takes the returned quantities out of stock, from the receipt's own batches first
 *    (InventoryMovement type return, reference_type supplier_debit_note, sent to eTIMS as a supplier return);
 *  - lowers what is still owed on that receipt's supplier invoice (its metadata.debited);
 *  - posts DR Payables (the supplier) / CR Inventory (+ CR Input VAT when the receipt's PO carried VAT),
 *    through LedgerPostingService::syncSupplierBill.
 * Deleting it undoes all three.
 */
class SupplierDebitNoteService
{
    public static function forReceipt(string $receiptId)
    {
        return AccountsPayable::whereRaw("metadata::jsonb->>'returns_receipt_id' = ?", [$receiptId]);
    }

    /** VAT rate on the receipt (its purchase order's), as the receipt's own bill charges it. */
    protected function vatRate(ProductReceipt $receipt): float
    {
        return $receipt->purchase_order_id
            ? (float) (PurchaseOrder::whereKey($receipt->purchase_order_id)->value('tax_rate') ?? 0)
            : 0.0;
    }

    /** What has already gone back on debit notes, per receipt line. */
    protected function returnedByItem(string $receiptId): array
    {
        $returned = [];
        foreach (self::forReceipt($receiptId)->get() as $note) {
            foreach ($note->line_items ?? [] as $line) {
                $id = $line['receipt_item_id'] ?? null;
                if ($id) {
                    $returned[$id] = ($returned[$id] ?? 0) + (int) ($line['quantity'] ?? 0);
                }
            }
        }

        return $returned;
    }

    /** The receipt's lines with what can still be sent back on each. */
    public function returnableLines(ProductReceipt $receipt): array
    {
        $returned = $this->returnedByItem($receipt->id);
        $items = ProductReceiptItem::with(['product:id,name,stock_quantity', 'variant:id,name,stock_quantity'])
            ->where('product_receipt_id', $receipt->id)->orderBy('created_at')->get();

        return $items->values()->map(function (ProductReceiptItem $item, $i) use ($returned, $receipt) {
            $back = (int) ($returned[$item->id] ?? 0);
            $inBatch = (int) $this->receiptBatches($receipt, $item)->sum('quantity_available');
            $stock = (int) (($item->variant ?: $item->product)?->stock_quantity ?? 0);
            return [
                'receipt_item_id' => $item->id,
                'product_id' => $item->product_id,
                'variant_id' => $item->variant_id,
                'name' => $this->itemName($item),
                'batch_number' => $item->batch_number,
                'expiry_date' => $item->expiry_date ? substr((string) $item->expiry_date, 0, 10) : null,
                'received' => (int) $item->quantity,
                'returned' => $back,
                'in_batch' => $inBatch,
                'in_stock' => $stock,
                'returnable' => max(0, min((int) $item->quantity - $back, $stock)),
                'unit_price' => round((float) $item->unit_price, 2),
            ];
        })->all();
    }

    /**
     * Raise the debit note. $items = [[receipt_item_id, quantity], ...]. Throws \InvalidArgumentException
     * with a message for the screen when something cannot go back.
     */
    public function create(ProductReceipt $receipt, array $items, array $data, ?string $userId): AccountsPayable
    {
        if (!$receipt->supplier_id) {
            throw new \InvalidArgumentException('This receipt has no supplier, so there is no one to debit. Add the supplier to the receipt first.');
        }

        $lines = collect($this->returnableLines($receipt))->keyBy('receipt_item_id');
        $wanted = collect($items)->filter(fn ($i) => (int) ($i['quantity'] ?? 0) > 0);
        if ($wanted->isEmpty()) {
            throw new \InvalidArgumentException('Enter a quantity to return on at least one line.');
        }
        foreach ($wanted as $input) {
            $line = $lines->get($input['receipt_item_id'] ?? '');
            if (!$line) {
                throw new \InvalidArgumentException('A line does not belong to this receipt.');
            }
            $qty = (int) $input['quantity'];
            $left = $line['received'] - $line['returned'];
            if ($qty > $left) {
                throw new \InvalidArgumentException("{$line['name']}: returning {$qty} but only {$left} of the {$line['received']} received are not yet returned.");
            }
            if ($qty > $line['in_stock']) {
                throw new \InvalidArgumentException("{$line['name']}: only {$line['in_stock']} left in stock.");
            }
        }

        $date = Carbon::parse($data['date'] ?? now());
        $ref = $receipt->product_receipt_number ?: substr($receipt->id, 0, 8);
        $rate = $this->vatRate($receipt);

        return DB::transaction(function () use ($receipt, $wanted, $lines, $data, $userId, $date, $ref, $rate) {
            $bills = app(SupplierBillService::class);
            $receiptBill = $bills->billForReceipt($receipt->id);

            $noteLines = [];
            $goods = 0.0;
            foreach ($wanted as $input) {
                $line = $lines[$input['receipt_item_id']];
                $qty = (int) $input['quantity'];
                $amount = round($qty * $line['unit_price'], 2);
                $goods += $amount;
                $noteLines[] = [
                    'receipt_item_id' => $line['receipt_item_id'],
                    'product_id' => $line['product_id'],
                    'variant_id' => $line['variant_id'],
                    'name' => $line['name'],
                    'batch_number' => $line['batch_number'],
                    'expiry_date' => $line['expiry_date'],
                    'quantity' => $qty,
                    'unit_price' => $line['unit_price'],
                    'amount' => $amount,
                ];
            }
            $goods = round($goods, 2);
            $vat = $rate > 0 ? round($goods * $rate / 100, 2) : 0.0;
            $total = round($goods + $vat, 2);
            $reason = trim((string) ($data['reason'] ?? ''));

            $note = $bills->record($receipt->company_id, [
                'kind' => 'debit_note',
                'supplier_id' => $receipt->supplier_id,
                'supplier_invoice_number' => ($data['supplier_reference'] ?? null) ?: null,
                'invoice_date' => $date->toDateString(),
                'due_date' => $date->toDateString(),
                'amount' => $goods,
                'tax_amount' => $vat,
                'description' => "Goods returned from {$ref}" . ($reason !== '' ? " - {$reason}" : ''),
                'source' => "Returned from goods received {$ref}",
            ], $userId);
            $note->invoice_number = $this->nextNumber($receipt->company_id);
            $note->line_items = $noteLines;
            $note->metadata = array_merge($note->metadata ?? [], [
                'returns' => true,
                'returns_receipt_id' => $receipt->id,
                'returns_receipt_number' => $ref,
                'receipt_bill_id' => $receiptBill?->id,
                'reason' => $reason !== '' ? $reason : null,
            ]);
            $note->save();

            foreach ($noteLines as $line) {
                $this->takeOutOfStock($receipt, $note, $line, $userId, $date);
            }

            if ($receiptBill) {
                $this->adjustDebited($receiptBill, $total);
            }

            return $note->fresh();
        });
    }

    /** Delete the debit note: the stock goes back where it came from, the receipt's invoice is owed again. */
    public function delete(AccountsPayable $note): void
    {
        DB::transaction(function () use ($note) {
            $movements = InventoryMovement::where('reference_type', 'supplier_debit_note')
                ->where('reference_id', $note->id)->get();
            foreach ($movements as $movement) {
                $qty = abs((int) $movement->quantity);
                $stock = $movement->variant_id ? ProductVariant::find($movement->variant_id) : Product::find($movement->product_id);
                if ($stock) {
                    $stock->stock_quantity = (int) $stock->stock_quantity + $qty;
                    $stock->on_hand = (int) $stock->on_hand + $qty;
                    $stock->save();
                }
                if ($movement->batch_id && ($batch = InventoryBatch::find($movement->batch_id))) {
                    $batch->quantity_available = (int) $batch->quantity_available + $qty;
                    $batch->quantity_received = (int) $batch->quantity_received + $qty;
                    $batch->save();
                    $batch->updateStatus();
                }
                if ($movement->product_id) {
                    InventoryMovementEtimsObserver::send((string) $note->company_id, (string) $movement->product_id, $qty, 'adjustment', 'supplier_debit_note_deleted:' . $movement->id);
                }
                $movement->delete();
            }

            $receiptBillId = $note->metadata['receipt_bill_id'] ?? null;
            if ($receiptBillId && ($bill = AccountsPayable::find($receiptBillId))) {
                $this->adjustDebited($bill, -(float) $note->total_amount);
            }

            // Its journal entry is reversed by LedgerSyncObserver.
            $note->delete();
        });
    }

    /** Debit notes for returned goods run SDEB/0001, SDEB/0002, ... */
    public function nextNumber(string $companyId): string
    {
        $last = (int) DB::table('accounts_payable')->where('company_id', $companyId)
            ->selectRaw("max(cast(substring(invoice_number from '^SDEB/([0-9]+)$') as integer)) as n")->value('n');

        return 'SDEB/' . str_pad((string) ($last + 1), 4, '0', STR_PAD_LEFT);
    }

    protected function adjustDebited(AccountsPayable $bill, float $amount): void
    {
        $meta = $bill->metadata ?? [];
        $meta['debited'] = round(max(0, (float) ($meta['debited'] ?? 0) + $amount), 2);
        $bill->metadata = $meta;
        $bill->save();
    }

    /** The batches this receipt line brought in. */
    protected function receiptBatches(ProductReceipt $receipt, ProductReceiptItem $item)
    {
        if (!$item->product_id) {
            return collect();
        }

        return InventoryBatch::where('product_receipt_id', $receipt->id)
            ->where('product_id', $item->product_id)
            ->when($item->variant_id, fn ($q) => $q->where('variant_id', $item->variant_id), fn ($q) => $q->whereNull('variant_id'))
            ->when($item->batch_number, fn ($q) => $q->where('batch_number', $item->batch_number))
            ->get();
    }

    /** Out of this receipt's batch first, then the product's other batches (newest first), then unbatched stock. */
    protected function takeOutOfStock(ProductReceipt $receipt, AccountsPayable $note, array $line, ?string $userId, Carbon $date): void
    {
        $product = $line['product_id'] ? Product::find($line['product_id']) : null;
        if (!$product) {
            return;
        }
        $variant = $line['variant_id'] ? ProductVariant::find($line['variant_id']) : null;
        $target = $variant ?: $product;
        $qty = (int) $line['quantity'];

        $target->stock_quantity = max(0, (int) $target->stock_quantity - $qty);
        $target->on_hand = max(0, (int) $target->on_hand - $qty);
        $target->save();

        $movement = [
            'company_id' => $receipt->company_id,
            'product_id' => $product->id,
            'variant_id' => $variant?->id,
            'type' => 'return',
            'unit_cost' => $line['unit_price'],
            'reference_type' => 'supplier_debit_note',
            'reference_id' => $note->id,
            'reference_number' => $note->invoice_number,
            'movement_date' => $date,
            'created_by' => $userId,
            'notes' => "Returned to supplier on {$note->invoice_number} (from {$receipt->product_receipt_number})",
        ];

        $batches = InventoryBatch::where('product_id', $product->id)
            ->when($variant, fn ($q) => $q->where('variant_id', $variant->id), fn ($q) => $q->whereNull('variant_id'))
            ->where('quantity_available', '>', 0)
            ->orderByRaw('CASE WHEN product_receipt_id = ? AND (? IS NULL OR batch_number = ?) THEN 0 WHEN product_receipt_id = ? THEN 1 ELSE 2 END',
                [$receipt->id, $line['batch_number'], $line['batch_number'], $receipt->id])
            ->orderBy('received_date', 'desc')
            ->lockForUpdate()
            ->get();

        $left = $qty;
        foreach ($batches as $batch) {
            if ($left <= 0) {
                break;
            }
            $take = min($left, (int) $batch->quantity_available);
            $before = (int) $batch->quantity_available;
            $batch->quantity_available = $before - $take;
            $batch->quantity_received = max(0, (int) $batch->quantity_received - $take);
            $batch->save();
            $batch->updateStatus();
            $left -= $take;

            InventoryMovement::create($movement + [
                'id' => (string) Str::uuid(),
                'store_id' => $batch->store_id,
                'batch_id' => $batch->id,
                'quantity' => -$take,
                'quantity_before' => $before,
                'quantity_after' => $batch->quantity_available,
                'total_cost' => round($take * (float) $line['unit_price'], 2),
            ]);
        }
        // Stock received without a batch.
        if ($left > 0) {
            InventoryMovement::create($movement + [
                'id' => (string) Str::uuid(),
                'store_id' => $receipt->store_id ?: ($variant?->store_id ?: $product->store_id),
                'quantity' => -$left,
                'quantity_before' => (int) $target->stock_quantity + $left,
                'quantity_after' => (int) $target->stock_quantity,
                'total_cost' => round($left * (float) $line['unit_price'], 2),
            ]);
        }
    }

    protected function itemName(ProductReceiptItem $item): string
    {
        $name = $item->product?->name ?? 'Item';
        return $item->variant?->name ? "{$name} - {$item->variant->name}" : $name;
    }
}
