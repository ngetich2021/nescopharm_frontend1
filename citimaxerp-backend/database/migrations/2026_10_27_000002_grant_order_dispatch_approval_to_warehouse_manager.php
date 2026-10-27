<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Directors, the GM and the Warehouse Manager approve order dispatches. Directors and the GM
 * already pass through can_manage_company; the Warehouse Manager needs the approval permission
 * itself (which may not exist yet on a database that never ran the workflow seeder).
 */
return new class extends Migration
{
    private const ROLES = ['Warehouse Manager', 'GM', 'Director', 'Directors'];

    public function up(): void
    {
        if (!Permission::where('key', 'can_approve_order_dispatches')->exists()) {
            // Booleans written literally: they bind as integers here, which Postgres rejects.
            DB::insert(
                'INSERT INTO permissions (id, name, key, description, category, is_system, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, false, true, NOW(), NOW())',
                [(string) Str::uuid(), 'Approve Order Dispatches', 'can_approve_order_dispatches', 'Approve order dispatch requests', 'Approvals']
            );
        }

        $id = Permission::where('key', 'can_approve_order_dispatches')->value('id');
        Role::whereIn('name', self::ROLES)->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $id = Permission::where('key', 'can_approve_order_dispatches')->value('id');
        if ($id) {
            Role::whereIn('name', self::ROLES)->each(fn (Role $role) => $role->permissions()->detach($id));
        }
    }
};
