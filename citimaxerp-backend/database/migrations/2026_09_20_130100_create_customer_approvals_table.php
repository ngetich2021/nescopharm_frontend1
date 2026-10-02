<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two-stage approval log for rep-created customers, mirroring
 * customer_account_approvals - but scoped to Customer directly, since Stage 1
 * happens before any CustomerAccount exists (the account is auto-created ON
 * Stage 1 approval, not before).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_approvals', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('customer_id');
            $table->string('approval_type'); // 'stage1' | 'stage2'
            $table->string('status')->default('pending'); // pending|approved|rejected
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('company_id')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('customers')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('set null');
            $table->index(['customer_id', 'approval_type']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_approvals');
    }
};
