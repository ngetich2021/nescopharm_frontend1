<?php

namespace Database\Seeders; // Ensure this is correct

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run()
    {
        // Define permissions
        $permissions = ['create-customers', 'edit-customer', 'delete-customer', 'view-transactions'];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Define roles and assign permissions
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $editorRole = Role::firstOrCreate(['name' => 'editor']);
        $editorRole = Role::firstOrCreate(['name' => 'finance']);
        $editorRole = Role::firstOrCreate(['name' => 'dev']);

        $adminRole->givePermissionTo($permissions);
        $editorRole->givePermissionTo(['create-customers', 'edit-customer']);

        // Assign role to a specific user
        $user = User::where('email', 'inchwara@gmail.com')->first();

        if ($user) {
            $user->assignRole('admin'); // Assign admin role
        }
    }
}
