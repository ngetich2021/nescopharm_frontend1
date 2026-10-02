<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - Cherry Distributors</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }

        .invoice-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }

        .company-info h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 5px;
        }

        .company-info p {
            color: #666;
            font-size: 13px;
            line-height: 1.6;
        }

        .invoice-details {
            text-align: right;
        }

        .invoice-details h2 {
            color: #0066cc;
            font-size: 24px;
            margin-bottom: 10px;
        }

        .invoice-details p {
            color: #666;
            font-size: 13px;
            margin: 3px 0;
        }

        .parties {
            display: flex;
            gap: 40px;
            margin-bottom: 30px;
        }

        .party {
            flex: 1;
        }

        .party h3 {
            color: #333;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
            color: #0066cc;
        }

        .party p {
            color: #666;
            font-size: 13px;
            line-height: 1.6;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
        }

        thead {
            background: #f8f8f8;
            border-top: 2px solid #333;
            border-bottom: 2px solid #333;
        }

        th {
            padding: 12px;
            text-align: left;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #333;
        }

        td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
            color: #666;
        }

        tbody tr:hover {
            background: #f9f9f9;
        }

        .product-name {
            font-weight: 600;
            color: #333;
        }

        .batch-expiry {
            font-size: 12px;
            color: #999;
            margin-top: 2px;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .totals {
            margin-top: 20px;
            width: 100%;
        }

        .total-row {
            display: flex;
            justify-content: flex-end;
            gap: 100px;
            padding: 8px 0;
            font-size: 13px;
        }

        .total-row.final {
            font-weight: 700;
            font-size: 14px;
            border-top: 2px solid #333;
            border-bottom: 2px solid #333;
            padding: 12px 0;
            color: #333;
        }

        .total-label {
            width: 150px;
            text-align: right;
        }

        .total-amount {
            width: 80px;
            text-align: right;
            font-weight: 500;
        }

        .notes {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }

        .notes h4 {
            color: #333;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .notes p {
            color: #666;
            font-size: 12px;
            line-height: 1.6;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 11px;
        }

        .badge {
            display: inline-block;
            padding: 2px 6px;
            font-size: 11px;
            border-radius: 3px;
            font-weight: 600;
            margin-right: 5px;
        }

        .badge-batch {
            background: #e3f2fd;
            color: #1976d2;
        }

        .badge-expiry {
            background: #fff3e0;
            color: #f57c00;
        }

        .qty-box {
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 3px;
            font-weight: 600;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .invoice-container {
                box-shadow: none;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <h1>Cherry Distributors</h1>
                <p>Industrial Area, Nairobi<br>
                   Phone: +254711111111<br>
                   Email: warehouse@cherrydist.com</p>
            </div>
            <div class="invoice-details">
                <h2>INVOICE</h2>
                <p><strong>Invoice #:</strong> INV-2026-00001</p>
                <p><strong>Date:</strong> {{ date('d M Y') }}</p>
                <p><strong>Due Date:</strong> {{ date('d M Y', strtotime('+30 days')) }}</p>
            </div>
        </div>

        <!-- Parties -->
        <div class="parties">
            <div class="party">
                <h3>Bill To</h3>
                <p>Jane Doe Supermarket<br>
                   Market Street<br>
                   Nairobi, Kenya<br>
                   Phone: +254755555555<br>
                   Email: jane@supermarket.com</p>
            </div>
            <div class="party">
                <h3>Ship To</h3>
                <p>Jane Doe Supermarket<br>
                   Market Street<br>
                   Nairobi, Kenya</p>
            </div>
        </div>

        <!-- Items Table -->
        <table>
            <thead>
                <tr>
                    <th style="width: 5%;">#</th>
                    <th style="width: 30%;">Product</th>
                    <th style="width: 20%;">Batch & Expiry</th>
                    <th style="width: 10%;" class="text-center">Qty</th>
                    <th style="width: 15%;" class="text-right">Unit Price</th>
                    <th style="width: 20%;" class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>
                        <div class="product-name">Coca-Cola 500ml</div>
                        <div class="batch-expiry">Receipt: PR-000004 | Stock: 1,142 units</div>
                    </td>
                    <td>
                        <div><span class="badge badge-batch">BATCH-2026-APR-004</span></div>
                        <div><span class="badge badge-expiry">Exp: 20 Sep 2027</span></div>
                    </td>
                    <td class="text-center"><span class="qty-box">100</span></td>
                    <td class="text-right">35.00</td>
                    <td class="text-right"><strong>3,500.00</strong></td>
                </tr>
                <tr>
                    <td>2</td>
                    <td>
                        <div class="product-name">Coca-Cola 500ml</div>
                        <div class="batch-expiry">Receipt: PR-000005 | Stock: 1,142 units</div>
                    </td>
                    <td>
                        <div><span class="badge badge-batch">BATCH-2026-MAY-005</span></div>
                        <div><span class="badge badge-expiry">Exp: 10 Jan 2028</span></div>
                    </td>
                    <td class="text-center"><span class="qty-box">150</span></td>
                    <td class="text-right">35.00</td>
                    <td class="text-right"><strong>5,250.00</strong></td>
                </tr>
                <tr>
                    <td>3</td>
                    <td>
                        <div class="product-name">Sprite 500ml</div>
                        <div class="batch-expiry">Receipt: PR-000001 | Stock: 1,094 units</div>
                    </td>
                    <td>
                        <div><span class="badge badge-batch">BATCH-2026-JAN-001</span></div>
                        <div><span class="badge badge-expiry">Exp: 31 Dec 2027</span></div>
                    </td>
                    <td class="text-center"><span class="qty-box">80</span></td>
                    <td class="text-right">35.00</td>
                    <td class="text-right"><strong>2,800.00</strong></td>
                </tr>
                <tr>
                    <td>4</td>
                    <td>
                        <div class="product-name">Fanta Orange 500ml</div>
                        <div class="batch-expiry">Receipt: PR-000007 | Stock: 592 units</div>
                    </td>
                    <td>
                        <div><span class="badge badge-batch">BATCH-2026-JAN-001</span></div>
                        <div><span class="badge badge-expiry">Exp: 31 Dec 2027</span></div>
                    </td>
                    <td class="text-center"><span class="qty-box">120</span></td>
                    <td class="text-right">32.00</td>
                    <td class="text-right"><strong>3,840.00</strong></td>
                </tr>
            </tbody>
        </table>

        <!-- Totals -->
        <div class="totals">
            <div class="total-row">
                <div class="total-label">Subtotal:</div>
                <div class="total-amount">15,390.00</div>
            </div>
            <div class="total-row">
                <div class="total-label">Tax (0%):</div>
                <div class="total-amount">0.00</div>
            </div>
            <div class="total-row final">
                <div class="total-label">TOTAL:</div>
                <div class="total-amount">15,390.00</div>
            </div>
        </div>

        <!-- Notes -->
        <div class="notes">
            <h4>Notes & Terms</h4>
            <p>• Payment due within 30 days of invoice date<br>
               • All products are subject to quality inspection upon delivery<br>
               • Batch numbers and expiry dates are clearly marked on each unit<br>
               • Returns must be made within 7 days of delivery with proof of batch numbers</p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Generated on {{ date('d M Y H:i') }} | Invoice #INV-2026-00001 | Page 1 of 1</p>
        </div>
    </div>
</body>
</html>
