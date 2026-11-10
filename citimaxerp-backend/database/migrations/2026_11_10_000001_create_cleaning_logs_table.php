<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The cleaning services sheet (SOPs > Cleaning Records): each cleaning with its start and end time,
 * the areas done and the cleaner. The store manager records it and picks who checks it; the checker
 * then writes a comment and confirms. Names are kept as text too, so imported past sheets keep the
 * names written on them even when that person has no login.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('cleaning_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->date('cleaning_date');
            $table->string('start_time', 5)->nullable(); // 08:40
            $table->string('end_time', 5)->nullable();
            $table->string('areas');                     // All areas, Offices/windows, Holiday...
            $table->string('cleaned_by', 150)->nullable();
            $table->text('remarks')->nullable();
            $table->uuid('prepared_by_user_id')->nullable();
            $table->string('prepared_by_name', 150)->nullable();
            $table->uuid('checker_user_id')->nullable();
            $table->string('checker_name', 150)->nullable();
            $table->string('status', 20)->default('pending'); // pending | checked
            $table->text('checker_comment')->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('prepared_by_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('checker_user_id')->references('id')->on('users')->onDelete('set null');
            $table->index(['company_id', 'cleaning_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cleaning_logs');
    }
};
