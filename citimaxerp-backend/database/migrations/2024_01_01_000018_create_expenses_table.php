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
        Schema::create('expenses', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->uuid('store_id')->nullable();
            $table->uuid('category_id');
            $table->string('vendor_name', 255);
            $table->text('description');
            $table->decimal('amount', 10, 2);
            $table->date('expense_date');
            $table->string('payment_method', 50);
            $table->text('receipt_url')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_recurring')->default(false);
            $table->string('recurring_frequency', 20)->nullable();
            $table->jsonb('tags')->nullable();
            $table->string('status', 20)->default('pending');
            $table->uuid('created_by');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->foreign('category_id', 'expenses_category_id_fkey')->references('id')->on('expense_categories')->onDelete('restrict');
            $table->foreign('company_id', 'expenses_company_id_fkey')->references('id')->on('companies');
            $table->foreign('store_id', 'expenses_store_id_fkey')->references('id')->on('stores')->onDelete('set null');
            $table->foreign('created_by', 'expenses_created_by_fkey')->references('id')->on('users');
            $table->foreign('approved_by', 'expenses_approved_by_fkey')->references('id')->on('users')->onDelete('set null');

            $table->index('company_id', 'idx_expenses_company_id');
            $table->index('store_id', 'idx_expenses_store_id');
            $table->index('category_id', 'idx_expenses_category_id');
            $table->index('expense_date', 'idx_expenses_expense_date');
            $table->index('status', 'idx_expenses_status');
            $table->index('created_by', 'idx_expenses_created_by');
            $table->index('tags', 'idx_expenses_tags')->using('gin');
        });

        DB::statement('
            ALTER TABLE expenses
            ADD CONSTRAINT expenses_payment_method_check
            CHECK (payment_method IN (\'cash\', \'card\', \'bank_transfer\', \'check\', \'other\'));
        ');

        DB::statement('
            ALTER TABLE expenses
            ADD CONSTRAINT expenses_reciving_frequency_check
            CHECK (recurring_frequency IN (\'weekly\', \'monthly\', \'quarterly\', \'yearly\') OR recurring_frequency IS NULL);
        ');

        DB::statement('
            ALTER TABLE expenses
            ADD CONSTRAINT expenses_status_check
            CHECK (status IN (\'pending\', \'approved\', \'rejected\', \'paid\'));
        ');

        DB::statement('
            ALTER TABLE expenses
            ADD CONSTRAINT expenses_amount_positive
            CHECK (amount > 0);
        ');

        DB::statement('
            CREATE TRIGGER update_expenses_modtime
            BEFORE UPDATE ON expenses
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check');
        DB::statement('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_reciving_frequency_check');
        DB::statement('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check');
        DB::statement('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_positive');
        DB::statement('DROP TRIGGER IF EXISTS update_expenses_modtime ON expenses');
        Schema::dropIfExists('expenses');
    }
};
