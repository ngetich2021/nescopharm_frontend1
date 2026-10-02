# SOP Management API Guide

## Overview
This module provides SOP management with:
- SOP document registry (year-wise)
- annexure templates with tabular columns
- annexure data entries (daily/monthly etc.)
- user-tracked comments with timestamp
- print-ready data retrieval
- email of specific SOP document as attachment

All routes require `auth:sanctum`.

## Base Routes
All endpoints below are under `/api/sops`.

## SOP Endpoints
- `GET /api/sops`
- `POST /api/sops`
- `GET /api/sops/{id}`
- `PATCH /api/sops/{id}` (or `PUT`)
- `DELETE /api/sops/{id}`
- `GET /api/sops/{id}/document/view`
- `GET /api/sops/{id}/document/access-url`
- `GET /api/sops/{id}/document/download`
- `POST /api/sops/{id}/email`
- `GET /api/sops/{id}/print-data`

Public signed route used as fallback by access-url:
- `GET /api/sops/{id}/document/public-view?expires=...&signature=...`

### Create SOP
`POST /api/sops`

`multipart/form-data` fields:
- `title` (required)
- `year` (required)
- `sop_number` (optional)
- `description` (optional)
- `status` (`draft|active|archived`, optional)
- `assigned_updater_id` (optional)
- `effective_date` (optional)
- `review_date` (optional)
- `metadata` (optional JSON)
- `document` (`pdf/doc/docx/xls/xlsx`, optional)

Document normalization behavior:
- Uploads are normalized to PDF where needed (`doc/docx/xls/xlsx` -> `pdf`) before persistence.
- Stored SOP records expose `mime_type = application/pdf` for converted documents.

### SOP List Filters
`GET /api/sops?year=2026&status=active&assigned_updater_id=<uuid>&search=stock&per_page=20`

## Annexure Endpoints
- `GET /api/sops/{sopId}/annexures`
- `POST /api/sops/{sopId}/annexures`
- `PATCH /api/sops/{sopId}/annexures/{annexureId}`
- `DELETE /api/sops/{sopId}/annexures/{annexureId}`

### Create Annexure
`POST /api/sops/{sopId}/annexures`

```json
{
  "name": "Temperature Monitoring Log",
  "description": "Daily cold room checks",
  "update_frequency": "daily",
  "columns_definition": [
    { "key": "time", "label": "Time", "type": "time", "required": true },
    { "key": "temp", "label": "Temperature (C)", "type": "number", "required": true },
    { "key": "remark", "label": "Remark", "type": "text", "required": false }
  ],
  "is_active": true
}
```

## Annexure Entry Endpoints
- `GET /api/sops/{sopId}/annexures/{annexureId}/entries`
- `POST /api/sops/{sopId}/annexures/{annexureId}/entries`
- `PATCH /api/sops/{sopId}/annexures/{annexureId}/entries/{entryId}`
- `DELETE /api/sops/{sopId}/annexures/{annexureId}/entries/{entryId}`

### Assigned Updater Rule
- Only `assigned_updater_id` of the SOP can create/update/delete annexure entries.
- Others can still view entries and add comments.

### Create Entry
`POST /api/sops/{sopId}/annexures/{annexureId}/entries`

```json
{
  "entry_date": "2026-02-19",
  "data_payload": {
    "time": "09:00",
    "temp": 5.4,
    "remark": "Normal"
  }
}
```

## Comment Endpoints
- `GET /api/sops/{sopId}/comments`
- `POST /api/sops/{sopId}/comments`
- `DELETE /api/sops/{sopId}/comments/{commentId}`

### Comment Rules
- Comments are user-tracked (not person-specific columns).
- Each comment stores:
- `commented_by`
- `comment_type` (`guidance|capa|general`)
- `created_at` (timestamp)

### Create Comment
`POST /api/sops/{sopId}/comments`

```json
{
  "comment_type": "guidance",
  "comment": "Please verify the batch number format.",
  "sop_annexure_id": "optional-uuid",
  "sop_annexure_entry_id": "optional-uuid"
}
```

## Print-Friendly Retrieval
Use `GET /api/sops/{id}/print-data` for a printer-friendly payload:
- SOP header
- annexures
- filtered entries
- comments

Optional query params:
- `date_from`
- `date_to`

## Email Attachment Endpoint
`POST /api/sops/{id}/email`

```json
{
  "recipients": ["qa@example.com", "ops@example.com"],
  "subject": "SOP for Review",
  "message": "Attached SOP as requested."
}
```

Sends the SOP document as an email attachment to each recipient.

## Bulk Import Command
Use this command to load existing SOP files in bulk.

```bash
php artisan sops:import "/absolute/folder/path" <company_id> <created_by_user_id> --year=2026 --assigned_updater_id=<user_id> --skip-existing
```

Useful flags:
- `--dry-run` preview only
- `--disk=public`
- `--status=active|draft|archived`

Imported files are also normalized to PDF when needed before storage.

## Backfill Existing Documents to PDF
Use this command to convert existing non-PDF SOP documents already in storage:

```bash
php artisan sops:convert-documents-to-pdf --delete-original
```

Useful flags:
- `--company_id=<company_uuid>`
- `--sop_id=<sop_uuid>` (repeatable)
- `--disk=s3`
- `--dry-run`

## Data Storage
- SOP files are stored on configured filesystem disk (default: `public`).
- For cloud deployment, configure filesystem disk to cloud backend (e.g., S3).
- SOP module uses `config('sop.storage_disk')` (`SOP_STORAGE_DISK` env), falling back to `FILESYSTEM_DISK`.
- `document_url` points to authenticated inline view endpoint: `GET /api/sops/{id}/document/view`.
- For browser viewer compatibility, SOP documents should be consumed as PDF.

## Frontend-Safe Document Access URL
Use:

- `GET /api/sops/{id}/document/access-url?ttl_minutes=15`

Behavior:
- Requires normal authenticated API call.
- Returns a temporary `view_url` the frontend can open directly in iframe/object/pdf viewer.
- Backend returns a Laravel temporary signed route by default (`source = signed_backend_url`).
- Optional override: `use_storage_temporary_url=true` to request storage-native temporary URL (if supported by provider).

Example response:

```json
{
  "data": {
    "view_url": "https://...",
    "expires_at": "2026-02-19T18:30:00+00:00",
    "ttl_minutes": 15,
    "source": "storage_temporary_url"
  }
}
```

## Tables Created
- `sops`
- `sop_annexures`
- `sop_annexure_entries`
- `sop_comments`
