<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts_receivable', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('customer_id');
            $table->string('invoice_number', 100);
            $table->date('invoice_date');
            $table->date('due_date');
            $table->decimal('total_amount', 15, 2);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('balance_amount', 15, 2);
            $table->enum('status', ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'])->default('draft');
            $table->text('description')->nullable();
            $table->string('payment_terms', 100)->nullable();
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->string('currency', 3)->default('KES');
            $table->decimal('exchange_rate', 10, 4)->default(1);
            $table->uuid('order_id')->nullable();
            $table->boolean('is_recurring')->default(false);
            $table->enum('recurring_frequency', ['weekly', 'monthly', 'quarterly', 'yearly'])->nullable();
            $table->date('next_recurring_date')->nullable();
            $table->uuid('created_by');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('viewed_at')->nullable();
            $table->jsonb('line_items')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers');
            $table->foreign('order_id')->references('id')->on('orders');
            $table->foreign('created_by')->references('id')->on('users');
            
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'due_date']);
            $table->index(['customer_id']);
            $table->index(['invoice_date']);
            $table->index(['is_recurring', 'next_recurring_date']);
            $table->unique(['company_id', 'invoice_number']);
        });

        DB::statement('
            CREATE TRIGGER update_accounts_receivable_modtime
            BEFORE UPDATE ON accounts_receivable
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts_receivable');
    }
};
