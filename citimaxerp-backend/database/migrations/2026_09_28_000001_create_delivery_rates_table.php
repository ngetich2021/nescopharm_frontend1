<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('transporter_name'); // FedEx, DHL, etc.
            $table->enum('zone', ['nairobi', 'upcountry']); // Nairobi or Upcountry
            $table->decimal('rate_per_carton', 10, 2); // Rate per carton/unit
            $table->text('description')->nullable();
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->uuid('created_by'); // Who created this rate
            $table->uuid('approved_by')->nullable(); // Who approved/rejected
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();

            $table->unique(['company_id', 'transporter_name', 'zone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_rates');
    }
};
