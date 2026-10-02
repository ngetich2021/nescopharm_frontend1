<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('breakage_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('breakage_id');
            $table->boolean('replacement_requested')->default(false);
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->integer('quantity');
            $table->string('cause')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('company_id');
            $table->string('image_path')->nullable();
            $table->timestamp('replaced_at')->nullable();
            $table->uuid('replaced_by')->nullable();
            $table->timestamps();

            $table->foreign('breakage_id')->references('id')->on('breakages')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('variant_id')->references('id')->on('product_variants');
            $table->foreign('company_id')->references('id')->on('companies');
            $table->foreign('replaced_by')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('breakage_items');
    }
};
