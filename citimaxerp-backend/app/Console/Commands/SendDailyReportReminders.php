<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\DailyWorkReport;
use App\Notifications\SystemAlert;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Reminds every employee who hasn't sent today's daily report that reports close at
 * 12 midnight, when whatever they've written is forwarded as it stands. Runs Mon-Sat evenings.
 */
class SendDailyReportReminders extends Command
{
    protected $signature = 'daily-reports:remind {--date= : Report date (Y-m-d), default today in Nairobi}';
    protected $description = "Remind staff who haven't sent today's daily report that reports close at 12 midnight";

    public function handle(NotificationService $notifications): int
    {
        $date = $this->option('date') ?: now(DailyWorkReport::TIMEZONE)->toDateString();
        if (Carbon::parse($date)->isSunday()) {
            $this->info('Sunday - no daily reports.');
            return self::SUCCESS;
        }
        $shown = Carbon::parse($date)->format('d/m/Y');
        $sent = 0;

        foreach (Company::pluck('id') as $companyId) {
            $submitted = DailyWorkReport::where('company_id', $companyId)->whereDate('report_date', $date)->pluck('employee_id')->flip();

            foreach (DailyWorkReport::expectedEmployees($companyId, $date) as $employee) {
                if ($submitted->has($employee->id)) {
                    continue;
                }
                $key = DailyWorkReport::reminderKey($employee->id, $date);
                // One reminder per day in the bell: the later one replaces the earlier.
                $notifications->resolve('daily_report_reminder', 'reminder_key', $key);
                $notifications->notifyUser($employee->user_id, new SystemAlert(
                    'action',
                    "Daily report for {$shown} not sent",
                    "Please send your daily work report for {$shown}. Reports close at 12 midnight - whatever you have written by then is sent automatically.",
                    '/employee-portal?tab=daily-reports',
                    ['type' => 'daily_report_reminder', 'reminder_key' => $key],
                ));
                $sent++;
            }
        }

        $this->info("Reminded {$sent} employee(s) for {$date}.");
        return self::SUCCESS;
    }
}
