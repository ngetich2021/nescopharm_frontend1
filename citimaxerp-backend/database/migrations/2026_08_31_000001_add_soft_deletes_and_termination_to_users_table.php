<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
            $table->timestamp('terminated_at')->nullable()->after('deleted_at');
            $table->text('termination_reason')->nullable()->after('terminated_at');
            $table->uuid('terminated_by')->nullable()->after('termination_reason');
            $table->foreign('terminated_by')->references('id')->on('users')->nullOnDelete();
            $table->index('deleted_at');
            $table->index('terminated_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['terminated_by']);
            $table->dropColumn(['deleted_at', 'terminated_at', 'termination_reason', 'terminated_by']);
        });
    }
};
