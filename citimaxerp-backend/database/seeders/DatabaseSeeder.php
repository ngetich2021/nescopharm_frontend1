<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(EtimsReferenceDataSeeder::class);

        // Demo tenant data belongs only in a local development database. The
        // seeder itself also validates the connection as a second safeguard.
        if (app()->environment('local')) {
            $this->call(CitimaxLocalSeeder::class);
        }
    }
}
