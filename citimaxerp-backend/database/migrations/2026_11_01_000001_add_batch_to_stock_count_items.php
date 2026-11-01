<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Stock counts are taken per batch: each line is one batch of a product (its expected quantity is
 * what the batch holds), and stock found that is in no batch the system knows is entered with its
 * batch number and expiry, so approving the count corrects - or creates - the right batch.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_count_items', function (Blueprint $table) {
            if (!Schema::hasColumn('stock_count_items', 'batch_id')) {
                $table->uuid('batch_id')->nullable()->after('variant_id');
                $table->foreign('batch_id')->references('id')->on('inventory_batches')->nullOnDelete();
            }
            if (!Schema::hasColumn('stock_count_items', 'batch_number')) {
                $table->string('batch_number', 100)->nullable()->after('batch_id');
            }
            if (!Schema::hasColumn('stock_count_items', 'expiry_date')) {
                $table->date('expiry_date')->nullable()->after('batch_number');
            }
            if (!Schema::hasColumn('stock_count_items', 'is_new_batch')) {
                // Entered during the count: stock found that was not on the list.
                $table->boolean('is_new_batch')->default(false)->after('expiry_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('stock_count_items', function (Blueprint $table) {
            if (Schema::hasColumn('stock_count_items', 'batch_id')) {
                $table->dropForeign(['batch_id']);
            }
            $table->dropColumn(array_values(array_filter(
                ['batch_id', 'batch_number', 'expiry_date', 'is_new_batch'],
                fn ($c) => Schema::hasColumn('stock_count_items', $c)
            )));
        });
    }
};
