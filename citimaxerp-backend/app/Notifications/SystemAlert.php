<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * In-app bell notification. `category` drives the icon in the frontend:
 * approval | approval_result | cheque | stock | info.
 */
class SystemAlert extends Notification
{
    use Queueable;

    public function __construct(
        public string $category,
        public string $title,
        public string $message,
        public ?string $url = null,
        public array $meta = [],
    ) {
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return array_merge($this->meta, [
            'type' => $this->meta['type'] ?? $this->category,
            'category' => $this->category,
            'title' => $this->title,
            'message' => $this->message,
            'url' => $this->url,
        ]);
    }
}
