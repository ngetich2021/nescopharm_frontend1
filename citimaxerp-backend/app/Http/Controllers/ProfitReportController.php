<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Reports > Profit: each sales invoice line from the go-live date (Order::HISTORICAL_CUTOFF) on, at the
 * price on the invoice (negotiated prices included), against what the goods cost:
 *  1. the buying cost of the batches the stock actually left on the order's dispatch (the total cost
 *     that left, so pack/piece units cannot skew it), shared between lines of the same item;
 *  2. else the item's average batch cost; 3. else its Cost Price; else no cost (listed as such).
 * Total value (TV) is each line as invoiced, after discount, including VAT, so a month's TV is the
 * Sales Accounts total. Profit = TV - cost value (CV); Profit % = profit / CV x 100. Read-only.
 * Sales before the cutoff never moved stock, so their cost is the item's batch cost or Cost Price.
 */
class ProfitReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role;
        $allowed = $role && collect(['can_manage_system', 'can_manage_company', 'can_view_reports_menu'])
            ->contains(fn ($p) => $role->hasPermission($p));
        if (!$allowed) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $companyId = $user->company_id;
        $earliest = Order::HISTORICAL_CUTOFF;
        $from = Carbon::parse($request->input('date_from') ?: now()->startOfMonth())->toDateString();
        $to = Carbon::parse($request->input('date_to') ?: now())->toDateString();
        // Any range: sales before the go-live date never moved stock, so their cost comes from the
        // item's batch cost or Cost Price (the "Cost from" column says which).

        $lines = DB::select("
            select i.id invoice_id, i.invoice_number, i.file_number, i.invoice_date, i.order_id, i.status, i.total_amount::float invoice_total,
                   coalesce(nullif(c.business_name, ''), c.name) customer,
                   li.product_id, li.description, li.unit, li.quantity::float q, li.unit_price::float p,
                   coalesce(li.discount_amount, 0)::float d, coalesce(li.tax_amount, 0)::float t,
                   -- The line's current code: its order line's (where codes are picked and changed),
                   -- else the code stored on the invoice line (invoices without an order).
                   coalesce((
                       select oi.price_label from order_items oi
                       where oi.order_id = i.order_id and oi.product_id = li.product_id
                         and coalesce(oi.variant_id::text, '') = coalesce(li.variant_id::text, '')
                         and coalesce(oi.price_label, '') <> ''
                       order by abs(oi.unit_price - li.unit_price) limit 1), nullif(li.metadata::jsonb->>'price_label', ''), '') label
            from invoice_line_items li
            join invoices i on i.id = li.invoice_id
            left join customers c on c.id = i.customer_id
            where i.company_id = ? and i.invoice_date between ? and ?
              and (i.type is null or i.type not in ('proforma', 'credit_note'))
              and coalesce(i.status, '') not in ('void', 'cancelled')
              and i.invoice_number not like ?  -- bounced cheque charges (DEB-...) are not sales of goods
              and li.quantity > 0
            order by i.invoice_date, i.invoice_number", [$companyId, $from, $to, Invoice::DEBIT_PREFIX . '%']);

        $orderIds = array_values(array_unique(array_filter(array_map(fn ($l) => $l->order_id, $lines))));
        $productIds = array_values(array_unique(array_filter(array_map(fn ($l) => $l->product_id, $lines))));

        // What left stock per order + item (sales less returns from edits), at its batches' cost.
        $moved = [];
        if ($orderIds) {
            $rows = DB::table('inventory_movements')
                ->where('company_id', $companyId)->where('reference_type', 'order')->whereIn('type', ['sale', 'return'])
                ->whereIn('reference_id', $orderIds)->where('unit_cost', '>', 0)
                ->groupBy('reference_id', 'product_id')
                ->selectRaw('reference_id, product_id, sum(-quantity)::float q, sum(-quantity * unit_cost)::float c')
                ->get();
            foreach ($rows as $m) {
                $moved[$m->reference_id . '|' . $m->product_id] = $m;
            }
        }
        $batchCost = $productIds ? DB::table('inventory_batches')->whereIn('product_id', $productIds)->where('unit_cost', '>', 0)
            ->groupBy('product_id')->selectRaw('product_id, sum(greatest(quantity_received, 1) * unit_cost) / sum(greatest(quantity_received, 1)) c')
            ->pluck('c', 'product_id') : collect();
        $costPrice = $productIds ? DB::table('products')->whereIn('id', $productIds)->where('unit_cost', '>', 0)->pluck('unit_cost', 'id') : collect();

        // Lines of the same item on one order share that order's dispatched cost by quantity.
        $share = [];
        foreach ($lines as $l) {
            $k = $l->order_id . '|' . $l->product_id;
            $share[$k] = ($share[$k] ?? 0) + $l->q;
        }

        $out = [];
        foreach ($lines as $l) {
            // Total value as invoiced: after discount, including VAT (what Sales Accounts shows).
            $sales = round($l->q * $l->p - $l->d + $l->t, 2);
            $k = $l->order_id . '|' . $l->product_id;
            if ($l->order_id && isset($moved[$k]) && $moved[$k]->q > 0) {
                $cost = $moved[$k]->c * ($l->q / max($share[$k], 1e-9));
                $source = 'dispatch';
            } elseif ($l->product_id && isset($batchCost[$l->product_id])) {
                $cost = (float) $batchCost[$l->product_id] * $l->q;
                $source = 'batch';
            } elseif ($l->product_id && isset($costPrice[$l->product_id])) {
                $cost = (float) $costPrice[$l->product_id] * $l->q;
                $source = 'cost_price';
            } else {
                $cost = null;
                $source = 'none';
            }
            $label = trim($l->label);
            $out[] = [
                'invoice_id' => $l->invoice_id,
                'invoice_number' => Invoice::printedNumber($l->invoice_number, $l->file_number),
                'invoice_date' => substr((string) $l->invoice_date, 0, 10),
                'customer' => $l->customer,
                'product_id' => $l->product_id,
                'description' => $l->description,
                'price_list' => $label !== '' ? strtok($label, ' ') : null,
                'price_code' => $label !== '' ? $label : null,
                'unit' => $l->unit ?: 'pcs',
                'quantity' => $l->q,
                'unit_price' => round($l->p, 2),
                'sales' => $sales,
                'cost' => $cost === null ? null : round($cost, 2),
                'cost_source' => $source,
            ];
        }

        // VAT is rounded per line here and per invoice on the invoice, so each invoice's last line takes
        // the cents that make its lines add up to the invoice total (Sales Accounts shows that total).
        $totals = [];
        $last = [];
        foreach ($lines as $l) {
            $totals[$l->invoice_id] = $l->invoice_total;
        }
        foreach ($out as $i => $row) {
            $last[$row['invoice_id']] = $i;
        }
        foreach ($last as $invoiceId => $i) {
            $sum = array_sum(array_map(fn ($r) => $r['invoice_id'] === $invoiceId ? $r['sales'] : 0, $out));
            $diff = round((float) $totals[$invoiceId] - $sum, 2);
            if ($diff != 0.0 && abs($diff) < 1) {
                $out[$i]['sales'] = round($out[$i]['sales'] + $diff, 2);
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => ['date_from' => $from, 'date_to' => $to, 'earliest' => $earliest, 'lines' => $out,
                'credits' => app(\App\Services\CreditNoteProfitService::class)->lines($companyId, $from, $to)],
        ]);
    }
}
