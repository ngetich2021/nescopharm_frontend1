<?php

namespace App\Services;

use App\Models\Invoice;
use Illuminate\Support\Facades\DB;

/**
 * Credit notes as the profit reports deduct them (Reports > Profit, Inventory report): each credited
 * line dated in the range, its amount (excl. VAT, after discount) and the cost of the goods that came
 * back. Lines without any cost are returned with cost null; the reports take their amount off sales
 * but leave them out of profit, as they do for sales without a cost.
 */
class CreditNoteProfitService
{
    /**
     * Credit notes dated in the range (issued, applied or refunded), deducted at the end of the report:
     * the amount credited (excl. VAT, after discount) comes off sales, and the cost of the goods that
     * came back comes off cost - the batches they went back into, else the item's batch cost, else its
     * Cost Price. Each line takes the price list of the invoice line it credits.
     */
    public function lines(string $companyId, string $from, string $to, ?array $productIds = null): array
    {
        $lines = DB::select("
            select cn.id credit_note_id, cn.credit_note_number, cn.credit_note_date, cn.invoice_id,
                   i.invoice_number, i.file_number, coalesce(nullif(c.business_name, ''), c.name) customer,
                   l.product_id, l.description, l.unit, l.quantity::float q, l.unit_price::float p,
                   coalesce(l.discount_amount, 0)::float d, coalesce(l.tax_amount, 0)::float t
            from credit_note_line_items l
            join credit_notes cn on cn.id = l.credit_note_id
            left join invoices i on i.id = cn.invoice_id
            left join customers c on c.id = cn.customer_id
            where cn.company_id = ? and cn.credit_note_date between ? and ?
              and cn.status in ('issued', 'applied', 'refunded') and l.quantity > 0
            order by cn.credit_note_date, cn.credit_note_number", [$companyId, $from, $to . ' 23:59:59']);
        if ($productIds !== null) {
            $keep = array_flip($productIds);
            $lines = array_values(array_filter($lines, fn ($l) => $l->product_id && isset($keep[$l->product_id])));
        }
        if (!$lines) {
            return [];
        }

        $noteIds = array_values(array_unique(array_map(fn ($l) => $l->credit_note_id, $lines)));
        $invoiceIds = array_values(array_unique(array_filter(array_map(fn ($l) => $l->invoice_id, $lines))));
        $productIds = array_values(array_unique(array_filter(array_map(fn ($l) => $l->product_id, $lines))));

        $returned = DB::table('inventory_movements')->where('reference_type', 'credit_note')->whereIn('reference_id', $noteIds)
            ->where('unit_cost', '>', 0)->groupBy('reference_id', 'product_id')
            ->selectRaw('reference_id, product_id, sum(abs(quantity) * unit_cost) / nullif(sum(abs(quantity)), 0) c')
            ->get()->mapWithKeys(fn ($m) => [$m->reference_id . '|' . $m->product_id => (float) $m->c]);
        $batchCost = $productIds ? DB::table('inventory_batches')->whereIn('product_id', $productIds)->where('unit_cost', '>', 0)
            ->groupBy('product_id')->selectRaw('product_id, sum(greatest(quantity_received, 1) * unit_cost) / sum(greatest(quantity_received, 1)) c')
            ->pluck('c', 'product_id') : collect();
        $costPrice = $productIds ? DB::table('products')->whereIn('id', $productIds)->where('unit_cost', '>', 0)->pluck('unit_cost', 'id') : collect();
        // The price code the credited item carried: on its invoice line, else on its order line.
        $labels = $invoiceIds ? DB::table('invoice_line_items as li')->join('invoices as i', 'i.id', '=', 'li.invoice_id')
            ->whereIn('li.invoice_id', $invoiceIds)->whereNotNull('li.product_id')
            ->selectRaw("li.invoice_id, li.product_id, max(coalesce(nullif(li.metadata::jsonb->>'price_label', ''), (
                select oi.price_label from order_items oi where oi.order_id = i.order_id and oi.product_id = li.product_id
                  and coalesce(oi.price_label, '') <> '' limit 1), '')) label")
            ->groupBy('li.invoice_id', 'li.product_id')->get()
            ->mapWithKeys(fn ($r) => [$r->invoice_id . '|' . $r->product_id => trim($r->label)]) : collect();

        return array_map(function ($l) use ($returned, $batchCost, $costPrice, $labels) {
            $k = $l->credit_note_id . '|' . $l->product_id;
            if (isset($returned[$k])) {
                [$unit, $source] = [$returned[$k], 'returned_batch'];
            } elseif ($l->product_id && isset($batchCost[$l->product_id])) {
                [$unit, $source] = [(float) $batchCost[$l->product_id], 'batch'];
            } elseif ($l->product_id && isset($costPrice[$l->product_id])) {
                [$unit, $source] = [(float) $costPrice[$l->product_id], 'cost_price'];
            } else {
                [$unit, $source] = [null, 'none'];
            }
            $label = (string) ($labels[$l->invoice_id . '|' . $l->product_id] ?? '');
            return [
                'credit_note_id' => $l->credit_note_id,
                'credit_note_number' => $l->credit_note_number,
                'date' => substr((string) $l->credit_note_date, 0, 10),
                'invoice_number' => $l->invoice_number ? Invoice::printedNumber($l->invoice_number, $l->file_number) : null,
                'customer' => $l->customer,
                'product_id' => $l->product_id,
                'description' => $l->description,
                'price_list' => $label !== '' ? strtok($label, ' ') : null,
                'price_code' => $label !== '' ? $label : null,
                'unit' => $l->unit ?: 'pcs',
                'quantity' => $l->q,
                'unit_price' => round($l->p, 2),
                // As credited: after discount, including VAT (what the credit note and Sales Accounts show).
                'amount' => round($l->q * $l->p - $l->d + $l->t, 2),
                'cost' => $unit === null ? null : round($unit * $l->q, 2),
                'cost_source' => $source,
            ];
        }, $lines);
    }
}
