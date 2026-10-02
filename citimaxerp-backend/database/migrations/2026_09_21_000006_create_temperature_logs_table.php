<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('temperature_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            // Which thermometer/monitored area this reading is for - e.g.
            // "Thermometer 2" - free text since companies label these
            // themselves and the set can grow without a lookup table.
            $table->string('thermometer_name');
            $table->string('area_room')->nullable();
            $table->decimal('acceptance_max_celsius', 5, 2)->nullable();
            $table->date('log_date');
            $table->decimal('morning_temp', 5, 2)->nullable();
            $table->decimal('afternoon_temp', 5, 2)->nullable();
            $table->string('checked_by')->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            // One reading per thermometer per day.
            $table->unique(['company_id', 'thermometer_name', 'log_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temperature_logs');
    }
};
