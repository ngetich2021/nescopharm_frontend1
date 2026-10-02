<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Append-only audit trail of every outbound eTIMS call.
        // Request/response bodies are envelope-encrypted via the service layer
        // because they can contain customer PII and KRA-PIN-bearing payloads.
        Schema::create('etims_submission_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');

            // What this log entry is about
            $table->string('operation', 48); // 'sale.submit', 'item.register', 'stock.add', 'credit_note.submit', 'verify_receipt'
            $table->string('subject_type', 32)->nullable(); // 'invoice' | 'product' | 'supplier_bill'
            $table->string('subject_id')->nullable();
            $table->uuid('client_request_id')->nullable();

            // Envelope-encrypted bodies (NULL-able while we get the system online)
            $table->text('request_body_encrypted')->nullable();
            $table->text('response_body_encrypted')->nullable();

            // Quick filterable fields
            $table->string('endpoint')->nullable();
            $table->string('http_method', 8)->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->string('result_status', 24); // 'ok', 'failed', 'timeout', 'invalid_response'
            $table->unsignedInteger('latency_ms')->nullable();
            $table->string('actor_user_id')->nullable();

            // Hash of normalized request body for dedup analytics (NOT for security)
            $table->string('request_hash', 64)->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'operation', 'created_at'], 'etims_logs_lookup_idx');
            $table->index(['subject_type', 'subject_id'], 'etims_logs_subject_idx');
            $table->index(['client_request_id'], 'etims_logs_client_req_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etims_submission_logs');
    }
};
