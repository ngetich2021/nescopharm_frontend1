<?php
namespace App\Services;

class KenyaPayrollCalculator
{
    // NSSF Act 2013 — Year 4 rates effective 1 February 2026
    private const LEL       = '9000.00';
    private const UEL       = '108000.00';
    private const NSSF_RATE = '0.06';
    private const TIER1_MAX = '540.00';
    private const TIER2_MAX = '5940.00';

    // SHIF (Social Health Authority, 2024)
    private const SHIF_RATE = '0.0275';
    private const SHIF_MIN  = '300.00';

    // Affordable Housing Levy
    private const HOUSING_RATE = '0.015';

    // PAYE (Finance Act 2023)
    private const PERSONAL_RELIEF  = '2400.00';
    private const INS_RELIEF_RATE   = '0.15';
    private const INS_RELIEF_MAX    = '5000.00';

    // Monthly PAYE bands [upper_limit_or_null, rate_string]
    private const TAX_BANDS = [
        ['24000.00',  '0.10'],
        ['32333.00',  '0.25'],
        ['500000.00', '0.30'],
        ['800000.00', '0.325'],
        [null,        '0.35'],
    ];

    /**
     * Calculate all statutory deductions for a given gross pay.
     * All monetary values returned as strings with 2 decimal places.
     */
    public function calculate(string $grossPay, string $insurancePremium = '0.00'): array
    {
        // --- NSSF ---
        $nssfTier1    = $this->calcNssfTier1($grossPay);
        $nssfTier2    = $this->calcNssfTier2($grossPay);
        $nssfEmployee = bcadd($nssfTier1, $nssfTier2, 2);
        $nssfEmployer = $nssfEmployee;

        // --- SHIF ---
        $shifCalc = bcmul($grossPay, self::SHIF_RATE, 2);
        $shif     = bccomp($shifCalc, self::SHIF_MIN, 2) < 0 ? self::SHIF_MIN : $shifCalc;

        // --- Housing Levy ---
        $housingLevyEmployee = bcmul($grossPay, self::HOUSING_RATE, 2);
        $housingLevyEmployer = $housingLevyEmployee;

        // --- PAYE ---
        $taxablePay = bcsub(bcsub(bcsub($grossPay, $nssfEmployee, 2), $shif, 2), $housingLevyEmployee, 2);
        if (bccomp($taxablePay, '0.00', 2) < 0) {
            $taxablePay = '0.00';
        }

        $payeBeforeRelief = $this->applyTaxBands($taxablePay);
        $insuranceRelief  = $this->calcInsuranceRelief($insurancePremium);
        $totalRelief      = bcadd(self::PERSONAL_RELIEF, $insuranceRelief, 2);
        $paye             = bcsub($payeBeforeRelief, $totalRelief, 2);
        if (bccomp($paye, '0.00', 2) < 0) {
            $paye = '0.00';
        }

        return [
            'nssf_tier1'             => $nssfTier1,
            'nssf_tier2'             => $nssfTier2,
            'nssf_employee'          => $nssfEmployee,
            'nssf_employer'          => $nssfEmployer,
            'taxable_pay'            => $taxablePay,
            'paye_before_relief'     => $payeBeforeRelief,
            'personal_relief'        => self::PERSONAL_RELIEF,
            'insurance_relief'       => $insuranceRelief,
            'paye'                   => $paye,
            'shif'                   => $shif,
            'housing_levy_employee'  => $housingLevyEmployee,
            'housing_levy_employer'  => $housingLevyEmployer,
        ];
    }

    private function calcNssfTier1(string $gross): string
    {
        $base         = bccomp($gross, self::LEL, 2) >= 0 ? self::LEL : $gross;
        $contribution = bcmul($base, self::NSSF_RATE, 2);
        return bccomp($contribution, self::TIER1_MAX, 2) > 0 ? self::TIER1_MAX : $contribution;
    }

    private function calcNssfTier2(string $gross): string
    {
        if (bccomp($gross, self::LEL, 2) <= 0) {
            return '0.00';
        }
        $ceiling      = bccomp($gross, self::UEL, 2) >= 0 ? self::UEL : $gross;
        $aboveLel     = bcsub($ceiling, self::LEL, 2);
        $contribution = bcmul($aboveLel, self::NSSF_RATE, 2);
        return bccomp($contribution, self::TIER2_MAX, 2) > 0 ? self::TIER2_MAX : $contribution;
    }

    private function applyTaxBands(string $taxablePay): string
    {
        $tax  = '0.00';
        $prev = '0.00';

        foreach (self::TAX_BANDS as [$upper, $rate]) {
            if (bccomp($taxablePay, $prev, 2) <= 0) break;

            if ($upper === null) {
                $chargeable = bcsub($taxablePay, $prev, 2);
                $tax        = bcadd($tax, bcmul($chargeable, $rate, 2), 2);
                break;
            }

            $bandTop    = bccomp($taxablePay, $upper, 2) < 0 ? $taxablePay : $upper;
            $chargeable = bcsub($bandTop, $prev, 2);

            if (bccomp($chargeable, '0.00', 2) > 0) {
                $tax = bcadd($tax, bcmul($chargeable, $rate, 2), 2);
            }

            $prev = $upper;
            if (bccomp($taxablePay, $upper, 2) <= 0) break;
        }

        return $tax;
    }

    private function calcInsuranceRelief(string $premium): string
    {
        if (bccomp($premium, '0.00', 2) <= 0) {
            return '0.00';
        }
        $relief = bcmul($premium, self::INS_RELIEF_RATE, 2);
        return bccomp($relief, self::INS_RELIEF_MAX, 2) > 0 ? self::INS_RELIEF_MAX : $relief;
    }
}
