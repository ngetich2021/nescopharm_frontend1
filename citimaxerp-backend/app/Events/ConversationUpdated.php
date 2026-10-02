<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $conversation;
    public $updateType;
    public $updateData;

    /**
     * Create a new event instance.
     */
    public function __construct(Conversation $conversation, string $updateType, array $updateData = [])
    {
        $this->conversation = $conversation->load(['customer', 'assignedAgent']);
        $this->updateType = $updateType;
        $this->updateData = $updateData;
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
        return 'conversation.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'conversation' => $this->conversation,
            'update_type' => $this->updateType,
            'update_data' => $this->updateData,
        ];
    }
}
