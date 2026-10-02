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
        Schema::create('logistics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_dispatch_id')->index();
            $table->uuid('company_id')->index();
            $table->uuid('delivery_person_id')->nullable()->index();
            $table->string('driver_name')->nullable();
            $table->string('driver_contact')->nullable();
            $table->string('vehicle_registration')->nullable();
            $table->string('vehicle_type')->nullable();

            // Restored fields from original model intention
            $table->string('logistics_provider')->nullable();
            $table->string('delivery_method')->nullable();
            $table->string('vehicle_id')->nullable();
            $table->string('tracking_number')->nullable();
            $table->string('delivery_status')->default('pending');
            $table->string('recipient_name')->nullable();
            $table->string('recipient_phone')->nullable();
            $table->string('delivery_address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->nullable();
            $table->dateTime('dispatch_time')->nullable();
            $table->dateTime('actual_delivery_time')->nullable();
            $table->text('signature')->nullable();

            $table->dateTime('estimated_delivery_time')->nullable();
            $table->string('pickup_location')->nullable();
            $table->string('delivery_location')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('pending');
            $table->timestamps();

            // Foreign keys
            $table->foreign('order_dispatch_id')->references('id')->on('order_dispatches')->onDelete('cascade');
            $table->foreign('delivery_person_id')->references('id')->on('delivery_persons')->onDelete('set null');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('logistics');
    }
};
