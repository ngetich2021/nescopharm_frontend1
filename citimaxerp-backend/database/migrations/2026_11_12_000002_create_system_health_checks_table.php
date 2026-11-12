<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per health check run (every 5 minutes, kept 30 days): whether the system was up,
 * what each check found, and whether a "down" email went out for it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('system_health_checks')) {
            return;
        }
        Schema::create('system_health_checks', function (Blueprint $table) {
            $table->id();
            $table->string('status', 10);          // ok | down
            $table->json('checks');                // [{name, ok, ms, detail}]
            $table->timestamp('alerted_at')->nullable();
            $table->timestamp('created_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_health_checks');
    }
};
