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
        Schema::create('delivery_persons', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('full_name', 100);
            $table->date('date_of_birth');
            $table->string('national_id_passport', 50);
            $table->string('phone_number', 20);
            $table->string('email', 100);
            $table->text('residential_address');
            $table->string('emergency_contact_name', 100);
            $table->string('emergency_contact_phone', 20);
            $table->text('work_experience')->nullable();
            $table->boolean('criminal_background_check')->nullable();
            $table->text('bank_mobile_money_details');
            $table->string('tax_id', 50)->nullable();
            $table->string('vehicle_type', 50)->nullable();
            $table->string('vehicle_registration', 20)->nullable();
            $table->string('drivers_license_number', 50)->nullable();
            $table->string('insurance_policy_number', 50)->nullable();
            $table->string('availability_status', 20);
            // Store location as separate lat/lng columns instead of PostGIS geography type
            $table->decimal('current_latitude', 10, 8)->nullable();
            $table->decimal('current_longitude', 11, 8)->nullable();
            $table->decimal('rating', 3, 2)->nullable();
            $table->integer('total_deliveries')->nullable()->default(0);
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->boolean('is_active')->nullable();
            $table->foreign('company_id', 'delivery_persons_company_id_fkey')->references('id')->on('companies');

            $table->index('availability_status', 'idx_delivery_persons_availability_status');
            $table->index('email', 'idx_delivery_persons_email');
            $table->index('national_id_passport', 'idx_delivery_persons_national_id_passport');
            $table->index('phone_number', 'idx_delivery_persons_phone_number');
        });

        DB::statement('
            CREATE TRIGGER update_delivery_persons_modtime
            BEFORE UPDATE ON delivery_persons
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_delivery_persons_modtime ON delivery_persons');
        Schema::dropIfExists('delivery_persons');
    }
};
