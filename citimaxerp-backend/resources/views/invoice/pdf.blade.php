<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice #{{ $invoice->invoice_number }}</title>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
body { font-family: 'Figtree'; background: #fff; }
        .invoice-box {
            max-width: 760px;
            margin: 24px auto;
            padding: 36px 32px 32px 32px;
        }
        .flex-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .company-logo {
            width: 56px; height: 56px; border-radius: 8px; background: #111827; color: #fff;
            display: flex; align-items: flex-start; justify-content: center; font-size: 2rem; font-weight: bold;
            margin-right: 12px; margin-top: 0; margin-bottom: 0;
        }
        .company-info { margin-bottom: 0; margin-top: 0; }
        .company-name { font-size: 1.3rem; font-weight: 700; color: #232c36; }
        .company-type { color: #6b7280; font-size: 1rem; font-weight: 400; }
        .invoice-title { font-size: 2.1rem; font-weight: 700; color: #232c36; letter-spacing: 1px; text-align: right; }
        .billed-to { font-weight: 700; color: #232c36; font-size: 1.15rem; margin-bottom: 8px; }
        .header-table { width: 100%; margin-top: 36px; margin-bottom: 12px; border-collapse: collapse; }
        .header-table td { vertical-align: top; padding: 0; }
        .header-left { width: 50%; }
        .header-right { width: 50%; text-align: right; }
        .header-right .label { font-weight: 500; color: #232c36; }
        .header-right .value { font-weight: 600; color: #232c36; margin-left: 8px; }
        .header-right .row { margin-bottom: 4px; font-size: 1.08rem; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 32px; }
        .items-table th, .items-table td { border-bottom: 1px solid #e5e7eb; padding: 10px 6px; }
        .items-table th { background: none; color: #232c36; font-size: 1.05rem; font-weight: 600; }
        .items-table th:nth-child(1), .items-table td:nth-child(1),
        .items-table th:nth-child(2), .items-table td:nth-child(2) { text-align: left; }
        .items-table th:nth-child(3), .items-table th:nth-child(4), .items-table th:nth-child(5),
        .items-table td:nth-child(3), .items-table td:nth-child(4), .items-table td:nth-child(5) { text-align: right; }
        .items-table td { font-size: 1.05rem; }
        .summary-table { width: 40%; float: right; margin-top: 18px; }
        .summary-table td { padding: 4px 0; font-size: 1.05rem; }
        .summary-table .total-label { font-weight: 700; font-size: 1.15rem; }
        .summary-table .total-value { font-weight: 700; font-size: 1.15rem; }
        .footer { margin-top: 56px; font-size: 1.05rem; color: #6b7280; }
        .signed-box { margin-top: 36px; float: right; background: #f3f4f6; color: #6b7280; padding: 10px 22px; border-radius: 7px; font-size: 1.05rem; font-weight: 500; }
        .etims-box { margin-top: 30px; border: 1px solid #d1d5db; padding: 14px; font-size: 0.82rem; color: #374151; }
        .etims-title { font-weight: 700; font-size: 1rem; margin-bottom: 8px; color: #111827; }
        .etims-details { width: 72%; vertical-align: top; line-height: 1.5; }
        .etims-qr { width: 28%; text-align: right; vertical-align: top; }
        .etims-qr img { width: 118px; height: 118px; }
        .letterhead-banner { width: 100%; display: block; margin-bottom: 24px; }
    </style>
</head>
<body>
    <div class="invoice-box">
        @php
            $letterheadSrc = isset($invoice->company) ? $invoice->company->assetDataUri($invoice->company->letterhead_url) : null;
            $hasLetterhead = (bool) $letterheadSrc;
        @endphp
        @if($letterheadSrc)
            <img src="{{ $letterheadSrc }}" alt="{{ $invoice->company->name }}" class="letterhead-banner"/>
        @endif
        <div class="flex-row" style="align-items: flex-start; margin-bottom: 0;">
            @if($hasLetterhead)
                {{-- Company identity already shown once, in the letterhead above --}}
                <div></div>
            @else
                <div style="display: flex; align-items: flex-start; margin-top: 0; margin-bottom: 0;">
                    @if(isset($invoice->company) && $invoice->company->logo_url)
                        <img src="{{ $invoice->company->logo_url }}" alt="Logo" class="company-logo" style="background: none;"/>
                    @else
                        <div class="company-logo">
                            {{ strtoupper(substr($invoice->company->name ?? 'C', 0, 1)) }}
                        </div>
                    @endif
                    <div class="company-info" style="margin-left: 12px;">
                        <div class="company-name">{{ $invoice->company->name ?? 'Company Name' }}</div>
                    </div>
                </div>
            @endif
            <div class="invoice-title" style="text-align: right; min-width: 180px; align-self: flex-start; margin-top: 0;">INVOICE</div>
        </div>

        <table class="header-table">
            <tr>
                <td class="header-left">
                    <div class="billed-to">BILLED TO:</div>
                    <div style="font-size: 1.08rem; font-weight: 500; color: #232c36;">
                        {{ $invoice->customer->name ?? '' }}<br>
                        {{ $invoice->customer->phone ?? '' }}
                    </div>
                </td>
                <td class="header-right">
                    <div class="row"><span class="label">Invoice No.</span> <span class="value">{{ $invoice->invoice_number }}</span></div>
                    <div class="row"><span class="label">Date:</span> <span class="value">{{ \Carbon\Carbon::parse($invoice->invoice_date)->format('j M Y') }}</span></div>
                    <div class="row"><span class="label">Due Date:</span> <span class="value">{{ \Carbon\Carbon::parse($invoice->due_date)->format('j M Y') }}</span></div>
                </td>
            </tr>
        </table>

        <table class="items-table">
            <thead>
                <tr>
                    <th>S/No</th>
                    <th>Code No.</th>
                    <th>Item Name</th>
                    <th>Pack Size</th>
                    <th>Price per Pack (Ksh)</th>
                    <th>Order Qty</th>
                    <th>Total Value (Ksh)</th>
                </tr>
            </thead>
            <tbody>
                @foreach($invoice->lineItems as $item)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>{{ $item->itemCode() ?? '-' }}</td>
                    <td>
                        {{ $item->description }}
                        @if((float) $item->tax_rate > 0)
                            <br><span style="display:inline-block; border:1px solid #6b7280; padding:0 4px; font-size:0.75rem; font-weight:600;">VAT {{ rtrim(rtrim(number_format($item->tax_rate, 2), '0'), '.') }}% inclusive</span>
                        @endif
                    </td>
                    <td>{{ $item->packSize() }}</td>
                    <td>{{ number_format($item->unitPriceInclTax(), 2) }}</td>
                    <td>{{ rtrim(rtrim(number_format($item->quantity, 2), '0'), '.') }}</td>
                    <td>{{ number_format($item->line_total, 2) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>

        <table class="summary-table">
            <tr>
                <td>Subtotal</td>
                <td style="text-align:right;">Ksh {{ number_format($invoice->subtotal, 2) }}</td>
            </tr>
            @if($invoice->discount_amount > 0)
            <tr>
                <td>Discount</td>
                <td style="text-align:right;">-Ksh {{ number_format($invoice->discount_amount, 2) }}</td>
            </tr>
            @endif
            @if((float) $invoice->tax_amount > 0)
            <tr>
                <td>VAT</td>
                <td style="text-align:right;">Ksh {{ number_format($invoice->tax_amount, 2) }}</td>
            </tr>
            @endif
            <tr>
                <td class="total-label">Total</td>
                <td class="total-value" style="text-align:right;">Ksh {{ number_format($invoice->total_amount, 2) }}</td>
            </tr>
        </table>

        <div style="clear: both;"></div>

        @if($invoice->etims_status === 'completed' && $invoice->etims_qr_url)
            @php
                $etimsQrDataUri = app(\App\Services\Pdf\QrCodeDataUriGenerator::class)
                    ->generate($invoice->etims_qr_url, 180);
                $etimsKraPin = \App\Models\CompanyEtimsConfig::query()
                    ->where('company_id', $invoice->company_id)
                    ->where('country_code', 'KE')
                    ->notSuperseded()
                    ->value('kra_pin');
            @endphp
            <div class="etims-box">
                <div class="etims-title">KRA eTIMS TAX INVOICE</div>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td class="etims-details">
                            <strong>Trader invoice:</strong> {{ $invoice->etims_trader_invoice_number ?? $invoice->invoice_number }}<br>
                            @if($etimsKraPin)<strong>Supplier PIN:</strong> {{ $etimsKraPin }}<br>@endif
                            @if($invoice->etims_receipt_number)<strong>Receipt number:</strong> {{ $invoice->etims_receipt_number }}<br>@endif
                            @if($invoice->etims_serial_number)<strong>Control unit:</strong> {{ $invoice->etims_serial_number }}<br>@endif
                            @if($invoice->etims_invoice_number)<strong>eTIMS invoice:</strong> {{ $invoice->etims_invoice_number }}<br>@endif
                            @if($invoice->etims_receipt_date)<strong>Receipt date:</strong> {{ $invoice->etims_receipt_date }} {{ $invoice->etims_receipt_time }}<br>@endif
                            @if($invoice->etims_internal_data)<strong>Internal data:</strong> {{ $invoice->etims_internal_data }}@endif
                        </td>
                        <td class="etims-qr"><img src="{{ $etimsQrDataUri }}" alt="KRA eTIMS QR code"></td>
                    </tr>
                </table>
            </div>
        @endif

        <div class="footer">
            <div>Payment Terms: {{ $invoice->payment_terms ?? 'Due on Receipt' }}</div>
            <div style="margin-top: 8px;">Thank you for your business.</div>
        </div>
        
    </div>
</body>
</html>
