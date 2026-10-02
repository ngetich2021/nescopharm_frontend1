<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('company_id');
            $table->string('email', 255);
            $table->text('password')->nullable();
            $table->string('password_setup_token', 128)->nullable();
            $table->timestamp('password_setup_token_expires_at')->nullable();
            $table->string('frontend_url', 255)->nullable();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('phone', 50)->nullable();
            $table->text('avatar_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('email_verified')->default(false);
            $table->timestamp('last_login_at')->nullable();
            $table->uuid('role_id')->nullable();
            $table->timestamp('created_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->timestamp('updated_at')->nullable()->default(DB::raw('CURRENT_TIMESTAMP'));
        });

        // // Add foreign keys, unique constraint and indexes after table creation
        // Schema::table('users', function (Blueprint $table) {
        //     $table->unique('email');
        //     $table->foreign('company_id', 'users_company_id_fkey')->references('id')->on('companies')->onDelete('cascade');
        //     $table->foreign('role_id', 'users_role_id_fkey')->references('id')->on('roles')->onDelete('set null');
        //     $table->index('is_active', 'idx_users_is_active');
        // });

        DB::statement('
            CREATE TRIGGER update_users_modtime
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        ');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS update_users_modtime ON users');
        Schema::dropIfExists('users');
    }
};
