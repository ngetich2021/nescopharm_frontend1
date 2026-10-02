<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('cheques', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->uuid('customer_id');
            $table->uuid('invoice_id')->nullable();
            $table->uuid('payment_id')->nullable()->comment('Set once the cheque is approved and a real Payment/allocation is created');
            $table->string('cheque_number', 100);
            $table->string('bank_name', 150);
            $table->decimal('amount', 12, 2);
            $table->date('issue_date');
            $table->date('maturity_date')->comment('Date the post-dated cheque matures/is expected to clear');
            $table->string('status', 20)->default('pending')->comment('pending, approved, bounced, cancelled');
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('customer_id')->references('id')->on('customers');
            $table->foreign('invoice_id')->references('id')->on('invoices')->onDelete('set null');
            $table->foreign('payment_id')->references('id')->on('payments')->onDelete('set null');

            $table->index(['company_id', 'status']);
            $table->index('maturity_date');
        });

        DB::statement("ALTER TABLE cheques ADD CONSTRAINT cheques_amount_check CHECK (amount > 0)");
        DB::statement("ALTER TABLE cheques ADD CONSTRAINT cheques_status_check CHECK (status IN ('pending','approved','bounced','cancelled'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('cheques');
    }
};
