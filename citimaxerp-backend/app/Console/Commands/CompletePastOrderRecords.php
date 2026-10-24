<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use App\Services\InvoiceOrderService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Every completed past sale gets its invoice and a delivered dispatch on record, and invoices
 * that no longer match their (corrected) order are brought back in line.
 */
class CompletePastOrderRecords extends Command
{
    protected $signature = 'orders:complete-past-records {--user= : Email of the user the records are created as} {--match-invoices : Also update invoices that differ from their order} {--dry-run}';

    protected $description = 'Create missing invoices and dispatches for past orders; optionally match invoices to their orders';

    public function handle(InvoiceOrderService $service): int
    {
        $user = User::where('email', $this->option('user'))->first();
        if (!$user) {
            $this->error('Pass --user=<email> of an existing user.');
            return self::FAILURE;
        }
        $dry = (bool) $this->option('dry-run');

        $orders = Order::where('company_id', $user->company_id)
            ->where('status', 'completed')
            ->where(fn ($q) => $q->where('is_historical', true)->orWhere('order_date', '<', Order::HISTORICAL_CUTOFF))
            ->orderBy('order_date')
            ->get();

        $invoices = $dispatches = 0;
        $problems = [];
        foreach ($orders as $order) {
            $needsInvoice = !Invoice::where('order_id', $order->id)->exists();
            $needsDispatch = !DB::table('order_dispatches')->where('order_id', $order->id)
                ->where('status', '!=', 'cancelled')->where('approval_status', '!=', 'rejected')->exists();
            if (!$needsInvoice && !$needsDispatch) {
                continue;
            }
            if ($dry) {
                $invoices += (int) $needsInvoice;
                $dispatches += (int) $needsDispatch;
                continue;
            }
            $result = $service->ensurePastOrderRecords($order, $user);
            if ($result['invoice'] === 'created') {
                $invoices++;
            } elseif ($result['invoice']) {
                $problems[] = "{$order->order_number}: {$result['invoice']}";
            }
            if ($result['dispatch'] === 'created') {
                $dispatches++;
            }
        }
        $this->info(($dry ? 'Would create' : 'Created') . " {$invoices} invoice(s) and {$dispatches} dispatch(es) for {$orders->count()} completed past orders");

        if ($this->option('match-invoices')) {
            $differing = DB::table('invoices as i')->join('orders as o', 'o.id', '=', 'i.order_id')
                ->where('i.company_id', $user->company_id)
                ->whereRaw('abs(i.total_amount - o.final_amount) > 1')
                ->whereExists(fn ($q) => $q->from('order_items')->whereColumn('order_items.order_id', 'o.id'))
                ->pluck('i.id');
            foreach ($differing as $id) {
                $invoice = Invoice::find($id);
                $before = (float) $invoice->total_amount;
                if (!$dry) {
                    DB::transaction(fn () => $service->syncWithOrder(Order::find($invoice->order_id), $invoice));
                    $invoice->refresh();
                }
                $this->line(sprintf('  %s %s: %.2f -> %s', $invoice->invoice_number, $invoice->status, $before, $dry ? 'order total' : number_format((float) $invoice->total_amount, 2, '.', '')));
            }
            $this->info(($dry ? 'Would update' : 'Updated') . ' ' . count($differing) . ' invoice(s) to match their orders');
        }

        foreach ($problems as $p) {
            $this->warn($p);
        }
        return self::SUCCESS;
    }
}
