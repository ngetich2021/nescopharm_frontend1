<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ApplyEmployeeTerminations extends Command
{
    protected $signature = 'employees:apply-terminations';
    protected $description = 'Mark employees inactive once their termination date has arrived';

    public function handle(): int
    {
        // Written as SQL booleans: bound booleans arrive as integers, which Postgres rejects.
        $count = DB::update('UPDATE employees SET is_active = false, updated_at = NOW() WHERE is_active = true AND termination_date IS NOT NULL AND termination_date <= ?', [now()->toDateString()]);
        $this->info("Employees marked inactive: {$count}");

        return self::SUCCESS;
    }
}
