<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('dispatch_items', function (Blueprint $table) {
            $table->uuid('batch_id')->nullable()->after('variant_id');
            $table->foreign('batch_id')->references('id')->on('inventory_batches')->onDelete('set null');
            $table->index('batch_id', 'idx_dispatch_items_batch_id');
        });
    }

    public function down()
    {
        Schema::table('dispatch_items', function (Blueprint $table) {
            $table->dropForeign(['batch_id']);
            $table->dropIndex('idx_dispatch_items_batch_id');
            $table->dropColumn('batch_id');
        });
    }
};
