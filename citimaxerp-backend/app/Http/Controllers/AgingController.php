<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Receivables and payables aging for the finance Aging page, built from the documents the ledger
 * posts: sales invoices for what customers owe, goods received less supplier payments for what
 * the company owes. Replaces the old accounts_receivable / accounts_payable module, whose tables
 * were never created and which wasn't scoped to a company.
 */
class AgingController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    protected function canView(Request $request, string $permission): bool
    {
        $role = $request->user()->role;
        if (!$role) {
            return false;
        }
        foreach (['can_manage_system', 'can_manage_company', 'can_view_finance_menu', 'can_view_financial_reports', $permission] as $p) {
            if ($role->hasPermission($p)) {
                return true;
            }
        }
        return false;
    }

    private function emptyBuckets(): array
    {
        return [
            'current' => ['min' => 0, 'max' => 30, 'amount' => 0.0, 'count' => 0],
            '31_60' => ['min' => 31, 'max' => 60, 'amount' => 0.0, 'count' => 0],
            '61_90' => ['min' => 61, 'max' => 90, 'amount' => 0.0, 'count' => 0],
            'over_90' => ['min' => 91, 'max' => null, 'amount' => 0.0, 'count' => 0],
        ];
    }

    private function bucketFor(int $daysPastDue): string
    {
        return match (true) {
            $daysPastDue > 90 => 'over_90',
            $daysPastDue > 60 => '61_90',
            $daysPastDue > 30 => '31_60',
            default => 'current',
        };
    }

    private function report(array $rows, string $key, string $asOf): array
    {
        $buckets = $this->emptyBuckets();
        $detail = [];
        foreach ($rows as $row) {
            $days = max(0, (int) Carbon::parse($row['due_date'])->startOfDay()->diffInDays(Carbon::parse($asOf)->startOfDay(), false));
            $bucket = $this->bucketFor($days);
            $buckets[$bucket]['amount'] = round($buckets[$bucket]['amount'] + $row['balance_amount'], 2);
            $buckets[$bucket]['count']++;
            $detail[] = [$key => $row, 'days_past_due' => $days, 'bucket' => $bucket];
        }

        return [
            'aging_buckets' => $buckets,
            'detail_report' => $detail,
            'summary' => [
                'total_outstanding' => round(array_sum(array_column($rows, 'balance_amount')), 2),
                'total_invoices' => count($rows),
                'as_of_date' => $asOf,
            ],
        ];
    }

    /** What customers owe: every live sales invoice with a balance, dated on or before the date. */
    public function receivables(Request $request)
    {
        if (!$this->canView($request, 'can_view_accounts_receivable')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view receivables.'], 403);
        }
        $asOf = Carbon::parse($request->input('as_of_date', now()->toDateString()))->toDateString();

        $rows = Invoice::with('customer:id,name,business_name')
            ->where('company_id', $request->user()->company_id)
            ->where('type', '!=', 'credit_note')
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->where('balance_amount', '>', 0.009)
            ->whereDate('invoice_date', '<=', $asOf)
            ->orderBy('due_date')
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->id,
                'customer' => ['id' => $inv->customer_id, 'name' => $inv->customer ? ($inv->customer->business_name ?: $inv->customer->name) : 'Unknown customer'],
                'invoice_number' => $inv->invoice_number,
                'invoice_date' => Carbon::parse($inv->invoice_date)->toDateString(),
                // No due date means it was due on the day.
                'due_date' => Carbon::parse($inv->due_date ?? $inv->invoice_date)->toDateString(),
                'total_amount' => round((float) $inv->total_amount, 2),
                'paid_amount' => round((float) $inv->amount_paid, 2),
                'balance_amount' => round((float) $inv->balance_amount, 2),
                'status' => $inv->status,
            ])
            ->all();

        return response()->json($this->report($rows, 'receivable', $asOf));
    }

    /**
     * What the company owes suppliers: each goods-received note at the value the ledger posts
     * (goods + landed costs + VAT), less that supplier's payments applied oldest note first.
     * Due date is the note date plus the supplier's payment terms.
     */
    public function payables(Request $request)
    {
        if (!$this->canView($request, 'can_view_accounts_payable')) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized to view payables.'], 403);
        }
        $asOf = Carbon::parse($request->input('as_of_date', now()->toDateString()))->toDateString();
        $companyId = $request->user()->company_id;

        $receipts = DB::table('product_receipts as r')
            ->leftJoin('purchase_orders as po', 'po.id', '=', 'r.purchase_order_id')
            ->leftJoin('suppliers as s', 's.id', '=', 'r.supplier_id')
            ->where('r.company_id', $companyId)
            ->whereNotNull('r.supplier_id')
            ->whereDate('r.created_at', '<=', $asOf)
            ->select(
                'r.id', 'r.product_receipt_number', 'r.created_at', 'r.supplier_id', 'r.shipping_cost', 'r.logistics_cost',
                'po.tax_rate', 's.name as supplier_name', 's.payment_terms_days',
                DB::raw('(SELECT COALESCE(SUM(COALESCE(i.quantity, 0) * COALESCE(i.unit_price, 0)), 0) FROM product_receipt_items i WHERE i.product_receipt_id = r.id) as goods')
            )
            ->orderBy('r.created_at')
            ->get();

        $paid = DB::table('supplier_payments')
            ->where('company_id', $companyId)
            ->where('status', 'completed')
            ->whereDate('payment_date', '<=', $asOf)
            ->groupBy('supplier_id')
            ->select('supplier_id', DB::raw('SUM(amount) as total'))
            ->pluck('total', 'supplier_id')
            ->map(fn ($v) => (float) $v)
            ->all();

        // Supplier bills entered without a goods receipt (e.g. brought in from the old system). A bill a
        // receipt already covers (metadata.ledger = receipt) is left out; its debit notes count as paid.
        $bills = DB::table('accounts_payable as b')
            ->leftJoin('suppliers as s', 's.id', '=', 'b.vendor_id')
            ->where('b.company_id', $companyId)
            ->whereNotIn('b.status', ['draft', 'cancelled'])
            ->whereDate('b.invoice_date', '<=', $asOf)
            ->whereRaw("coalesce(b.metadata->>'ledger', '') <> 'receipt'")
            ->select('b.id', 'b.invoice_number', 'b.invoice_date', 'b.vendor_id', 'b.total_amount', 's.name as supplier_name', 's.payment_terms_days',
                DB::raw("coalesce(b.metadata->>'kind', 'bill') as kind"))
            ->get();
        foreach ($bills->where('kind', 'debit_note') as $dn) {
            $paid[$dn->vendor_id] = ($paid[$dn->vendor_id] ?? 0.0) + (float) $dn->total_amount;
        }

        $documents = collect($receipts)->map(function ($r) {
            $goods = round((float) $r->goods, 2);
            $vat = (float) $r->tax_rate > 0 ? round($goods * (float) $r->tax_rate / 100, 2) : 0.0;
            return (object) [
                'id' => $r->id, 'supplier_id' => $r->supplier_id, 'supplier_name' => $r->supplier_name,
                'number' => $r->product_receipt_number ?: substr($r->id, 0, 8), 'date' => Carbon::parse($r->created_at),
                'terms' => $r->payment_terms_days, 'total' => round($goods + (float) $r->shipping_cost + (float) $r->logistics_cost + $vat, 2),
            ];
        })->concat($bills->where('kind', '!=', 'debit_note')->map(fn ($b) => (object) [
            'id' => $b->id, 'supplier_id' => $b->vendor_id, 'supplier_name' => $b->supplier_name,
            'number' => $b->invoice_number, 'date' => Carbon::parse($b->invoice_date),
            'terms' => $b->payment_terms_days, 'total' => round((float) $b->total_amount, 2),
        ]))->sortBy(fn ($d) => $d->date->timestamp)->values();

        $rows = [];
        foreach ($documents as $r) {
            $total = $r->total;
            if ($total <= 0) {
                continue;
            }
            $applied = min($total, $paid[$r->supplier_id] ?? 0.0);
            $paid[$r->supplier_id] = ($paid[$r->supplier_id] ?? 0.0) - $applied;
            $balance = round($total - $applied, 2);
            if ($balance <= 0.009) {
                continue;
            }
            $date = $r->date;
            $rows[] = [
                'id' => $r->id,
                'supplier' => ['id' => $r->supplier_id, 'name' => $r->supplier_name ?? 'Unknown supplier'],
                'invoice_number' => $r->number,
                'invoice_date' => $date->toDateString(),
                'due_date' => $date->copy()->addDays((int) ($r->terms ?? 0))->toDateString(),
                'total_amount' => $total,
                'paid_amount' => round($applied, 2),
                'balance_amount' => $balance,
                'status' => $applied > 0 ? 'partially_paid' : 'unpaid',
            ];
        }
        usort($rows, fn ($a, $b) => strcmp($a['due_date'], $b['due_date']));

        return response()->json($this->report($rows, 'payable', $asOf));
    }
}
