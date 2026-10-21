<?php

use Database\Seeders\DeliveryManagementPermissionsSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * The delivery rate/invoice permissions were only ever created by a seeder that no deploy runs,
 * so on production nobody - not even the Warehouse Manager - could create delivery rates.
 * The seeder is idempotent, so running it here is safe wherever it has already run.
 */
return new class extends Migration
{
    public function up(): void
    {
        (new DeliveryManagementPermissionsSeeder())->run();
    }

    public function down(): void
    {
        // Permissions are left in place; removing them would lock users out of delivery rates.
    }
};
