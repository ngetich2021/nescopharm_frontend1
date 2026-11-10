<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Str;

/**
 * Accountants see SOPs (the menu, SOPs, temperature and cleaning records) and can add, edit and
 * comment on them. Deleting stays with GM/Director.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'can_view_sops_menu' => 'View SOPs Menu',
        'can_view_sops' => 'View SOPs',
        'can_create_sops' => 'Create SOPs',
        'can_update_sops' => 'Update SOPs',
        'can_comment_sops' => 'Comment on SOPs',
    ];

    public function up(): void
    {
        $ids = [];
        foreach (self::PERMISSIONS as $key => $name) {
            $ids[] = Permission::firstOrCreate(
                ['key' => $key],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $name,
                    'description' => $name,
                    'category' => 'SOPs',
                    'is_system' => true,
                    'is_active' => true,
                ]
            )->id;
        }

        $grant = array_fill_keys($ids, ['granted_at' => now()]);
        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($grant));

        // Who may be picked as the checker of temperature and cleaning records. Any role can be given
        // it on Users > Roles; GM, Director and Accountant start with it.
        $check = Permission::firstOrCreate(
            ['key' => 'can_check_sop_records'],
            [
                'id' => (string) Str::uuid(),
                'name' => 'Check SOP Records',
                'description' => 'Be picked as the checker of temperature and cleaning records, and confirm them with a comment',
                'category' => 'SOPs',
                'is_system' => true,
                'is_active' => true,
            ]
        );
        Role::whereIn('name', ['GM', 'Director', 'Accountant'])
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$check->id => ['granted_at' => now()]]));
    }

    public function down(): void
    {
        $ids = Permission::whereIn('key', array_keys(self::PERMISSIONS))->pluck('id')->all();
        Role::where('name', 'Accountant')->each(fn (Role $role) => $role->permissions()->detach($ids));

        $check = Permission::where('key', 'can_check_sop_records')->value('id');
        if ($check) {
            Role::all()->each(fn (Role $role) => $role->permissions()->detach($check));
            Permission::whereKey($check)->delete();
        }
    }
};
