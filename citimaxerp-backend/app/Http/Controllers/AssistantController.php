<?php

namespace App\Http\Controllers;

use App\Services\Assistant\AssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The in-app assistant's chat: the conversation so far in, the assistant's reply out. */
class AssistantController extends Controller
{
    public function chat(Request $request, AssistantService $assistant): JsonResponse
    {
        $data = $request->validate([
            'messages' => 'required|array|min:1|max:40',
            'messages.*.role' => 'required|in:user,assistant',
            'messages.*.content' => 'required|string|max:4000',
        ]);

        // The last 12 turns are enough context and keep the request small.
        $history = array_map(
            fn ($m) => ['role' => $m['role'], 'content' => $m['content']],
            array_slice($data['messages'], -12)
        );

        return response()->json(['reply' => $assistant->reply($request->user(), $history)]);
    }
}
