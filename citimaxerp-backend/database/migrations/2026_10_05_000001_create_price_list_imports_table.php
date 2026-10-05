<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_list_imports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('list_name', 20);
            $table->unsignedInteger('version');
            $table->string('file_name')->nullable();
            $table->unsignedInteger('rows_count')->default(0);
            $table->unsignedInteger('products_created')->default(0);
            $table->unsignedInteger('products_matched')->default(0);
            $table->unsignedInteger('prices_added')->default(0);
            $table->unsignedInteger('prices_updated')->default(0);
            $table->unsignedInteger('errors_count')->default(0);
            $table->uuid('uploaded_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('uploaded_by')->references('id')->on('users')->onDelete('set null');
            $table->index(['company_id', 'list_name', 'created_at']);
            $table->unique(['company_id', 'list_name', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_list_imports');
    }
};
