<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This table stores company-specific accounting configuration settings.
     * It allows each company to define when and how transactions should
     * integrate with the accounting system.
     */
    public function up(): void
    {
        Schema::create('company_accounting_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->unique();
            
            // =================================================================
            // ACCOUNTING METHOD
            // =================================================================
            // 'accrual' - Record revenue when earned (invoice sent), expenses when incurred
            // 'cash' - Record revenue when payment received, expenses when paid
            $table->string('accounting_method')->default('accrual');
            
            // =================================================================
            // SALES/INVOICE TRIGGERS
            // =================================================================
            // When should a sales transaction create an accounting entry?
            // Options: 'order_created', 'order_completed', 'order_dispatched',
            //          'invoice_created', 'invoice_sent', 'invoice_approved', 'payment_received'
            $table->string('sales_recognition_trigger')->default('invoice_sent');
            
            // Should cash sales (POS) create immediate accounting entries?
            $table->boolean('auto_record_cash_sales')->default(true);
            
            // Should credit sales wait for invoice to be sent?
            $table->boolean('credit_sales_on_invoice_send')->default(true);
            
            // =================================================================
            // PURCHASE/EXPENSE TRIGGERS
            // =================================================================
            // When should purchases create accounting entries?
            // Options: 'purchase_created', 'purchase_approved', 'goods_received', 'payment_made'
            $table->string('purchase_recognition_trigger')->default('goods_received');
            
            // When should expenses create accounting entries?
            // Options: 'expense_created', 'expense_approved', 'expense_paid'
            $table->string('expense_recognition_trigger')->default('expense_approved');
            
            // =================================================================
            // PAYMENT SETTINGS
            // =================================================================
            // Automatically create journal entries when payments are recorded
            $table->boolean('auto_record_customer_payments')->default(true);
            $table->boolean('auto_record_supplier_payments')->default(true);
            
            // =================================================================
            // INVOICE TYPE SETTINGS
            // =================================================================
            // How to handle different invoice types
            $table->boolean('record_proforma_invoices')->default(false); // Usually no accounting entry
            $table->boolean('record_draft_invoices')->default(false); // Usually wait until sent
            
            // =================================================================
            // VAT/TAX SETTINGS
            // =================================================================
            // When to recognize VAT liability
            // 'invoice_date' - VAT due when invoice is issued
            // 'payment_date' - VAT due when payment is received (cash accounting for VAT)
            $table->string('vat_recognition')->default('invoice_date');
            
            // =================================================================
            // INVENTORY SETTINGS
            // =================================================================
            // When to record cost of goods sold
            // 'on_sale' - COGS recorded when sale is made
            // 'on_dispatch' - COGS recorded when goods are dispatched
            // 'on_delivery' - COGS recorded when delivery is confirmed
            $table->string('cogs_recognition')->default('on_dispatch');
            
            // Use perpetual inventory (update inventory with each transaction)
            // vs periodic inventory (update at period end)
            $table->boolean('perpetual_inventory')->default(true);
            
            // =================================================================
            // APPROVAL WORKFLOWS
            // =================================================================
            // Require approval before accounting entries are created
            $table->boolean('require_invoice_approval')->default(false);
            $table->boolean('require_expense_approval')->default(true);
            $table->boolean('require_journal_approval')->default(false);
            
            // Minimum amount that requires approval
            $table->decimal('expense_approval_threshold', 15, 2)->nullable();
            
            // =================================================================
            // AUTOMATION FLAGS
            // =================================================================
            // Master switch - if false, no automatic accounting entries
            $table->boolean('accounting_integration_enabled')->default(true);
            
            // Log failed accounting entries for manual review
            $table->boolean('log_failed_entries')->default(true);
            
            // Allow transactions to proceed even if accounting entry fails
            $table->boolean('soft_fail_on_accounting_error')->default(true);
            
            // =================================================================
            // PERIOD SETTINGS
            // =================================================================
            // Financial year start (month, 1-12)
            $table->integer('financial_year_start_month')->default(1); // January
            
            // Lock past periods from new entries
            $table->boolean('lock_closed_periods')->default(true);
            
            // Current accounting period end date (null = not locked)
            $table->date('current_period_end')->nullable();
            
            $table->timestamps();
            
            $table->foreign('company_id')
                  ->references('id')
                  ->on('companies')
                  ->onDelete('cascade');
        });
        
        // Create an index for faster lookups
        Schema::table('company_accounting_settings', function (Blueprint $table) {
            $table->index('accounting_method');
            $table->index('sales_recognition_trigger');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_accounting_settings');
    }
};
