<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Prevent reuse of email even after soft-delete.
     * Adds a database-level UNIQUE constraint on users.email that covers
     * all rows, including soft-deleted ones. Without this, the commented-out
     * unique constraint in 2024_01_01_000004_create_users_table and the
     * softDeletes added in 2026_08_31_000001 allow a deleted email to be
     * re-inserted if validation is bypassed or raced.
     */
    public function up(): void
    {
        // Guard: check for existing duplicates (including soft-deleted)
        $duplicates = DB::table('users')
            ->select('email', DB::raw('COUNT(*) as cnt'))
            ->whereNotNull('email')
            ->groupBy('email')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('email');

        if ($duplicates->isNotEmpty()) {
            Log::warning('Cannot add unique constraint to users.email - duplicates exist', [
                'duplicates' => $duplicates->toArray(),
            ]);
            // Throw to make migration fail with a clear message rather than a cryptic PG error
            throw new \RuntimeException(
                'Cannot add unique constraint to users.email: duplicate emails exist: ' . $duplicates->implode(', ') .
                '. Please deduplicate before migrating.'
            );
        }

        // Check if index already exists (idempotent)
        $indexExists = DB::selectOne("
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'users'
              AND indexname = 'users_email_unique'
        ");

        if ($indexExists) {
            return;
        }

        // Also check for any existing unique constraint on email (e.g. from $table->unique)
        $constraintExists = DB::selectOne("
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND contype = 'u'
              AND array_to_string(conkey, ',') = (
                  SELECT attnum::text FROM pg_attribute
                  WHERE attrelid = 'users'::regclass AND attname = 'email'
              )
        ");

        // Create the unique index/constraint. Use Schema for portability, but
        // ensure it covers ALL rows (not a partial WHERE deleted_at IS NULL index).
        Schema::table('users', function (Blueprint $table) {
            $table->unique('email', 'users_email_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop by name if exists
            try {
                $table->dropUnique('users_email_unique');
            } catch (\Throwable $e) {
                // Fallback: raw drop for PostgreSQL
                try {
                    DB::statement('DROP INDEX IF EXISTS users_email_unique');
                } catch (\Throwable $e2) {
                }
            }
        });
    }
};
