<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Create or get the can_manage_system permission
$permission = App\Models\Permission::firstOrCreate(
    ['system_name' => 'can_manage_system'],
    [
        'name' => 'Manage System',
        'description' => 'Full system management access',
        'category' => 'System'
    ]
);

echo "Permission: {$permission->name} ({$permission->system_name})\n";

// Get the Admin role
$role = App\Models\Role::where('name', 'Admin')->first();

if ($role) {
    // Check if permission is already attached
    $hasPermission = $role->permissions->contains($permission->id);
    
    if (!$hasPermission) {
        $role->permissions()->attach($permission->id);
        echo "Permission attached to {$role->name} role\n";
    } else {
        echo "Permission already attached to {$role->name} role\n";
    }
    
    echo "\nAdmin role now has " . $role->permissions()->count() . " permission(s)\n";
} else {
    echo "Admin role not found\n";
}
