<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('credit_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('credit_note_number')->unique();
            $table->uuid('company_id');
            $table->uuid('customer_id')->nullable();
            $table->uuid('invoice_id'); // required: credit note must be linked to an invoice
            $table->uuid('created_by');

            // Status: draft → issued → applied | void
            $table->string('status')->default('draft');

            $table->date('credit_note_date');
            $table->date('expiry_date')->nullable();
            $table->text('reason')->nullable(); // reason for issuing the credit note

            // Financial totals
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('amount_applied', 15, 2)->default(0); // how much has been applied to invoices
            $table->decimal('balance_amount', 15, 2)->default(0); // remaining credit

            $table->string('currency', 3)->default('KES');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();

            $table->timestamp('issued_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamp('voided_at')->nullable();

            $table->timestamps();

            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('set null');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('restrict');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');

            // Indexes
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'customer_id']);
            $table->index(['company_id', 'invoice_id']);
            $table->index(['invoice_id']);
            $table->index(['status']);
            $table->index(['credit_note_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credit_notes');
    }
};
