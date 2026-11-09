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
        $schedule->command('stock:send-low-stock-alerts')->dailyAt('07:30');
        $schedule->command('batches:refresh-status')->dailyAt('00:05');
        $schedule->command('employees:apply-terminations')->dailyAt('00:10');
        $schedule->command('orders:purge-declined')->everyFiveMinutes()->withoutOverlapping();
        $schedule->command('customers:generate-statements')->monthlyOn(1, '01:00');

        // Daily work reports close at 12 midnight (Nairobi): reminders at 8 PM and 10 PM to anyone
        // who hasn't sent theirs, then at midnight whatever was written is forwarded.
        $schedule->command('daily-reports:remind')->dailyAt('20:00')->timezone('Africa/Nairobi');
        $schedule->command('daily-reports:remind')->dailyAt('22:00')->timezone('Africa/Nairobi');
        $schedule->command('daily-reports:close')->dailyAt('00:00')->timezone('Africa/Nairobi')->withoutOverlapping();

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
