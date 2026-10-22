<?php

namespace App\Services;

use App\Models\CompanyAccountingSettings;
use App\Models\CreditNote;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Order;
use App\Models\OrderDispatch;
use App\Models\OrderDispatchItem;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\PaymentRefund;
use App\Models\PayrollRun;
use App\Models\ProductReceipt;
use App\Models\ProductReceiptItem;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Turns business documents into general-ledger entries.
 *
 * Every document type has a sync method that works out what the ledger
 * *should* contain for that document right now, then reconciles:
 *   - nothing should be posted and nothing is  -> no-op
 *   - an entry should exist and none does      -> post it
 *   - the existing entry matches               -> no-op (idempotent)
 *   - the document changed / was voided        -> reverse the old entry, post the new one
 *
 * The same methods back the model observers (live posting) and the
 * finance:backfill command (history replay), so both produce identical books.
 */
class LedgerPostingService
{
    /** Sentinel: leave whatever is in the ledger alone (manual trigger). */
    public const SKIP = '__skip__';

    protected array $settingsCache = [];
    protected array $outcomes = [];
    protected bool $planning = false;

    public function __construct(protected AccountingIntegrationService $engine)
    {
    }

    // =====================================================================
    // DISPATCH
    // =====================================================================

    public function syncModel(Model $model, bool $deleted = false): array
    {
        return match (true) {
            $model instanceof Invoice => [$this->syncInvoice($model, $deleted)],
            $model instanceof Payment => [$this->syncPayment($model, $deleted)],
            $model instanceof PaymentRefund => [$this->syncPaymentRefund($model, $deleted)],
            $model instanceof Expense => [$this->syncExpense($model, $deleted)],
            $model instanceof ProductReceipt => [$this->syncProductReceipt($model, $deleted)],
            $model instanceof OrderDispatch => [$this->syncDispatch($model, $deleted)],
            $model instanceof CreditNote => $this->syncCreditNote($model, $deleted),
            $model instanceof SupplierPayment => [$this->syncSupplierPayment($model, $deleted)],
            $model instanceof PayrollRun => $this->syncPayrollRun($model, $deleted),
            default => [],
        };
    }

    // =====================================================================
    // SALES
    // =====================================================================

    /**
     * Accrual revenue recognition: DR Receivables / CR Sales / CR VAT.
     * Under cash basis revenue is recognised from receipts instead.
     */
    public function syncInvoice(Invoice $invoice, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($invoice->company_id);
        $desired = null;

        if (!$deleted && $settings) {
            $trigger = $settings->sales_recognition_trigger;
            if ($trigger === 'manual') {
                $desired = self::SKIP;
            } elseif ($this->isCashBasis($settings)) {
                $desired = null;
            } elseif ($this->invoiceIsRecognisable($invoice, $settings)) {
                $total = $this->money($invoice->total_amount);
                $tax = $this->money($invoice->tax_amount);
                $desired = [
                    'date' => $invoice->invoice_date ?? $invoice->created_at,
                    'prefix' => 'INV',
                    'reference' => $invoice->invoice_number,
                    'description' => "Sales invoice {$invoice->invoice_number}",
                    'lines' => [
                        ['key' => 'accounts_receivable', 'debit' => $total, 'contact' => [$invoice->customer_id, Customer::class], 'description' => "Invoice {$invoice->invoice_number}"],
                        ['key' => 'sales_revenue', 'credit' => $total - $tax, 'description' => "Sales - invoice {$invoice->invoice_number}"],
                        ['key' => 'vat_payable', 'credit' => $tax, 'description' => "Output VAT - invoice {$invoice->invoice_number}"],
                    ],
                ];
            }
        }

        return $this->syncEntry($invoice, 'sales_invoice', $desired);
    }

    protected function invoiceIsRecognisable(Invoice $invoice, CompanyAccountingSettings $settings): bool
    {
        if (in_array($invoice->status, ['cancelled', 'void', 'voided'], true)) {
            return false;
        }
        if ($invoice->type === 'proforma' && !$settings->record_proforma_invoices) {
            return false;
        }
        if ($invoice->status === 'draft' && !$invoice->sent_at && !$settings->record_draft_invoices) {
            return false;
        }
        return $this->money($invoice->total_amount) > 0;
    }

    /**
     * Customer receipt. Accrual: DR Cash/Bank / CR Receivables. A receipt for
     * an order that was never invoiced is a cash sale (CR Sales/VAT), and under
     * cash basis every receipt is revenue.
     */
    public function syncPayment(Payment $payment, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($payment->company_id);
        $desired = null;
        $amount = $this->money($payment->amount_paid);

        if (!$deleted && $settings && $payment->status === 'completed' && $amount > 0) {
            if (!$settings->auto_record_customer_payments) {
                $desired = self::SKIP;
            } else {
                $ref = $payment->transaction_id ?: substr($payment->id, 0, 8);
                $cashLine = ['method' => $payment->payment_method, 'debit' => $amount, 'contact' => [$payment->customer_id, Customer::class], 'description' => "Receipt {$ref} ({$payment->payment_method})"];

                if ($this->isCashBasis($settings) || $this->isUninvoicedOrderReceipt($payment)) {
                    $tax = $this->uninvoicedOrderVat($payment, $amount);
                    $lines = [
                        $cashLine,
                        ['key' => 'sales_revenue', 'credit' => $amount - $tax, 'description' => "Cash sale - receipt {$ref}"],
                        ['key' => 'vat_payable', 'credit' => $tax, 'description' => "Output VAT - receipt {$ref}"],
                    ];
                    $purposeDescription = "Cash sale receipt {$ref}";
                } else {
                    $lines = [
                        $cashLine,
                        ['key' => 'accounts_receivable', 'credit' => $amount, 'contact' => [$payment->customer_id, Customer::class], 'description' => "Receipt {$ref}"],
                    ];
                    $purposeDescription = "Customer receipt {$ref}";
                }

                $desired = [
                    'date' => $payment->payment_date ?? $payment->created_at,
                    'prefix' => 'REC',
                    'reference' => $ref,
                    'description' => $purposeDescription,
                    'lines' => $lines,
                ];
            }
        }

        return $this->syncEntry($payment, 'customer_payment', $desired);
    }

    protected function isUninvoicedOrderReceipt(Payment $payment): bool
    {
        if ($payment->invoice_id || PaymentAllocation::where('payment_id', $payment->id)->exists()) {
            return false;
        }
        return $payment->order_id && !Invoice::where('order_id', $payment->order_id)->exists();
    }

    protected function uninvoicedOrderVat(Payment $payment, float $amount): float
    {
        if (!$payment->order_id) {
            return 0.0;
        }
        $order = Order::find($payment->order_id);
        if (!$order) {
            return 0.0;
        }
        $orderTotal = $this->money($order->final_amount ?: $order->total_amount);
        $orderTax = $this->money($order->tax);
        if ($orderTotal <= 0 || $orderTax <= 0) {
            return 0.0;
        }
        return round($amount * $orderTax / $orderTotal, 2);
    }

    public function syncPaymentRefund(PaymentRefund $refund, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($refund->company_id);
        $desired = null;
        $amount = $this->money($refund->amount);

        if (!$deleted && $settings && $refund->status === 'completed' && $amount > 0) {
            $ref = $refund->reference ?: substr($refund->id, 0, 8);
            $desired = [
                'date' => $refund->refund_date ?? $refund->created_at,
                'prefix' => 'RFD',
                'reference' => $ref,
                'description' => "Customer refund {$ref}",
                'lines' => [
                    ['key' => $this->isCashBasis($settings) ? 'sales_revenue' : 'accounts_receivable', 'debit' => $amount, 'contact' => [$refund->customer_id, Customer::class], 'description' => "Refund {$ref}"],
                    ['method' => $refund->refund_method, 'credit' => $amount, 'description' => "Refund paid {$ref}"],
                ],
            ];
        }

        return $this->syncEntry($refund, 'customer_refund', $desired);
    }

    /**
     * Credit note: DR Sales Returns + DR VAT / CR Receivables, and when the
     * credit is refunded in cash: DR Receivables / CR Cash.
     */
    public function syncCreditNote(CreditNote $note, bool $deleted = false): array
    {
        $settings = $this->settings($note->company_id);
        $issued = !$deleted && $settings && in_array($note->status, ['issued', 'applied', 'partially_applied', 'refunded'], true);
        $total = $this->money($note->total_amount);
        $tax = $this->money($note->tax_amount);

        $desired = null;
        if ($issued && $total > 0) {
            $desired = [
                'date' => $note->credit_note_date ?? $note->issued_at ?? $note->created_at,
                'prefix' => 'CRN',
                'reference' => $note->credit_note_number,
                'description' => "Credit note {$note->credit_note_number}",
                'lines' => [
                    ['key' => 'sales_returns', 'fallback' => 'sales_revenue', 'debit' => $total - $tax, 'description' => "Sales return - {$note->credit_note_number}"],
                    ['key' => 'vat_payable', 'debit' => $tax, 'description' => "Output VAT reversal - {$note->credit_note_number}"],
                    ['key' => 'accounts_receivable', 'credit' => $total, 'contact' => [$note->customer_id, Customer::class], 'description' => "Credit note {$note->credit_note_number}"],
                ],
            ];
        }

        $refunded = $this->money($note->amount_refunded);
        $refundDesired = null;
        if ($issued && $refunded > 0) {
            $refundDesired = [
                'date' => $note->refunded_at ?? $note->updated_at,
                'prefix' => 'RFD',
                'reference' => $note->credit_note_number,
                'description' => "Credit note refund {$note->credit_note_number}",
                'lines' => [
                    ['key' => 'accounts_receivable', 'debit' => $refunded, 'contact' => [$note->customer_id, Customer::class], 'description' => "Credit refunded - {$note->credit_note_number}"],
                    ['method' => 'cash', 'credit' => $refunded, 'description' => "Refund paid - {$note->credit_note_number}"],
                ],
            ];
        }

        return [
            $this->syncEntry($note, 'credit_note', $desired),
            $this->syncEntry($note, 'credit_note_refund', $refundDesired),
        ];
    }

    /**
     * Cost of goods sold when stock leaves on a dispatch: DR COGS / CR Inventory.
     */
    public function syncDispatch(OrderDispatch $dispatch, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($dispatch->company_id);
        $desired = null;

        // A historical (migrated) sale's stock is already out of the opening balances, so
        // booking its cost again would take it out of Inventory twice.
        $historical = (bool) Order::whereKey($dispatch->order_id)->value('is_historical');

        if (!$deleted && !$historical && $settings && $settings->perpetual_inventory) {
            $shippedStatuses = $settings->cogs_recognition === 'on_delivery' ? ['delivered'] : ['in_transit', 'delivered'];
            if (in_array($dispatch->status, $shippedStatuses, true)) {
                $cost = $this->money(
                    OrderDispatchItem::where('order_dispatch_id', $dispatch->id)
                        ->join('products', 'products.id', '=', 'order_dispatch_items.product_id')
                        ->sum(DB::raw('COALESCE(order_dispatch_items.base_quantity, order_dispatch_items.quantity) * COALESCE(products.unit_cost, 0)'))
                );
                if ($cost > 0) {
                    $ref = $dispatch->dispatch_number ?: substr($dispatch->id, 0, 8);
                    $desired = [
                        'date' => $dispatch->actual_delivery_date ?? $dispatch->dispatch_date ?? $dispatch->updated_at,
                        'prefix' => 'COGS',
                        'reference' => $ref,
                        'description' => "Cost of goods dispatched {$ref}",
                        'lines' => [
                            ['key' => 'cogs', 'debit' => $cost, 'description' => "COGS - dispatch {$ref}"],
                            ['key' => 'inventory', 'credit' => $cost, 'description' => "Stock out - dispatch {$ref}"],
                        ],
                    ];
                }
            }
        }

        return $this->syncEntry($dispatch, 'cogs', $desired);
    }

    // =====================================================================
    // PURCHASING
    // =====================================================================

    /**
     * Goods received: DR Inventory (+ landed costs) [+ DR Input VAT] / CR Payables.
     */
    public function syncProductReceipt(ProductReceipt $receipt, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($receipt->company_id);
        $desired = null;

        if (!$deleted && $settings) {
            if (in_array($settings->purchase_recognition_trigger, ['manual', 'payment_made'], true)) {
                $desired = $settings->purchase_recognition_trigger === 'manual' ? self::SKIP : null;
            } else {
                $goods = $this->money(
                    ProductReceiptItem::where('product_receipt_id', $receipt->id)
                        ->sum(DB::raw('COALESCE(quantity, 0) * COALESCE(unit_price, 0)'))
                );
                $landed = $this->money($receipt->shipping_cost) + $this->money($receipt->logistics_cost);
                $vat = 0.0;
                if ($receipt->purchase_order_id) {
                    $rate = (float) (PurchaseOrder::whereKey($receipt->purchase_order_id)->value('tax_rate') ?? 0);
                    $vat = $rate > 0 ? round($goods * $rate / 100, 2) : 0.0;
                }
                $total = $goods + $landed + $vat;

                if ($total > 0) {
                    $ref = $receipt->product_receipt_number ?: substr($receipt->id, 0, 8);
                    $supplierName = $receipt->supplier_id ? (Supplier::whereKey($receipt->supplier_id)->value('name') ?? 'supplier') : 'supplier';
                    $desired = [
                        'date' => $receipt->created_at,
                        'prefix' => 'GRN',
                        'reference' => $ref,
                        'description' => "Goods received {$ref} - {$supplierName}",
                        'lines' => [
                            ['key' => 'inventory', 'debit' => $goods + $landed, 'description' => "Stock received {$ref}"],
                            ['key' => 'input_vat', 'debit' => $vat, 'description' => "Input VAT - {$ref}"],
                            ['key' => 'accounts_payable', 'credit' => $total, 'contact' => [$receipt->supplier_id, Supplier::class], 'description' => "Payable to {$supplierName} - {$ref}"],
                        ],
                    ];
                }
            }
        }

        return $this->syncEntry($receipt, 'goods_received', $desired);
    }

    /**
     * Supplier payment: DR Payables / CR Cash/Bank. Under a cash-basis purchase
     * trigger the payment is the purchase (DR Inventory).
     */
    public function syncSupplierPayment(SupplierPayment $payment, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($payment->company_id);
        $desired = null;
        $amount = $this->money($payment->amount);

        if (!$deleted && $settings && $payment->status === 'completed' && $amount > 0) {
            if (!$settings->auto_record_supplier_payments) {
                $desired = self::SKIP;
            } else {
                $ref = $payment->payment_number ?: substr($payment->id, 0, 8);
                $supplierName = Supplier::whereKey($payment->supplier_id)->value('name') ?? 'supplier';
                $debitKey = $settings->purchase_recognition_trigger === 'payment_made' ? 'inventory' : 'accounts_payable';
                $desired = [
                    'date' => $payment->payment_date ?? $payment->created_at,
                    'prefix' => 'PAY',
                    'reference' => $ref,
                    'description' => "Supplier payment {$ref} - {$supplierName}",
                    'lines' => [
                        ['key' => $debitKey, 'debit' => $amount, 'contact' => [$payment->supplier_id, Supplier::class], 'description' => "Paid {$supplierName} - {$ref}"],
                        ['method' => $payment->payment_method, 'credit' => $amount, 'description' => "Payment {$ref} ({$payment->payment_method})"],
                    ],
                ];
            }
        }

        return $this->syncEntry($payment, 'supplier_payment', $desired);
    }

    // =====================================================================
    // EXPENSES & PAYROLL
    // =====================================================================

    /**
     * Expense: DR expense account for its category / CR Cash/Bank.
     */
    public function syncExpense(Expense $expense, bool $deleted = false): ?JournalEntry
    {
        $settings = $this->settings($expense->company_id);
        $desired = null;

        if (!$deleted && $settings) {
            $trigger = $settings->expense_recognition_trigger;
            $postable = match ($trigger) {
                'manual' => null,
                'expense_created' => $expense->status !== 'rejected',
                'expense_paid' => $expense->status === 'paid',
                default => in_array($expense->status, ['approved', 'paid'], true),
            };

            if ($postable === null) {
                $desired = self::SKIP;
            } elseif ($postable && $this->money($expense->amount) > 0) {
                $amount = $this->money($expense->amount);
                $label = trim(($expense->description ?: 'Expense') . ($expense->vendor_name ? " - {$expense->vendor_name}" : ''));
                $desired = [
                    'date' => $expense->expense_date ?? $expense->created_at,
                    'prefix' => 'EXP',
                    'reference' => 'EXP-' . substr($expense->id, 0, 8),
                    'description' => "Expense: {$label}",
                    'lines' => [
                        ['key' => 'miscellaneous_expense', 'context' => ['context_type' => 'expense_category', 'context_id' => $expense->category_id], 'debit' => $amount, 'description' => $label],
                        ['method' => $expense->payment_method, 'credit' => $amount, 'description' => "Paid ({$expense->payment_method}) - {$label}"],
                    ],
                ];
            }
        }

        return $this->syncEntry($expense, 'expense', $desired);
    }

    /**
     * Payroll accrual on approval and payment of net pay on payout.
     *
     * Accrual: DR Salaries (gross) + DR employer NSSF + DR employer housing levy
     *          CR PAYE / NSSF / SHIF / Housing levy / other deductions /
     *             staff advances recovered / net salaries payable
     * Payout:  DR Net salaries payable / CR Bank
     */
    public function syncPayrollRun(PayrollRun $run, bool $deleted = false): array
    {
        $settings = $this->settings($run->company_id);
        $accrualDesired = null;
        $payoutDesired = null;

        if (!$deleted && $settings && in_array($run->status, ['approved', 'paid'], true)) {
            // Payslips with no gross pay can still carry a statutory minimum
            // (e.g. SHIF 300) that is never actually withheld, so they are
            // left out - otherwise the entry cannot balance.
            $t = $run->payslips()->where('gross_pay', '>', 0)->selectRaw('
                COALESCE(SUM(gross_pay),0) gross, COALESCE(SUM(net_pay),0) net,
                COALESCE(SUM(nssf_employee),0) nssf_employee, COALESCE(SUM(nssf_employer),0) nssf_employer,
                COALESCE(SUM(paye),0) paye, COALESCE(SUM(shif),0) shif,
                COALESCE(SUM(housing_levy_employee),0) housing_levy, COALESCE(SUM(housing_levy_employer),0) housing_levy_employer,
                COALESCE(SUM(total_custom_deductions),0) + COALESCE(SUM(other_deductions),0) deductions,
                COALESCE(SUM(salary_advance_deduction),0) advance_deductions
            ')->first()->toArray();
            $period = Carbon::create((int) $run->pay_year, (int) $run->pay_month, 1)->endOfMonth();
            $label = $period->format('F Y');
            $housingEmployer = $this->money($t['housing_levy_employer']);
            $housingTotal = $this->money($t['housing_levy']) + $housingEmployer;
            $otherDeductions = $this->money($t['deductions']);

            if ($this->money($t['gross']) > 0) {
                $accrualDesired = [
                    'date' => $period,
                    'prefix' => 'PRL',
                    'reference' => "PAYROLL-{$period->format('Y-m')}",
                    'description' => "Payroll {$label}",
                    'lines' => [
                        ['key' => 'salaries_expense', 'fallback' => 'miscellaneous_expense', 'debit' => $this->money($t['gross']), 'description' => "Gross salaries {$label}"],
                        ['key' => 'nssf_employer_expense', 'fallback' => 'salaries_expense', 'debit' => $this->money($t['nssf_employer']), 'description' => "Employer NSSF {$label}"],
                        ['key' => 'housing_levy_employer_expense', 'fallback' => 'salaries_expense', 'debit' => $housingEmployer, 'description' => "Employer housing levy {$label}"],
                        ['key' => 'paye_payable', 'credit' => $this->money($t['paye']), 'description' => "PAYE {$label}"],
                        ['key' => 'nssf_payable', 'credit' => $this->money($t['nssf_employee']) + $this->money($t['nssf_employer']), 'description' => "NSSF {$label}"],
                        ['key' => 'shif_payable', 'credit' => $this->money($t['shif']), 'description' => "SHIF {$label}"],
                        ['key' => 'housing_levy_payable', 'credit' => $housingTotal, 'description' => "Housing levy {$label}"],
                        ['key' => 'payroll_deductions_payable', 'credit' => $otherDeductions, 'description' => "Other payroll deductions {$label}"],
                        ['key' => 'staff_advances', 'credit' => $this->money($t['advance_deductions']), 'description' => "Salary advances recovered {$label}"],
                        ['key' => 'salaries_payable', 'credit' => $this->money($t['net']), 'description' => "Net pay {$label}"],
                    ],
                    // Rounding on payslips can leave a cent or two; absorb it in net pay.
                    'balance_with' => 'salaries_payable',
                ];
            }

            if ($run->status === 'paid' && $this->money($t['net']) > 0) {
                $payoutDesired = [
                    'date' => $run->paid_at ?? $period,
                    'prefix' => 'PRL',
                    'reference' => "PAYOUT-{$period->format('Y-m')}",
                    'description' => "Salaries paid {$label}",
                    'lines' => [
                        ['key' => 'salaries_payable', 'debit' => $this->money($t['net']), 'description' => "Net pay settled {$label}"],
                        ['method' => 'bank_transfer', 'credit' => $this->money($t['net']), 'description' => "Salary payout {$label}"],
                    ],
                ];
            }
        }

        return [
            $this->syncEntry($run, 'payroll_accrual', $accrualDesired),
            $this->syncEntry($run, 'payroll_payment', $payoutDesired),
        ];
    }

    // =====================================================================
    // CORE RECONCILIATION
    // =====================================================================

    /**
     * Run the sync for a document and report what happened to each of its
     * ledger entries (post / repost / reverse / unchanged / nothing / skip).
     */
    public function runModel(Model $model): array
    {
        $this->outcomes = [];
        $this->syncModel($model);
        return $this->outcomes;
    }

    /**
     * Same as runModel() but writes nothing - used by finance:backfill --dry-run.
     */
    public function planModel(Model $model): array
    {
        $this->outcomes = [];
        $this->planning = true;
        try {
            $this->syncModel($model);
        } finally {
            $this->planning = false;
        }
        return $this->outcomes;
    }

    /**
     * Reconcile the ledger for one (document, purpose) pair with $desired.
     *
     * @param array|string|null $desired entry spec, null for "nothing should be posted", or self::SKIP
     */
    public function syncEntry(Model $source, string $purpose, array|string|null $desired): ?JournalEntry
    {
        if ($desired === self::SKIP) {
            $this->outcomes[] = 'skip';
            return null;
        }

        $companyId = $source->company_id;
        $this->engine->setCompany($companyId);
        $this->engine->setUser($this->actingUserId($source));

        $existing = $this->activeEntries($source, $purpose);
        $spec = $desired ? $this->buildSpec($desired) : null;

        if ($spec && $existing->count() === 1 && $this->matches($existing->first(), $spec)) {
            $this->outcomes[] = 'unchanged';
            return $existing->first();
        }
        if (!$spec && $existing->isEmpty()) {
            $this->outcomes[] = 'nothing';
            return null;
        }

        $this->outcomes[] = !$spec ? 'reverse' : ($existing->isEmpty() ? 'post' : 'repost');
        if ($this->planning) {
            return null;
        }

        return DB::transaction(function () use ($existing, $spec, $source, $purpose) {
            foreach ($existing as $entry) {
                $this->engine->reverseJournalEntry($entry->id, $spec ? 'Source document changed' : 'Source document voided or deleted');
            }
            if (!$spec) {
                return null;
            }
            return $this->engine->postEntry([
                'prefix' => $spec['prefix'],
                'entry_date' => $spec['date'],
                'reference' => $spec['reference'],
                'description' => $spec['description'],
                'entry_type' => 'automatic',
                'source_id' => $source->getKey(),
                'source_type' => get_class($source),
                'status' => 'posted',
                'metadata' => ['transaction_type' => $purpose],
            ], $spec['items']);
        });
    }

    protected function activeEntries(Model $source, string $purpose)
    {
        return JournalEntry::with('items')
            ->where('company_id', $source->company_id)
            ->where('source_type', get_class($source))
            ->where('source_id', $source->getKey())
            ->where('status', 'posted')
            ->get()
            ->filter(fn (JournalEntry $e) => ($e->metadata['transaction_type'] ?? null) === $purpose)
            ->values();
    }

    /**
     * Resolve accounts, drop zero lines and return balanced items.
     */
    protected function buildSpec(array $desired): ?array
    {
        $items = [];
        foreach ($desired['lines'] as $line) {
            $debit = round((float) ($line['debit'] ?? 0), 2);
            $credit = round((float) ($line['credit'] ?? 0), 2);
            if ($debit <= 0 && $credit <= 0) {
                continue;
            }

            $accountId = $this->resolveLineAccount($line);
            [$contactId, $contactType] = $line['contact'] ?? [null, null];

            $items[] = [
                'account_id' => $accountId,
                'debit_amount' => max($debit, 0),
                'credit_amount' => max($credit, 0),
                'description' => $line['description'] ?? $desired['description'],
                'contact_id' => $contactId,
                'contact_type' => $contactId ? $contactType : null,
                '_key' => $line['key'] ?? null,
            ];
        }

        if (empty($items)) {
            return null;
        }

        $diff = round(array_sum(array_column($items, 'debit_amount')) - array_sum(array_column($items, 'credit_amount')), 2);
        if ($diff != 0.0 && !empty($desired['balance_with']) && abs($diff) <= 1.0) {
            foreach ($items as &$item) {
                if ($item['_key'] === $desired['balance_with'] && $item['credit_amount'] > 0) {
                    $item['credit_amount'] = round($item['credit_amount'] + $diff, 2);
                    break;
                }
            }
            unset($item);
        }

        foreach ($items as &$item) {
            unset($item['_key']);
        }
        unset($item);

        return [
            'date' => Carbon::parse($desired['date'] ?? now())->toDateString(),
            'prefix' => $desired['prefix'],
            'reference' => $desired['reference'] ? (string) $desired['reference'] : null,
            'description' => $desired['description'],
            'items' => $items,
        ];
    }

    protected function resolveLineAccount(array $line): string
    {
        if (!empty($line['account_id'])) {
            return $line['account_id'];
        }

        if (array_key_exists('method', $line)) {
            $id = $this->engine->resolvePaymentMethodAccountId($line['method']);
            if (!$id) {
                throw new \RuntimeException("No cash/bank account mapped for payment method '{$line['method']}'. Configure it in Finance > Account Mappings.");
            }
            return $id;
        }

        $context = array_filter($line['context'] ?? []);
        $id = $this->engine->resolveAccountId($line['key'], count($context) === 2 ? $context : []);
        if (!$id && !empty($line['fallback'])) {
            $id = $this->engine->resolveAccountId($line['fallback']);
        }
        if (!$id) {
            throw new \RuntimeException("Account mapping '{$line['key']}' is not configured. Configure it in Finance > Account Mappings.");
        }
        return $id;
    }

    protected function matches(JournalEntry $entry, array $spec): bool
    {
        if (Carbon::parse($entry->entry_date)->toDateString() !== $spec['date']) {
            return false;
        }
        $have = $entry->items
            ->map(fn ($i) => $i->account_id . '|' . number_format((float) $i->debit_amount, 2, '.', '') . '|' . number_format((float) $i->credit_amount, 2, '.', ''))
            ->sort()->values()->all();
        $want = collect($spec['items'])
            ->map(fn ($i) => $i['account_id'] . '|' . number_format($i['debit_amount'], 2, '.', '') . '|' . number_format($i['credit_amount'], 2, '.', ''))
            ->sort()->values()->all();
        return $have === $want;
    }

    // =====================================================================
    // HELPERS
    // =====================================================================

    protected function settings(string $companyId): ?CompanyAccountingSettings
    {
        if (!array_key_exists($companyId, $this->settingsCache)) {
            $settings = CompanyAccountingSettings::getOrCreateDefaults($companyId);
            $this->settingsCache[$companyId] = ($settings && $settings->accounting_integration_enabled) ? $settings : null;
        }
        return $this->settingsCache[$companyId];
    }

    public function forgetSettings(?string $companyId = null): void
    {
        if ($companyId) {
            unset($this->settingsCache[$companyId]);
        } else {
            $this->settingsCache = [];
        }
    }

    protected function isCashBasis(CompanyAccountingSettings $settings): bool
    {
        return $settings->accounting_method === 'cash' || $settings->sales_recognition_trigger === 'payment_received';
    }

    protected function money($value): float
    {
        return round((float) ($value ?? 0), 2);
    }

    /**
     * journal_entries.created_by is required; prefer the logged-in user, then
     * whoever created the document, then any user of the company.
     */
    protected function actingUserId(Model $source): string
    {
        $id = auth()->id()
            ?? ($source->created_by ?? null)
            ?? ($source->approved_by ?? null);

        if ($id) {
            return $id;
        }

        static $fallback = [];
        return $fallback[$source->company_id] ??= User::where('company_id', $source->company_id)->orderBy('created_at')->value('id');
    }
}
