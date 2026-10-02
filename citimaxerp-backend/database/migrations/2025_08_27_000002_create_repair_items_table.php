<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repair_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id'); // FK to companies (multi-tenant)
            $table->uuid('repair_id'); // FK to repairs
            $table->uuid('product_id'); // FK to products
            $table->uuid('product_variant')->nullable(); // FK to product_variants (if applicable)
            $table->string('unique_identifier')->nullable(); // serial number or custom ID, auto-generated if not provided
            $table->integer('quantity')->default(1);
            $table->boolean('is_repairable')->default(true);
            $table->boolean('repaired')->default(false);
            $table->string('status')->default('pending'); // pending, in_progress, repaired, completed
             $table->uuid('repaired_by')->nullable()->after('repaired');
            $table->timestamp('repaired_at')->nullable()->after('repaired_by');
            $table->text('repair_notes')->nullable()->after('repaired_at');
            $table->uuid('assigned_to')->nullable()->after('repair_notes');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('repair_id')->references('id')->on('repairs')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('product_variant')->references('id')->on('product_variants'); // Uncomment if product_variants table exists
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repair_items');
    }
};
