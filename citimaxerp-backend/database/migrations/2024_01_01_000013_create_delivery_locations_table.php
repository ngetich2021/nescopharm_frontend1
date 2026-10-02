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
        Schema::create('delivery_locations', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('customer_id');
            $table->string('house_number', 20);
            $table->string('estate', 255)->nullable();
            $table->string('city', 100);
            $table->string('street', 100)->nullable();
            $table->string('country', 100);
            $table->boolean('is_default')->nullable()->default(false);
            $table->text('location_note')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->string('landmark')->nullable();
            $table->uuid('company_id')->nullable();
            $table->foreign('company_id', 'delivery_locations_company_id_fkey')->references('id')->on('companies');
            $table->foreign('customer_id', 'fk_customer')->references('id')->on('customers')->onDelete('cascade');

            $table->index('customer_id', 'idx_delivery_locations_customer_id');
            $table->index('is_default', 'idx_delivery_locations_is_default');
        });

        DB::statement('
            CREATE TRIGGER update_delivery_locations_modtime
            BEFORE UPDATE ON delivery_locations
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_delivery_locations_modtime ON delivery_locations');
        Schema::dropIfExists('delivery_locations');
    }
};
