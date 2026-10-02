<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up()
    {
        Schema::create('dispatch_items', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('dispatch_id');
            $table->uuid('product_id');
            $table->uuid('variant_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->integer('quantity');
            $table->decimal('unit_quantity', 15, 4)->nullable();
            $table->integer('base_quantity')->nullable();
            $table->jsonb('packaging_breakdown')->nullable();
            $table->integer('received_quantity')->default(0);
            $table->boolean('is_returnable')->default(false);
            $table->boolean('is_returned')->default(false);
            $table->date('return_date')->nullable();
            $table->integer('returned_quantity')->nullable();
            $table->text('return_notes')->nullable();
            $table->json('reminder_status')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // Add foreign keys and indexes after table creation
        Schema::table('dispatch_items', function (Blueprint $table) {
            $table->foreign('dispatch_id')->references('id')->on('dispatches')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products');
            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('set null');
            $table->foreign('unit_id')->references('id')->on('product_packaging_units')->onDelete('set null');
            $table->index('unit_id', 'idx_dispatch_items_unit_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('dispatch_items');
    }
};
