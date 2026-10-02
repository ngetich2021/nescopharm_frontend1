<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts_payable', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('vendor_id'); // Links to suppliers table
            $table->string('invoice_number', 100);
            $table->string('vendor_invoice_number', 100)->nullable();
            $table->date('invoice_date');
            $table->date('due_date');
            $table->decimal('total_amount', 15, 2);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('balance_amount', 15, 2);
            $table->enum('status', ['draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled'])->default('draft');
            $table->text('description')->nullable();
            $table->string('payment_terms', 100)->nullable();
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->string('currency', 3)->default('KES');
            $table->decimal('exchange_rate', 10, 4)->default(1);
            $table->uuid('purchase_order_id')->nullable();
            $table->uuid('created_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->jsonb('line_items')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('vendor_id')->references('id')->on('suppliers');
            $table->foreign('purchase_order_id')->references('id')->on('purchase_orders');
            $table->foreign('created_by')->references('id')->on('users');
            $table->foreign('approved_by')->references('id')->on('users');
            
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'due_date']);
            $table->index(['vendor_id']);
            $table->index(['invoice_date']);
            $table->unique(['company_id', 'invoice_number']);
        });

        DB::statement('
            CREATE TRIGGER update_accounts_payable_modtime
            BEFORE UPDATE ON accounts_payable
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts_payable');
    }
};
