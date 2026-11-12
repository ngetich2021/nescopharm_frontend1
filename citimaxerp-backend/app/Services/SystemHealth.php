<?php

namespace App\Services;

use App\Models\CompanySetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

/**
 * System health: database, live API, website, AI assistant (Groq) and email.
 * health:check runs it every 5 minutes, emails when something goes down or comes back,
 * and health:check --report sends the 8:00am summary.
 */
class SystemHealth
{
    /** @return array<int, array{name: string, ok: bool, ms: int|null, detail: string}> */
    public function run(): array
    {
        return [
            $this->timed('Database', function () {
                DB::select('select 1');
                $conns = (int) DB::selectOne('select count(*) as c from pg_stat_activity')->c;
                return "connected ({$conns} open connections)";
            }),
            $this->timed('API (server)', fn () => $this->url(config('health.api_url'))),
            $this->timed('Website', fn () => $this->url(config('health.website_url'))),
            $this->timed('AI assistant', fn () => $this->groq()),
            $this->timed('Email', function () {
                if (! config('services.resend.key')) {
                    throw new \RuntimeException('RESEND_API_KEY is not set');
                }
                return 'Resend configured';
            }),
        ];
    }

    /** Runs one check: ok with its time, or failed with the reason (slower than the timeout = failed). */
    protected function timed(string $name, callable $check): array
    {
        $start = microtime(true);
        try {
            $detail = $check();
            $ms = (int) round((microtime(true) - $start) * 1000);
            if ($ms > config('health.timeout_seconds') * 1000) {
                return ['name' => $name, 'ok' => false, 'ms' => $ms, 'detail' => "too slow ({$ms} ms)"];
            }
            return ['name' => $name, 'ok' => true, 'ms' => $ms, 'detail' => (string) $detail];
        } catch (\Throwable $e) {
            $ms = (int) round((microtime(true) - $start) * 1000);
            return ['name' => $name, 'ok' => false, 'ms' => $ms, 'detail' => mb_substr($e->getMessage(), 0, 200)];
        }
    }

    protected function url(string $url): string
    {
        $res = Http::timeout(config('health.timeout_seconds'))->acceptJson()->get($url);
        if ($res->status() >= 400) {
            throw new \RuntimeException("HTTP {$res->status()}" . ($res->status() === 504 ? ' (gateway timeout - server not answering)' : ''));
        }
        return "HTTP {$res->status()}";
    }

    protected function groq(): string
    {
        $key = config('services.groq.key');
        if (! $key) {
            $setting = CompanySetting::where('setting_key', 'groq_api_key')->where('is_active', true)->value('setting_value');
            $key = is_array($setting) ? ($setting['key'] ?? null) : null;
        }
        if (! $key) {
            throw new \RuntimeException('no Groq API key set');
        }
        $modelsUrl = preg_replace('#/chat/completions$#', '/models', config('services.groq.url'));
        $res = Http::timeout(15)->withToken($key)->get($modelsUrl);
        if (! $res->successful()) {
            throw new \RuntimeException("Groq answered HTTP {$res->status()}" . ($res->status() === 401 ? ' (key rejected)' : ''));
        }
        return 'Groq reachable, key accepted';
    }

    /** @return string[] */
    public function recipients(): array
    {
        $emails = config('health.recipients');
        if (! $emails) {
            $setting = CompanySetting::where('setting_key', 'health_alert_emails')->where('is_active', true)->value('setting_value');
            $emails = is_array($setting) ? ($setting['emails'] ?? []) : [];
        }
        return array_values(array_filter($emails, fn ($e) => filter_var($e, FILTER_VALIDATE_EMAIL)));
    }

    public function now(): Carbon
    {
        return now()->timezone(config('health.timezone'));
    }

    /** Working hours are 8:30 to 17:00 Nairobi time; alerts go out at any hour either way. */
    public function inWorkingHours(): bool
    {
        $t = $this->now()->format('H:i');
        return $t >= '08:30' && $t < '17:00';
    }

    public function send(string $subject, string $html): void
    {
        $to = $this->recipients();
        if (! $to) {
            throw new \RuntimeException('No health email recipients: set HEALTH_ALERT_EMAILS or the health_alert_emails setting.');
        }
        Mail::html($html, fn ($m) => $m->to($to)->subject($subject));
    }

    public function checksTable(array $checks): string
    {
        $rows = '';
        foreach ($checks as $i => $c) {
            $badge = $c['ok']
                ? '<span style="color:#15803d;font-weight:bold">UP</span>'
                : '<span style="color:#b91c1c;font-weight:bold">DOWN</span>';
            $rows .= '<tr><td style="padding:6px 10px;border:1px solid #ddd">' . ($i + 1) . '</td>'
                . '<td style="padding:6px 10px;border:1px solid #ddd">' . e($c['name']) . '</td>'
                . '<td style="padding:6px 10px;border:1px solid #ddd">' . $badge . '</td>'
                . '<td style="padding:6px 10px;border:1px solid #ddd;text-align:right">' . ($c['ms'] !== null ? number_format($c['ms']) . ' ms' : '-') . '</td>'
                . '<td style="padding:6px 10px;border:1px solid #ddd">' . e($c['detail']) . '</td></tr>';
        }
        return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">'
            . '<tr style="background:#f3f4f6"><th style="padding:6px 10px;border:1px solid #ddd">S/No</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Check</th><th style="padding:6px 10px;border:1px solid #ddd">Status</th><th style="padding:6px 10px;border:1px solid #ddd">Time</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Detail</th></tr>'
            . $rows . '</table>';
    }

    public function wrap(string $heading, string $body): string
    {
        return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
            . '<h2 style="margin:0 0 6px">' . e($heading) . '</h2>'
            . '<p style="margin:0 0 14px;color:#555">' . $this->now()->format('d/m/Y H:i') . ' (Nairobi time)</p>'
            . $body
            . '<p style="margin-top:18px;color:#777;font-size:12px">Citimax ERP system health. Checked every 5 minutes; a down alert repeats every '
            . config('health.repeat_minutes') . ' minutes until it is back up.</p></div>';
    }
}
