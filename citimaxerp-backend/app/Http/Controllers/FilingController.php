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
    public function __construct(private InvoiceOrderService $invoiceOrders)
    {
    }

    protected function allowed(Request $request, string $permission): bool
    {
        $role = $request->user()?->role;
        return $role && ($role->hasPermission('can_manage_system') || $role->hasPermission('can_manage_company') || $role->hasPermission($permission));
    }

    public function index(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_view_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $companyId = $request->user()->company_id;

        $invoices = DB::table('invoices as i')
            ->leftJoin('customers as c', 'c.id', '=', 'i.customer_id')
            ->leftJoin('orders as o', 'o.id', '=', 'i.order_id')
            ->where('i.company_id', $companyId)
            ->where(fn ($q) => $q->whereNull('i.type')->orWhere('i.type', 'sales'))
            ->select([
                'i.id', 'i.invoice_number', 'i.invoice_date', 'i.due_date', 'i.status',
                'i.total_amount', 'i.amount_paid', 'i.balance_amount', 'i.file_number', 'i.filed_at',
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
                'filed' => $invoices->filter(fn ($i) => filled($i['file_number']))->count(),
                'customers' => $invoices->pluck('customer_id')->unique()->count(),
                'differs_from_order' => $invoices->where('differs_from_order', true)->count(),
                'orders_without_invoice' => $missing->count(),
            ],
        ]);
    }

    /** Set or clear one invoice's file number. */
    public function update(Request $request, string $id): JsonResponse
    {
        if (!$this->allowed($request, 'can_update_invoices')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $validator = Validator::make($request->all(), ['file_number' => 'nullable|string|max:50']);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }
        $invoice = Invoice::where('company_id', $request->user()->company_id)->findOrFail($id);
        $this->setFileNumber($invoice, $request->input('file_number'), $request->user()->id);

        return response()->json(['message' => 'File number saved', 'file_number' => $invoice->file_number]);
    }

    /**
     * File numbers from an Excel sheet: [{invoice_number, file_number}]. Without apply=true it only
     * reports what would change, so the user sees it before anything is saved.
     */
    public function import(Request $request): JsonResponse
    {
        if (!$this->allowed($request, 'can_update_invoices')) {
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
        $invoices = collect();
        foreach (DB::table('invoices')->where('company_id', $user->company_id)->get(['id', 'invoice_number', 'file_number']) as $i) {
            $invoices[strtoupper($i->invoice_number)] = $i;
            $invoices[strtoupper(self::shortNumber($i->invoice_number))] ??= $i;
        }

        $results = [];
        $counts = ['update' => 0, 'clear' => 0, 'unchanged' => 0, 'not_found' => 0, 'skipped' => 0];
        $seen = [];
        foreach ($request->input('rows') as $index => $row) {
            $number = strtoupper(trim((string) ($row['invoice_number'] ?? '')));
            $file = trim((string) ($row['file_number'] ?? ''));
            if ($number === '') {
                $counts['skipped']++;
                continue;
            }
            $invoice = $invoices->get($number);
            if (!$invoice) {
                $counts['not_found']++;
                $results[] = ['row' => $index + 1, 'invoice_number' => $row['invoice_number'], 'file_number' => $file, 'result' => 'not_found', 'message' => 'No invoice with this number'];
                continue;
            }
            if (isset($seen[$invoice->id])) {
                $counts['skipped']++;
                $results[] = ['row' => $index + 1, 'invoice_number' => self::shortNumber($invoice->invoice_number), 'file_number' => $file, 'result' => 'skipped', 'message' => 'Listed twice in the sheet; the first row was used'];
                continue;
            }
            $seen[$invoice->id] = true;

            $current = (string) ($invoice->file_number ?? '');
            $result = $file === $current ? 'unchanged' : ($file === '' ? 'clear' : 'update');
            $counts[$result]++;
            if ($result !== 'unchanged') {
                $results[] = ['row' => $index + 1, 'invoice_number' => self::shortNumber($invoice->invoice_number), 'file_number' => $file, 'previous' => $current ?: null, 'result' => $result];
                if ($apply) {
                    $this->setFileNumber(Invoice::find($invoice->id), $file, $user->id);
                }
            }
        }

        return response()->json([
            'applied' => $apply,
            'counts' => $counts,
            'rows' => $results,
            'message' => $apply
                ? "Saved {$counts['update']} file number(s)" . ($counts['clear'] ? ", cleared {$counts['clear']}" : '')
                : 'Preview only - nothing saved yet',
        ]);
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
