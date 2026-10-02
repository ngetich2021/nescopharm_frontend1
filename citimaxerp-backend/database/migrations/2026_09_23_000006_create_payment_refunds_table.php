<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Audit trail for money handed back out of a Payment's unapplied excess
     * (an invoice overpayment). A cheque refund stays "pending" - mirroring
     * every other cheque flow in this app - until ChequeController::approve()
     * clears it; every other method is real money and completes immediately.
     */
    public function up(): void
    {
        Schema::create('payment_refunds', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('payment_id');
            $table->uuid('company_id');
            $table->uuid('customer_id')->nullable();
            $table->uuid('cheque_id')->nullable();
            $table->decimal('amount', 10, 2);
            $table->date('refund_date');
            $table->string('refund_method', 30)->comment('bank_transfer, cash, mobile_money, cheque, other');
            $table->string('reference')->nullable();
            $table->text('reason');
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('completed')->comment('completed, pending, failed');
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('payment_id')->references('id')->on('payments')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('set null');
            $table->foreign('cheque_id')->references('id')->on('cheques')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');

            $table->index(['payment_id', 'status']);
        });

        DB::statement("ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_amount_check CHECK (amount > 0)");
        DB::statement("ALTER TABLE payment_refunds ADD CONSTRAINT payment_refunds_status_check CHECK (status IN ('completed','pending','failed'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_refunds');
    }
};
