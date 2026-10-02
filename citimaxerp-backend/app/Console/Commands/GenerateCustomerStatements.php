<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\CustomerNote;
use App\Models\Invoice;
use App\Services\CustomerStatementService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class GenerateCustomerStatements extends Command
{
    protected $signature = 'customers:generate-statements';
    protected $description = "Generate each customer's account statement for the month just ended and save it as a customer note";

    public function handle(CustomerStatementService $statementService): void
    {
        $periodStart = Carbon::now()->subMonthNoOverflow()->startOfMonth();
        $periodEnd = Carbon::now()->subMonthNoOverflow()->endOfMonth();

        // Only customers who have ever been invoiced - a real trading
        // relationship, not every lead/contact record in the system.
        $customerIds = Invoice::select('customer_id')->distinct()->pluck('customer_id');
        $customers = Customer::whereIn('id', $customerIds)->get(['id', 'company_id', 'name']);

        $generated = 0;

        foreach ($customers as $customer) {
            $statement = $statementService->generate($customer->company_id, $customer->id, $periodStart, $periodEnd);
            $summary = $statement['summary'];

            // Nothing happened this month and both balances are zero -
            // skip rather than note-spam a dormant account.
            $hadActivity = $summary['invoices_count'] || $summary['payments_count']
                || $summary['credit_notes_count'] || $summary['pd_cheques_count'];
            if (!$hadActivity && (float) $statement['opening_balance'] == 0.0 && (float) $statement['closing_balance'] == 0.0) {
                continue;
            }

            CustomerNote::create([
                'id' => (string) Str::uuid(),
                'company_id' => $customer->company_id,
                'customer_id' => $customer->id,
                'note_content' => $statementService->toText($statement),
                'created_by' => null,
            ]);

            $generated++;
            $this->info("Statement generated for {$customer->name} ({$customer->id})");
        }

        $this->info("Customer statements generated: {$generated}.");
    }
}
