<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Conversation;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Company-wide conversations channel
Broadcast::channel('company.{companyId}.conversations', function ($user, $companyId) {
    return $user->company_id === $companyId;
});

// Individual conversation channel
Broadcast::channel('conversation.{conversationId}', function ($user, $conversationId) {
    $conversation = Conversation::find($conversationId);
    return $conversation && $conversation->company_id === $user->company_id;
});

// Agent presence channel for typing indicators
Broadcast::channel('conversation.{conversationId}.presence', function ($user, $conversationId) {
    $conversation = Conversation::find($conversationId);
    if ($conversation && $conversation->company_id === $user->company_id) {
        return [
            'id' => $user->id,
            'name' => $user->first_name . ' ' . $user->last_name,
            'avatar' => $user->avatar ?? null,
        ];
    }
    return false;
});
