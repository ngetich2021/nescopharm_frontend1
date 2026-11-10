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
 * Sales are excluding VAT, after line discounts. Profit % = profit / cost x 100. Read-only.
 * Past sales (before the cutoff) never moved stock, so they have no cost and are not covered.
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
        if ($from < $earliest) {
            $from = $earliest;
        }

        $lines = DB::select("
            select i.id invoice_id, i.invoice_number, i.file_number, i.invoice_date, i.order_id, i.status,
                   coalesce(nullif(c.business_name, ''), c.name) customer,
                   li.product_id, li.description, li.unit, li.quantity::float q, li.unit_price::float p,
                   coalesce(li.discount_amount, 0)::float d, coalesce(li.metadata::jsonb->>'price_label', '') label
            from invoice_line_items li
            join invoices i on i.id = li.invoice_id
            left join customers c on c.id = i.customer_id
            where i.company_id = ? and i.invoice_date between ? and ?
              and (i.type is null or i.type not in ('proforma', 'credit_note'))
              and coalesce(i.status, '') not in ('void', 'cancelled')
              and li.quantity > 0
            order by i.invoice_date, i.invoice_number", [$companyId, $from, $to]);

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
            $sales = round($l->q * $l->p - $l->d, 2);
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

        return response()->json([
            'status' => 'success',
            'data' => ['date_from' => $from, 'date_to' => $to, 'earliest' => $earliest, 'lines' => $out,
                'credits' => app(\App\Services\CreditNoteProfitService::class)->lines($companyId, $from, $to)],
        ]);
    }
}
