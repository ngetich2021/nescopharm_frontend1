<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{ $docTitle }}</title>
@include('requisitions._styles')
<style>
  .items-table td, .items-table th { font-size: 10px; }
  .items-table .qty { width: 60px; }
  .item-note { color: #64748b; font-size: 9px; margin-top: 2px; }
  .totals td { font-weight: bold; background: #f8fafc; }
  .sample-notice { background: #fef08a; border-left: 4px solid #eab308; padding: 12px; margin: 16px 0; font-size: 11px; color: #422006; }
  .sample-notice strong { display: block; margin-bottom: 4px; }
</style>
</head>
<body>
<div class="page">

  @include('requisitions._letterhead', [
    'docTitle' => $docTitle,
    'docLines' => array_filter([
      'Requisition No: ' . $requisition->requisition_number,
      $dispatch ? 'Dispatch No: ' . $dispatch->dispatch_number : null,
      'Date: ' . $requisition->created_at->format('d M Y'),
    ]),
  ])

  <div class="section-title">Requisition Details</div>
  <table class="info-table">
    <tr>
      <td class="label">Requested By</td>
      <td class="value">{{ $requisition->requester ? trim($requisition->requester->first_name . ' ' . $requisition->requester->last_name) : '—' }}</td>
      <td class="label">Approved By</td>
      <td class="value">{{ $requisition->approver ? trim($requisition->approver->first_name . ' ' . $requisition->approver->last_name) : '—' }}</td>
    </tr>
    <tr>
      <td class="label">Approval Status</td>
      <td class="value">{{ ucfirst(str_replace('_', ' ', $requisition->approval_status ?? '—')) }}</td>
      <td class="label">Status</td>
      <td class="value">{{ ucfirst($requisition->status ?? '—') }}</td>
    </tr>
    @if($dispatch)
    <tr>
      <td class="label">Issued From</td>
      <td class="value">{{ $dispatch->fromStore->name ?? '—' }}</td>
      <td class="label">Issued On</td>
      <td class="value">{{ $dispatch->created_at->format('d M Y') }}</td>
    </tr>
    @endif
  </table>

  <div class="section-title">Items</div>
  <table class="items-table">
    <thead>
      <tr>
        <th class="sno">S/No</th>
        <th>Item</th>
        <th>Variant</th>
        <th>Batch No.</th>
        <th>Expiry Date</th>
        <th class="qty">Qty Req.</th>
        <th class="qty">Qty Issued</th>
      </tr>
    </thead>
    <tbody>
      @foreach($rows as $i => $row)
      <tr class="{{ $i % 2 === 1 ? 'row-even' : '' }}">
        <td class="sno">{{ $i + 1 }}</td>
        <td>
          {{ $row['name'] }}
          @if($row['notes'])<div class="item-note">{{ $row['notes'] }}</div>@endif
        </td>
        <td>{{ $row['variant'] ?? '—' }}</td>
        <td>{{ $row['batches'] ?: '—' }}</td>
        <td>{{ $row['expiries'] ?: '—' }}</td>
        <td class="qty">{{ $row['requested'] }}</td>
        <td class="qty">{{ $row['issued'] ?? '—' }}</td>
      </tr>
      @endforeach
      <tr class="totals">
        <td colspan="5" style="text-align: right;">Total</td>
        <td class="qty">{{ collect($rows)->sum('requested') }}</td>
        <td class="qty">{{ collect($rows)->sum('issued') }}</td>
      </tr>
    </tbody>
  </table>

  @if(!$isCustomDoc)
  <div class="sample-notice">
    <strong>⚠ Free Sample Distribution (Zero Rated)</strong>
    These items are issued as complimentary samples for promotional purposes and are not for sale. This distribution is zero rated for tax purposes.
  </div>
  @endif

  @if($isCustomDoc)
  <div class="notes-box">
    <strong>Custom items</strong> are not in the stock catalog and are to be sourced/procured separately; they carry no batch or expiry.
  </div>
  @endif

  @if($requisition->notes)
  <div class="notes-box">
    <strong>Notes:</strong> {{ $requisition->notes }}
  </div>
  @endif

  <table class="signatures">
    <tr>
      <td>
        <div class="sig-line">
          <div class="sig-role">Issued By (Warehouse Manager)</div>
          <div>Name: {{ $dispatch?->createdBy ? trim($dispatch->createdBy->first_name . ' ' . $dispatch->createdBy->last_name) : '______________________' }}</div>
          <div>Signature: ______________________</div>
          <div>Date: {{ $dispatch ? $dispatch->created_at->format('d M Y') : '______________________' }}</div>
        </div>
      </td>
      <td>
        <div class="sig-line">
          <div class="sig-role">Received By</div>
          <div>Name &amp; Signature: ______________________</div>
          <div>Date: ______________________</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="footer">
    This document is computer-generated for official purposes. &nbsp;
    Generated: {{ now()->format('d M Y H:i') }} &nbsp;|&nbsp; {{ $company?->name ?? 'CitiMax ERP' }}
  </div>

</div>
</body>
</html>
