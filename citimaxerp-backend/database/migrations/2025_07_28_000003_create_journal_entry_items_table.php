<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_entry_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('journal_entry_id');
            $table->uuid('account_id');
            $table->uuid('company_id');
            $table->text('description')->nullable();
            $table->decimal('debit_amount', 15, 2)->default(0);
            $table->decimal('credit_amount', 15, 2)->default(0);
            $table->uuid('contact_id')->nullable();
            $table->string('contact_type', 50)->nullable(); // 'customer', 'supplier', 'employee'
            $table->string('reference', 100)->nullable();
            $table->jsonb('metadata')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('journal_entry_id')->references('id')->on('journal_entries')->onDelete('cascade');
            $table->foreign('account_id')->references('id')->on('chart_of_accounts');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            
            $table->index(['journal_entry_id']);
            $table->index(['account_id']);
            $table->index(['company_id']);
            $table->index(['contact_id', 'contact_type']);
        });

        DB::statement('
            CREATE TRIGGER update_journal_entry_items_modtime
            BEFORE UPDATE ON journal_entry_items
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_entry_items');
    }
};
