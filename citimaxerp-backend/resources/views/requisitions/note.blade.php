<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Requisition Note</title>
@include('requisitions._styles')
</head>
<body>
<div class="page">

  @include('requisitions._letterhead', [
    'docTitle' => 'REQUISITION NOTE',
    'docLines' => array_filter([
      'Dispatch No: ' . $dispatch->dispatch_number,
      $requisition ? 'Requisition No: ' . $requisition->requisition_number : null,
      'Date: ' . $dispatch->created_at->format('d M Y'),
    ]),
  ])

  <!-- Details -->
  <div class="section-title">Dispatch Details</div>
  <table class="info-table">
    <tr>
      <td class="label">From Store</td>
      <td class="value">{{ $dispatch->fromStore->name ?? '—' }}</td>
      <td class="label">To</td>
      <td class="value">{{ \Illuminate\Support\Str::of($dispatch->to_entity ?? '—')->headline() }}</td>
    </tr>
    <tr>
      <td class="label">Assigned To</td>
      <td class="value">{{ $dispatch->toUser ? trim($dispatch->toUser->first_name . ' ' . $dispatch->toUser->last_name) : '—' }}</td>
      <td class="label">Type</td>
      <td class="value">{{ ucfirst($dispatch->type ?? '—') }}</td>
    </tr>
    @if($requisition)
    <tr>
      <td class="label">Requested By</td>
      <td class="value">{{ $requisition->requester ? trim($requisition->requester->first_name . ' ' . $requisition->requester->last_name) : '—' }}</td>
      <td class="label">Approved By</td>
      <td class="value">{{ $requisition->approver ? trim($requisition->approver->first_name . ' ' . $requisition->approver->last_name) : '—' }}</td>
    </tr>
    @endif
  </table>

  <!-- Items -->
  <div class="section-title">Items Dispatched</div>
  <table class="items-table">
    <thead>
      <tr>
        <th class="sno">S/No</th>
        <th>Product</th>
        <th>Variant</th>
        <th>Batch No.</th>
        <th>Expiry Date</th>
        <th class="qty">Qty Dispatched</th>
      </tr>
    </thead>
    <tbody>
      @foreach($dispatch->dispatchItems as $i => $item)
      <tr class="{{ $i % 2 === 1 ? 'row-even' : '' }}">
        <td class="sno">{{ $i + 1 }}</td>
        <td>{{ $item->product->name ?? '—' }}</td>
        <td>{{ $item->variant->name ?? '—' }}</td>
        <td>{{ $item->batch->batch_number ?? '—' }}</td>
        <td>{{ $item->batch?->expiry_date ? $item->batch->expiry_date->format('d M Y') : '—' }}</td>
        <td class="qty">{{ $item->quantity }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  @if($dispatch->notes)
  <div class="notes-box">
    <strong>Notes:</strong> {{ $dispatch->notes }}
  </div>
  @endif

  <!-- Signatures -->
  <table class="signatures">
    <tr>
      <td>
        <div class="sig-line">
          <div class="sig-role">Issued By (Warehouse Manager)</div>
          <div>Name: {{ $dispatch->createdBy ? trim($dispatch->createdBy->first_name . ' ' . $dispatch->createdBy->last_name) : '______________________' }}</div>
          <div>Signature: ______________________</div>
          <div>Date: {{ $dispatch->created_at->format('d M Y') }}</div>
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
    This requisition note is computer-generated. &nbsp;
    Generated: {{ now()->format('d M Y H:i') }} &nbsp;|&nbsp; {{ $company?->name ?? 'CitiMax ERP' }}
  </div>

</div>
</body>
</html>
