<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('order_dispatch_id');
            $table->string('note_number')->unique(); // Auto-generated DN-0001, etc.
            $table->string('status')->default('draft'); // draft, finalized, completed
            $table->json('items'); // Array of dispatch items with quantities
            $table->text('special_instructions')->nullable();
            $table->uuid('generated_by'); // System or user who generated
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('order_dispatch_id')->references('id')->on('order_dispatches')->cascadeOnDelete();
            $table->foreign('generated_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_notes');
    }
};
