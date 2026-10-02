<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repairs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id'); // FK to companies (multi-tenant)
            $table->string('repair_number')->unique();
            $table->uuid('reported_by'); // FK to users (HOD)
            $table->uuid('approver_id')->nullable()->after('description');
            $table->timestamp('approved_at')->nullable();
            $table->string('status')->default('pending'); // pending, in_progress, repaired, completed
            $table->string('approval_status')->default('pending'); // pending, approved, rejected
            $table->text('description')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repairs');
    }
};
