<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Idempotency + replay-protection ledger for inbound DigiTax webhooks.
        // Per plan we'd partition by month in production. For the initial cut we
        // use a unique (company_id, event_id) constraint with a 7-day uniqueness
        // window enforced at the application layer.
        Schema::create('etims_webhook_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->string('event_id');            // DigiTax-supplied unique event identifier
            $table->string('event_type', 48);      // 'item.sync' | 'sale.sync' | 'credit_note.sync' | 'verify.result'
            $table->string('subject_type', 32)->nullable();
            $table->string('subject_id')->nullable();
            $table->uuid('client_request_id')->nullable();
            $table->string('processing_status', 24)->default('received'); // received, processed, failed, ignored
            $table->text('last_error')->nullable();
            $table->json('payload')->nullable();   // raw payload for forensic replay
            $table->timestamp('received_at')->useCurrent();
            $table->timestamp('processed_at')->nullable();

            $table->unique(['company_id', 'event_id'], 'etims_webhook_event_uniq');
            $table->index(['company_id', 'event_type', 'processing_status'], 'etims_webhook_lookup_idx');
            $table->index(['client_request_id'], 'etims_webhook_clientreq_idx');
            $table->index('received_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etims_webhook_events');
    }
};
