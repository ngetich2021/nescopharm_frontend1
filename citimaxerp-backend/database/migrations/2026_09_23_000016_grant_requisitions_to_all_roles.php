<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration {
    /**
     * Every role should be able to raise/view requisitions (RequisitionController
     * now scopes the list to the requester's own requests unless the role also
     * holds can_manage_company - see that controller change). GM specifically
     * is a runtime, per-company role with no guaranteed permission set (unlike
     * Director, which always gets can_manage_company from its own migration),
     * so also backfill that here wherever a role is literally named "GM" so
     * the "GM sees everyone's requisitions" behavior actually holds.
     */
    private const BASELINE_KEYS = [
        'can_view_requisitions',
        'can_create_requisitions',
        'can_update_requisitions',
        'can_view_requisitions_menu',
    ];

    public function up(): void
    {
        $baselineIds = Permission::whereIn('key', self::BASELINE_KEYS)->pluck('id');
        $baselineSync = $baselineIds->mapWithKeys(fn ($id) => [$id => ['granted_at' => now()]])->toArray();

        Role::query()->chunkById(100, function ($roles) use ($baselineSync) {
            foreach ($roles as $role) {
                $role->permissions()->syncWithoutDetaching($baselineSync);
            }
        });

        $manageCompany = Permission::where('key', 'can_manage_company')->first();
        if ($manageCompany) {
            Role::where('name', 'GM')->get()->each(function (Role $role) use ($manageCompany) {
                $role->permissions()->syncWithoutDetaching([$manageCompany->id => ['granted_at' => now()]]);
            });
        }
    }

    public function down(): void
    {
        // Not reversible - strictly additive, and removing it would silently
        // take requisitions access away from roles that may now depend on it.
    }
};
