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
        Schema::create('credit_note_line_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('credit_note_id');
            $table->uuid('product_id')->nullable();
            $table->uuid('variant_id')->nullable();

            $table->string('description');
            $table->decimal('quantity', 10, 2);
            $table->string('unit')->default('pcs');
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);

            $table->json('metadata')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('credit_note_id')->references('id')->on('credit_notes')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('set null');

            // Indexes
            $table->index(['credit_note_id']);
            $table->index(['product_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('credit_note_line_items');
    }
};
