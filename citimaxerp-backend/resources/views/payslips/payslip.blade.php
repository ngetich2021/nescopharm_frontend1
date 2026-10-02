<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payslip</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 0; }
  .page { padding: 32px; }
  .company-name { font-size: 18px; font-weight: bold; color: #0f172a; }
  .company-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .payslip-title { font-size: 14px; font-weight: bold; text-align: right; color: #0f172a; }
  .payslip-period { font-size: 11px; text-align: right; color: #64748b; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .info-table td { padding: 4px 8px; font-size: 11px; }
  .info-table .label { color: #64748b; width: 140px; }
  .info-table .value { font-weight: bold; color: #0f172a; }
  .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase;
                   letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0;
                   padding-bottom: 4px; margin: 16px 0 8px; }
  .deductions-table { width: 100%; border-collapse: collapse; }
  .deductions-table th { text-align: left; padding: 5px 8px; font-size: 10px;
                          text-transform: uppercase; color: #64748b; background: #f8fafc;
                          border: 1px solid #e2e8f0; }
  .deductions-table td { padding: 5px 8px; border: 1px solid #e2e8f0; }
  .deductions-table .amount { text-align: right; font-family: monospace; }
  .deductions-table .subtotal { background: #f8fafc; font-weight: bold; }
  .net-pay-box { background: #0f172a; color: #fff; padding: 14px 16px;
                  margin-top: 16px; border-radius: 4px; }
  .net-pay-label { font-size: 11px; color: #94a3b8; }
  .net-pay-amount { font-size: 20px; font-weight: bold; color: #fff; }
  .footer { margin-top: 24px; font-size: 9px; color: #94a3b8;
            border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; }
  .row-even { background: #f8fafc; }
  table.header-layout { width: 100%; border-collapse: collapse; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <table class="header-layout">
    <tr>
      <td style="width:60%; vertical-align: middle;">
        <div class="company-name">{{ $payslip->company->name ?? 'CitiMax ERP' }}</div>
        <div class="company-sub">Human Resources Department</div>
      </td>
      <td style="width:40%; vertical-align: top; text-align: right;">
        <div class="payslip-title">PAYSLIP</div>
        <div class="payslip-period">
          {{ \Carbon\Carbon::create($payslip->payrollRun->pay_year, $payslip->payrollRun->pay_month)->format('F Y') }}
        </div>
      </td>
    </tr>
  </table>
  <div style="border-bottom: 2px solid #0f172a; margin: 10px 0 16px;"></div>

  <!-- Employee Info -->
  <div class="section-title">Employee Details</div>
  <table class="info-table">
    <tr>
      <td class="label">Employee Name</td>
      <td class="value">{{ $payslip->employee->first_name }} {{ $payslip->employee->last_name }}</td>
      <td class="label">Employee No.</td>
      <td class="value">{{ $payslip->employee->employee_number }}</td>
    </tr>
    <tr>
      <td class="label">Position</td>
      <td class="value">{{ $payslip->employee->position ?? '—' }}</td>
      <td class="label">Department</td>
      <td class="value">{{ $payslip->employee->department ?? '—' }}</td>
    </tr>
    <tr>
      <td class="label">KRA PIN</td>
      <td class="value">{{ $payslip->employee->kra_pin ?? '—' }}</td>
      <td class="label">NSSF No.</td>
      <td class="value">{{ $payslip->employee->nssf_number ?? '—' }}</td>
    </tr>
    <tr>
      <td class="label">Bank</td>
      <td class="value">{{ $payslip->employee->bank_name ?? '—' }}</td>
      <td class="label">Account No.</td>
      <td class="value">{{ $payslip->employee->bank_account ?? '—' }}</td>
    </tr>
  </table>

  <!-- Earnings -->
  <div class="section-title">Earnings &amp; Allowances</div>
  <table class="deductions-table">
    <thead>
      <tr>
        <th style="width:60%;">Description</th>
        <th style="width:40%; text-align:right;">Amount (KES)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Basic Salary</strong></td>
        <td class="amount"><strong>{{ number_format($payslip->gross_pay, 2) }}</strong></td>
      </tr>

      @php $allowances = $payslip->allowances_json ?? []; @endphp
      @foreach($allowances as $i => $allowance)
      <tr class="{{ $i % 2 === 0 ? 'row-even' : '' }}">
        <td>{{ $allowance['name'] }} <span style="color:#94a3b8; font-size:9px;">({{ ucfirst($allowance['frequency'] ?? 'monthly') }}{{ !($allowance['is_taxable'] ?? true) ? ' · Non-taxable' : '' }})</span></td>
        <td class="amount">{{ number_format($allowance['amount'] ?? 0, 2) }}</td>
      </tr>
      @endforeach

      @if(count($allowances) > 0)
      <tr class="subtotal">
        <td>Total Allowances</td>
        <td class="amount">{{ number_format($payslip->total_allowances, 2) }}</td>
      </tr>
      @endif
    </tbody>
  </table>

  <!-- Deductions -->
  <div class="section-title">Statutory Deductions</div>
  <table class="deductions-table">
    <thead>
      <tr>
        <th style="width:60%;">Description</th>
        <th style="width:40%; text-align:right;">Amount (KES)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>NSSF Tier I (6% of KES 9,000 LEL)</td>
        <td class="amount">{{ number_format($payslip->nssf_tier1, 2) }}</td>
      </tr>
      <tr class="row-even">
        <td>NSSF Tier II (6% of earnings between LEL &amp; UEL)</td>
        <td class="amount">{{ number_format($payslip->nssf_tier2, 2) }}</td>
      </tr>
      <tr>
        <td>Taxable Pay (Gross &minus; NSSF &minus; SHIF &minus; Housing Levy)</td>
        <td class="amount">{{ number_format($payslip->taxable_pay, 2) }}</td>
      </tr>
      <tr class="row-even">
        <td>PAYE (tax on taxable pay)</td>
        <td class="amount">{{ number_format($payslip->paye_before_relief, 2) }}</td>
      </tr>
      <tr>
        <td style="padding-left:20px;">Less: Personal Relief</td>
        <td class="amount">({{ number_format($payslip->personal_relief, 2) }})</td>
      </tr>
      @if(bccomp((string)$payslip->insurance_relief, '0.00', 2) > 0)
      <tr class="row-even">
        <td style="padding-left:20px;">Less: Insurance Relief</td>
        <td class="amount">({{ number_format($payslip->insurance_relief, 2) }})</td>
      </tr>
      @endif
      <tr class="subtotal">
        <td>Net PAYE</td>
        <td class="amount">{{ number_format($payslip->paye, 2) }}</td>
      </tr>
      <tr>
        <td>SHIF / SHA (2.75% of Gross, min KES 300)</td>
        <td class="amount">{{ number_format($payslip->shif, 2) }}</td>
      </tr>
      <tr class="row-even">
        <td>Affordable Housing Levy (1.5% of Gross)</td>
        <td class="amount">{{ number_format($payslip->housing_levy_employee, 2) }}</td>
      </tr>

      {{-- Custom deductions from employee profile --}}
      @php $customDeductions = $payslip->deductions_json ?? []; @endphp
      @foreach($customDeductions as $i => $ded)
      <tr class="{{ $i % 2 === 0 ? '' : 'row-even' }}">
        <td>{{ $ded['name'] }} <span style="color:#94a3b8; font-size:9px;">({{ ucfirst($ded['frequency'] ?? 'monthly') }})</span></td>
        <td class="amount">{{ number_format($ded['amount'] ?? 0, 2) }}</td>
      </tr>
      @endforeach

      @if(bccomp((string)$payslip->salary_advance_deduction, '0.00', 2) > 0)
      <tr>
        <td>Salary Advance Recovery</td>
        <td class="amount">{{ number_format($payslip->salary_advance_deduction, 2) }}</td>
      </tr>
      @endif
      @if(bccomp((string)$payslip->other_deductions, '0.00', 2) > 0)
      <tr class="row-even">
        <td>Other Deductions{{ $payslip->other_deductions_note ? ' — ' . $payslip->other_deductions_note : '' }}</td>
        <td class="amount">{{ number_format($payslip->other_deductions, 2) }}</td>
      </tr>
      @endif
      <tr style="background:#fee2e2;">
        <td><strong>Total Deductions</strong></td>
        <td class="amount"><strong>{{ number_format($payslip->total_deductions, 2) }}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Net Pay -->
  <div class="net-pay-box">
    <table style="width:100%; border-collapse:collapse;">
      <tr>
        <td class="net-pay-label">NET PAY</td>
        <td style="text-align:right;" class="net-pay-amount">
          KES {{ number_format($payslip->net_pay, 2) }}
        </td>
      </tr>
    </table>
  </div>

  <!-- Employer contributions note -->
  <div style="margin-top:12px; font-size:10px; color:#64748b; border: 1px solid #e2e8f0; padding: 8px;">
    <strong>Employer Contributions (not deducted from your pay):</strong>
    NSSF Employer: KES {{ number_format($payslip->nssf_employer, 2) }} &nbsp;|&nbsp;
    Housing Levy Employer: KES {{ number_format($payslip->housing_levy_employer, 2) }}
  </div>

  <div class="footer">
    This payslip is computer-generated and does not require a signature. &nbsp;
    Generated: {{ now()->format('d M Y H:i') }} &nbsp;|&nbsp; CitiMax ERP
  </div>

</div>
</body>
</html>
