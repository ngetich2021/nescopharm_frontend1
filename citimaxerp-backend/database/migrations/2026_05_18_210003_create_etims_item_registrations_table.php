<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('etims_item_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->uuid('product_id');

            // KRA item identification
            $table->string('item_code')->nullable();
            $table->string('item_class_code', 16)->nullable();
            $table->string('item_type_code', 4)->nullable(); // 1=raw 2=finished 3=service
            $table->string('packaging_unit_code', 16)->nullable();
            $table->string('quantity_unit_code', 16)->nullable();
            $table->string('country_of_origin_code', 4)->nullable();
            $table->string('tax_type_code', 1)->nullable(); // A/B/C/D/E

            // Sync state: pending, synced, failed
            $table->string('sync_status', 16)->default('pending');
            $table->uuid('client_request_id')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);

            $table->timestamps();

            $table->index(['company_id', 'product_id', 'sync_status'], 'etims_items_lookup_idx');
            $table->unique(['company_id', 'product_id'], 'etims_items_one_per_product');
            $table->unique(['company_id', 'client_request_id'], 'etims_items_idempotency');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etims_item_registrations');
    }
};
