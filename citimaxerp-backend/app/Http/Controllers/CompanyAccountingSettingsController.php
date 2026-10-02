<?php

namespace App\Http\Controllers;

use App\Models\CompanyAccountingSettings;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CompanyAccountingSettingsController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }

    /**
     * Get accounting settings for the authenticated user's company
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user->company_id) {
            return response()->json(['message' => 'User is not associated with a company'], 400);
        }

        $settings = CompanyAccountingSettings::getForCompany($user->company_id);
        
        return response()->json([
            'status' => 'success',
            'message' => 'Accounting settings retrieved successfully',
            'data' => $settings,
            'options' => [
                'sales_recognition_triggers' => CompanyAccountingSettings::getSalesRecognitionOptions(),
                'purchase_recognition_triggers' => CompanyAccountingSettings::getPurchaseRecognitionOptions(),
                'expense_recognition_triggers' => CompanyAccountingSettings::getExpenseRecognitionOptions(),
                'accounting_methods' => [
                    CompanyAccountingSettings::METHOD_ACCRUAL => 'Accrual Basis (Record when earned/incurred)',
                    CompanyAccountingSettings::METHOD_CASH => 'Cash Basis (Record when paid/received)',
                ],
                'vat_recognition_options' => [
                    CompanyAccountingSettings::VAT_ON_INVOICE => 'When Invoice is Issued',
                    CompanyAccountingSettings::VAT_ON_PAYMENT => 'When Payment is Received',
                ],
                'cogs_recognition_options' => [
                    CompanyAccountingSettings::COGS_ON_SALE => 'When Sale is Made',
                    CompanyAccountingSettings::COGS_ON_DISPATCH => 'When Goods are Dispatched',
                    CompanyAccountingSettings::COGS_ON_DELIVERY => 'When Delivery is Confirmed',
                ],
            ],
        ]);
    }

    /**
     * Update accounting settings for the authenticated user's company
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user->company_id) {
            return response()->json(['message' => 'User is not associated with a company'], 400);
        }

        // Check if user has permission to update company settings
        $role = $user->role;
        if (!$role || (!$role->hasPermission('can_manage_company') && !$role->hasPermission('can_manage_system'))) {
            return response()->json(['message' => 'Unauthorized to update accounting settings'], 403);
        }

        $validator = Validator::make($request->all(), [
            'accounting_method' => 'sometimes|in:accrual,cash',
            'sales_recognition_trigger' => 'sometimes|in:order_created,order_completed,order_dispatched,order_delivered,invoice_created,invoice_sent,invoice_approved,payment_received',
            'auto_record_cash_sales' => 'sometimes|boolean',
            'credit_sales_on_invoice_send' => 'sometimes|boolean',
            'purchase_recognition_trigger' => 'sometimes|in:purchase_created,purchase_approved,goods_received,payment_made',
            'expense_recognition_trigger' => 'sometimes|in:expense_created,expense_approved,expense_paid',
            'auto_record_customer_payments' => 'sometimes|boolean',
            'auto_record_supplier_payments' => 'sometimes|boolean',
            'record_proforma_invoices' => 'sometimes|boolean',
            'record_draft_invoices' => 'sometimes|boolean',
            'vat_recognition' => 'sometimes|in:invoice_date,payment_date',
            'cogs_recognition' => 'sometimes|in:on_sale,on_dispatch,on_delivery',
            'perpetual_inventory' => 'sometimes|boolean',
            'require_invoice_approval' => 'sometimes|boolean',
            'require_expense_approval' => 'sometimes|boolean',
            'require_journal_approval' => 'sometimes|boolean',
            'expense_approval_threshold' => 'nullable|numeric|min:0',
            'accounting_integration_enabled' => 'sometimes|boolean',
            'log_failed_entries' => 'sometimes|boolean',
            'soft_fail_on_accounting_error' => 'sometimes|boolean',
            'financial_year_start_month' => 'sometimes|integer|min:1|max:12',
            'lock_closed_periods' => 'sometimes|boolean',
            'current_period_end' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors(), 'errors' => $validator->errors()], 422);
        }

        try {
            $settings = CompanyAccountingSettings::getForCompany($user->company_id);
            $settings->update($request->only([
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
            ]));

            Log::info('Company accounting settings updated', [
                'company_id' => $user->company_id,
                'user_id' => $user->id,
                'changes' => $request->all(),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Accounting settings updated successfully',
                'data' => $settings->fresh(),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update accounting settings', [
                'company_id' => $user->company_id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to update settings', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Reset settings to defaults
     */
    public function reset(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user->company_id) {
            return response()->json(['message' => 'User is not associated with a company'], 400);
        }

        // Check if user has permission
        $role = $user->role;
        if (!$role || (!$role->hasPermission('can_manage_company') && !$role->hasPermission('can_manage_system'))) {
            return response()->json(['message' => 'Unauthorized to reset accounting settings'], 403);
        }

        try {
            $settings = CompanyAccountingSettings::getForCompany($user->company_id);
            $settings->update(CompanyAccountingSettings::getDefaultSettings());

            Log::info('Company accounting settings reset to defaults', [
                'company_id' => $user->company_id,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'Settings reset to defaults',
                'data' => $settings->fresh(),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to reset accounting settings', [
                'company_id' => $user->company_id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Failed to reset settings', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Get a summary of current settings in plain language
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user->company_id) {
            return response()->json(['message' => 'User is not associated with a company'], 400);
        }

        $settings = CompanyAccountingSettings::getForCompany($user->company_id);
        
        $summary = [];
        
        // Accounting Method
        $summary[] = $settings->isAccrualBasis() 
            ? "📊 Using **Accrual Basis** accounting - Revenue and expenses are recorded when earned/incurred, not when cash changes hands."
            : "💵 Using **Cash Basis** accounting - Revenue and expenses are recorded only when payment is received/made.";
        
        // Sales Recognition
        $salesTriggers = CompanyAccountingSettings::getSalesRecognitionOptions();
        $summary[] = "🧾 **Sales** are recorded to accounting " . strtolower($salesTriggers[$settings->sales_recognition_trigger] ?? $settings->sales_recognition_trigger);
        
        // Cash Sales
        if ($settings->auto_record_cash_sales) {
            $summary[] = "💳 **Cash sales** (POS) are recorded immediately when payment is received";
        }
        
        // Purchases
        $purchaseTriggers = CompanyAccountingSettings::getPurchaseRecognitionOptions();
        $summary[] = "📦 **Purchases** are recorded to accounting " . strtolower($purchaseTriggers[$settings->purchase_recognition_trigger] ?? $settings->purchase_recognition_trigger);
        
        // Expenses
        $expenseTriggers = CompanyAccountingSettings::getExpenseRecognitionOptions();
        $summary[] = "💸 **Expenses** are recorded to accounting " . strtolower($expenseTriggers[$settings->expense_recognition_trigger] ?? $settings->expense_recognition_trigger);
        
        // Payments
        if ($settings->auto_record_customer_payments) {
            $summary[] = "✅ Customer payments automatically create accounting entries";
        }
        if ($settings->auto_record_supplier_payments) {
            $summary[] = "✅ Supplier payments automatically create accounting entries";
        }
        
        // Approvals
        if ($settings->require_expense_approval) {
            if ($settings->expense_approval_threshold) {
                $summary[] = "⚠️ Expenses over KES " . number_format($settings->expense_approval_threshold) . " require approval";
            } else {
                $summary[] = "⚠️ All expenses require approval before accounting entry";
            }
        }
        
        // Integration Status
        if (!$settings->accounting_integration_enabled) {
            array_unshift($summary, "🔴 **Accounting integration is DISABLED** - No automatic journal entries will be created");
        } else {
            array_unshift($summary, "🟢 **Accounting integration is ENABLED**");
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Settings summary retrieved successfully',
            'enabled' => $settings->accounting_integration_enabled,
            'method' => $settings->accounting_method,
            'summary' => $summary,
        ]);
    }
}
