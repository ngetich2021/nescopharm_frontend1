<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_depreciation', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('fixed_asset_id');
            $table->uuid('company_id');
            $table->date('depreciation_date');
            $table->decimal('depreciation_amount', 15, 2);
            $table->decimal('accumulated_depreciation', 15, 2);
            $table->decimal('book_value', 15, 2);
            $table->string('depreciation_type');
            $table->text('notes')->nullable();
            $table->uuid('journal_entry_id')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
        });

        // Add foreign keys, indexes and unique constraint after table creation
        Schema::table('asset_depreciation', function (Blueprint $table) {
            $table->foreign('fixed_asset_id')->references('id')->on('fixed_assets')->onDelete('cascade');
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('journal_entry_id')->references('id')->on('journal_entries');
            
            $table->index(['fixed_asset_id', 'depreciation_date']);
            $table->index(['company_id', 'depreciation_date']);
            $table->unique(['fixed_asset_id', 'depreciation_date', 'depreciation_type']);
        });

        // Add check constraint for depreciation_type
        DB::statement("
            ALTER TABLE asset_depreciation
            ADD CONSTRAINT asset_depreciation_type_check
            CHECK (depreciation_type IN ('monthly', 'annual', 'adjustment'));
        ");

        DB::statement('
            CREATE TRIGGER update_asset_depreciation_modtime
            BEFORE UPDATE ON asset_depreciation
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_depreciation');
    }
};
