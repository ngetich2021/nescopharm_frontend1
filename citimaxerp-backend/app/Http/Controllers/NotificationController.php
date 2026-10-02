<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * The current user's own notifications - there's no company-wide
     * "view all notifications" permission gate here, since a notification
     * is inherently addressed to a specific user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = $user->notifications();
        if ($request->boolean('unread_only')) {
            $query = $user->unreadNotifications();
        }

        $notifications = $query->orderBy('created_at', 'desc')->limit(50)->get();

        return response()->json([
            'status' => 'success',
            'data' => $notifications,
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        $notification = $user->notifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();

        return response()->json([
            'status' => 'success',
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['status' => 'success', 'unread_count' => 0]);
    }
}
