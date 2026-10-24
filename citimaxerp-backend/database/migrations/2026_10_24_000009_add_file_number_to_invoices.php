<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Filing: the number a printed invoice is filed under (1, 2, 4 ...), kept per customer's folder.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (!Schema::hasColumn('invoices', 'file_number')) {
                $table->string('file_number', 50)->nullable()->index();
                $table->timestamp('filed_at')->nullable();
                $table->uuid('filed_by')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['file_number', 'filed_at', 'filed_by']);
        });
    }
};
