<?php

namespace Database\Seeders;

use App\Models\PayrollConfiguration;
use Illuminate\Database\Seeder;

/**
 * Seeds the payroll_configurations table with Kenya's 2025/2026 statutory rates.
 *
 * Sources:
 *  - PAYE:          Finance Act 2023 (effective 1 Jul 2023, still current for 2026)
 *  - NSSF:          NSSF Act 2013 — Tier I (6 % of lower earnings up to KES 7,000)
 *                   and Tier II (6 % of upper earnings up to KES 36,000)
 *  - SHIF:          Social Health Insurance Fund Act 2023 — 2.75 %, minimum KES 300
 *  - Minimum wages: Employment (General) (Amendment) Regulations 2024
 *  - Personal relief: KES 2,400/month
 */
class PayrollConfigurationSeeder extends Seeder
{
    public function run(): void
    {
        // Idempotent — skip if an active config already exists.
        if (PayrollConfiguration::getCurrentConfig()) {
            $this->command->info('Active PayrollConfiguration already exists — skipping seeder.');
            return;
        }

        PayrollConfiguration::create([
            'effective_from'  => '2025-01-01',
            'effective_to'    => null, // open-ended

            // ----------------------------------------------------------------
            // PAYE — Finance Act 2023 marginal bands (monthly taxable income)
            // ----------------------------------------------------------------
            'tax_bands' => [
                ['lower_limit' => 0,       'upper_limit' => 24000,  'rate' => 0.10],
                ['lower_limit' => 24000,   'upper_limit' => 32333,  'rate' => 0.25],
                ['lower_limit' => 32333,   'upper_limit' => 500000, 'rate' => 0.30],
                ['lower_limit' => 500000,  'upper_limit' => 800000, 'rate' => 0.325],
                ['lower_limit' => 800000,  'upper_limit' => null,   'rate' => 0.35],
            ],

            'personal_relief' => 2400.00,

            // ----------------------------------------------------------------
            // NSSF Act 2013 — employee contribution (employer mirrors)
            //   Tier I: 6 % of basic salary, capped at KES 7,000 (max KES 420)
            //   Tier II: 6 % of pensionable pay, capped at KES 36,000 (max KES 2,160)
            // ----------------------------------------------------------------
            'nssf_tiers' => [
                'tier1' => ['limit' => 7000,  'rate' => 0.06],
                'tier2' => ['limit' => 36000, 'rate' => 0.06],
            ],

            // ----------------------------------------------------------------
            // SHIF — 2.75 % of gross pay, minimum KES 300/month
            // ----------------------------------------------------------------
            'shif_rates' => [
                'standard' => 0.0275,
                'minimum'  => 300.00,
            ],

            // ----------------------------------------------------------------
            // Minimum wages (monthly KES) — 2024 amendment
            // ----------------------------------------------------------------
            'minimum_wages' => [
                'nairobi' => [
                    'unskilled'      => 15120,
                    'semi_skilled'   => 18275,
                    'skilled'        => 28000,
                    'highly_skilled' => 35000,
                ],
                'mombasa' => [
                    'unskilled'      => 14620,
                    'semi_skilled'   => 17775,
                    'skilled'        => 27500,
                    'highly_skilled' => 34000,
                ],
                'kisumu' => [
                    'unskilled'      => 13572,
                    'semi_skilled'   => 16425,
                    'skilled'        => 25200,
                    'highly_skilled' => 31500,
                ],
                'other' => [
                    'unskilled'      => 13572,
                    'semi_skilled'   => 16425,
                    'skilled'        => 25200,
                    'highly_skilled' => 31500,
                ],
            ],

            // ----------------------------------------------------------------
            // Overtime multipliers + working-hours constants
            // ----------------------------------------------------------------
            'overtime_rates' => [
                'regular'                => 1.5,
                'weekend'                => 2.0,
                'holiday'                => 2.5,
                'standard_monthly_hours' => 176,  // 8 h × 22 working days
                'max_regular_hours'      => 208,  // 52-week safety cap
            ],
        ]);

        $this->command->info('PayrollConfiguration seeded with 2025/2026 Kenya statutory rates.');
    }
}
