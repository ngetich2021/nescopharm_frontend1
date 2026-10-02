<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('entry_number', 50);
            $table->date('entry_date');
            $table->string('reference', 100)->nullable();
            $table->text('description');
            $table->decimal('total_debit', 15, 2)->default(0);
            $table->decimal('total_credit', 15, 2)->default(0);
            $table->enum('status', ['draft', 'posted', 'reversed'])->default('draft');
            $table->enum('entry_type', ['manual', 'automatic', 'recurring', 'adjusting', 'closing']);
            $table->uuid('source_id')->nullable();
            $table->string('source_type', 100)->nullable();
            $table->uuid('created_by');
            $table->uuid('posted_by')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->uuid('reversed_by')->nullable();
            $table->timestamp('reversed_at')->nullable();
            $table->text('reversal_reason')->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users');
            $table->foreign('posted_by')->references('id')->on('users');
            $table->foreign('reversed_by')->references('id')->on('users');
            
            $table->index(['company_id', 'entry_date']);
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'entry_type']);
            $table->index(['source_id', 'source_type']);
            $table->unique(['company_id', 'entry_number']);
        });

        DB::statement('
            CREATE TRIGGER update_journal_entries_modtime
            BEFORE UPDATE ON journal_entries
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_entries');
    }
};
