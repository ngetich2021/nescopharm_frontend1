<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The Fixed Asset Register (24/11/2026): each asset has an ID and tag, a person it is assigned to,
// where it came from, and straight-line depreciation, so every item can be accounted for.
return new class extends Migration
{
    private const COLUMNS = [
        'asset_code', 'tag_number', 'assigned_to', 'supplier', 'invoice_number', 'purchase_date', 'date_basis',
        'total_cost', 'depreciation_method', 'depreciation_rate', 'useful_life_years', 'residual_percent',
        'depreciation_start_date', 'status', 'original_category',
    ];

    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $add = fn (string $c) => !Schema::hasColumn('assets', $c);
            if ($add('asset_code')) $table->string('asset_code', 30)->nullable();           // CMP-001
            if ($add('tag_number')) $table->string('tag_number', 30)->nullable();           // TAG-001
            if ($add('assigned_to')) $table->string('assigned_to')->nullable();             // the person answerable for it
            if ($add('supplier')) $table->string('supplier')->nullable();
            if ($add('invoice_number')) $table->string('invoice_number')->nullable();
            if ($add('purchase_date')) $table->date('purchase_date')->nullable();
            if ($add('date_basis')) $table->string('date_basis', 60)->nullable();           // Per register / Assumed / Corrected
            if ($add('total_cost')) $table->decimal('total_cost', 15, 2)->nullable();       // line cost; purchase_cost = per piece
            if ($add('depreciation_method')) $table->string('depreciation_method', 30)->default('straight_line');
            if ($add('depreciation_rate')) $table->decimal('depreciation_rate', 8, 4)->nullable(); // % a year
            if ($add('useful_life_years')) $table->decimal('useful_life_years', 5, 2)->nullable();
            if ($add('residual_percent')) $table->decimal('residual_percent', 6, 2)->default(0);
            if ($add('depreciation_start_date')) $table->date('depreciation_start_date')->nullable();
            if ($add('status')) $table->string('status', 30)->default('In Use');
            if ($add('original_category')) $table->string('original_category')->nullable();
        });
        Schema::table('assets', function (Blueprint $table) {
            $table->index(['company_id', 'asset_code']);
            $table->index(['company_id', 'assigned_to']);
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'asset_code']);
            $table->dropIndex(['company_id', 'assigned_to']);
            foreach (self::COLUMNS as $c) {
                if (Schema::hasColumn('assets', $c)) {
                    $table->dropColumn($c);
                }
            }
        });
    }
};
