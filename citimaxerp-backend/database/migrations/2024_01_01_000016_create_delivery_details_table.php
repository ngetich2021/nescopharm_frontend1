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
        Schema::create('delivery_details', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('customer_id');
            $table->uuid('order_id');
            $table->uuid('delivery_location_id')->nullable();
            $table->string('delivery_method', 50);
            $table->string('tracking_number', 100)->nullable();
            $table->date('estimated_delivery_date')->nullable();
            $table->date('actual_delivery_date')->nullable();
            $table->string('delivery_status', 50);
            $table->text('delivery_instructions')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->uuid('company_id')->nullable();
            $table->foreign('company_id', 'delivery_details_company_id_fkey')->references('id')->on('companies');
            $table->foreign('customer_id', 'fk_customer')->references('id')->on('customers')->onDelete('cascade');
            $table->foreign('delivery_location_id', 'fk_delivery_location')->references('id')->on('delivery_locations')->onDelete('set null');
            $table->foreign('order_id', 'fk_order')->references('id')->on('orders')->onDelete('cascade');

            $table->index('customer_id', 'idx_delivery_details_customer_id');
            $table->index('delivery_location_id', 'idx_delivery_details_delivery_location_id');
            $table->index('delivery_status', 'idx_delivery_details_delivery_status');
            $table->index('order_id', 'idx_delivery_details_order_id');
        });

        DB::statement('
            CREATE TRIGGER update_delivery_details_modtime
            BEFORE UPDATE ON delivery_details
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_delivery_details_modtime ON delivery_details');
        Schema::dropIfExists('delivery_details');
    }
};
