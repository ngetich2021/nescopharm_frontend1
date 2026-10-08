<?php

namespace App\Http\Controllers;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryItem;
use App\Services\AccountingIntegrationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class JournalEntryController extends Controller
{
    public function __construct(protected AccountingIntegrationService $engine)
    {
        $this->middleware('auth:sanctum');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($resourceCompanyId !== null && $user->company_id !== $resourceCompanyId) {
            return false;
        }
        if ($role->hasPermission('can_manage_company')) {
            return true;
        }
        return $role->hasPermission($permission);
    }

    protected function deny(string $message)
    {
        return response()->json(['status' => 'failed', 'message' => $message], 403);
    }

    protected function notFound()
    {
        return response()->json(['status' => 'failed', 'message' => 'Journal entry not found.'], 404);
    }

    protected function relations(): array
    {
        return ['items.chartOfAccount', 'creator', 'postedBy'];
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_journal_entries')) {
            return $this->deny('Unauthorized to view journal entries.');
        }

        $companyId = $user->company_id;
        if ($request->filled('company_id') && $this->hasPermission($request, 'can_manage_all_finance')) {
            $companyId = $request->input('company_id');
        }

        $query = JournalEntry::with($this->relations())->where('company_id', $companyId);

        if ($request->filled('status')) {
            // "pending" in older screens meant not yet posted.
            $status = $request->input('status') === 'pending' ? 'draft' : $request->input('status');
            $query->where('status', $status);
        }
        if ($request->filled('entry_type')) {
            $query->where('entry_type', $request->input('entry_type'));
        }
        if ($request->filled('date_from')) {
            $query->where('entry_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('entry_date', '<=', $request->input('date_to'));
        }
        if ($request->filled('reference')) {
            $query->where('reference', 'ilike', '%' . $request->input('reference') . '%');
        }
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('reference', 'ilike', "%{$search}%")
                    ->orWhere('entry_number', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        $entries = $query->orderBy('entry_date', 'desc')->orderBy('created_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'message' => 'Journal entries retrieved successfully.',
            'entries' => $entries,
        ]);
    }

    public function show(Request $request, $id)
    {
        $entry = JournalEntry::with($this->relations())->find($id);
        if (!$entry) {
            return $this->notFound();
        }
        if (!$this->hasPermission($request, 'can_view_journal_entries', $entry->company_id)) {
            return $this->deny('Unauthorized to view this journal entry.');
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Journal entry retrieved successfully.',
            'entry' => $entry,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_journal_entries')) {
            return $this->deny('Unauthorized to create journal entries.');
        }

        $validator = Validator::make($request->all(), $this->rules(false));
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        [$items, $error] = $this->normaliseItems($request->input('items'), $user->company_id);
        if ($error) {
            return response()->json(['status' => 'failed', 'message' => $error], 400);
        }

        try {
            $this->engine->setCompany($user->company_id)->setUser($user->id);
            $entry = DB::transaction(fn () => $this->engine->postEntry([
                'prefix' => 'JE',
                'entry_date' => $request->input('entry_date'),
                'reference' => $request->input('reference'),
                'description' => $request->input('description'),
                'entry_type' => $this->entryType($request->input('entry_type')),
                'status' => $request->boolean('post_immediately') ? 'posted' : 'draft',
                'metadata' => $this->metadata($request),
            ], $items));

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry created successfully.',
                'entry' => $entry->load($this->relations()),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error creating journal entry', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 422);
        }
    }

    public function update(Request $request, $id)
    {
        $entry = JournalEntry::with('items')->find($id);
        if (!$entry) {
            return $this->notFound();
        }
        if (!$this->hasPermission($request, 'can_update_journal_entries', $entry->company_id)) {
            return $this->deny('Unauthorized to edit journal entries.');
        }
        if ($entry->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only draft journal entries can be edited. Reverse a posted entry instead.'], 400);
        }

        $validator = Validator::make($request->all(), $this->rules(true));
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()], 400);
        }

        $items = null;
        if ($request->has('items')) {
            [$items, $error] = $this->normaliseItems($request->input('items'), $entry->company_id);
            if ($error) {
                return response()->json(['status' => 'failed', 'message' => $error], 400);
            }
        }

        try {
            DB::transaction(function () use ($request, $entry, $items) {
                if ($items !== null) {
                    $entry->items()->delete();
                    foreach ($items as $item) {
                        JournalEntryItem::create($item + [
                            'id' => (string) Str::uuid(),
                            'journal_entry_id' => $entry->id,
                            'company_id' => $entry->company_id,
                        ]);
                    }
                    $entry->total_debit = array_sum(array_column($items, 'debit_amount'));
                    $entry->total_credit = array_sum(array_column($items, 'credit_amount'));
                }

                $entry->fill(array_filter([
                    'reference' => $request->input('reference'),
                    'entry_date' => $request->input('entry_date'),
                    'description' => $request->input('description'),
                    'entry_type' => $request->filled('entry_type') ? $this->entryType($request->input('entry_type')) : null,
                ], fn ($v) => $v !== null));
                $entry->metadata = array_merge($entry->metadata ?? [], $this->metadata($request));
                $entry->save();
            });

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry updated successfully.',
                'entry' => $entry->fresh($this->relations()),
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating journal entry', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => 'Failed to update journal entry.'], 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $entry = JournalEntry::find($id);
        if (!$entry) {
            return $this->notFound();
        }
        if (!$this->hasPermission($request, 'can_delete_journal_entries', $entry->company_id)) {
            return $this->deny('Unauthorized to delete journal entries.');
        }
        if ($entry->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only draft journal entries can be deleted. Reverse a posted entry instead.'], 400);
        }

        $entry->delete();

        return response()->json(['status' => 'success', 'message' => 'Journal entry deleted successfully.']);
    }

    public function post(Request $request, $id)
    {
        $entry = JournalEntry::with('items.chartOfAccount')->find($id);
        if (!$entry) {
            return $this->notFound();
        }
        if (!$this->hasPermission($request, 'can_post_journal_entries', $entry->company_id)) {
            return $this->deny('Unauthorized to post journal entries.');
        }
        if ($entry->status !== 'draft') {
            return response()->json(['status' => 'failed', 'message' => 'Only draft journal entries can be posted.'], 400);
        }

        $debits = round((float) $entry->items->sum('debit_amount'), 2);
        $credits = round((float) $entry->items->sum('credit_amount'), 2);
        if ($entry->items->count() < 2 || abs($debits - $credits) > 0.01) {
            return response()->json(['status' => 'failed', 'message' => "Entry is unbalanced (debits {$debits}, credits {$credits})."], 400);
        }
        $inactive = $entry->items->first(fn ($i) => !$i->chartOfAccount || !$i->chartOfAccount->is_active);
        if ($inactive) {
            return response()->json(['status' => 'failed', 'message' => 'Entry uses an inactive or missing account.'], 400);
        }

        $entry->update([
            'status' => 'posted',
            'total_debit' => $debits,
            'total_credit' => $credits,
            'posted_by' => $request->user()->id,
            'posted_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Journal entry posted successfully.',
            'entry' => $entry->fresh($this->relations()),
        ]);
    }

    public function reverse(Request $request, $id)
    {
        $entry = JournalEntry::find($id);
        if (!$entry) {
            return $this->notFound();
        }
        if (!$this->hasPermission($request, 'can_reverse_journal_entries', $entry->company_id)) {
            return $this->deny('Unauthorized to reverse journal entries.');
        }
        if ($entry->status !== 'posted') {
            return response()->json(['status' => 'failed', 'message' => 'Only posted journal entries can be reversed.'], 400);
        }

        try {
            $this->engine->setCompany($entry->company_id)->setUser($request->user()->id);
            $reversal = DB::transaction(fn () => $this->engine->reverseJournalEntry($entry->id, $request->input('reason', 'Manual reversal')));

            return response()->json([
                'status' => 'success',
                'message' => 'Journal entry reversed successfully.',
                'reversing_entry' => $reversal->load($this->relations()),
            ]);
        } catch (\Exception $e) {
            Log::error('Error reversing journal entry', ['error' => $e->getMessage()]);
            return response()->json(['status' => 'failed', 'message' => $e->getMessage()], 422);
        }
    }

    protected function rules(bool $isUpdate): array
    {
        $req = $isUpdate ? 'sometimes|required' : 'required';
        return [
            'reference' => 'nullable|string|max:255',
            'entry_date' => "{$req}|date",
            'description' => "{$req}|string|max:1000",
            'memo' => 'nullable|string',
            'entry_type' => 'nullable|string',
            'currency_code' => 'nullable|string|size:3',
            'exchange_rate' => 'nullable|numeric|min:0',
            'post_immediately' => 'nullable|boolean',
            'items' => ($isUpdate ? 'sometimes|' : '') . 'required|array|min:2',
            'items.*.account_id' => 'nullable|uuid',
            'items.*.chart_of_account_id' => 'nullable|uuid',
            'items.*.debit_amount' => 'nullable|numeric|min:0',
            'items.*.credit_amount' => 'nullable|numeric|min:0',
            'items.*.description' => 'nullable|string|max:500',
        ];
    }

    /**
     * Accept either account_id or chart_of_account_id per line, require each
     * line to be a debit or a credit, and require the entry to balance.
     */
    protected function normaliseItems(array $raw, string $companyId): array
    {
        $accountIds = ChartOfAccount::where('company_id', $companyId)->pluck('id')->flip();
        $items = [];
        $debits = 0.0;
        $credits = 0.0;

        foreach ($raw as $i => $line) {
            $accountId = $line['account_id'] ?? $line['chart_of_account_id'] ?? null;
            if (!$accountId || !$accountIds->has($accountId)) {
                return [null, 'Line ' . ($i + 1) . ': choose an account from this company\'s chart of accounts.'];
            }
            $debit = round((float) ($line['debit_amount'] ?? 0), 2);
            $credit = round((float) ($line['credit_amount'] ?? 0), 2);
            if (($debit > 0) === ($credit > 0)) {
                return [null, 'Line ' . ($i + 1) . ': enter either a debit or a credit amount, not both.'];
            }
            $items[] = [
                'account_id' => $accountId,
                'debit_amount' => $debit,
                'credit_amount' => $credit,
                'description' => $line['description'] ?? null,
            ];
            $debits += $debit;
            $credits += $credit;
        }

        if (abs($debits - $credits) > 0.01) {
            return [null, "Total debits ({$debits}) must equal total credits ({$credits})."];
        }

        return [$items, null];
    }

    protected function entryType(?string $type): string
    {
        return match ($type) {
            'adjusting', 'closing', 'recurring' => $type,
            default => 'manual',
        };
    }

    protected function metadata(Request $request): array
    {
        return array_filter([
            'memo' => $request->input('memo'),
            'currency_code' => $request->input('currency_code'),
            'exchange_rate' => $request->input('exchange_rate'),
        ], fn ($v) => $v !== null && $v !== '');
    }
}
