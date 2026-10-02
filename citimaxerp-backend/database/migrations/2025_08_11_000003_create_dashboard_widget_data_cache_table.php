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
        Schema::create('dashboard_widget_data_cache', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('widget_id');
            $table->uuid('company_id');
            $table->json('cached_data');
            $table->timestamp('expires_at');
            $table->timestamp('last_generated_at');
            $table->timestamps();

            $table->foreign('widget_id')->references('id')->on('dashboard_widgets')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            
            $table->index(['widget_id', 'expires_at']);
            $table->index(['company_id', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dashboard_widget_data_cache');
    }
};
