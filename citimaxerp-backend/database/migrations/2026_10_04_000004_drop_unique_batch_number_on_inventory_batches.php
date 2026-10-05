<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // A supplier batch number covers many sizes/variants and can arrive across several receipts.
    public function up(): void
    {
        Schema::table('inventory_batches', function (Blueprint $table) {
            $table->dropUnique('inventory_batches_batch_number_unique');
            $table->index(['company_id', 'batch_number']);
        });
    }

    public function down(): void
    {
        Schema::table('inventory_batches', function (Blueprint $table) {
            $table->dropIndex(['company_id', 'batch_number']);
            $table->unique('batch_number');
        });
    }
};
