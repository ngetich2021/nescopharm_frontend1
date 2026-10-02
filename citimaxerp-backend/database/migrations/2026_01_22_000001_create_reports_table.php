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
        Schema::create('reports', function (Blueprint $blueprint) {
            $blueprint->uuid('id')->primary();
            $blueprint->uuid('company_id');
            $blueprint->string('name');
            $blueprint->string('type');
            $blueprint->string('module');
            $blueprint->json('filters')->nullable();
            $blueprint->string('status')->default('active');
            $blueprint->timestamp('last_generated_at')->nullable();
            $blueprint->uuid('created_by')->nullable();
            $blueprint->timestamps();

            $blueprint->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $blueprint->foreign('created_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
