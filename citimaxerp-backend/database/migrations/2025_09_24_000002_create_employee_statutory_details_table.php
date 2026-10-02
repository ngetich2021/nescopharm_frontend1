<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_statutory_details', function (Blueprint $table) {
            $table->id();
            $table->uuid('employee_id');
            $table->string('kra_pin')->unique();
            $table->string('nssf_number')->unique();
            $table->string('shif_number')->unique();
            $table->string('tax_relief_status')->default('standard');
            $table->integer('number_of_dependents')->default(0);
            $table->string('disability_exemption_certificate')->nullable();
            $table->decimal('disability_exemption_amount', 10, 2)->default(0.00);
            $table->timestamps();

            $table->foreign('employee_id')
                  ->references('id')
                  ->on('employees')
                  ->onDelete('cascade');

            $table->index(['kra_pin', 'nssf_number', 'shif_number']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_statutory_details');
    }
};