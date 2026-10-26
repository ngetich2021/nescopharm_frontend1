<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Item rows have random UUIDs and share one created_at second, so an order's lines came back
 * in any order (a 50-line order showed shuffled). line_seq is an auto-numbered column filled
 * in the order rows are saved, which is the order they were entered; the relations sort by it.
 * Existing rows are numbered by created_at, then by where they sit in the table.
 */
return new class extends Migration
{
    private const TABLES = ['order_items', 'quote_items', 'invoice_line_items', 'order_dispatch_items'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach (self::TABLES as $table) {
            DB::statement("ALTER TABLE {$table} ADD COLUMN IF NOT EXISTS line_seq BIGSERIAL");
            DB::statement("
                UPDATE {$table} t SET line_seq = s.n
                FROM (SELECT id, row_number() OVER (ORDER BY created_at, ctid) AS n FROM {$table}) s
                WHERE t.id = s.id");
            DB::statement("SELECT setval(pg_get_serial_sequence('{$table}', 'line_seq'), GREATEST((SELECT COALESCE(MAX(line_seq), 0) FROM {$table}), 1))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach (self::TABLES as $table) {
            DB::statement("ALTER TABLE {$table} DROP COLUMN IF EXISTS line_seq");
        }
    }
};
