<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Filing (invoices by customer with their file numbers) is used by the Accountant, Store Manager,
 * Warehouse Manager, GM and Directors: they open it, set or import file numbers and print.
 * Creating missing invoices and matching invoices to orders still need the invoice permissions.
 */
return new class extends Migration
{
    private const ROLES = ['Accountant', 'Store Manager', 'Warehouse Manager', 'GM', 'Director', 'Directors'];

    public function up(): void
    {
        if (!Permission::where('key', 'can_view_filing')->exists()) {
            // Booleans written literally: they bind as integers here, which Postgres rejects.
            DB::insert(
                'INSERT INTO permissions (id, name, key, description, category, is_system, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, false, true, NOW(), NOW())',
                [(string) Str::uuid(), 'View Filing', 'can_view_filing', 'Open the Filing tab, set and import invoice file numbers, print invoices and filing lists', 'Menu Permissions']
            );
        }

        $id = Permission::where('key', 'can_view_filing')->value('id');
        Role::whereIn('name', self::ROLES)->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_view_filing')->value('id');
        if ($id) {
            Role::whereIn('name', self::ROLES)->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
