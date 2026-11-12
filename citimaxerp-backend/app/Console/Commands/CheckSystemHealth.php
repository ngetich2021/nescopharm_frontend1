<?php

namespace App\Console\Commands;

use App\Services\SystemHealth;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * health:check          - every 5 minutes: emails when something goes down (repeating while it stays
 *                         down) and once when it is back up, at any hour.
 * health:check --report - the 8:00am email: every check now plus the last 24 hours.
 */
class CheckSystemHealth extends Command
{
    protected $signature = 'health:check {--report : Send the daily health summary email}';

    protected $description = 'Check the database, API, website, AI assistant and email; email the results or any outage';

    public function handle(SystemHealth $health): int
    {
        $checks = $health->run();
        $down = collect($checks)->contains(fn ($c) => ! $c['ok']);
        $failed = collect($checks)->reject(fn ($c) => $c['ok'])->pluck('name')->implode(', ');
        $alertedAt = null;

        foreach ($checks as $c) {
            $this->line(sprintf('%-14s %-4s %6s ms  %s', $c['name'], $c['ok'] ? 'UP' : 'DOWN', $c['ms'] ?? '-', $c['detail']));
        }

        $lastOk = DB::table('system_health_checks')->where('status', 'ok')->max('created_at');
        $previous = DB::table('system_health_checks')->orderByDesc('created_at')->first();

        try {
            if ($this->option('report')) {
                $health->send(
                    ($down ? "Citimax ERP daily health: DOWN ({$failed})" : 'Citimax ERP daily health: all systems up')
                        . ' - ' . $health->now()->format('d/m/Y'),
                    $health->wrap('Daily system health', $health->checksTable($checks) . $this->last24Hours())
                );
                $this->info('Daily report sent.');
                $alertedAt = $down ? now() : null;
            } elseif ($down) {
                $lastAlert = DB::table('system_health_checks')
                    ->whereNotNull('alerted_at')
                    ->when($lastOk, fn ($q) => $q->where('created_at', '>', $lastOk))
                    ->max('alerted_at');
                if (! $lastAlert || now()->diffInMinutes($lastAlert, true) >= config('health.repeat_minutes')) {
                    $since = $this->downSince($lastOk);
                    $when = $health->inWorkingHours() ? 'during working hours' : 'after hours';
                    $health->send(
                        "ALERT: Citimax ERP is DOWN - {$failed}",
                        $health->wrap('System down', '<p style="margin:0 0 12px">'
                            . e($failed) . ' failed ' . $when . '. '
                            . ($since ? 'Down since ' . $since->timezone(config('health.timezone'))->format('d/m/Y H:i') . '.' : 'Just went down.')
                            . '</p>' . $health->checksTable($checks))
                    );
                    $alertedAt = now();
                    $this->warn('Down alert sent.');
                }
            } elseif ($previous && $previous->status === 'down') {
                $since = $this->downSince($lastOk);
                $mins = $since ? (int) $since->diffInMinutes(now(), true) : null;
                $health->send(
                    'RECOVERED: Citimax ERP is back up',
                    $health->wrap('System back up', '<p style="margin:0 0 12px">Everything is answering again'
                        . ($mins !== null ? ' after about ' . max(5, $mins) . ' minutes down' : '') . '.</p>'
                        . $health->checksTable($checks))
                );
                $this->info('Recovery email sent.');
            }
        } catch (\Throwable $e) {
            // Not sending must not stop the check being recorded; the next run tries again.
            Log::error('Health email not sent', ['error' => $e->getMessage()]);
            $this->error('Email not sent: ' . $e->getMessage());
            $alertedAt = null;
        }

        DB::table('system_health_checks')->insert([
            'status' => $down ? 'down' : 'ok',
            'checks' => json_encode($checks),
            'alerted_at' => $alertedAt,
            'created_at' => now(),
        ]);
        DB::table('system_health_checks')->where('created_at', '<', now()->subDays(30))->delete();

        return self::SUCCESS;
    }

    /** First failed run after the last good one. */
    protected function downSince(?string $lastOk): ?\Carbon\Carbon
    {
        $first = DB::table('system_health_checks')->where('status', 'down')
            ->when($lastOk, fn ($q) => $q->where('created_at', '>', $lastOk))
            ->min('created_at');
        return $first ? \Carbon\Carbon::parse($first) : null;
    }

    protected function last24Hours(): string
    {
        $rows = DB::table('system_health_checks')->where('created_at', '>=', now()->subDay())->get();
        if ($rows->isEmpty()) {
            return '<p style="margin-top:14px">No checks recorded in the last 24 hours yet.</p>';
        }
        $downRuns = $rows->where('status', 'down')->count();
        $api = $rows->map(fn ($r) => collect(json_decode($r->checks, true))->firstWhere('name', 'API (server)')['ms'] ?? null)->filter();

        return '<h3 style="margin:18px 0 6px">Last 24 hours</h3><ul style="margin:0;padding-left:18px">'
            . '<li>Checks run: ' . $rows->count() . '</li>'
            . '<li>Checks that found a problem: ' . $downRuns . ($downRuns ? ' (about ' . ($downRuns * 5) . ' minutes)' : '') . '</li>'
            . ($api->isNotEmpty() ? '<li>API response: average ' . number_format($api->avg()) . ' ms, slowest ' . number_format($api->max()) . ' ms</li>' : '')
            . '</ul>';
    }
}
