<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\DispatchItem;
use App\Notifications\DispatchItemReturnReminder;
use Carbon\Carbon;

class SendDispatchItemReturnReminders extends Command
{
    protected $signature = 'dispatch:send-return-reminders';
    protected $description = 'Send reminders for dispatch items due for return (2 days before, due today, 1 and 2 days overdue)';

    public function handle()
    {
        $today = Carbon::today();
        $windows = [
            'due_2_days' => $today->copy()->addDays(2),
            'due_today' => $today,
            'overdue_1_day' => $today->copy()->subDay(),
            'overdue_2_days' => $today->copy()->subDays(2),
        ];
        foreach ($windows as $reminderType => $date) {
            $items = DispatchItem::whereRaw('is_returnable::int = 1')
                ->whereRaw('is_returned::int = 0')
                ->whereDate('return_date', $date->toDateString())
                ->with(['dispatch', 'product', 'dispatch.toUser'])
                ->get();
            foreach ($items as $item) {
                $reminderStatus = $item->reminder_status ?? [];
                if (!isset($reminderStatus[$reminderType]) || !$reminderStatus[$reminderType]) {
                    $user = $item->dispatch->toUser ?? null;
                    if ($user && $user->email) {
                        $user->notify(new DispatchItemReturnReminder($item, $reminderType));
                        $reminderStatus[$reminderType] = true;
                        $item->reminder_status = $reminderStatus;
                        $item->save();
                        $this->info("Reminder sent for item {$item->id} ({$reminderType}) to user {$user->email}");
                    }
                }
            }
        }
        $this->info('Dispatch item return reminders processed.');
    }
}
