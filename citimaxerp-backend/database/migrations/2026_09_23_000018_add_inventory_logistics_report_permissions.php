<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Every report category (inventory, sales, logistics, procurement,
     * customers) previously shared the single can_view_reports permission,
     * so there was no way to grant a role visibility into just one category.
     * These two new permissions let a role see the Inventory and Logistics
     * report pages specifically, without can_view_reports opening every
     * other report category (sales, procurement, customer/CRM) too.
     */
    public function up(): void
    {
        $inventoryReports = Permission::firstOrCreate(
            ['key' => 'can_view_inventory_reports'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'View Inventory Reports',
                'category' => 'Reporting & Analytics',
                'description' => 'View inventory-category reports (stock balance, low stock, movement).',
                'is_active' => true,
            ]
        );

        $logisticsReports = Permission::firstOrCreate(
            ['key' => 'can_view_logistics_reports'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'View Logistics Reports',
                'category' => 'Reporting & Analytics',
                'description' => 'View logistics-category reports (delivery efficiency, success rate).',
                'is_active' => true,
            ]
        );

        Role::where('name', 'Warehouse Manager')->get()->each(function (Role $role) use ($inventoryReports, $logisticsReports) {
            $role->permissions()->syncWithoutDetaching([
                $inventoryReports->id => ['granted_at' => now()],
                $logisticsReports->id => ['granted_at' => now()],
            ]);
        });
    }

    public function down(): void
    {
        // Not reversible - additive only.
    }
};
