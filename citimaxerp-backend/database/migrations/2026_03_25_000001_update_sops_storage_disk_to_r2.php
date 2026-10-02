<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Re-point all SOP records that used the generic 's3' disk to the
        // dedicated 'r2' disk so the controller can resolve R2 credentials
        // correctly via the R2_* environment variables.
        DB::table('sops')
            ->where('storage_disk', 's3')
            ->whereNotNull('document_path')
            ->update(['storage_disk' => 'r2']);
    }

    public function down(): void
    {
        DB::table('sops')
            ->where('storage_disk', 'r2')
            ->whereNotNull('document_path')
            ->update(['storage_disk' => 's3']);
    }
};
