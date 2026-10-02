{{-- Expects: $company (nullable), $docTitle, $docLines (array of strings) --}}
@php
  $letterheadSrc = $company?->assetDataUri($company->getRawOriginal('letterhead_url'));
  $logoSrc = $letterheadSrc ? null : $company?->assetDataUri($company->getRawOriginal('logo_url'));
@endphp

@if($letterheadSrc)
  <img src="{{ $letterheadSrc }}" alt="{{ $company->name }}" class="letterhead-banner" />
@endif
<div class="letterhead">
  <table class="header-layout">
    <tr>
      <td style="width:60%; vertical-align: middle;">
        @unless($letterheadSrc)
        <table style="border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle; padding-right: 10px;">
              @if($logoSrc)
                <img src="{{ $logoSrc }}" alt="Logo" class="company-logo" style="background: none;" />
              @else
                <div class="company-logo">{{ strtoupper(substr($company->name ?? 'C', 0, 1)) }}</div>
              @endif
            </td>
            <td style="vertical-align: middle;">
              <div class="company-name">{{ $company->name ?? 'CitiMax ERP' }}</div>
              <div class="company-sub">
                @if($company?->address){{ $company->address }}@endif
                @if($company?->city), {{ $company->city }}@endif
                @if($company?->phone)<br>Tel: {{ $company->phone }}@endif
                @if($company?->email) &nbsp;|&nbsp; {{ $company->email }}@endif
              </div>
            </td>
          </tr>
        </table>
        @endunless
      </td>
      <td style="width:40%; vertical-align: top; text-align: right;">
        <div class="doc-title">{{ $docTitle }}</div>
        @foreach($docLines as $line)
          <div class="doc-sub">{{ $line }}</div>
        @endforeach
      </td>
    </tr>
  </table>
</div>
