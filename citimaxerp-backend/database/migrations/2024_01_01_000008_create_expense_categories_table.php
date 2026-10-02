<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('expense_categories', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('color', 7)->default('#6B7280');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->unique(['name', 'company_id'], 'expense_categories_name_company_key');
            $table->foreign('company_id', 'expense_categories_company_id_fkey')->references('id')->on('companies');

            $table->index('company_id', 'idx_expense_categories_company_id');
        });

        DB::statement('
            CREATE TRIGGER update_expense_categories_modtime
            BEFORE UPDATE ON expense_categories
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_expense_categories_modtime ON expense_categories');
        Schema::dropIfExists('expense_categories');
    }
};
