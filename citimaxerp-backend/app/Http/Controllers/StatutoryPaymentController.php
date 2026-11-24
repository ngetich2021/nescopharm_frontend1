<?php

namespace App\Http\Controllers;

use App\Models\PayrollRun;
use App\Models\StatutoryPayment;
use App\Services\LedgerPostingService;
use App\Services\StatutoryObligationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Payroll > Statutory Payments: what is owed to KRA, NSSF, SHA, HELB and NITA for each payroll
 * month (filled from the approved payroll), each item Pending / Partially Paid / Fully Paid, and
 * the payments made - each posted DR the payable / CR the bank it was paid from.
 */
class StatutoryPaymentController extends Controller
{
    public function __construct(private readonly StatutoryObligationService $obligations)
    {
        $this->middleware('auth:sanctum');
    }

    private function allowed(Request $request, string $permission): bool
    {
        $role = $request->user()->role;
        return $role && ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company') || $role->hasPermission($permission));
    }

    // GET /statutory-payments/obligations?year=2026
    public function obligations(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        return response()->json(['status' => 'success', 'data' => $this->obligations->forCompany($companyId, $request->integer('year') ?: null)]);
    }

    // GET /statutory-payments/history - every salary and statutory payment, newest first (audit trail)
    public function history(Request $request): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $this->obligations->history($request->user()->company_id, $request->input('date_from'), $request->input('date_to'))]);
    }

    // POST /statutory-payments (multipart: payroll_run_id, item, amount, payment_date, account_id, payment_method, reference, notes, attachment)
    public function store(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_process_payroll')) {
            return response()->json(['status' => 'failed', 'message' => 'You do not have permission to record statutory payments.'], 403);
        }
        $companyId = $request->user()->company_id;

        $v = Validator::make($request->all(), [
            'payroll_run_id' => 'required|uuid',
            'item' => 'required|in:' . implode(',', array_keys(StatutoryPayment::ITEMS)),
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'account_id' => 'required|uuid',
            'payment_method' => 'required|in:bank_transfer,cheque,mpesa,cash,rtgs,eft',
            'reference' => 'required|string|max:120',
            'notes' => 'nullable|string|max:1000',
            'attachment' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ], [
            'account_id.required' => 'Choose the bank account (or petty cash) this was paid from.',
            'reference.required' => 'Enter the payment reference (e.g. the KRA payment slip number or bank reference).',
        ]);
        if ($v->fails()) {
            return response()->json(['status' => 'failed', 'message' => $v->errors()->first(), 'errors' => $v->errors()], 422);
        }
        $data = $v->validated();

        $run = PayrollRun::where('company_id', $companyId)->find($data['payroll_run_id']);
        if (!$run || $run->is_historical || !in_array($run->status, ['approved', 'payment_initiated', 'paid'], true)) {
            return response()->json(['status' => 'failed', 'message' => 'Choose an approved payroll month.'], 422);
        }
        if (!\App\Models\ChartOfAccount::where('company_id', $companyId)->where('id', $data['account_id'])->exists()) {
            return response()->json(['status' => 'failed', 'message' => "Choose one of the company's bank or cash accounts."], 422);
        }

        $reference = trim($data['reference']);
        $label = StatutoryPayment::ITEMS[$data['item']][0];

        return DB::transaction(function () use ($request, $data, $run, $companyId, $reference, $label) {
            // Lock the run so two people paying the same item at once cannot both get through.
            PayrollRun::where('id', $run->id)->lockForUpdate()->first();

            $dup = StatutoryPayment::where('company_id', $companyId)->where('item', $data['item'])
                ->whereRaw('LOWER(reference) = ?', [mb_strtolower($reference)])->first();
            if ($dup) {
                return response()->json(['status' => 'failed', 'message' => "A {$label} payment with reference {$reference} is already recorded (" . $dup->payment_date?->format('d/m/Y') . ', KES ' . number_format((float) $dup->amount, 2) . '). The same payment cannot be recorded twice.'], 422);
            }

            $line = $this->obligations->line($run, $data['item']);
            $balance = round($line['due'] - $line['paid'], 2);
            if ($balance <= 0) {
                return response()->json(['status' => 'failed', 'message' => "{$label} for " . $line['period_label'] . ' is already fully paid.'], 422);
            }
            if (round((float) $data['amount'], 2) > $balance) {
                return response()->json(['status' => 'failed', 'message' => "{$label} for {$line['period_label']} has KES " . number_format($balance, 2) . ' left to pay - the amount entered is more than that.'], 422);
            }

            $path = $request->hasFile('attachment')
                ? $request->file('attachment')->store("statutory-payments/{$companyId}", config('filesystems.default'))
                : null;

            $payment = StatutoryPayment::create([
                'company_id' => $companyId,
                'payroll_run_id' => $run->id,
                'item' => $data['item'],
                'amount' => round((float) $data['amount'], 2),
                'payment_date' => $data['payment_date'],
                'account_id' => $data['account_id'],
                'payment_method' => $data['payment_method'],
                'reference' => $reference,
                'notes' => $data['notes'] ?? null,
                'attachment_path' => $path,
                'created_by' => $request->user()->id,
            ]);

            \App\Models\ActivityLog::logActivity('statutory_payment_recorded', "{$label} {$line['period_label']} paid KES " . number_format((float) $payment->amount, 2) . " ref {$reference}", $request->user(), ['statutory_payment_id' => $payment->id]);

            $posts = app(LedgerPostingService::class)->payrollPosts($run);
            return response()->json([
                'status' => 'success',
                'message' => $posts
                    ? "{$label} payment recorded and posted (DR {$label} payable / CR the bank)."
                    : "{$label} payment recorded (this payroll month is not posted to the ledger).",
                'data' => $payment->load('account:id,account_code,account_name'),
            ], 201);
        });
    }

    // DELETE /statutory-payments/{id} - a payment entered by mistake; its journal entry is reversed.
    public function destroy(Request $request, string $id): JsonResponse
    {
        if (!$this->allowed($request, 'can_process_payroll')) {
            return response()->json(['status' => 'failed', 'message' => 'You do not have permission to delete statutory payments.'], 403);
        }
        $payment = StatutoryPayment::where('company_id', $request->user()->company_id)->find($id);
        if (!$payment) {
            return response()->json(['status' => 'failed', 'message' => 'Payment not found.'], 404);
        }
        $payment->delete();
        \App\Models\ActivityLog::logActivity('statutory_payment_deleted', "{$payment->item_label} payment ref {$payment->reference} (KES " . number_format((float) $payment->amount, 2) . ') deleted', $request->user(), ['statutory_payment_id' => $payment->id]);
        return response()->json(['status' => 'success', 'message' => 'Payment deleted and its ledger entry reversed.']);
    }
}
