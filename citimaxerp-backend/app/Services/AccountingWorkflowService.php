<?php

namespace App\Services;

use App\Models\CompanyAccountingSettings;
use App\Models\Invoice;
use App\Models\Expense;
use App\Models\PurchaseOrder;
use App\Models\CustomerPayment;
use App\Models\SupplierPayment;
use Illuminate\Support\Facades\Log;

/**
 * AccountingWorkflowService
 * 
 * This service handles the business logic for determining WHEN accounting
 * entries should be created based on company-specific settings.
 * 
 * Different companies have different accounting workflows:
 * - Some create A/R entries when invoice is created
 * - Some create A/R entries when invoice is sent
 * - Some create A/R entries only when payment is received (cash basis)
 * - Some require approval before posting journal entries
 * 
 * This service centralizes that decision-making logic.
 */
class AccountingWorkflowService
{
    protected $accountingService;
    protected $settings;
    protected $companyId;
    protected $userId;

    public function __construct(AccountingIntegrationService $accountingService)
    {
        $this->accountingService = $accountingService;
    }

    /**
     * Initialize the service for a specific company
     */
    public function forCompany(string $companyId): self
    {
        $this->companyId = $companyId;
        $this->settings = CompanyAccountingSettings::getOrCreateDefaults($companyId);
        $this->accountingService->setCompany($companyId);
        return $this;
    }

    /**
     * Set the user making the transaction
     */
    public function asUser(string $userId): self
    {
        $this->userId = $userId;
        $this->accountingService->setUser($userId);
        return $this;
    }

    /**
     * Get the current company's accounting settings
     */
    public function getSettings(): ?CompanyAccountingSettings
    {
        return $this->settings;
    }

    // ========================================
    // SALES INVOICE TRIGGERS
    // ========================================

    /**
     * Handle accounting when an invoice is CREATED (but not yet sent)
     * 
     * @param Invoice $invoice
     * @return array|null Journal entry result or null if not triggered
     */
    public function onInvoiceCreated(Invoice $invoice): ?array
    {
        if (!$this->settings) {
            Log::warning('AccountingWorkflow: No settings found for company', ['company_id' => $this->companyId]);
            return null;
        }

        // Check if company wants accounting entries on invoice creation
        if (!$this->settings->shouldRecordOnInvoiceCreated()) {
            Log::info('AccountingWorkflow: Skipping invoice creation trigger', [
                'invoice_id' => $invoice->id,
                'setting' => $this->settings->sales_invoice_trigger
            ]);
            return null;
        }

        return $this->recordSalesInvoice($invoice, 'created');
    }

    /**
     * Handle accounting when an invoice is SENT to customer
     * 
     * @param Invoice $invoice
     * @return array|null Journal entry result or null if not triggered
     */
    public function onInvoiceSent(Invoice $invoice): ?array
    {
        if (!$this->settings) {
            return null;
        }

        // Check if company wants accounting entries on invoice sent
        if (!$this->settings->shouldRecordOnInvoiceSent()) {
            Log::info('AccountingWorkflow: Skipping invoice sent trigger', [
                'invoice_id' => $invoice->id,
                'setting' => $this->settings->sales_invoice_trigger
            ]);
            return null;
        }

        return $this->recordSalesInvoice($invoice, 'sent');
    }

    /**
     * Handle accounting when an order is COMPLETED (before invoicing)
     * 
     * @param $order The completed order
     * @return array|null Journal entry result or null if not triggered
     */
    public function onOrderCompleted($order): ?array
    {
        if (!$this->settings) {
            return null;
        }

        // Check if company wants accounting entries on order completion
        if ($this->settings->sales_invoice_trigger !== 'order_completed') {
            Log::info('AccountingWorkflow: Skipping order completed trigger', [
                'order_id' => $order->id ?? 'unknown',
                'setting' => $this->settings->sales_invoice_trigger
            ]);
            return null;
        }

        return $this->recordOrderSale($order, 'completed');
    }

    /**
     * Handle accounting when an order is DISPATCHED
     * 
     * @param $order The dispatched order
     * @return array|null Journal entry result or null if not triggered
     */
    public function onOrderDispatched($order): ?array
    {
        if (!$this->settings) {
            return null;
        }

        // Check if company wants accounting entries on order dispatch
        if (!$this->settings->shouldRecordOnOrderDispatched()) {
            Log::info('AccountingWorkflow: Skipping order dispatched trigger', [
                'order_id' => $order->id ?? 'unknown',
                'setting' => $this->settings->sales_invoice_trigger
            ]);
            return null;
        }

        return $this->recordOrderSale($order, 'dispatched');
    }

    /**
     * Handle accounting when an order is DELIVERED (dispatch confirmed)
     * 
     * @param $order The delivered order
     * @param $dispatch The dispatch record with delivery confirmation
     * @return array|null Journal entry result or null if not triggered
     */
    public function onOrderDelivered($order, $dispatch = null): ?array
    {
        if (!$this->settings) {
            return null;
        }

        // Check if company wants accounting entries on delivery confirmation
        if (!$this->settings->shouldRecordOnOrderDelivered()) {
            Log::info('AccountingWorkflow: Skipping order delivered trigger', [
                'order_id' => $order->id ?? 'unknown',
                'dispatch_id' => $dispatch->id ?? 'unknown',
                'setting' => $this->settings->sales_invoice_trigger
            ]);
            return null;
        }

        Log::info('AccountingWorkflow: Recording sale on delivery confirmation', [
            'order_id' => $order->id ?? 'unknown',
            'dispatch_id' => $dispatch->id ?? 'unknown'
        ]);

        return $this->recordOrderSale($order, 'delivered');
    }

    // ========================================
    // PAYMENT TRIGGERS
    // ========================================

    /**
     * Handle accounting when a CUSTOMER PAYMENT is received
     * 
     * @param Invoice $invoice The invoice being paid
     * @param float $amount Payment amount
     * @param string $paymentMethod Payment method used
     * @param string|null $reference Payment reference
     * @return array|null Journal entry result
     */
    public function onCustomerPaymentReceived(
        Invoice $invoice,
        float $amount,
        string $paymentMethod,
        ?string $reference = null
    ): ?array {
        if (!$this->settings) {
            return null;
        }

        $results = [];

        // If company uses cash basis or payment-triggered A/R
        if ($this->settings->shouldRecordOnPayment()) {
            // Record the sales entry now (revenue recognition at payment time)
            $salesResult = $this->recordCashSale($invoice, $amount, $paymentMethod);
            if ($salesResult) {
                $results['sales'] = $salesResult;
            }
        } else {
            // Company uses accrual - A/R was already recorded
            // Now record the payment clearing A/R
            $paymentResult = $this->accountingService->recordCustomerPayment(
                $invoice->customer_id ?? $invoice->account_id,
                $amount,
                $paymentMethod,
                $reference ?? "Payment for Invoice #{$invoice->invoice_number}"
            );
            if ($paymentResult) {
                $results['payment'] = $paymentResult;
            }
        }

        return !empty($results) ? $results : null;
    }

    /**
     * Handle accounting when a SUPPLIER PAYMENT is made
     * 
     * @param string $supplierId Supplier ID
     * @param float $amount Payment amount
     * @param string $paymentMethod Payment method used
     * @param string|null $reference Payment reference
     * @return array|null Journal entry result
     */
    public function onSupplierPaymentMade(
        string $supplierId,
        float $amount,
        string $paymentMethod,
        ?string $reference = null
    ): ?array {
        if (!$this->settings) {
            return null;
        }

        // Check if company wants automatic payment recording
        if (!$this->settings->record_supplier_payments) {
            Log::info('AccountingWorkflow: Skipping supplier payment (disabled)', [
                'supplier_id' => $supplierId
            ]);
            return null;
        }

        return $this->accountingService->recordSupplierPayment(
            $supplierId,
            $amount,
            $paymentMethod,
            $reference ?? "Supplier Payment"
        );
    }

    // ========================================
    // PURCHASE / EXPENSE TRIGGERS
    // ========================================

    /**
     * Handle accounting when a PURCHASE is made on credit
     * 
     * @param string $supplierId Supplier ID
     * @param float $amount Purchase amount
     * @param string $description Purchase description
     * @param string|null $expenseAccountKey Optional specific expense account
     * @return array|null Journal entry result
     */
    public function onPurchaseMade(
        string $supplierId,
        float $amount,
        string $description,
        ?string $expenseAccountKey = null
    ): ?array {
        if (!$this->settings) {
            return null;
        }

        // Check purchase trigger settings
        $trigger = $this->settings->purchase_trigger;
        
        // For now, handle on_bill_received trigger
        // Other triggers can be implemented as needed
        if ($trigger === 'manual') {
            Log::info('AccountingWorkflow: Skipping purchase (manual trigger)', [
                'supplier_id' => $supplierId
            ]);
            return null;
        }

        return $this->accountingService->recordPurchaseOnCredit(
            $supplierId,
            $amount,
            $description,
            $expenseAccountKey
        );
    }

    /**
     * Handle accounting when an EXPENSE is recorded
     * 
     * @param float $amount Expense amount
     * @param string $paymentMethod Payment method
     * @param string $description Expense description
     * @param string|null $category Expense category (for account selection)
     * @return array|null Journal entry result
     */
    public function onExpenseRecorded(
        float $amount,
        string $paymentMethod,
        string $description,
        ?string $category = null
    ): ?array {
        if (!$this->settings) {
            return null;
        }

        // Check expense trigger settings
        if ($this->settings->expense_trigger === 'manual') {
            Log::info('AccountingWorkflow: Skipping expense (manual trigger)', [
                'amount' => $amount
            ]);
            return null;
        }

        return $this->accountingService->recordExpense(
            $amount,
            $paymentMethod,
            $description,
            $category
        );
    }

    // ========================================
    // MANUAL TRIGGERS
    // ========================================

    /**
     * Manually trigger accounting entry for an invoice
     * Used when company settings are 'manual'
     * 
     * @param Invoice $invoice
     * @return array|null
     */
    public function manualRecordInvoice(Invoice $invoice): ?array
    {
        return $this->recordSalesInvoice($invoice, 'manual');
    }

    /**
     * Manually trigger accounting entry for an expense
     * 
     * @param Expense $expense
     * @return array|null
     */
    public function manualRecordExpense(Expense $expense): ?array
    {
        return $this->accountingService->recordExpense(
            $expense->amount,
            $expense->payment_method ?? 'cash',
            $expense->description ?? 'Manual expense entry',
            $expense->category ?? null
        );
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    /**
     * Record a sales invoice based on type (credit vs cash)
     */
    protected function recordSalesInvoice(Invoice $invoice, string $trigger): ?array
    {
        $amount = $invoice->total ?? $invoice->grand_total ?? 0;
        
        if ($amount <= 0) {
            Log::warning('AccountingWorkflow: Invoice has zero or negative amount', [
                'invoice_id' => $invoice->id,
                'amount' => $amount
            ]);
            return null;
        }

        // Determine if this is a credit or cash sale
        $paymentTerms = $invoice->payment_terms ?? 'credit';
        
        if ($paymentTerms === 'cash' || $paymentTerms === 'immediate') {
            // Cash sale - direct to bank/cash
            return $this->accountingService->recordCashSale(
                $amount,
                $invoice->payment_method ?? 'cash',
                "Cash sale - Invoice #{$invoice->invoice_number}"
            );
        } else {
            // Credit sale - goes to A/R
            $customerId = $invoice->customer_id ?? $invoice->account_id;
            return $this->accountingService->recordSalesInvoice(
                $customerId,
                $amount,
                "Sales Invoice #{$invoice->invoice_number}"
            );
        }
    }

    /**
     * Record a cash sale
     */
    protected function recordCashSale(Invoice $invoice, float $amount, string $paymentMethod): ?array
    {
        return $this->accountingService->recordCashSale(
            $amount,
            $paymentMethod,
            "Cash sale - Invoice #{$invoice->invoice_number}"
        );
    }

    /**
     * Record a sale from an order (for dispatch/delivery triggers)
     */
    protected function recordOrderSale($order, string $trigger): ?array
    {
        $amount = $order->total ?? $order->grand_total ?? $order->total_amount ?? 0;
        
        if ($amount <= 0) {
            Log::warning('AccountingWorkflow: Order has zero or negative amount', [
                'order_id' => $order->id ?? 'unknown',
                'amount' => $amount
            ]);
            return null;
        }

        $customerId = $order->customer_id ?? $order->account_id ?? null;
        $orderNumber = $order->order_number ?? $order->id ?? 'unknown';
        
        // Check if order has associated invoice for payment terms
        $paymentTerms = $order->payment_terms ?? 'credit';
        
        if ($paymentTerms === 'cash' || $paymentTerms === 'immediate' || $paymentTerms === 'cod') {
            // Cash on delivery or immediate payment
            return $this->accountingService->recordCashSale(
                $amount,
                $order->payment_method ?? 'cash',
                "Sale on {$trigger} - Order #{$orderNumber}"
            );
        } else {
            // Credit sale - goes to A/R
            return $this->accountingService->recordSalesInvoice(
                $customerId,
                $amount,
                "Sale on {$trigger} - Order #{$orderNumber}"
            );
        }
    }

    // ========================================
    // STATUS CHECKS
    // ========================================

    /**
     * Check if accounting is enabled for this company
     */
    public function isAccountingEnabled(): bool
    {
        return $this->settings && $this->settings->is_active;
    }

    /**
     * Check if company uses accrual accounting
     */
    public function isAccrualBasis(): bool
    {
        return $this->settings && $this->settings->isAccrualBasis();
    }

    /**
     * Check if company uses cash basis accounting
     */
    public function isCashBasis(): bool
    {
        return $this->settings && $this->settings->isCashBasis();
    }

    /**
     * Check if journals should be auto-posted
     */
    public function shouldAutoPost(): bool
    {
        return $this->settings && $this->settings->auto_post_journals;
    }

    /**
     * Check if journals require approval
     */
    public function requiresApproval(): bool
    {
        return $this->settings && $this->settings->require_approval;
    }

    /**
     * Get the sales invoice trigger setting
     */
    public function getSalesInvoiceTrigger(): ?string
    {
        return $this->settings ? $this->settings->sales_invoice_trigger : null;
    }

    /**
     * Get the purchase trigger setting
     */
    public function getPurchaseTrigger(): ?string
    {
        return $this->settings ? $this->settings->purchase_trigger : null;
    }

    /**
     * Get the expense trigger setting
     */
    public function getExpenseTrigger(): ?string
    {
        return $this->settings ? $this->settings->expense_trigger : null;
    }
}
