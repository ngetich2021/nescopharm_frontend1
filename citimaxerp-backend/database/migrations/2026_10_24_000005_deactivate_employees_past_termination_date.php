<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Termination dates entered through the edit form never switched the employee off, so former
 * staff stayed "active" and kept appearing in pickers and payroll. Apply the dates that have
 * already passed (Employee now does this itself on save, and nightly for future dates).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::update(
            'UPDATE employees SET is_active = false, updated_at = NOW() WHERE is_active = true AND termination_date IS NOT NULL AND termination_date <= ?',
            [now()->toDateString()]
        );
    }

    public function down(): void
    {
        // Not reversible: which of these were wrongly active can't be told apart afterwards.
    }
};
