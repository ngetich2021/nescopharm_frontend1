<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Monthly Depreciation Journal (NESCOPHARM_AFRICA_LIMITED_-_Monthly_Depreciation_Journal.xlsx, 27/11/2026):
// - depreciation_runs: one posted journal per month (DEP/YYYY/MM) - the workbook's Posting Log - with
//   the class summary and asset-level calculation as posted, who prepared / reviewed it, and its
//   reversal when a month is corrected (reverse the whole journal, then post again)
// - assets.disposal_date: the workbook's "Disposal Date (input)"; the charge stops in that month
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('depreciation_runs')) {
            Schema::create('depreciation_runs', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->index();
                $table->date('period_end');
                $table->date('posting_date');
                $table->string('reference', 30);
                $table->string('narration', 255);
                $table->string('status', 20)->default('posted'); // posted | reversed
                $table->decimal('total_charge', 15, 2)->default(0);
                $table->json('classes')->nullable();
                $table->json('assets')->nullable();
                $table->uuid('journal_entry_id')->nullable();
                $table->uuid('created_by')->nullable();
                $table->string('prepared_by_name', 120)->nullable();
                $table->string('reviewed_by_name', 120)->nullable();
                $table->timestamp('posted_at')->nullable();
                $table->uuid('reversed_by')->nullable();
                $table->timestamp('reversed_at')->nullable();
                $table->string('reversal_reason', 255)->nullable();
                $table->timestamps();
            });
            // One posted journal per company per month (the duplicate check, enforced by the database).
            DB::statement("CREATE UNIQUE INDEX depreciation_runs_one_posted_per_month ON depreciation_runs (company_id, period_end) WHERE status = 'posted'");
        }

        if (!Schema::hasColumn('assets', 'disposal_date')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->date('disposal_date')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('depreciation_runs');
        if (Schema::hasColumn('assets', 'disposal_date')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->dropColumn('disposal_date');
            });
        }
    }
};
