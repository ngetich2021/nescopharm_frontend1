<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chart_of_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('parent_id')->nullable();
            $table->string('account_code', 20)->unique();
            $table->string('account_name', 255);
            $table->enum('account_type', ['asset', 'liability', 'equity', 'income', 'expense']);
            $table->enum('account_subtype', [
                'current_asset', 'fixed_asset', 'other_asset',
                'current_liability', 'long_term_liability', 'other_liability',
                'owner_equity', 'retained_earnings',
                'operating_income', 'other_income',
                'cost_of_goods_sold', 'operating_expense', 'other_expense'
            ]);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system_account')->default(false);
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->enum('normal_balance', ['debit', 'credit']);
            $table->string('tax_code', 10)->nullable();
            $table->integer('level')->default(1);
            $table->string('full_path', 500)->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            
            $table->index(['company_id', 'account_type']);
            $table->index(['company_id', 'is_active']);
            $table->index(['company_id', 'parent_id']);
            $table->unique(['company_id', 'account_code']);
        });

        // Add self-referencing foreign key after table creation
        Schema::table('chart_of_accounts', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('chart_of_accounts')->onDelete('set null');
        });

        DB::statement('
            CREATE TRIGGER update_chart_of_accounts_modtime
            BEFORE UPDATE ON chart_of_accounts
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('chart_of_accounts');
    }
};
