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

    public function reply(User $user, array $history, array $attachments = []): string
    {
        $key = $this->apiKey($user);
        if (!$key) {
            return 'The assistant is not set up yet (no Groq API key on the server).';
        }

        // Files go with the latest question as text: a file's own text, or what the vision
        // model reads off a photo (the main model takes text only).
        if ($attachments && ($last = array_key_last($history)) !== null) {
            $history[$last]['content'] .= $this->attachmentText($key, $attachments, $history[$last]['content']);
        }

        $tools = new AssistantTools($user);
        $messages = array_merge([['role' => 'system', 'content' => $this->systemPrompt($user, $tools)]], $history);
        $definitions = $tools->definitions();
        // The screens the guide pointed to, e.g. "[Assets](/assets)", so the answer always links one.
        $links = [];
        // Tables a tool builds itself (the whole stock list), added under the answer as they are.
        $tables = [];

        for ($round = 0; $round <= self::MAX_TOOL_ROUNDS; $round++) {
            $payload = [
                'model' => config('services.groq.model'),
                'messages' => $messages,
                'temperature' => 0.2,
                'max_tokens' => 1500,
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
                $answer = trim((string) ($message['content'] ?? ''));
                if ($answer === '' && !$tables) {
                    return 'Sorry, I do not have an answer for that.';
                }
                return trim($this->withLink($this->fixLinks($answer), $links) . ($tables ? "\n\n" . implode("\n\n", $tables) : ''));
            }

            $messages[] = ['role' => 'assistant', 'content' => $message['content'] ?? null, 'tool_calls' => $calls];
            foreach ($calls as $call) {
                $args = json_decode($call['function']['arguments'] ?? '{}', true) ?: [];
                $name = $call['function']['name'] ?? '';
                $result = $tools->run($name, $args);
                foreach ($result['areas'] ?? [] as $area) {
                    $links[] = $area['link'];
                }
                if (!empty($result['_table'])) {
                    // Only the latest list of each kind, if the model asked twice.
                    $tables[$name] = $result['_table'];
                }
                unset($result['_table']);
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
     * A how-to answer that names none of the guide's screens as a link gets the first one added, so
     * the user can always click through ("Open: [Assets](/assets)").
     */
    protected function withLink(string $answer, array $links): string
    {
        if (!$links) {
            return $answer;
        }
        foreach ($links as $link) {
            preg_match('/\]\(([^)]+)\)$/', $link, $m);
            if (str_contains($answer, '](' . $m[1] . ')')) {
                return $answer;
            }
        }
        return $answer . "\n\nOpen: " . $links[0];
    }

    /**
     * Links the model wrote without a path, e.g. "[full list](Inventory Reports > Stock Balance)":
     * pointed at the screen they name, or else left as plain text rather than a dead link.
     */
    protected function fixLinks(string $answer): string
    {
        return preg_replace_callback('/\[([^\]]+)\]\(([^)]*)\)/', function ($m) {
            [$whole, $label, $target] = $m;
            if (preg_match('#^(/[a-z]|https?://)#i', trim($target))) {
                return $whole;
            }
            $path = AssistantKnowledge::pathFor($target) ?? AssistantKnowledge::pathFor($label);
            $text = preg_match('/^(full list|here|link|open|this)$/i', trim($label)) && trim($target) !== '' ? trim($target) : $label;
            return $path ? "[{$text}]({$path})" : $text;
        }, $answer);
    }

    /** The attached files as text added to the question. */
    protected function attachmentText(string $key, array $attachments, string $question): string
    {
        $out = '';
        foreach ($attachments as $i => $file) {
            $name = $file['name'] ?? ('file ' . ($i + 1));
            if (($file['type'] ?? '') === 'text') {
                $out .= "\n\n[Attached file \"{$name}\"]\n" . mb_substr((string) $file['data'], 0, 12000);
                continue;
            }
            $text = $this->readImage($key, (string) $file['data'], $question);
            $out .= $text !== null
                ? "\n\n[Attached image \"{$name}\" - its text as read by the system]\n{$text}"
                : "\n\n[Attached image \"{$name}\" could not be read]";
        }
        return $out;
    }

    /**
     * The text of a photo or screenshot (a product list, an invoice, a shelf label...), read by the
     * vision model, one line per item. Null when it cannot be read.
     */
    protected function readImage(string $key, string $dataUrl, string $question): ?string
    {
        if (!preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#', $dataUrl)) {
            return null;
        }
        try {
            $response = Http::withToken($key)->timeout(90)->acceptJson()->post(config('services.groq.url'), [
                'model' => config('services.groq.vision_model'),
                'temperature' => 0,
                'max_tokens' => 2000,
                'messages' => [['role' => 'user', 'content' => [
                    ['type' => 'text', 'text' => "Transcribe the text in this image exactly as written. For a list or table of products, "
                        . "give one item per line with its description, strength/size, code and quantity as shown. Do not add anything "
                        . "that is not in the image. The user asked: " . mb_substr($question, 0, 500)],
                    ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]],
                ]]],
            ]);
        } catch (ConnectionException $e) {
            Log::warning('Assistant: image reading unreachable', ['error' => $e->getMessage()]);
            return null;
        }
        if (!$response->successful()) {
            Log::warning('Assistant: image reading failed', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 300)]);
            return null;
        }
        $text = (string) $response->json('choices.0.message.content');
        // Some models think aloud first.
        $text = trim(preg_replace('#<think>.*?</think>#s', '', $text));
        return $text !== '' ? mb_substr($text, 0, 8000) : null;
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
- You can only read. You cannot create, change, approve or delete anything; for those, explain how the user does it in the system.
- If a tool returns "did_you_mean", say nothing matched exactly and offer those names ("Did you mean ...?"); if one is clearly what was meant, look it up with that name.
- Every screen you mention MUST be a clickable markdown link with its path, e.g. [Sales > Credit Notes](/sales/credit-notes) - never a screen name as plain text, never "→" menu trails without the link. how_to returns each screen's "link": use it exactly, as the first step ("1. Open [HR & Payroll > Employees](/hr/employees)").
- Every table starts with an S/No column numbered 1, 2, 3... Never show Item No. (item numbers are not used here): name products by their description, plus their price-list code where relevant.
- When the user gives several products at once (typed, pasted, or in an attached file or photo), call match_products with one line per product, then show a table: S/No, their line, matched product, codes with prices, stock. Mark lines with no match and offer their did_you_mean names. Say "(partial)" for partial matches so they can check them.
- For available stock ("what stock do we have", "stock list", "what is out of stock") call stock_on_hand - never answer it from stock_alerts, which holds only alerts. The system adds the complete table of every line (in stock, then those at 0) under your answer, so do NOT write a product table or list yourself, and never mention pages, offsets or a "Next" button.
- For customers' orders and order value ("how many orders has X made", "customers with no orders", "best customers", "customer stats") call customer_stats. It also adds the full customer table under your answer, so write only the totals and a short note. Write only: the totals ("145 lines in stock (3,641,187 units, 3,630,000 usable) and 60 at 0, as of 2 Nov 2026 06:38"), then short notes from "notes": expired stock (not usable - write it off or return it), wrong expiry dates (a typing slip like year 0029, to correct on [Batches](/inventory/batches)), and lines whose batches do not match the stock shown (to correct with a [Stock Count](/inventory/stock-counts)). End with the full_list_link.
- Money is Kenya Shillings: write it like "KES 74,756.80". Dates like "29 Oct 2026".
- Invoices are numbered NSK/#### (e.g. NSK/0427); give the number exactly as list_invoices returns it. For "the latest invoice number" answer with "latest_nsk" (the highest NSK number). An invoice shown as INV-#### has no NSK number (File No) yet: say so, and that it gets one on [Filing](/filing); never present an INV number as the invoice number when asked for NSK.
- A product's code is its price list and number, e.g. "NSPV 003", "NSPH 012", "NSPD 001" - always give the full code as the tool returns it. Item No. is a different number.
- For "how do I ..." or "where is ..." questions, call how_to and explain its steps in short numbered steps, naming the menu and buttons. Use ONLY the screens, tabs, buttons, fields and reports in its text: if something is not there (a tab, a filter, a report, depreciation...), it does not exist - say the system does not have it, never invent it. A follow-up ("how do I do it as an employee", "and for one") is about the previous topic: call how_to with the full topic, e.g. "daily report as employee".
- Answer for this user's role ("{$role}"): how_to gives only the steps their role can do; when it says their role cannot do an action, tell them who does it (an approver or administrator) instead of giving those steps. Questions in the first person ("my leave", "my daily report", "as an employee") are about their own records: those are in the Employee Portal if they can open it.
- When the task leads straight into another one, end with one "Next:" line linking it (e.g. after adding an employee: "Next: [Payroll](/hr/payroll) to pay them"). Skip it otherwise; never point an employee to an approver's or manager's screen for their own records.
- This user can open only: {$areas}. If they ask about anything else ({$closed}), say they don't have access to it and to ask an administrator; do not reveal or guess that data.
- Be brief and clear. Use short lists or small tables for several items. Reply in the user's language.
PROMPT;
    }
}
