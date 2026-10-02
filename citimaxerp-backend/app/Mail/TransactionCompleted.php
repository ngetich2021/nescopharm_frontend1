<?php
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TransactionCompleted extends Mailable
{
    use Queueable, SerializesModels;

    public $transaction;

    public function __construct($transaction)
    {
        $this->transaction = $transaction;
    }

    public function build()
    {
        return $this->view('emails.transaction_completed')
                    ->with([
                        'transaction' => $this->transaction,
                    ]);
    }
}