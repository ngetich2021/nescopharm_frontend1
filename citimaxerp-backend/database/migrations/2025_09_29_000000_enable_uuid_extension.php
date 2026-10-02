<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Enable UUID extension if not already enabled
        // This is redundant since it's already handled in the main schema migration
        // but we'll keep it for completeness
        DB::statement('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    }

    public function down(): void
    {
        // We don't drop the extension as other tables might be using it
        // DB::statement('DROP EXTENSION IF EXISTS "uuid-ossp";');
    }
};
