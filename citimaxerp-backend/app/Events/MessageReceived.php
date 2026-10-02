<?php

namespace App\Events;

use App\Models\Message;
use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;
    public $conversation;

    /**
     * Create a new event instance.
     */
    public function __construct(Message $message, Conversation $conversation)
    {
        $this->message = $message->load(['sender', 'attachments', 'replyToMessage']);
        $this->conversation = $conversation;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('company.' . $this->conversation->company_id . '.conversations'),
            new PrivateChannel('conversation.' . $this->conversation->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'message.received';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'message' => $this->message,
            'conversation_id' => $this->conversation->id,
            'conversation' => [
                'id' => $this->conversation->id,
                'last_message_at' => $this->conversation->last_message_at,
                'last_customer_message_at' => $this->conversation->last_customer_message_at,
                'unread_count' => $this->conversation->unread_count,
                'status' => $this->conversation->status,
            ],
        ];
    }
}
