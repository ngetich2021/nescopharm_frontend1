<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * Accountants can send out an approved dispatch: "Dispatch Order" > Create Logistics needs
 * can_create_logistics (LogisticController::store), and moving it on to in transit / delivered
 * afterwards needs view + update. Adding a new delivery person from the same form needs
 * can_create_delivery_persons.
 */
return new class extends Migration
{
    private const PERMISSION_KEYS = [
        'can_view_logistics', 'can_create_logistics', 'can_update_logistics',
        'can_create_delivery_persons',
    ];

    public function up(): void
    {
        $sync = Permission::whereIn('key', self::PERMISSION_KEYS)->pluck('id')
            ->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->toArray();

        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($sync));
    }

    public function down(): void
    {
        $ids = Permission::whereIn('key', self::PERMISSION_KEYS)->pluck('id');
        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($ids));
    }
};
