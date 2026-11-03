<?php

namespace App\Observers;

use App\Jobs\Etims\SubmitStockMovementJob;
use App\Models\CompanyEtimsConfig;
use App\Models\InventoryMovement;

/**
 * Tells eTIMS about stock that leaves or enters other than by a sale or a goods receipt, so
 * KRA's stock count follows the system's: stock adjustments and counts (KRA 06 in / 16 out),
 * damage and expiry (15 discarding) and returns to a supplier (12 outgoing return).
 *
 * Not sent: sales (the eTIMS invoice itself takes them off), goods receipts (ProductReceiptItemObserver
 * sends them), transfers between stores (the company's total is unchanged), and customer
 * returns on a credit note (the eTIMS credit note covers them). Breakages, which do not write a
 * movement, are sent from BreakageController. KRA holding less than the system is harmless: a sale
 * short of eTIMS stock adds the shortfall first (EtimsProvider::ensureSaleStock).
 */
class InventoryMovementEtimsObserver
{
    public function created(InventoryMovement $movement): void
    {
        $kind = match (true) {
            $movement->type === 'adjustment' => 'adjustment',
            in_array($movement->type, ['damage', 'expiry'], true) => 'breakage',
            $movement->type === 'return' && $movement->reference_type === 'purchase_order_return' => 'supplier_return',
            default => null,
        };
        if (!$kind || !$movement->product_id || !$movement->company_id) {
            return;
        }

        $delta = $movement->quantity_before !== null && $movement->quantity_after !== null
            && (int) $movement->quantity_after !== (int) $movement->quantity_before
            ? (int) $movement->quantity_after - (int) $movement->quantity_before
            : (int) $movement->quantity;
        if ($kind !== 'adjustment') {
            $delta = -abs($delta); // damage, expiry and supplier returns only take stock out
        }
        if ($delta === 0) {
            return;
        }

        self::send((string) $movement->company_id, (string) $movement->product_id, $delta, $kind, 'inventory_movement:' . $movement->id);
    }

    /** Queue the movement for eTIMS once the change is saved, when eTIMS is enabled for the company. */
    public static function send(string $companyId, string $productId, int $delta, string $kind, string $reference): void
    {
        $enabled = CompanyEtimsConfig::query()
            ->where('company_id', $companyId)
            ->notSuperseded()
            ->whereRaw('enabled = true')
            ->exists();
        if (!$enabled) {
            return;
        }

        SubmitStockMovementJob::dispatch($companyId, $productId, $delta, $kind, $reference)->afterCommit();
    }
}
