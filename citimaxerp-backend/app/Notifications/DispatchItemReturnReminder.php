<?php
namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use App\Models\DispatchItem;

class DispatchItemReturnReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public $dispatchItem;
    public $reminderType;

    /**
     * Create a new notification instance.
     *
     * @param DispatchItem $dispatchItem
     * @param string $reminderType
     */
    public function __construct(DispatchItem $dispatchItem, $reminderType)
    {
        $this->dispatchItem = $dispatchItem;
        $this->reminderType = $reminderType;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        $item = $this->dispatchItem;
        $dispatch = $item->dispatch;
        $product = $item->product;
        $due = $item->return_date ? $item->return_date->format('Y-m-d') : 'N/A';
        $reminderText = [
            'due_2_days' => 'in 2 days',
            'due_today' => 'today',
            'overdue_1_day' => 'was due yesterday',
            'overdue_2_days' => 'was due 2 days ago',
        ];
        $reminderMsg = $reminderText[$this->reminderType] ?? '';
        return (new MailMessage)
            ->subject('Dispatch Item Return Reminder')
            ->greeting('Hello!')
            ->line("This is a reminder that the following item $reminderMsg:")
            ->line("Product: {$product->name}")
            ->line("Quantity: {$item->quantity}")
            ->line("Return Due Date: $due")
            ->line("Dispatch #: {$dispatch->dispatch_number}")
            ->line('Please return the item as soon as possible if you have not already done so.')
            ->action('View Dispatch', url('/dispatches/' . $dispatch->id));
    }
}
