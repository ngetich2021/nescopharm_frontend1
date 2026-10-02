<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Quote #{{ $quote->quote_number }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; background: #fff; }
        .quote-box { max-width: 760px; margin: 0 auto; padding: 16px 24px; }
        .letterhead-banner { width: 100%; display: block; margin-bottom: 12px; }
        .company-name { font-size: 18px; font-weight: bold; margin-bottom: 12px; }
        .title-row { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .title-row td { padding: 0; vertical-align: bottom; }
        .quote-title { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .info-table td { border: 1px solid #9ca3af; padding: 5px 7px; vertical-align: top; }
        .info-table .label { font-weight: bold; width: 18%; background: #f9fafb; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th, .items-table td { border: 1px solid #9ca3af; padding: 5px 6px; vertical-align: top; }
        .items-table th { background: #f3f4f6; font-weight: bold; text-align: left; font-size: 10px; }
        .num { text-align: right; white-space: nowrap; }
        .tax-tag { font-size: 9px; color: #4b5563; }
        .total-row td { font-weight: bold; font-size: 12px; }
        .vat-note { margin-top: 6px; font-size: 10px; color: #4b5563; text-align: right; }
        .valid-until { margin-top: 16px; padding: 8px 12px; background: #fef3c7; font-weight: bold; color: #92400e; }
        .footer { margin-top: 20px; color: #4b5563; }
    </style>
</head>
<body>
@php
    $company = $quote->company;
    $customer = $quote->customer;
    $rep = $quote->salesRep ?? $quote->originalSubmittedBy;
    $repName = $rep ? trim($rep->first_name . ' ' . $rep->last_name) : '';
    $clientName = $customer ? ($customer->business_name ?: $customer->name) : '';
    $totals = $quote->vatBreakdown();
    $currency = $quote->currency ?: 'KES';
    $letterheadSrc = $company?->assetDataUri($company->letterhead_url);
@endphp
    <div class="quote-box">
        @if($letterheadSrc)
            <img src="{{ $letterheadSrc }}" alt="{{ $company->name }}" class="letterhead-banner"/>
        @else
            <div class="company-name">{{ $company->name ?? '' }}</div>
        @endif

        <table class="title-row">
            <tr>
                <td class="quote-title">QUOTATION</td>
                <td style="text-align: right;">Date: <strong>{{ \Carbon\Carbon::parse($quote->created_at)->format('j M Y') }}</strong></td>
            </tr>
        </table>

        <table class="info-table">
            <tr>
                <td class="label">Client Name:</td>
                <td>{{ $clientName }}@if($customer && $customer->phone)<br>{{ $customer->phone }}@endif</td>
                <td class="label">Quote No.:</td>
                <td>{{ $quote->quote_number }}</td>
            </tr>
            <tr>
                <td class="label">Sales Team Name:</td>
                <td>{{ $repName ?: '-' }}</td>
                <td class="label">Payment terms:</td>
                <td><strong>{{ $quote->paymentTermsLabel() }}</strong></td>
            </tr>
        </table>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 12%;">Item Code</th>
                    <th>Item Description</th>
                    <th style="width: 12%;">Pack Size</th>
                    <th class="num" style="width: 14%;">Unit Price incl. VAT ({{ $currency }})</th>
                    <th class="num" style="width: 8%;">Order Qty</th>
                    <th class="num" style="width: 15%;">Amount incl. VAT</th>
                </tr>
            </thead>
            <tbody>
                @foreach($quote->quoteItems as $item)
                @php $vatRate = $item->taxInfo()['rate']; $vatFactor = 1 + $vatRate / 100; @endphp
                <tr>
                    <td>{{ $item->itemCode() ?? '-' }}</td>
                    <td>
                        {{ $item->product->name ?? '' }}{{ $item->variant ? ' - ' . $item->variant->name : '' }}
                        @if($vatRate > 0)
                            <br><span style="display:inline-block; border:1px solid #6b7280; padding:0 4px; font-size:9px; font-weight:bold;">VAT {{ rtrim(rtrim(number_format($vatRate, 2), '0'), '.') }}% inclusive</span>
                        @endif
                    </td>
                    <td>{{ $item->packSize() }}</td>
                    <td class="num">{{ number_format((float) $item->unit_price * $vatFactor, 2) }}</td>
                    <td class="num">{{ number_format((float) ($item->unit_quantity ?: $item->quantity)) }}</td>
                    <td class="num">{{ number_format($item->netAmount() * $vatFactor, 2) }}</td>
                </tr>
                @endforeach
                <tr>
                    <td colspan="5" class="num">Subtotal</td>
                    <td class="num">{{ number_format($totals['subtotal'], 2) }}</td>
                </tr>
                @if($totals['discount'] > 0)
                <tr>
                    <td colspan="5" class="num">Discount</td>
                    <td class="num">-{{ number_format($totals['discount'], 2) }}</td>
                </tr>
                @endif
                <tr>
                    <td colspan="5" class="num">VAT</td>
                    <td class="num">{{ number_format($totals['vat'], 2) }}</td>
                </tr>
                <tr class="total-row">
                    <td colspan="5" class="num">Total ({{ $currency }})</td>
                    <td class="num">{{ number_format($totals['total'], 2) }}</td>
                </tr>
            </tbody>
        </table>

        <div class="vat-note">Unit prices and amounts are inclusive of VAT.</div>

        @if($quote->valid_until)
        <div class="valid-until">
            This quote is valid until {{ \Carbon\Carbon::parse($quote->valid_until)->format('F j, Y') }}
        </div>
        @endif

        <div class="footer">
            @if($quote->notes)
                <div style="font-weight: bold; margin-bottom: 4px;">Notes:</div>
                <div>{{ $quote->notes }}</div>
            @else
                <div>Thank you for considering our quotation.</div>
            @endif
        </div>
    </div>
</body>
</html>
