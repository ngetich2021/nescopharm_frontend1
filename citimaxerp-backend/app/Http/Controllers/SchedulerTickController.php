<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use Illuminate\Console\Scheduling\CallbackEvent;
use Illuminate\Console\Scheduling\Schedule;
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
            $this->runDueEvents();
        });

        return response()->json(['status' => 'ok', 'schedule' => 'started']);
    }

    /**
     * What schedule:run does, but in this process: schedule:run starts each command as a new
     * "php artisan ..." process, and inside the web server PHP_BINARY is php-fpm, so nothing ran.
     * Each tick's result is kept in the "scheduler_last_tick" setting.
     */
    private function runDueEvents(): void
    {
        $ran = [];
        app(\Illuminate\Contracts\Console\Kernel::class); // defines the schedule
        $schedule = app(Schedule::class);

        foreach ($schedule->dueEvents(app()) as $event) {
            $name = $event instanceof CallbackEvent ? ($event->description ?: 'job') : $this->artisanCommand($event->command);
            try {
                if (! $event->filtersPass(app())) {
                    continue;
                }
                if ($event->withoutOverlapping && ! $event->mutex->create($event)) {
                    $ran[] = "{$name}: skipped (still running)";
                    continue;
                }
                try {
                    if ($event instanceof CallbackEvent) {
                        $event->run(app());
                    } else {
                        Artisan::call($name);
                    }
                    $ran[] = "{$name}: ok";
                } finally {
                    if ($event->withoutOverlapping) {
                        $event->mutex->forget($event);
                    }
                }
            } catch (\Throwable $e) {
                $ran[] = "{$name}: failed - " . mb_substr($e->getMessage(), 0, 200);
                Log::error('Scheduled task failed', ['task' => $name, 'error' => $e->getMessage()]);
            }
        }

        try {
            CompanySetting::updateOrCreate(
                ['setting_key' => 'scheduler_last_tick', 'company_id' => CompanySetting::where('setting_key', 'scheduler_token_hash')->value('company_id')
                    ?? DB::table('companies')->orderBy('created_at')->value('id')],
                ['setting_value' => ['at' => now()->toIso8601String(), 'ran' => $ran], 'is_active' => true,
                 'description' => 'Last run of the schedule by the Cloudflare Worker and what it ran']
            );
        } catch (\Throwable $e) {
            Log::warning('Scheduler tick not recorded', ['error' => $e->getMessage()]);
        }
    }

    /** "'/usr/bin/php' 'artisan' health:check --report" -> "health:check --report" */
    private function artisanCommand(string $command): string
    {
        return trim(preg_replace("/^.*?['\"]?artisan['\"]?\s+/", '', $command));
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
