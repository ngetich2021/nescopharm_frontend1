<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Mail\Mailable;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Notifications\Notification;
use App\Models\Quote;

class SendQuoteNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $quote;

    public function __construct(Quote $quote)
    {
        $this->quote = $quote;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $quote = $this->quote;
        $url = url('/quotes/' . $quote->id); // Adjust as needed for your frontend

        // Generate PDF from Blade view
        $pdf = Pdf::loadView('quote.pdf', ['quote' => $quote]);
        $pdfContent = $pdf->output();

        return (new MailMessage)
            ->subject('Your Quote #' . $quote->quote_number)
            ->greeting('Hello ' . ($quote->customer->name ?? ''))
            ->line('You have received a new quotation from ' . ($quote->company->name ?? 'our company') . '.')
            ->line('Quote Number: ' . $quote->quote_number)
            ->line('Total Amount: ' . number_format($quote->final_amount, 2) . ' ' . $quote->currency)
            ->line('Valid Until: ' . \Carbon\Carbon::parse($quote->valid_until)->format('F j, Y'))
            ->action('View Quote', $url)
            ->line('Thank you for considering our quotation!')
            ->attachData($pdfContent, 'quote-' . $quote->quote_number . '.pdf', [
                'mime' => 'application/pdf',
            ]);
    }
}
