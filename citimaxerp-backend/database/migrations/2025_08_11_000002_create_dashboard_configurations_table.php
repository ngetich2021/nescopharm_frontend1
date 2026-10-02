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
        Schema::create('dashboard_configurations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('company_id');
            $table->string('dashboard_name')->default('Default Dashboard');
            $table->json('layout_configuration'); // Widget positions, sizes, visibility
            $table->json('global_filters')->nullable(); // Date ranges, company filters, etc.
            $table->string('refresh_interval')->default('5m'); // Auto-refresh interval
            $table->string('theme')->default('light'); // 'light', 'dark', 'auto'
            $table->boolean('is_default')->default(false);
            $table->boolean('is_shared')->default(false); // Can be shared with other users
            $table->json('shared_with')->nullable(); // User IDs this dashboard is shared with
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            
            $table->index(['user_id', 'is_default']);
            $table->index(['company_id', 'is_shared']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dashboard_configurations');
    }
};
