<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('dashboard_widgets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('widget_type'); // 'sales_overview', 'revenue_chart', 'top_products', etc.
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('configuration')->nullable(); // Widget-specific configuration
            $table->string('size')->default('medium'); // 'small', 'medium', 'large', 'full'
            $table->integer('position_x')->default(0);
            $table->integer('position_y')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system_widget')->default(false); // System-provided vs custom
            $table->json('permissions')->nullable(); // Required permissions to view
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['company_id', 'is_active']);
            $table->index(['widget_type', 'company_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dashboard_widgets');
    }
};
