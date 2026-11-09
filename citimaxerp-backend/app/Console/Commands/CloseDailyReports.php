<?php

namespace App\Console\Commands;

use App\Models\DailyWorkReport;
use App\Models\DailyWorkReportDraft;
use App\Notifications\SystemAlert;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * The 12 midnight close: every daily report still being written for the day that just ended
 * (a server draft with something in it) is forwarded to the Directors as it stands, marked
 * auto-submitted, and its writer is told. Empty drafts are dropped.
 */
class CloseDailyReports extends Command
{
    protected $signature = 'daily-reports:close {--date= : Report date (Y-m-d), default yesterday in Nairobi}';
    protected $description = 'Forward unsent daily report drafts at the 12 midnight close';

    public function handle(NotificationService $notifications): int
    {
        $date = $this->option('date') ?: now(DailyWorkReport::TIMEZONE)->subDay()->toDateString();
        $shown = Carbon::parse($date)->format('d/m/Y');
        $forwarded = 0;

        $drafts = DailyWorkReportDraft::with(['employee', 'user.role'])->whereDate('report_date', $date)->get();

        foreach ($drafts as $draft) {
            $alreadySent = DailyWorkReport::where('employee_id', $draft->employee_id)->whereDate('report_date', $date)->exists();
            if ($alreadySent || !$draft->hasContent() || !$draft->employee || !$draft->user || Carbon::parse($date)->isSunday()) {
                $draft->delete();
                continue;
            }

            try {
                DailyWorkReport::submitFor($draft->employee, $draft->user, [
                    'report_date' => $date,
                    'entries' => $draft->entries ?? [],
                    'key_achievements' => $draft->key_achievements,
                    'pending_work' => $draft->pending_work,
                ], true);
                $forwarded++;

                $notifications->notifyUser($draft->user_id, new SystemAlert(
                    'info',
                    "Daily report for {$shown} sent automatically",
                    "Reports closed at 12 midnight, so what you had written for {$shown} was sent to the Directors as it stood.",
                    '/employee-portal?tab=daily-reports',
                    ['type' => 'daily_report_auto_submitted'],
                ));
            } catch (\Throwable $e) {
                Log::warning('Daily report close failed', ['draft_id' => $draft->id, 'error' => $e->getMessage()]);
            }
        }

        // The day is closed: its "not sent" reminders no longer apply.
        try {
            \Illuminate\Notifications\DatabaseNotification::query()
                ->whereRaw("data::jsonb->>'type' = ?", ['daily_report_reminder'])
                ->whereRaw("data::jsonb->>'reminder_key' LIKE ?", ['%:' . $date])
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('Clearing daily report reminders failed', ['error' => $e->getMessage()]);
        }

        $this->info("Forwarded {$forwarded} daily report(s) for {$date}.");
        return self::SUCCESS;
    }
}
