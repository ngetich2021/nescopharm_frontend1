<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The emailed link to the set-password page, for a new account or a forgotten password. Using it
 * also confirms the email address. Sent straight away, not queued, so a failure is told to the
 * person waiting for it.
 */
class VerifyEmailNotification extends Notification
{
    use Queueable;

    public const SETUP = 'setup';
    public const RESET = 'reset';

    public function __construct(public string $passwordSetupUrl, public string $purpose = self::SETUP)
    {
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        if ($this->purpose === self::RESET) {
            return (new MailMessage)
                ->subject('Reset Your Password')
                ->line('We received a request to reset the password for your account.')
                ->action('Reset Password', $this->passwordSetupUrl)
                ->line('This link works for 24 hours. If you did not ask for it, you can ignore this email and your password stays the same.');
        }

        return (new MailMessage)
            ->subject('Set Your Password')
            ->line('Your account is ready. Click the button below to confirm your email address and set your password.')
            ->action('Set Password', $this->passwordSetupUrl)
            ->line('This link works for 24 hours. After that, use "Forgot password" on the login page to get a new one. If you did not expect this email, you can ignore it.');
    }
}
