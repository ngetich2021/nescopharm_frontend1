<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('company_etims_configs', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id');

            // Tenant identity at KRA / DigiTax
            $table->string('kra_pin')->nullable();          // P\d{9}[A-Z]
            $table->string('branch_id')->default('00');

            // Envelope-encrypted DigiTax X-API-Key
            //   data_key_encrypted = KEK-encrypted DEK (the wrapped key)
            //   api_key_ciphertext = DEK-encrypted plaintext API key (AES-256-GCM)
            //   api_key_iv         = GCM IV
            //   api_key_tag        = GCM auth tag
            $table->text('data_key_encrypted')->nullable();
            $table->text('api_key_ciphertext')->nullable();
            $table->string('api_key_iv')->nullable();
            $table->string('api_key_tag')->nullable();

            // Environment - immutable once `live_first_submission_at` is set
            $table->string('environment')->default('test');     // 'test' | 'live'
            $table->timestamp('live_first_submission_at')->nullable();

            // Webhook - opaque token (NOT company_id) to prevent enumeration
            $table->string('webhook_token', 64)->unique()->nullable();
            $table->text('callback_secret_encrypted')->nullable();
            $table->text('callback_secret_previous_encrypted')->nullable();
            $table->timestamp('callback_secret_previous_expires_at')->nullable();

            // Lifecycle
            $table->date('go_live_date')->nullable();
            $table->boolean('enabled')->default(false);

            // Re-onboarding flow (KRA PIN immutability)
            $table->timestamp('superseded_at')->nullable();
            $table->string('superseded_by_config_id')->nullable();

            // Health
            $table->timestamp('last_sync_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('last_test_connection_at')->nullable();
            $table->string('last_test_connection_result')->nullable(); // 'success' | 'failure'

            $table->timestamps();

            // One eTIMS config per company (re-onboarding creates a new row + supersedes old)
            $table->index(['company_id', 'superseded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_etims_configs');
    }
};
