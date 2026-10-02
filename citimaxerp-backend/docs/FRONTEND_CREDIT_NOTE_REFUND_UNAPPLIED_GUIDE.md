# Frontend Credit Note Integration Guide

## Purpose
This guide documents the frontend changes needed after backend support was added for:
- credit note refunds
- explicit unapplied customer credit handling
- actionable apply errors when an invoice has no outstanding balance

All endpoints below are authenticated with `auth:sanctum` and are under `/api`.

## What Changed
- `POST /api/credit-notes/{id}/apply` now returns structured UI guidance if the target invoice is fully paid.
- `POST /api/credit-notes/{id}/refund` was added.
- `GET /api/credit-notes/customers/{customerId}/unapplied-credits` was added.
- Credit note payloads now include refund information and totals.

## Data Contract Changes
Credit note now includes:
- `amount_refunded` (decimal string/number)
- `refunded_at` (datetime, nullable)
- `refunds` (array)

Status behavior:
- `issued`: still has balance
- `applied`: fully consumed via invoice application or mixed application/refund
- `refunded`: fully consumed by refund only
- `void`: not consumed and voided

## Endpoint Summary
- `POST /api/credit-notes/{id}/apply`
- `POST /api/credit-notes/{id}/refund`
- `GET /api/credit-notes/customers/{customerId}/unapplied-credits`
- `GET /api/credit-notes/by-invoice/{invoiceId}` (extended totals)
- `GET /api/credit-notes` and `GET /api/credit-notes/{id}` now include `refunds`

## 1) Apply Credit Note
### Request
`POST /api/credit-notes/{id}/apply`

```json
{
  "invoice_id": "uuid-required",
  "amount": 1500.00
}
```

`amount` is optional. If omitted, backend applies as much as possible.

### Success Response (200)
```json
{
  "message": "Credit note applied successfully",
  "applied": 1500,
  "credit_note": {},
  "invoice": {},
  "customer_credit_context": {
    "unapplied_credit_total": 3500,
    "open_invoice_balance_total": 4200,
    "open_invoices_count": 2,
    "unapplied_credit_notes_count": 1,
    "suggested_next_action": "apply_to_open_invoice",
    "open_invoices": [],
    "unapplied_credit_notes": []
  }
}
```

### Fully Paid Invoice Response (400)
If selected invoice has no balance, frontend should branch using `error_code`.

```json
{
  "message": "The invoice has no outstanding balance",
  "error_code": "INVOICE_NO_OUTSTANDING_BALANCE",
  "ui_hint": {
    "primary_action": "choose_another_invoice_or_refund",
    "show_unapplied_credit_panel": true
  },
  "customer_credit_context": {
    "unapplied_credit_total": 5000,
    "open_invoice_balance_total": 0,
    "open_invoices_count": 0,
    "unapplied_credit_notes_count": 1,
    "suggested_next_action": "refund_credit_note",
    "open_invoices": [],
    "unapplied_credit_notes": []
  }
}
```

Frontend handling:
- Detect `error_code === "INVOICE_NO_OUTSTANDING_BALANCE"`.
- Show a recovery UI with:
- option to pick another open invoice from `customer_credit_context.open_invoices`
- option to refund from the current credit note

## 2) Refund Credit Note
### Request
`POST /api/credit-notes/{id}/refund`

```json
{
  "amount": 2000.00,
  "refund_reason": "Customer requested cash refund",
  "refund_method": "bank_transfer",
  "reference": "BTX-99211",
  "notes": "Processed by finance",
  "refund_date": "2026-02-19"
}
```

Fields:
- `refund_reason` is required.
- `amount` is optional; defaults to full remaining credit balance.
- works only when credit note is `issued` and has remaining balance.

### Success Response (200)
```json
{
  "message": "Credit note refunded successfully",
  "refunded": 2000,
  "refund": {},
  "credit_note": {},
  "customer_credit_context": {
    "unapplied_credit_total": 3000,
    "open_invoice_balance_total": 0,
    "open_invoices_count": 0,
    "unapplied_credit_notes_count": 1,
    "suggested_next_action": "refund_credit_note",
    "open_invoices": [],
    "unapplied_credit_notes": []
  }
}
```

Frontend handling:
- Refresh the selected credit note details.
- Refresh unapplied credit panel.
- Show refund ledger rows from `credit_note.refunds`.

## 3) Fetch Unapplied Credit Context
### Request
`GET /api/credit-notes/customers/{customerId}/unapplied-credits`

### Response (200)
```json
{
  "customer": {
    "id": "uuid",
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "0700000000",
    "customer_number": "CUST-0001"
  },
  "context": {
    "unapplied_credit_total": 5000,
    "open_invoice_balance_total": 2500,
    "open_invoices_count": 1,
    "unapplied_credit_notes_count": 2,
    "suggested_next_action": "apply_to_open_invoice",
    "open_invoices": [
      {
        "id": "uuid",
        "invoice_number": "INV-0007",
        "invoice_date": "2026-02-01",
        "due_date": "2026-03-01",
        "total_amount": "10000.00",
        "amount_paid": "7500.00",
        "balance_amount": "2500.00",
        "currency": "KES",
        "status": "sent"
      }
    ],
    "unapplied_credit_notes": [
      {
        "id": "uuid",
        "credit_note_number": "CN-0004",
        "invoice_id": "uuid",
        "credit_note_date": "2026-02-15",
        "expiry_date": null,
        "currency": "KES",
        "total_amount": "5000.00",
        "amount_applied": "0.00",
        "amount_refunded": "0.00",
        "balance_amount": "5000.00"
      }
    ]
  }
}
```

## 4) By-Invoice Credit Note Totals
`GET /api/credit-notes/by-invoice/{invoiceId}` now returns:
- `total_credits_issued`
- `total_credits_applied`
- `total_credits_refunded` (new)
- `total_credits_available` (new)

Use this for invoice-level summary cards.

## 5) Suggested UI Flow
- In "Apply Credit Note" modal:
- let user choose invoice and optional amount
- on `INVOICE_NO_OUTSTANDING_BALANCE`, switch to a split panel:
- "Apply to another invoice" list from `open_invoices`
- "Refund credit" form that posts to refund endpoint
- In credit note details:
- add "Refund history" table from `refunds`
- show `amount_refunded` and updated `balance_amount`
- In customer profile or finance tab:
- add "Unapplied Credits" widget using the new customer context endpoint

## 6) QA Checklist
- Apply credit note to open invoice succeeds.
- Apply credit note to paid invoice returns `INVOICE_NO_OUTSTANDING_BALANCE`.
- Refund partial amount keeps status `issued` if balance remains.
- Refund full remaining amount changes status to `refunded` when nothing was applied.
- Mixed scenario (some applied, then refund remaining) ends with zero balance and status `applied`.
- Void is blocked once note is consumed (applied or refunded).

## 7) Backend References
- Controller: `app/Http/Controllers/CreditNoteController.php`
- Model: `app/Models/CreditNote.php`
- Refund model: `app/Models/CreditNoteRefund.php`
- Routes: `routes/api.php`
- Migration: `database/migrations/2026_02_19_000003_add_refunds_to_credit_notes.php`
