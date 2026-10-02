<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Mail\Mailable;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Notifications\Notification;
use App\Models\Invoice;

class SendInvoiceNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $invoice;

    public function __construct(Invoice $invoice)
    {
        $this->invoice = $invoice;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $invoice = $this->invoice;
        $url = url('/invoices/' . $invoice->id); // Adjust as needed for your frontend

        // Generate PDF from Blade view
        $pdf = Pdf::loadView('invoice.pdf', ['invoice' => $invoice]);
        $pdfContent = $pdf->output();

        return (new MailMessage)
            ->subject('Your Invoice #' . $invoice->invoice_number)
            ->greeting('Hello ' . ($invoice->customer->name ?? ''))
            ->line('You have a new invoice from ' . ($invoice->company->name ?? 'our company') . '.')
            ->line('Invoice Number: ' . $invoice->invoice_number)
            ->line('Total Amount: ' . number_format($invoice->total_amount, 2) . ' ' . $invoice->currency)
            ->action('View Invoice', $url)
            ->line('Thank you for your business!')
            ->attachData($pdfContent, 'invoice-' . $invoice->invoice_number . '.pdf', [
                'mime' => 'application/pdf',
            ]);
    }
}
