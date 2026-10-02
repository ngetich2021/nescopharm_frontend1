<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected $passwordSetupUrl;

    public function __construct($passwordSetupUrl)
    {
        $this->passwordSetupUrl = $passwordSetupUrl;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $url = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $notifiable->id, 'hash' => sha1($notifiable->email)]
        );

        return (new MailMessage)
            ->subject('Verify Your Email Address')
            ->line('Please click the button below to verify your email address. You will be redirected to set your password immediately after verification.')
            ->action('Verify & Set Password', $url)
            ->line('If you did not create an account, no further action is required.');
    }
}
