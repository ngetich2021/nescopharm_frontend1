<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Runs the Laravel schedule when called by the Cloudflare Worker each minute (cloudflare/scheduler-worker.js),
 * because the Laravel Cloud scheduler is not on. The Worker sends the token in X-Cron-Token; its SHA-256
 * is kept in the "scheduler_token_hash" company setting ({"hash": "..."}) or SCHEDULER_TOKEN_HASH.
 *
 * Answers at once (200 when the app and database work, 503 when the database does not, so the Worker
 * can alert), then runs schedule:run after the response has gone, so long jobs never time out the call.
 */
class SchedulerTickController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        if (! $this->validToken((string) $request->header('X-Cron-Token'))) {
            abort(404);
        }

        try {
            DB::select('select 1');
        } catch (\Throwable $e) {
            return response()->json(['status' => 'database unreachable'], 503);
        }

        // Once per minute, however often it is called (Cloudflare can retry).
        $minute = now()->format('YmdHi');
        if (! Cache::add("scheduler-tick:{$minute}", true, 120)) {
            return response()->json(['status' => 'ok', 'schedule' => 'already run this minute']);
        }

        app()->terminating(function () {
            ignore_user_abort(true);
            set_time_limit(600);
            try {
                Artisan::call('schedule:run');
            } catch (\Throwable $e) {
                Log::error('Scheduler tick failed', ['error' => $e->getMessage()]);
            }
        });

        return response()->json(['status' => 'ok', 'schedule' => 'started']);
    }

    private function validToken(string $token): bool
    {
        if ($token === '') {
            return false;
        }
        $hash = env('SCHEDULER_TOKEN_HASH');
        if (! $hash) {
            $setting = CompanySetting::where('setting_key', 'scheduler_token_hash')->where('is_active', true)->value('setting_value');
            $hash = is_array($setting) ? ($setting['hash'] ?? null) : null;
        }
        return $hash && hash_equals($hash, hash('sha256', $token));
    }
}
