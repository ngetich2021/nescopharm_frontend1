<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Enable pgcrypto extension for gen_random_uuid()
        DB::unprepared('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
        
        // Enable uuid-ossp extension (optional)
        DB::unprepared('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        // Define update_modified_column function
        DB::unprepared('
            CREATE OR REPLACE FUNCTION update_modified_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language plpgsql;
        ');

        // Define update_updated_at_column function
        DB::unprepared('
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language plpgsql;
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::unprepared('DROP FUNCTION IF EXISTS update_modified_column CASCADE');
        DB::unprepared('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE');
        // Extensions are not dropped as they might be used by other databases
    }
};
