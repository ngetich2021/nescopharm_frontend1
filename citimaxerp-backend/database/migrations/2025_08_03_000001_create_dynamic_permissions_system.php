<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Create permissions table
        Schema::create('permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100); // Human readable name
            $table->string('key', 100)->unique(); // Machine readable key (e.g., can_manage_users)
            $table->text('description')->nullable();
            $table->string('category', 50)->default('General'); // Permission category
            $table->uuid('company_id')->nullable(); // null for system permissions
            $table->boolean('is_system')->default(false); // System-wide vs company-specific
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->json('metadata')->nullable(); // Additional permission data
            $table->timestamps();

            // Foreign keys
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');

            // Indexes
            $table->index(['company_id', 'is_active']);
            $table->index(['is_system', 'is_active']);
            $table->index(['category', 'is_active']);
            $table->index(['key', 'company_id']);
        });

        // Create role_permissions pivot table
        Schema::create('role_permissions', function (Blueprint $table) {
            $table->uuid('role_id');
            $table->uuid('permission_id');
            $table->uuid('granted_by')->nullable();
            $table->timestamp('granted_at')->default(now());
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();

            // Foreign keys
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
            $table->foreign('permission_id')->references('id')->on('permissions')->onDelete('cascade');
            $table->foreign('granted_by')->references('id')->on('users')->onDelete('set null');

            // Composite primary key
            $table->primary(['role_id', 'permission_id']);
            
            // Indexes
            $table->index(['role_id', 'granted_at']);
            $table->index(['permission_id', 'granted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
    }
};
