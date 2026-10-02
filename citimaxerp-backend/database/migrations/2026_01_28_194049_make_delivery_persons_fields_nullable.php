<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('delivery_persons', function (Blueprint $table) {
            // Make these fields nullable so only basic info is required for creation
            $table->date('date_of_birth')->nullable()->change();
            $table->string('national_id_passport', 50)->nullable()->change();
            $table->text('residential_address')->nullable()->change();
            $table->string('emergency_contact_name', 100)->nullable()->change();
            $table->string('emergency_contact_phone', 20)->nullable()->change();
            $table->text('bank_mobile_money_details')->nullable()->change();
            $table->string('availability_status', 20)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('delivery_persons', function (Blueprint $table) {
            // Revert back to non-nullable (will fail if there are null values)
            $table->date('date_of_birth')->nullable(false)->change();
            $table->string('national_id_passport', 50)->nullable(false)->change();
            $table->text('residential_address')->nullable(false)->change();
            $table->string('emergency_contact_name', 100)->nullable(false)->change();
            $table->string('emergency_contact_phone', 20)->nullable(false)->change();
            $table->text('bank_mobile_money_details')->nullable(false)->change();
            $table->string('availability_status', 20)->nullable(false)->change();
        });
    }
};
