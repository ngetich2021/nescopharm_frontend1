<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Order;
use App\Services\InvoiceOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Filing: every invoice, arranged by customer, with the number its printed copy is filed under.
 * Also shows completed orders that never got an invoice, and invoices that no longer match their order.
 */
class FilingController extends Controller
{
    /** File numbers run from 1 to this, or to the number of invoices if there are more. */
    const FILE_NUMBER_LIMIT = 1000;

    public function __construct(private InvoiceOrderService $invoiceOrders)
    {
    }

    /** Company admins, or a role with any of the given permissions. */
    protected function allowed(Request $request, string ...$permissions): bool
    {
        $role = $request->user()?->role;
        if (!$role) {
            return false;
        }
        foreach (['can_manage_system', 'can_manage_company', ...$permissions] as $permission) {
            if ($role->hasPermission($permission)) {
                return true;
            }
        }
        return false;
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_view_filing', 'can_view_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $companyId = $request->user()->company_id;

        $invoices = DB::table('invoices as i')
            ->leftJoin('customers as c', 'c.id', '=', 'i.customer_id')
            ->leftJoin('orders as o', 'o.id', '=', 'i.order_id')
            ->where('i.company_id', $companyId)
            ->select([
                'i.id', 'i.invoice_number', 'i.invoice_date', 'i.due_date', 'i.status',
                'i.total_amount', 'i.amount_paid', 'i.balance_amount', 'i.file_number', 'i.filed_at', 'i.created_at',
                'i.customer_id', 'c.business_name', 'c.name as customer_name',
                'o.id as order_id', 'o.order_number', 'o.final_amount as order_amount',
            ])
            ->get()
            ->map(function ($r) {
                $customer = trim((string) ($r->business_name ?: $r->customer_name)) ?: 'No customer';
                return [
                    'id' => $r->id,
                    'invoice_number' => self::shortNumber($r->invoice_number),
                    'invoice_date' => $r->invoice_date,
                    'due_date' => $r->due_date,
                    'status' => $r->status,
                    'total_amount' => (float) $r->total_amount,
                    'amount_paid' => (float) $r->amount_paid,
                    'balance_amount' => (float) $r->balance_amount,
                    'file_number' => $r->file_number,
                    'filed_at' => $r->filed_at,
                    'created_at' => $r->created_at,
                    // Invoiced in the last week - shown as new so it gets its file number.
                    'is_new' => $r->created_at && \Carbon\Carbon::parse($r->created_at)->gt(now()->subDays(7)),
                    'customer_id' => $r->customer_id,
                    'customer' => $customer,
                    'order_id' => $r->order_id,
                    'order_number' => self::shortNumber($r->order_number),
                    'order_amount' => $r->order_amount !== null ? (float) $r->order_amount : null,
                    // The order was corrected after it was invoiced (e.g. VAT added later).
                    'differs_from_order' => $r->order_amount !== null && abs((float) $r->order_amount - (float) $r->total_amount) > 1,
                ];
            })
            ->sort(fn ($a, $b) => [strtolower($a['customer']), $a['invoice_date'], $a['invoice_number']] <=> [strtolower($b['customer']), $b['invoice_date'], $b['invoice_number']])
            ->values();

        $missing = DB::table('orders as o')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->where('o.company_id', $companyId)
            ->where('o.status', 'completed')
            ->whereNull('o.deleted_at')
            ->whereNotExists(fn ($q) => $q->from('invoices')->whereColumn('invoices.order_id', 'o.id'))
            ->select(['o.id', 'o.order_number', 'o.order_date', 'o.final_amount', 'o.is_historical', 'o.customer_id', 'c.business_name', 'c.name as customer_name'])
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'order_number' => self::shortNumber($r->order_number),
                'order_date' => $r->order_date,
                'amount' => (float) $r->final_amount,
                'is_historical' => (bool) $r->is_historical,
                'customer_id' => $r->customer_id,
                'customer' => trim((string) ($r->business_name ?: $r->customer_name)) ?: 'No customer',
            ])
            ->sort(fn ($a, $b) => [strtolower($a['customer']), $a['order_date']] <=> [strtolower($b['customer']), $b['order_date']])
            ->values();

        return response()->json([
            'invoices' => $invoices,
            'orders_without_invoice' => $missing,
            'summary' => [
                'invoices' => $invoices->count(),
                // File numbers run from 1 to this.
                'max_file_number' => max(self::FILE_NUMBER_LIMIT, $invoices->count()),
                'filed' => $invoices->filter(fn ($i) => filled($i['file_number']))->count(),
                'new_unfiled' => $invoices->filter(fn ($i) => $i['is_new'] && blank($i['file_number']))->count(),
                'customers' => $invoices->pluck('customer_id')->unique()->count(),
                'differs_from_order' => $invoices->where('differs_from_order', true)->count(),
                'orders_without_invoice' => $missing->count(),
            ],
        ]);
    }

    /** Set or clear one invoice's file number. */
    public function update(Request $request, string $id): JsonResponse
    {
        if (!$this->allowed($request, 'can_view_filing', 'can_update_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $companyId = $request->user()->company_id;
        $invoice = Invoice::where('company_id', $companyId)->findOrFail($id);

        [$value, $error] = $this->normaliseFileNumber($request->input('file_number'), $this->maxFileNumber($companyId));
        if ($error) {
            return response()->json(['message' => $error], 422);
        }
        if ($value !== null) {
            $taken = DB::table('invoices')->where('company_id', $companyId)->where('id', '!=', $invoice->id)
                ->where('file_number', $value)->value('invoice_number');
            if ($taken) {
                return response()->json(['message' => "File No {$value} is already used by " . self::shortNumber($taken) . '.'], 422);
            }
        }
        $this->setFileNumber($invoice, $value, $request->user()->id);

        return response()->json(['message' => 'File number saved', 'file_number' => $invoice->file_number]);
    }

    /**
     * File numbers from an Excel sheet: [{invoice_number, file_number}]. Without apply=true it only
     * reports what would change, so the user sees it before anything is saved. Each number must be
     * 1..FILE_NUMBER_LIMIT and used once; numbers may move between invoices within one sheet.
     */
    public function import(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_view_filing', 'can_update_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validator = Validator::make($request->all(), [
            'rows' => 'required|array|min:1|max:20000',
            'rows.*.invoice_number' => 'nullable',
            'rows.*.file_number' => 'nullable',
            'apply' => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }
        $user = $request->user();
        $apply = $request->boolean('apply');

        // Matched on the number as printed (INV-0074) or as stored (INV-9b267ea3-0074).
        $all = DB::table('invoices')->where('company_id', $user->company_id)->get(['id', 'invoice_number', 'file_number'])->keyBy('id');
        $max = max(self::FILE_NUMBER_LIMIT, $all->count());
        $byNumber = collect();
        foreach ($all as $i) {
            $byNumber[strtoupper($i->invoice_number)] = $i;
            $byNumber[strtoupper(self::shortNumber($i->invoice_number))] ??= $i;
        }

        $counts = ['update' => 0, 'clear' => 0, 'unchanged' => 0, 'not_found' => 0, 'skipped' => 0, 'invalid' => 0];
        $rows = [];     // invoice id => the row it came from and its wanted value (null when the value was refused)
        $results = [];
        foreach ($request->input('rows') as $index => $row) {
            $number = strtoupper(trim((string) ($row['invoice_number'] ?? '')));
            $raw = trim((string) ($row['file_number'] ?? ''));
            if ($number === '') {
                $counts['skipped']++;
                continue;
            }
            $invoice = $byNumber->get($number);
            if (!$invoice) {
                $counts['not_found']++;
                $results[] = ['row' => $index + 1, 'invoice_number' => $row['invoice_number'], 'file_number' => $raw, 'result' => 'not_found', 'message' => 'No invoice with this number'];
                continue;
            }
            $short = self::shortNumber($invoice->invoice_number);
            if (array_key_exists($invoice->id, $rows)) {
                $counts['skipped']++;
                $results[] = ['row' => $index + 1, 'invoice_number' => $short, 'file_number' => $raw, 'result' => 'skipped', 'message' => 'Listed twice in the sheet; the first row was used'];
                continue;
            }
            [$value, $error] = $this->normaliseFileNumber($raw, $max);
            if ($error) {
                $counts['invalid']++;
                $rows[$invoice->id] = null;
                $results[] = ['row' => $index + 1, 'invoice_number' => $short, 'file_number' => $raw, 'previous' => $invoice->file_number, 'result' => 'invalid', 'message' => $error];
                continue;
            }
            $rows[$invoice->id] = ['row' => $index + 1, 'value' => $value];
        }

        // Where every invoice ends up; a number wanted by two invoices is refused for each row that asks for it.
        $wanted = collect($rows)->filter()->map(fn ($r) => $r['value']);
        $refused = [];
        do {
            $final = $all->map(fn ($i) => $wanted->has($i->id) ? $wanted[$i->id] : $i->file_number)->filter(fn ($v) => $v !== null);
            $clashing = $final->countBy()->filter(fn ($n) => $n > 1)->keys()->map(fn ($v) => (string) $v);
            $again = $wanted->filter(fn ($v) => $v !== null && $clashing->contains($v));
            foreach ($again as $id => $v) {
                $others = $final->filter(fn ($fv, $fid) => (string) $fv === $v && $fid !== $id)->keys()
                    ->map(fn ($fid) => self::shortNumber($all[$fid]->invoice_number))->implode(', ');
                $refused[$id] = "File No {$v} is also used by {$others}";
                $wanted->forget($id);
            }
        } while ($again->isNotEmpty());

        $changes = [];
        foreach ($rows as $id => $row) {
            if ($row === null) {
                continue;
            }
            $invoice = $all[$id];
            $short = self::shortNumber($invoice->invoice_number);
            $current = $invoice->file_number;
            if (isset($refused[$id])) {
                $counts['invalid']++;
                $results[] = ['row' => $row['row'], 'invoice_number' => $short, 'file_number' => $row['value'], 'previous' => $current, 'result' => 'invalid', 'message' => $refused[$id]];
                continue;
            }
            $result = $row['value'] === $current ? 'unchanged' : ($row['value'] === null ? 'clear' : 'update');
            $counts[$result]++;
            if ($result !== 'unchanged') {
                $results[] = ['row' => $row['row'], 'invoice_number' => $short, 'file_number' => $row['value'] ?? '', 'previous' => $current, 'result' => $result];
                $changes[$id] = $row['value'];
            }
        }

        if ($apply && $changes) {
            DB::transaction(function () use ($changes, $user) {
                // Free the numbers first so two invoices can swap without tripping the unique rule.
                DB::table('invoices')->whereIn('id', array_keys($changes))->update(['file_number' => null]);
                foreach ($changes as $id => $value) {
                    $this->setFileNumber(Invoice::find($id), $value, $user->id);
                }
            });
        }
        usort($results, fn ($x, $y) => $x['row'] <=> $y['row']);

        return response()->json([
            'applied' => $apply,
            'counts' => $counts,
            'max' => $max,
            'rows' => $results,
            'message' => $apply
                ? "Saved {$counts['update']} file number(s)" . ($counts['clear'] ? ", cleared {$counts['clear']}" : '') . ($counts['invalid'] ? "; {$counts['invalid']} row(s) not saved" : '')
                : 'Preview only - nothing saved yet',
        ]);
    }

    /** File numbers run from 1 to FILE_NUMBER_LIMIT, or to the number of invoices if there are more. */
    protected function maxFileNumber(string $companyId): int
    {
        return max(self::FILE_NUMBER_LIMIT, DB::table('invoices')->where('company_id', $companyId)->count());
    }

    /**
     * A whole number from 1 to $max ("007", Excel's "7.0" and "NSK/0007" are 7); empty clears it.
     *
     * @return array{0: ?string, 1: ?string} [value, error]
     */
    protected function normaliseFileNumber($raw, int $max): array
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return [null, null];
        }
        // Typed as printed: NSK/0429, nsk 429.
        $raw = preg_replace('/^nsk\s*[\/\-]?\s*/i', '', $raw);
        if (!preg_match('/^\d+(\.0+)?$/', $raw)) {
            return [null, "File No must be a whole number from 1 to {$max}"];
        }
        $n = (int) $raw;
        if ($n < 1 || $n > $max) {
            return [null, "File No must be from 1 to {$max}"];
        }
        return [(string) $n, null];
    }

    /** Create the missing invoices for the given completed orders. */
    public function createInvoices(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_create_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validator = Validator::make($request->all(), ['order_ids' => 'required|array|min:1|max:500', 'order_ids.*' => 'uuid']);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }
        $user = $request->user();
        $orders = Order::where('company_id', $user->company_id)->whereIn('id', $request->input('order_ids'))->orderBy('order_date')->get();

        $results = $orders->map(fn ($order) => ['order_number' => $order->order_number] + $this->invoiceOrders->createForOrder($order, $user))->values();
        $created = $results->where('ok', true)->count();

        return response()->json([
            'message' => "Created {$created} of {$results->count()} invoice(s)",
            'created' => $created,
            'results' => $results,
        ]);
    }

    /** Bring invoices back in line with their (corrected) orders. */
    public function matchOrders(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_update_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validator = Validator::make($request->all(), ['invoice_ids' => 'required|array|min:1|max:500', 'invoice_ids.*' => 'uuid']);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }
        $invoices = Invoice::where('company_id', $request->user()->company_id)
            ->whereIn('id', $request->input('invoice_ids'))
            ->whereNotNull('order_id')
            ->get();

        $results = [];
        foreach ($invoices as $invoice) {
            $order = Order::find($invoice->order_id);
            if (!$order || !$order->orderItems()->exists()) {
                $results[] = ['invoice_number' => $invoice->invoice_number, 'skipped' => true, 'message' => 'The order has no items to copy'];
                continue;
            }
            $before = (float) $invoice->total_amount;
            DB::transaction(fn () => $this->invoiceOrders->syncWithOrder($order, $invoice));
            $invoice->refresh();
            $results[] = ['invoice_number' => $invoice->invoice_number, 'before' => $before, 'after' => (float) $invoice->total_amount, 'status' => $invoice->status];
        }

        return response()->json(['message' => 'Updated ' . count($results) . ' invoice(s) to match their orders', 'results' => $results]);
    }

    /** INV-9b267ea3-0074 is printed as INV-0074 (see Invoice::getInvoiceNumberAttribute). */
    protected static function shortNumber(?string $number): ?string
    {
        return $number && preg_match('/^([A-Z]+)-(?:[\w-]+)-(\d{4})$/', $number, $m) ? $m[1] . '-' . $m[2] : $number;
    }

    protected function setFileNumber(Invoice $invoice, ?string $fileNumber, string $userId): void
    {
        $fileNumber = trim((string) $fileNumber);
        $invoice->forceFill([
            'file_number' => $fileNumber === '' ? null : $fileNumber,
            'filed_at' => $fileNumber === '' ? null : ($invoice->file_number ? $invoice->filed_at : now()),
            'filed_by' => $fileNumber === '' ? null : $userId,
        ])->saveQuietly();
    }
}
