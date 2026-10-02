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
        Schema::create('sops', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('sop_number')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('year')->nullable();
            $table->string('status')->default('active'); // draft|active|archived
            $table->uuid('assigned_updater_id')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('review_date')->nullable();
            $table->string('document_path')->nullable();
            $table->string('original_file_name')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->json('metadata')->nullable();
            $table->uuid('created_by');
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('assigned_updater_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');

            $table->index(['company_id', 'year']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'assigned_updater_id']);
            $table->unique(['company_id', 'sop_number', 'year']);
        });

        Schema::create('sop_annexures', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sop_id');
            $table->uuid('company_id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('update_frequency')->default('daily'); // daily|weekly|monthly|quarterly|yearly|ad_hoc
            $table->json('columns_definition')->nullable(); // dynamic table columns config
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->uuid('created_by');
            $table->timestamps();

            $table->foreign('sop_id')->references('id')->on('sops')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');

            $table->index(['company_id', 'sop_id']);
            $table->index(['company_id', 'is_active']);
        });

        Schema::create('sop_annexure_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sop_annexure_id');
            $table->uuid('sop_id');
            $table->uuid('company_id');
            $table->date('entry_date');
            $table->json('data_payload');
            $table->json('metadata')->nullable();
            $table->uuid('updated_by');
            $table->timestamps();

            $table->foreign('sop_annexure_id')->references('id')->on('sop_annexures')->onDelete('cascade');
            $table->foreign('sop_id')->references('id')->on('sops')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('restrict');

            $table->index(['company_id', 'sop_id', 'entry_date']);
            $table->index(['company_id', 'sop_annexure_id', 'entry_date']);
            $table->unique(['sop_annexure_id', 'entry_date']);
        });

        Schema::create('sop_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sop_id');
            $table->uuid('sop_annexure_id')->nullable();
            $table->uuid('sop_annexure_entry_id')->nullable();
            $table->uuid('company_id');
            $table->uuid('commented_by');
            $table->string('comment_type')->default('guidance'); // guidance|capa|general
            $table->text('comment');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('sop_id')->references('id')->on('sops')->onDelete('cascade');
            $table->foreign('sop_annexure_id')->references('id')->on('sop_annexures')->onDelete('set null');
            $table->foreign('sop_annexure_entry_id')->references('id')->on('sop_annexure_entries')->onDelete('set null');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('commented_by')->references('id')->on('users')->onDelete('restrict');

            $table->index(['company_id', 'sop_id', 'created_at']);
            $table->index(['company_id', 'commented_by', 'created_at']);
            $table->index(['comment_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sop_comments');
        Schema::dropIfExists('sop_annexure_entries');
        Schema::dropIfExists('sop_annexures');
        Schema::dropIfExists('sops');
    }
};
