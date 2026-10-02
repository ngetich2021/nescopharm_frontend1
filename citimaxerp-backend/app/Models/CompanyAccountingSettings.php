<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Str;

/**
 * CompanyAccountingSettings
 * 
 * Stores company-specific accounting configuration.
 * This allows each company to define when and how transactions
 * should integrate with the accounting system.
 * 
 * @property string $id
 * @property string $company_id
 * @property string $accounting_method accrual|cash
 * @property string $sales_recognition_trigger
 * @property bool $auto_record_cash_sales
 * @property bool $credit_sales_on_invoice_send
 * @property string $purchase_recognition_trigger
 * @property string $expense_recognition_trigger
 * @property bool $auto_record_customer_payments
 * @property bool $auto_record_supplier_payments
 * @property bool $record_proforma_invoices
 * @property bool $record_draft_invoices
 * @property string $vat_recognition
 * @property string $cogs_recognition
 * @property bool $perpetual_inventory
 * @property bool $require_invoice_approval
 * @property bool $require_expense_approval
 * @property bool $require_journal_approval
 * @property float|null $expense_approval_threshold
 * @property bool $accounting_integration_enabled
 * @property bool $log_failed_entries
 * @property bool $soft_fail_on_accounting_error
 * @property int $financial_year_start_month
 * @property bool $lock_closed_periods
 * @property \Carbon\Carbon|null $current_period_end
 */
class CompanyAccountingSettings extends Model
{
    use HasUuids;

    protected $table = 'company_accounting_settings';

    protected $fillable = [
        'company_id',
        'accounting_method',
        'sales_recognition_trigger',
        'auto_record_cash_sales',
        'credit_sales_on_invoice_send',
        'purchase_recognition_trigger',
        'expense_recognition_trigger',
        'auto_record_customer_payments',
        'auto_record_supplier_payments',
        'record_proforma_invoices',
        'record_draft_invoices',
        'vat_recognition',
        'cogs_recognition',
        'perpetual_inventory',
        'require_invoice_approval',
        'require_expense_approval',
        'require_journal_approval',
        'expense_approval_threshold',
        'accounting_integration_enabled',
        'log_failed_entries',
        'soft_fail_on_accounting_error',
        'financial_year_start_month',
        'lock_closed_periods',
        'current_period_end',
    ];

    protected $casts = [
        'auto_record_cash_sales' => 'boolean',
        'credit_sales_on_invoice_send' => 'boolean',
        'auto_record_customer_payments' => 'boolean',
        'auto_record_supplier_payments' => 'boolean',
        'record_proforma_invoices' => 'boolean',
        'record_draft_invoices' => 'boolean',
        'perpetual_inventory' => 'boolean',
        'require_invoice_approval' => 'boolean',
        'require_expense_approval' => 'boolean',
        'require_journal_approval' => 'boolean',
        'expense_approval_threshold' => 'decimal:2',
        'accounting_integration_enabled' => 'boolean',
        'log_failed_entries' => 'boolean',
        'soft_fail_on_accounting_error' => 'boolean',
        'financial_year_start_month' => 'integer',
        'lock_closed_periods' => 'boolean',
        'current_period_end' => 'date',
    ];

    // =================================================================
    // CONSTANTS FOR TRIGGER OPTIONS
    // =================================================================

    // Sales Recognition Triggers
    const SALES_TRIGGER_ORDER_CREATED = 'order_created';
    const SALES_TRIGGER_ORDER_COMPLETED = 'order_completed';
    const SALES_TRIGGER_ORDER_DISPATCHED = 'order_dispatched';
    const SALES_TRIGGER_ORDER_DELIVERED = 'order_delivered';
    const SALES_TRIGGER_INVOICE_CREATED = 'invoice_created';
    const SALES_TRIGGER_INVOICE_SENT = 'invoice_sent';
    const SALES_TRIGGER_INVOICE_APPROVED = 'invoice_approved';
    const SALES_TRIGGER_PAYMENT_RECEIVED = 'payment_received';

    // Purchase Recognition Triggers
    const PURCHASE_TRIGGER_CREATED = 'purchase_created';
    const PURCHASE_TRIGGER_APPROVED = 'purchase_approved';
    const PURCHASE_TRIGGER_GOODS_RECEIVED = 'goods_received';
    const PURCHASE_TRIGGER_PAYMENT_MADE = 'payment_made';

    // Expense Recognition Triggers
    const EXPENSE_TRIGGER_CREATED = 'expense_created';
    const EXPENSE_TRIGGER_APPROVED = 'expense_approved';
    const EXPENSE_TRIGGER_PAID = 'expense_paid';

    // Accounting Methods
    const METHOD_ACCRUAL = 'accrual';
    const METHOD_CASH = 'cash';

    // COGS Recognition
    const COGS_ON_SALE = 'on_sale';
    const COGS_ON_DISPATCH = 'on_dispatch';
    const COGS_ON_DELIVERY = 'on_delivery';

    // VAT Recognition
    const VAT_ON_INVOICE = 'invoice_date';
    const VAT_ON_PAYMENT = 'payment_date';

    // Unified trigger options for API responses
    const TRIGGER_OPTIONS = [
        'sales_invoice_trigger' => [
            'order_created' => 'When Order is Created',
            'order_completed' => 'When Order is Completed',
            'order_dispatched' => 'When Order is Dispatched',
            'order_delivered' => 'When Order is Delivered (Dispatch Confirmed)',
            'invoice_created' => 'When Invoice is Created',
            'invoice_sent' => 'When Invoice is Sent (Recommended)',
            'invoice_approved' => 'When Invoice is Approved',
            'payment_received' => 'When Payment is Received (Cash Basis)',
            'manual' => 'Manual Only (No Automatic Entry)',
        ],
        'purchase_trigger' => [
            'purchase_created' => 'When Purchase Order is Created',
            'purchase_approved' => 'When Purchase Order is Approved',
            'goods_received' => 'When Goods are Received (Recommended)',
            'payment_made' => 'When Payment is Made (Cash Basis)',
            'manual' => 'Manual Only (No Automatic Entry)',
        ],
        'expense_trigger' => [
            'expense_created' => 'When Expense is Created',
            'expense_approved' => 'When Expense is Approved (Recommended)',
            'expense_paid' => 'When Expense is Paid (Cash Basis)',
            'manual' => 'Manual Only (No Automatic Entry)',
        ],
    ];

    // =================================================================
    // RELATIONSHIPS
    // =================================================================

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // =================================================================
    // COMPATIBILITY ACCESSORS
    // These provide a unified API for the workflow service
    // =================================================================

    /**
     * Get the sales invoice trigger setting
     */
    public function getSalesInvoiceTriggerAttribute(): string
    {
        return $this->sales_recognition_trigger;
    }

    /**
     * Get the purchase trigger setting
     */
    public function getPurchaseTriggerAttribute(): string
    {
        return $this->purchase_recognition_trigger;
    }

    /**
     * Get the expense trigger setting
     */
    public function getExpenseTriggerAttribute(): string
    {
        return $this->expense_recognition_trigger;
    }

    /**
     * Check if active
     */
    public function getIsActiveAttribute(): bool
    {
        return $this->accounting_integration_enabled;
    }

    /**
     * Check if auto post journals
     */
    public function getAutoPostJournalsAttribute(): bool
    {
        return !$this->require_journal_approval;
    }

    /**
     * Check if require approval
     */
    public function getRequireApprovalAttribute(): bool
    {
        return $this->require_journal_approval;
    }

    /**
     * Check if should record customer payments
     */
    public function getRecordCustomerPaymentsAttribute(): bool
    {
        return $this->auto_record_customer_payments;
    }

    /**
     * Check if should record supplier payments
     */
    public function getRecordSupplierPaymentsAttribute(): bool
    {
        return $this->auto_record_supplier_payments;
    }

    /**
     * Check if should record on invoice sent
     */
    public function shouldRecordOnInvoiceSent(): bool
    {
        return $this->shouldRecordSalesAt(self::SALES_TRIGGER_INVOICE_SENT);
    }

    /**
     * Check if should record on invoice created
     */
    public function shouldRecordOnInvoiceCreated(): bool
    {
        return $this->shouldRecordSalesAt(self::SALES_TRIGGER_INVOICE_CREATED);
    }

    /**
     * Check if should record on payment received
     */
    public function shouldRecordOnPayment(): bool
    {
        return $this->shouldRecordSalesAt(self::SALES_TRIGGER_PAYMENT_RECEIVED) 
            || $this->isCashBasis();
    }

    /**
     * Check if should record on order delivered (dispatch confirmed)
     */
    public function shouldRecordOnOrderDelivered(): bool
    {
        return $this->shouldRecordSalesAt(self::SALES_TRIGGER_ORDER_DELIVERED);
    }

    /**
     * Check if should record on order dispatched
     */
    public function shouldRecordOnOrderDispatched(): bool
    {
        return $this->shouldRecordSalesAt(self::SALES_TRIGGER_ORDER_DISPATCHED);
    }

    // =================================================================
    // STATIC METHODS
    // =================================================================

    /**
     * Get settings for a company, creating defaults if not exists
     */
    public static function getForCompany(string $companyId): self
    {
        $existing = static::where('company_id', $companyId)->first();
        
        if ($existing) {
            return $existing;
        }

        // Use raw insert for PostgreSQL boolean compatibility
        $defaults = static::getDefaultSettings();
        $id = \Illuminate\Support\Str::uuid()->toString();
        $now = now();

        \Illuminate\Support\Facades\DB::statement("
            INSERT INTO company_accounting_settings (
                id, company_id, accounting_method, sales_recognition_trigger,
                auto_record_cash_sales, credit_sales_on_invoice_send,
                purchase_recognition_trigger, expense_recognition_trigger,
                auto_record_customer_payments, auto_record_supplier_payments,
                record_proforma_invoices, record_draft_invoices,
                vat_recognition, cogs_recognition, perpetual_inventory,
                require_invoice_approval, require_expense_approval, require_journal_approval,
                expense_approval_threshold, accounting_integration_enabled,
                log_failed_entries, soft_fail_on_accounting_error,
                financial_year_start_month, lock_closed_periods, current_period_end,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?,
                true, true,
                ?, ?,
                true, true,
                false, false,
                ?, ?, true,
                false, true, false,
                ?, true,
                true, true,
                ?, true, ?,
                ?, ?
            )
        ", [
            $id, 
            $companyId, 
            $defaults['accounting_method'], 
            $defaults['sales_recognition_trigger'],
            $defaults['purchase_recognition_trigger'], 
            $defaults['expense_recognition_trigger'],
            $defaults['vat_recognition'], 
            $defaults['cogs_recognition'],
            $defaults['expense_approval_threshold'],
            $defaults['financial_year_start_month'],
            $defaults['current_period_end'],
            $now,
            $now
        ]);

        return static::find($id);
    }

    /**
     * Alias for getForCompany for compatibility
     */
    public static function getOrCreateDefaults(string $companyId): self
    {
        return static::getForCompany($companyId);
    }

    /**
     * Get default settings array
     */
    public static function getDefaultSettings(): array
    {
        return [
            'accounting_method' => self::METHOD_ACCRUAL,
            'sales_recognition_trigger' => self::SALES_TRIGGER_INVOICE_SENT,
            'auto_record_cash_sales' => true,
            'credit_sales_on_invoice_send' => true,
            'purchase_recognition_trigger' => self::PURCHASE_TRIGGER_GOODS_RECEIVED,
            'expense_recognition_trigger' => self::EXPENSE_TRIGGER_APPROVED,
            'auto_record_customer_payments' => true,
            'auto_record_supplier_payments' => true,
            'record_proforma_invoices' => false,
            'record_draft_invoices' => false,
            'vat_recognition' => self::VAT_ON_INVOICE,
            'cogs_recognition' => self::COGS_ON_DISPATCH,
            'perpetual_inventory' => true,
            'require_invoice_approval' => false,
            'require_expense_approval' => true,
            'require_journal_approval' => false,
            'expense_approval_threshold' => null,
            'accounting_integration_enabled' => true,
            'log_failed_entries' => true,
            'soft_fail_on_accounting_error' => true,
            'financial_year_start_month' => 1,
            'lock_closed_periods' => true,
            'current_period_end' => null,
        ];
    }

    /**
     * Override create to handle PostgreSQL boolean casting
     */
    public static function create(array $attributes = [])
    {
        // Convert boolean fields to actual booleans for PostgreSQL
        $booleanFields = [
            'auto_record_cash_sales',
            'credit_sales_on_invoice_send',
            'auto_record_customer_payments',
            'auto_record_supplier_payments',
            'record_proforma_invoices',
            'record_draft_invoices',
            'perpetual_inventory',
            'require_invoice_approval',
            'require_expense_approval',
            'require_journal_approval',
            'accounting_integration_enabled',
            'log_failed_entries',
            'soft_fail_on_accounting_error',
            'lock_closed_periods',
        ];

        foreach ($booleanFields as $field) {
            if (isset($attributes[$field])) {
                $attributes[$field] = (bool) $attributes[$field];
            }
        }

        return parent::create($attributes);
    }

    /**
     * Get available sales recognition trigger options
     */
    public static function getSalesRecognitionOptions(): array
    {
        return [
            self::SALES_TRIGGER_ORDER_CREATED => 'When Order is Created',
            self::SALES_TRIGGER_ORDER_COMPLETED => 'When Order is Completed',
            self::SALES_TRIGGER_ORDER_DISPATCHED => 'When Order is Dispatched',
            self::SALES_TRIGGER_ORDER_DELIVERED => 'When Order is Delivered (Dispatch Confirmed)',
            self::SALES_TRIGGER_INVOICE_CREATED => 'When Invoice is Created',
            self::SALES_TRIGGER_INVOICE_SENT => 'When Invoice is Sent (Recommended)',
            self::SALES_TRIGGER_INVOICE_APPROVED => 'When Invoice is Approved',
            self::SALES_TRIGGER_PAYMENT_RECEIVED => 'When Payment is Received (Cash Basis)',
        ];
    }

    /**
     * Get available purchase recognition trigger options
     */
    public static function getPurchaseRecognitionOptions(): array
    {
        return [
            self::PURCHASE_TRIGGER_CREATED => 'When Purchase Order is Created',
            self::PURCHASE_TRIGGER_APPROVED => 'When Purchase Order is Approved',
            self::PURCHASE_TRIGGER_GOODS_RECEIVED => 'When Goods are Received (Recommended)',
            self::PURCHASE_TRIGGER_PAYMENT_MADE => 'When Payment is Made (Cash Basis)',
        ];
    }

    /**
     * Get available expense recognition trigger options
     */
    public static function getExpenseRecognitionOptions(): array
    {
        return [
            self::EXPENSE_TRIGGER_CREATED => 'When Expense is Created',
            self::EXPENSE_TRIGGER_APPROVED => 'When Expense is Approved (Recommended)',
            self::EXPENSE_TRIGGER_PAID => 'When Expense is Paid (Cash Basis)',
        ];
    }

    // =================================================================
    // HELPER METHODS FOR CHECKING TRIGGERS
    // =================================================================

    /**
     * Check if sales should be recorded at the given trigger point
     */
    public function shouldRecordSalesAt(string $trigger): bool
    {
        if (!$this->accounting_integration_enabled) {
            return false;
        }

        return $this->sales_recognition_trigger === $trigger;
    }

    /**
     * Check if purchases should be recorded at the given trigger point
     */
    public function shouldRecordPurchaseAt(string $trigger): bool
    {
        if (!$this->accounting_integration_enabled) {
            return false;
        }

        return $this->purchase_recognition_trigger === $trigger;
    }

    /**
     * Check if expenses should be recorded at the given trigger point
     */
    public function shouldRecordExpenseAt(string $trigger): bool
    {
        if (!$this->accounting_integration_enabled) {
            return false;
        }

        return $this->expense_recognition_trigger === $trigger;
    }

    /**
     * Check if customer payments should be auto-recorded
     */
    public function shouldAutoRecordCustomerPayment(): bool
    {
        return $this->accounting_integration_enabled && $this->auto_record_customer_payments;
    }

    /**
     * Check if supplier payments should be auto-recorded
     */
    public function shouldAutoRecordSupplierPayment(): bool
    {
        return $this->accounting_integration_enabled && $this->auto_record_supplier_payments;
    }

    /**
     * Check if using cash basis accounting
     */
    public function isCashBasis(): bool
    {
        return $this->accounting_method === self::METHOD_CASH;
    }

    /**
     * Check if using accrual basis accounting
     */
    public function isAccrualBasis(): bool
    {
        return $this->accounting_method === self::METHOD_ACCRUAL;
    }

    /**
     * Check if a cash sale should be recorded immediately
     */
    public function shouldRecordCashSaleImmediately(): bool
    {
        return $this->accounting_integration_enabled && $this->auto_record_cash_sales;
    }

    /**
     * Check if expense needs approval before accounting entry
     */
    public function expenseNeedsApproval(float $amount): bool
    {
        if (!$this->require_expense_approval) {
            return false;
        }

        if ($this->expense_approval_threshold === null) {
            return true; // All expenses need approval
        }

        return $amount >= $this->expense_approval_threshold;
    }

    /**
     * Check if the given date is in a closed period
     */
    public function isInClosedPeriod(\Carbon\Carbon $date): bool
    {
        if (!$this->lock_closed_periods || $this->current_period_end === null) {
            return false;
        }

        return $date->lte($this->current_period_end);
    }
}
