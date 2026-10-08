<?php

namespace App\Console\Commands;

use App\Models\Cheque;
use App\Models\User;
use App\Notifications\PostDatedChequeMaturityReminder;
use App\Notifications\SystemAlert;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendChequeMaturityReminders extends Command
{
    protected $signature = 'cheques:send-maturity-reminders';
    protected $description = 'Alert the Managing Director and GM one week before a pending post-dated cheque WE issue (to a supplier or a customer refund) matures - not cheques customers issue to us';

    public function handle(): void
    {
        $targetDate = Carbon::today()->addDays(7);

        // Only cheques the company itself issues (repaying a customer or
        // paying a supplier) - that's the direction where "make sure funds
        // are available" actually applies. A cheque a customer hands to us
        // never needs the company's own bank balance to be ready.
        $cheques = Cheque::where('status', 'pending')
            ->where('direction', 'issued')
            ->whereNull('reminder_sent_at')
            ->whereDate('maturity_date', $targetDate->toDateString())
            ->with(['customer', 'supplier', 'company'])
            ->get();

        foreach ($cheques as $cheque) {
            // "Managing Director" and "General Manager" map to this app's
            // actual role names - "Director" and "GM" - for this company.
            $recipients = User::whereHas('role', function ($q) use ($cheque) {
                $q->where('company_id', $cheque->company_id)
                    ->whereIn('name', ['Director', 'GM']);
            })->whereNotNull('email')->get();

            if ($recipients->isEmpty()) {
                $this->warn("No Director/GM users found for company {$cheque->company_id} - skipping cheque {$cheque->id}");
                continue;
            }

            foreach ($recipients as $recipient) {
                $recipient->notify(new PostDatedChequeMaturityReminder($cheque));
            }

            $cheque->update(['reminder_sent_at' => now()]);
            $this->info("Maturity reminder sent for cheque {$cheque->cheque_number} to " . $recipients->count() . ' recipient(s)');
        }

        $this->remindReceivedCheques(app(NotificationService::class));

        $this->info('Cheque maturity reminders processed.');
    }

    // Received post-dated cheques need banking on/after maturity - nudge whoever records customer payments.
    protected function remindReceivedCheques(NotificationService $notifier): void
    {
        $today = Carbon::today();
        $inThreeDays = $today->copy()->addDays(3);

        $cheques = Cheque::where('status', 'pending')
            ->where('direction', 'received')
            ->where(function ($q) use ($today, $inThreeDays) {
                $q->whereDate('maturity_date', $today->toDateString())
                    ->orWhereDate('maturity_date', $inThreeDays->toDateString());
            })
            ->with('customer')
            ->get();

        foreach ($cheques as $cheque) {
            $dueToday = $cheque->maturity_date->isSameDay($today);
            $from = $cheque->customer?->business_name ?: ($cheque->customer?->name ?? 'a customer');
            $amount = 'KES ' . number_format((float) $cheque->amount, 2);

            $notifier->notifyPermission(
                $cheque->company_id,
                ['can_update_invoices'],
                new SystemAlert(
                    'cheque',
                    $dueToday ? "Cheque from {$from} matures today" : "Cheque from {$from} matures in 3 days",
                    "Cheque #{$cheque->cheque_number} ({$cheque->bank_name}) for {$amount} " . ($dueToday ? 'is ready to bank.' : 'matures on ' . $cheque->maturity_date->format('d M Y') . '.'),
                    '/sales/cheques',
                    ['type' => 'received_cheque_maturity', 'cheque_id' => $cheque->id],
                ),
            );
        }

        $this->info("Received-cheque reminders sent for {$cheques->count()} cheque(s)");
    }
}
