<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // DigiTax sale identifier (returned on submit)
            $table->string('etims_sale_id')->nullable()->after('metadata');

            // High-level status: draft (uncommitted), locked_pending, submitted, completed, failed, voided_with_cn, response_invalid
            $table->string('etims_status', 32)->nullable()->after('etims_sale_id');

            // KRA-issued artifacts (returned via webhook on completion)
            $table->text('etims_signature')->nullable()->after('etims_status');
            $table->string('etims_qr_url')->nullable()->after('etims_signature');
            $table->string('etims_trader_invoice_number')->nullable()->after('etims_qr_url');

            // Submission timestamps
            $table->timestamp('etims_submitted_at')->nullable()->after('etims_trader_invoice_number');
            $table->timestamp('etims_synced_at')->nullable()->after('etims_submitted_at');

            // Last error text for retry UX
            $table->text('etims_last_error')->nullable()->after('etims_synced_at');

            // Idempotency: UUID we send to DigiTax to allow safe retry + webhook-before-response resolution
            $table->uuid('etims_client_request_id')->nullable()->after('etims_last_error');

            // Concurrency lock for "locked_pending" state
            $table->string('etims_lock_state', 32)->nullable()->after('etims_client_request_id');
            $table->timestamp('etims_lock_acquired_at')->nullable()->after('etims_lock_state');

            $table->index(['company_id', 'etims_status'], 'invoices_etims_status_idx');
            $table->index(['etims_lock_state', 'etims_lock_acquired_at'], 'invoices_etims_lock_idx');
            $table->unique(['company_id', 'etims_client_request_id'], 'invoices_etims_client_req_unique');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_etims_client_req_unique');
            $table->dropIndex('invoices_etims_lock_idx');
            $table->dropIndex('invoices_etims_status_idx');
            $table->dropColumn([
                'etims_sale_id',
                'etims_status',
                'etims_signature',
                'etims_qr_url',
                'etims_trader_invoice_number',
                'etims_submitted_at',
                'etims_synced_at',
                'etims_last_error',
                'etims_client_request_id',
                'etims_lock_state',
                'etims_lock_acquired_at',
            ]);
        });
    }
};
