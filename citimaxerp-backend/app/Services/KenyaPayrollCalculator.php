<?php
namespace App\Services;

/**
 * Kenyan statutory payroll, exactly as the client's Payroll & KRA Compliance Tracker computes it:
 * - NSSF (Year 4, Feb 2026): 6% employee + 6% employer of pay up to the UEL 108,000
 *   (Tier I on the first 9,000, Tier II the rest)
 * - SHIF 2.75% of gross, minimum 300, no cap
 * - Affordable Housing Levy 1.5% employee + 1.5% employer of gross
 * - PAYE on gross less NSSF, SHIF and Housing Levy, monthly bands 10 / 25 / 30 / 32.5 / 35%,
 *   less personal relief 2,400 and insurance relief (15%, max 5,000)
 * - NITA KES 50 per employee per month (employer cost)
 * Every statutory amount is rounded to whole shillings.
 *
 * Options: statutory => false (no statutory deductions at all, e.g. a fixed net pay as instructed),
 * shif_exempt => true (no SHIF deducted).
 */
class KenyaPayrollCalculator
{
    private const LEL       = 9000;
    private const UEL       = 108000;
    private const NSSF_RATE = 0.06;

    private const SHIF_RATE = 0.0275;
    private const SHIF_MIN  = 300;

    private const HOUSING_RATE = 0.015;

    private const PERSONAL_RELIEF = 2400;
    private const INS_RELIEF_RATE = 0.15;
    private const INS_RELIEF_MAX  = 5000;

    public const NITA_LEVY = 50;

    // Monthly PAYE bands [upper_limit_or_null, rate]
    private const TAX_BANDS = [
        [24000, 0.10],
        [32333, 0.25],
        [500000, 0.30],
        [800000, 0.325],
        [null, 0.35],
    ];

    /**
     * All monetary values returned as strings with 2 decimal places.
     *
     * @param array{statutory?: bool, shif_exempt?: bool} $options
     */
    public function calculate(string $grossPay, string $insurancePremium = '0.00', array $options = []): array
    {
        $gross = (float) $grossPay;
        $statutory = $options['statutory'] ?? true;
        $shifExempt = $options['shif_exempt'] ?? false;

        if (!$statutory || $gross <= 0) {
            $zero = $this->fmt(0);
            return [
                'nssf_tier1' => $zero, 'nssf_tier2' => $zero, 'nssf_employee' => $zero, 'nssf_employer' => $zero,
                'taxable_pay' => $zero,
                'paye_before_relief' => $zero, 'personal_relief' => $zero, 'insurance_relief' => $zero, 'paye' => $zero,
                'shif' => $zero, 'housing_levy_employee' => $zero, 'housing_levy_employer' => $zero,
                'nita' => $zero,
            ];
        }

        // --- NSSF ---
        $nssfEmployee = round(self::NSSF_RATE * min($gross, self::UEL));
        $nssfTier1 = min($nssfEmployee, round(self::NSSF_RATE * min($gross, self::LEL)));
        $nssfTier2 = $nssfEmployee - $nssfTier1;

        // --- SHIF ---
        $shif = $shifExempt ? 0 : max(self::SHIF_MIN, round(self::SHIF_RATE * $gross));

        // --- Housing Levy ---
        $housingEmployee = round(self::HOUSING_RATE * $gross);
        $housingEmployer = $housingEmployee;

        // --- PAYE ---
        $taxable = max(0, $gross - $nssfEmployee - $shif - $housingEmployee);
        $taxBefore = round($this->applyTaxBands($taxable));
        $insuranceRelief = min(self::INS_RELIEF_RATE * max(0, (float) $insurancePremium), self::INS_RELIEF_MAX);
        $paye = max(0, round($taxBefore - self::PERSONAL_RELIEF - $insuranceRelief));

        return [
            'nssf_tier1'             => $this->fmt($nssfTier1),
            'nssf_tier2'             => $this->fmt($nssfTier2),
            'nssf_employee'          => $this->fmt($nssfEmployee),
            'nssf_employer'          => $this->fmt($nssfEmployee),
            'taxable_pay'            => $this->fmt($taxable),
            'paye_before_relief'     => $this->fmt($taxBefore),
            'personal_relief'        => $this->fmt(self::PERSONAL_RELIEF),
            'insurance_relief'       => $this->fmt($insuranceRelief),
            'paye'                   => $this->fmt($paye),
            'shif'                   => $this->fmt($shif),
            'housing_levy_employee'  => $this->fmt($housingEmployee),
            'housing_levy_employer'  => $this->fmt($housingEmployer),
            'nita'                   => $this->fmt(self::NITA_LEVY),
        ];
    }

    private function applyTaxBands(float $taxable): float
    {
        $tax = 0.0;
        $prev = 0.0;
        foreach (self::TAX_BANDS as [$upper, $rate]) {
            if ($taxable <= $prev) {
                break;
            }
            $top = $upper === null ? $taxable : min($taxable, $upper);
            $tax += ($top - $prev) * $rate;
            if ($upper === null) {
                break;
            }
            $prev = $upper;
        }
        return $tax;
    }

    private function fmt(float|int $v): string
    {
        return number_format((float) $v, 2, '.', '');
    }
}
