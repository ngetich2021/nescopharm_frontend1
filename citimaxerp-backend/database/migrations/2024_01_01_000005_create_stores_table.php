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
        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('store_code', 50)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('manager_name', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->unique(['store_code', 'company_id'], 'stores_code_company_key');
            $table->foreign('company_id', 'stores_company_id_fkey')->references('id')->on('companies')->onDelete('cascade');

            $table->index('company_id', 'idx_stores_company_id');
            $table->index('name', 'idx_stores_name');
            $table->index('is_active', 'idx_stores_is_active');
        });

        DB::statement('
            CREATE TRIGGER update_stores_modtime
            BEFORE UPDATE ON stores
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_stores_modtime ON stores');
        Schema::dropIfExists('stores');
    }
};
