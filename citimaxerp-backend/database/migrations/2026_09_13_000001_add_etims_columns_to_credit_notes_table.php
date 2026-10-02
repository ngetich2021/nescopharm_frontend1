<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('credit_notes', function (Blueprint $table) {
            $table->boolean('etims_requested')->default(true);
            $table->string('etims_sale_id')->nullable();
            $table->string('etims_status', 32)->nullable();
            $table->text('etims_signature')->nullable();
            $table->text('etims_qr_url')->nullable();
            $table->string('etims_trader_invoice_number')->nullable();
            $table->timestamp('etims_submitted_at')->nullable();
            $table->timestamp('etims_synced_at')->nullable();
            $table->text('etims_last_error')->nullable();
            $table->uuid('etims_client_request_id')->nullable();
            $table->string('etims_lock_state', 32)->nullable();
            $table->timestamp('etims_lock_acquired_at')->nullable();
            $table->string('etims_receipt_number')->nullable();
            $table->string('etims_serial_number')->nullable();
            $table->string('etims_invoice_number')->nullable();
            $table->string('etims_receipt_date')->nullable();
            $table->string('etims_receipt_time')->nullable();
            $table->text('etims_internal_data')->nullable();

            $table->index(['company_id', 'etims_status'], 'credit_notes_etims_status_idx');
            $table->index(['etims_lock_state', 'etims_lock_acquired_at'], 'credit_notes_etims_lock_idx');
            $table->unique(['company_id', 'etims_client_request_id'], 'credit_notes_etims_client_req_unique');
        });
    }

    public function down(): void
    {
        Schema::table('credit_notes', function (Blueprint $table) {
            $table->dropUnique('credit_notes_etims_client_req_unique');
            $table->dropIndex('credit_notes_etims_lock_idx');
            $table->dropIndex('credit_notes_etims_status_idx');
            $table->dropColumn([
                'etims_requested', 'etims_sale_id', 'etims_status', 'etims_signature',
                'etims_qr_url', 'etims_trader_invoice_number', 'etims_submitted_at',
                'etims_synced_at', 'etims_last_error', 'etims_client_request_id',
                'etims_lock_state', 'etims_lock_acquired_at', 'etims_receipt_number',
                'etims_serial_number', 'etims_invoice_number', 'etims_receipt_date',
                'etims_receipt_time', 'etims_internal_data',
            ]);
        });
    }
};
