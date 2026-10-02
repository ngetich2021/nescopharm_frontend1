<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('payroll_configurations', function (Blueprint $table) {
            $table->id();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->json('tax_bands')->comment('Progressive tax bands with rates');
            $table->json('nssf_tiers')->comment('NSSF contribution tiers and limits');
            $table->json('shif_rates')->comment('SHIF rates and minimum contributions');
            $table->json('minimum_wages')->comment('Minimum wages by region and skill level');
            $table->json('overtime_rates')->comment('Overtime multipliers for different scenarios');
            $table->decimal('personal_relief', 10, 2)->default(2400.00);
            $table->timestamps();
            
            // Index for faster queries when looking up current configuration
            $table->index(['effective_from', 'effective_to']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('payroll_configurations');
    }
};