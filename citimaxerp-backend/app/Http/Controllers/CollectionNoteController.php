<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Collection notes on the Receivables & Payables page. A customer says "I will pay on 17/11/26";
 * the note keeps that promise, and when the date passes it is marked kept or broken and the next
 * call is noted under it - so the history of every follow-up stays with the customer.
 *
 *   GET   /api/finance/collection-notes?party_type=customer   - every note, newest first
 *   POST  /api/finance/collection-notes                        - a new note (optionally a promise)
 *   PATCH /api/finance/collection-notes/{id}                   - mark the promise kept or broken
 */
class CollectionNoteController extends AgingController
{
    private function partyType(Request $request): string
    {
        return $request->input('party_type') === 'supplier' ? 'supplier' : 'customer';
    }

    private function permissionFor(string $type): string
    {
        return $type === 'supplier' ? 'can_view_accounts_payable' : 'can_view_accounts_receivable';
    }

    public function index(Request $request)
    {
        $type = $this->partyType($request);
        if (!$this->canView($request, $this->permissionFor($type))) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }

        $notes = DB::table('collection_notes as n')
            ->leftJoin('users as u', 'u.id', '=', 'n.created_by')
            ->leftJoin('users as o', 'o.id', '=', 'n.outcome_by')
            ->where('n.company_id', $request->user()->company_id)
            ->where('n.party_type', $type)
            ->orderByDesc('n.created_at')
            ->get([
                'n.id', 'n.party_id', 'n.invoice_id', 'n.note', 'n.promise_date', 'n.promise_amount', 'n.outcome', 'n.outcome_at', 'n.created_at',
                DB::raw("trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) as created_by_name"),
                DB::raw("trim(coalesce(o.first_name, '') || ' ' || coalesce(o.last_name, '')) as outcome_by_name"),
            ])
            ->map(fn ($n) => [
                'id' => $n->id,
                'party_id' => $n->party_id,
                'invoice_id' => $n->invoice_id,
                'note' => $n->note,
                'promise_date' => $n->promise_date ? substr((string) $n->promise_date, 0, 10) : null,
                'promise_amount' => $n->promise_amount !== null ? (float) $n->promise_amount : null,
                'outcome' => $n->outcome,
                'outcome_at' => $n->outcome_at,
                'outcome_by' => $n->outcome_by_name ?: null,
                'created_at' => $n->created_at,
                'created_by' => $n->created_by_name ?: null,
            ]);

        return response()->json(['data' => $notes]);
    }

    public function store(Request $request)
    {
        $type = $this->partyType($request);
        if (!$this->canView($request, $this->permissionFor($type))) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $validator = Validator::make($request->all(), [
            'party_id' => 'required|uuid',
            'invoice_id' => 'nullable|uuid',
            'note' => 'required|string|max:2000',
            'promise_date' => 'nullable|date',
            'promise_amount' => 'nullable|numeric|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first()], 422);
        }

        $companyId = $request->user()->company_id;
        $partyExists = DB::table($type === 'supplier' ? 'suppliers' : 'customers')
            ->where('id', $request->input('party_id'))->where('company_id', $companyId)->exists();
        if (!$partyExists) {
            return response()->json(['status' => 'failed', 'message' => ucfirst($type) . ' not found.'], 404);
        }

        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('collection_notes')->insert([
            'id' => $id,
            'company_id' => $companyId,
            'party_type' => $type,
            'party_id' => $request->input('party_id'),
            'invoice_id' => $request->input('invoice_id') ?: null,
            'note' => trim($request->input('note')),
            'promise_date' => $request->input('promise_date') ?: null,
            'promise_amount' => $request->filled('promise_amount') ? $request->input('promise_amount') : null,
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['status' => 'success', 'message' => 'Note saved.', 'id' => $id], 201);
    }

    public function update(Request $request, string $id)
    {
        $note = DB::table('collection_notes')->where('id', $id)->where('company_id', $request->user()->company_id)->first();
        if (!$note) {
            return response()->json(['status' => 'failed', 'message' => 'Note not found.'], 404);
        }
        if (!$this->canView($request, $this->permissionFor($note->party_type))) {
            return response()->json(['status' => 'failed', 'message' => 'Unauthorized.'], 403);
        }
        $validator = Validator::make($request->all(), ['outcome' => 'nullable|in:kept,broken']);
        if ($validator->fails()) {
            return response()->json(['status' => 'failed', 'message' => $validator->errors()->first()], 422);
        }

        $outcome = $request->input('outcome') ?: null;
        DB::table('collection_notes')->where('id', $id)->update([
            'outcome' => $outcome,
            'outcome_by' => $outcome ? $request->user()->id : null,
            'outcome_at' => $outcome ? now() : null,
            'updated_at' => now(),
        ]);

        return response()->json(['status' => 'success', 'message' => $outcome ? "Promise marked {$outcome}." : 'Promise outcome cleared.']);
    }
}
