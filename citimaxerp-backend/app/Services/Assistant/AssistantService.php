<?php

namespace App\Services\Assistant;

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The in-app assistant: answers how-to questions from the navigation guide and data questions by
 * calling AssistantTools, which read live data within the user's permissions. Nothing is cached,
 * so "the latest invoice" is the latest at the moment of asking.
 */
class AssistantService
{
    protected const MAX_TOOL_ROUNDS = 5;

    public function reply(User $user, array $history): string
    {
        $key = $this->apiKey($user);
        if (!$key) {
            return 'The assistant is not set up yet (no Groq API key on the server).';
        }

        $tools = new AssistantTools($user);
        $messages = array_merge([['role' => 'system', 'content' => $this->systemPrompt($user, $tools)]], $history);
        $definitions = $tools->definitions();

        for ($round = 0; $round <= self::MAX_TOOL_ROUNDS; $round++) {
            $payload = [
                'model' => config('services.groq.model'),
                'messages' => $messages,
                'temperature' => 0.2,
                'max_tokens' => 1200,
            ];
            // On the last round the model must answer with what it has.
            if ($definitions && $round < self::MAX_TOOL_ROUNDS) {
                $payload['tools'] = $definitions;
                $payload['tool_choice'] = 'auto';
            }

            $response = $this->send($key, $payload);
            if (!$response || !$response->successful()) {
                return $response?->status() === 429
                    ? 'I am getting too many questions at once. Please try again in a minute.'
                    : 'Sorry, I could not reach the assistant service just now. Please try again.';
            }

            $message = $response->json('choices.0.message') ?? [];
            $calls = $message['tool_calls'] ?? [];
            if (!$calls) {
                return trim((string) ($message['content'] ?? '')) ?: 'Sorry, I do not have an answer for that.';
            }

            $messages[] = ['role' => 'assistant', 'content' => $message['content'] ?? null, 'tool_calls' => $calls];
            foreach ($calls as $call) {
                $args = json_decode($call['function']['arguments'] ?? '{}', true) ?: [];
                $result = $tools->run($call['function']['name'] ?? '', $args);
                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $call['id'],
                    'content' => mb_substr(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0, 6000),
                ];
            }
        }

        return 'Sorry, that took too many steps. Please ask in a simpler way.';
    }

    /**
     * The Groq key: the server's GROQ_API_KEY, or else the company's "groq_api_key" setting
     * ({"key": "gsk_..."} in company_settings), so it can be set without redeploying.
     */
    protected function apiKey(User $user): ?string
    {
        if ($key = config('services.groq.key')) {
            return $key;
        }
        $setting = CompanySetting::where('company_id', $user->company_id)
            ->where('setting_key', 'groq_api_key')->where('is_active', true)->value('setting_value');
        return is_array($setting) ? ($setting['key'] ?? null) : null;
    }

    /**
     * One call to Groq. On a rate limit it waits the few seconds Groq asks for and tries again, then
     * tries the fallback model (its limit is counted separately). Null when Groq cannot be reached.
     */
    protected function send(string $key, array $payload): ?Response
    {
        $models = array_values(array_unique(array_filter([$payload['model'], config('services.groq.fallback_model')])));
        $response = null;
        foreach ($models as $model) {
            for ($try = 0; $try < 2; $try++) {
                try {
                    $response = Http::withToken($key)->timeout(60)->acceptJson()
                        ->post(config('services.groq.url'), ['model' => $model] + $payload);
                } catch (ConnectionException $e) {
                    Log::warning('Assistant: Groq unreachable', ['error' => $e->getMessage()]);
                    $response = null;
                    continue;
                }
                if ($response->status() !== 429) {
                    if (!$response->successful()) {
                        Log::warning('Assistant: Groq request failed', ['model' => $model, 'status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
                    }
                    return $response;
                }
                // "Please try again in 6.69s": wait that long (at most 10s), once per model.
                preg_match('/try again in ([\d.]+)s/', $response->body(), $m);
                if ($try === 0) {
                    usleep((int) (min(10.0, (float) ($m[1] ?? 3)) * 1_000_000));
                }
            }
        }
        if ($response) {
            Log::warning('Assistant: Groq rate limited', ['body' => mb_substr($response->body(), 0, 300)]);
        }
        return $response;
    }

    protected function systemPrompt(User $user, AssistantTools $tools): string
    {
        $can = fn (string $p) => $tools->can($p);
        $now = now('Africa/Nairobi');
        $company = $user->company?->name ?? 'the company';
        $name = trim(($user->first_name ?? '') . ' ' . ($user->last_name ?? '')) ?: ($user->name ?? 'the user');
        $role = $user->role?->name ?? 'no role';
        $areas = AssistantKnowledge::areaList($can) ?: 'none';
        $closed = implode(', ', AssistantKnowledge::closedAreas($can)) ?: 'none';

        return <<<PROMPT
You are the Citimax assistant inside {$company}'s Citimax ERP (a pharmaceutical distribution system in Kenya).
You are talking to {$name}, role "{$role}". Today is {$now->format('l, j F Y, H:i')} (Nairobi time).

How to answer:
- For any figure (prices, codes, stock, invoices, sales, receipts, expenses, balances, purchase orders) ALWAYS call a tool and answer only from what it returns. Never invent or estimate numbers, names or invoice numbers. If a tool returns nothing, say so.
- Data is live: call the tool again for each question rather than reusing earlier answers.
- Money is Kenya Shillings: write it like "KES 74,756.80". Dates like "29 Oct 2026". Invoices are numbered NSK/#### (e.g. NSK/0427).
- For "how do I ..." or "where is ..." questions, call how_to and explain its steps in short numbered steps, naming the menu and buttons. Do not make up screens or buttons.
- This user can open only: {$areas}. If they ask about anything else ({$closed}), say they don't have access to it and to ask an administrator; do not reveal or guess that data.
- Be brief and clear. Use short lists or small tables for several items. Reply in the user's language.
PROMPT;
    }
}
