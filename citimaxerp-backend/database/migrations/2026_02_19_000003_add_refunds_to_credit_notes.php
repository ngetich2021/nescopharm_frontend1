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
        Schema::table('credit_notes', function (Blueprint $table) {
            $table->decimal('amount_refunded', 15, 2)->default(0)->after('amount_applied');
            $table->timestamp('refunded_at')->nullable()->after('applied_at');
        });

        Schema::create('credit_note_refunds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('credit_note_id');
            $table->uuid('company_id');
            $table->uuid('customer_id')->nullable();
            $table->uuid('invoice_id')->nullable();
            $table->uuid('created_by');

            $table->decimal('amount', 15, 2);
            $table->date('refund_date');
            $table->string('refund_method')->nullable();
            $table->string('reference')->nullable();
            $table->string('reason');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('credit_note_id')->references('id')->on('credit_notes')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('set null');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');

            $table->index(['company_id', 'customer_id']);
            $table->index(['credit_note_id', 'refund_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credit_note_refunds');

        Schema::table('credit_notes', function (Blueprint $table) {
            $table->dropColumn(['amount_refunded', 'refunded_at']);
        });
    }
};
