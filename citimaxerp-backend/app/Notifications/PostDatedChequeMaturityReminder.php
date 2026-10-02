<?php

namespace App\Notifications;

use App\Models\Cheque;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PostDatedChequeMaturityReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public Cheque $cheque;

    public function __construct(Cheque $cheque)
    {
        $this->cheque = $cheque;
    }

    public function via($notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * This notification only ever fires for direction='issued' cheques
     * (see SendChequeMaturityReminders) - a cheque the company itself
     * writes, either to a supplier or as a refund to a customer.
     */
    protected function partyLine(): array
    {
        $cheque = $this->cheque;
        $party = $cheque->payee_display_name ?? 'the recipient';

        return [
            'headline' => "Post-dated cheque due to {$party} matures in a week",
            'line' => "A cheque issued to {$party} is due to clear in 7 days - make sure funds are available.",
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        $cheque = $this->cheque;
        ['headline' => $headline, 'line' => $line] = $this->partyLine();

        return (new MailMessage)
            ->subject($headline)
            ->greeting('Hello ' . $notifiable->first_name . ',')
            ->line($line)
            ->line("Cheque Number: {$cheque->cheque_number}")
            ->line("Bank: {$cheque->bank_name}")
            ->line('Amount: KES ' . number_format((float) $cheque->amount, 2))
            ->line('Maturity Date: ' . $cheque->maturity_date->toDateString())
            ->action('View Cheque', rtrim(config('app.frontend_url'), '/') . '/sales/cheques');
    }

    public function toArray($notifiable): array
    {
        $cheque = $this->cheque;
        ['headline' => $headline, 'line' => $line] = $this->partyLine();

        return [
            'type' => 'post_dated_cheque_maturity',
            'title' => $headline,
            'message' => $line,
            'cheque_id' => $cheque->id,
            'direction' => $cheque->direction,
            'cheque_number' => $cheque->cheque_number,
            'bank_name' => $cheque->bank_name,
            'amount' => $cheque->amount,
            'maturity_date' => $cheque->maturity_date->toDateString(),
            'url' => '/sales/cheques',
        ];
    }
}
