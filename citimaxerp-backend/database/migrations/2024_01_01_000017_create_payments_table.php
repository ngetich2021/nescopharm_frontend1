<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('order_id');
            $table->uuid('invoice_id')->nullable();
            $table->string('payment_method', 50);
            $table->string('transaction_id', 100)->nullable();
            $table->decimal('amount_paid', 10, 2);
            $table->decimal('amount_applied', 10, 2)->nullable()->comment('Amount applied to invoice (for partial payments)');
            $table->string('status', 20)->default('pending');
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->date('payment_date')->nullable();
            $table->timestamp('applied_date')->nullable()->comment('When payment was applied to invoice');
            $table->uuid('customer_id')->nullable();
            $table->uuid('company_id')->nullable();
            $table->foreign('company_id', 'payments_company_id_fkey')->references('id')->on('companies');
            $table->foreign('customer_id', 'payments_customer_id_fkey')->references('id')->on('customers');
            $table->foreign('order_id', 'payments_order_id_fkey')->references('id')->on('orders')->onDelete('cascade');
            // invoice_id foreign key deferred to later migration (references invoices)
            
            $table->index(['invoice_id', 'status']);
        });

        // Add unique constraint on transaction_id after table creation
        Schema::table('payments', function (Blueprint $table) {
            $table->unique('transaction_id');
        });

        DB::statement('
            ALTER TABLE payments
            ADD CONSTRAINT payments_amount_paid_check
            CHECK (amount_paid >= 0);
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_paid_check');
        Schema::dropIfExists('payments');
    }
};
