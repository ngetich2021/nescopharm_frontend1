<?php

namespace App\Console;

use App\Jobs\Etims\EtimsReaperJob;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // $schedule->command('eod:process')->dailyAt('20:59');
        $schedule->command('dispatch:send-return-reminders')->dailyAt('08:00');
        $schedule->command('cheques:send-maturity-reminders')->dailyAt('08:00');
        $schedule->command('batches:refresh-status')->dailyAt('00:05');
        $schedule->command('customers:generate-statements')->monthlyOn(1, '01:00');

        // Recover eTIMS invoices left locked by an interrupted worker.
        $schedule->job(new EtimsReaperJob())->everyFiveMinutes()->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');
        require base_path('routes/console.php');
    }
}
