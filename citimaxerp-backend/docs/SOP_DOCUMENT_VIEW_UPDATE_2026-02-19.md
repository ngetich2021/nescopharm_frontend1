# SOP Document View Update (2026-02-19)

## Summary
This document records the SOP document-view fixes and related backend updates implemented on `dev` in commit:

- `06c8e3bc8be42e776829cc309d92c8560bd8c1ec`
- Commit message: `Ensure SOP documents viewable`

## Problem Observed
- Frontend showed: `Document view failed / Failed to view SOP document`.

## Root Causes
1. Existing SOP files were stored as `docx` files, but frontend inline viewing expected PDF-compatible rendering.
2. Unauthenticated API document-view requests could fail incorrectly in middleware flow and reach controller code with `user = null`, causing server errors.

## What Was Updated

### 1) SOP Document Conversion and PDF Normalization
- Added reusable conversion service:
  - `app/Services/SopDocumentConversionService.php`
- Added batch conversion command for existing records:
  - `app/Console/Commands/ConvertSopDocumentsToPdf.php`
- Updated SOP import to normalize supported files to PDF:
  - `app/Console/Commands/ImportSopDocuments.php`
- Updated SOP create/update upload flow to normalize to PDF:
  - `app/Http/Controllers/SopController.php`

### 2) SOP Storage Disk Handling (Cloud-Safe)
- Added SOP disk configuration:
  - `config/sop.php`
- Added `storage_disk` column to SOPs:
  - `database/migrations/2026_02_19_000005_add_storage_disk_to_sops.php`
- Updated SOP model behavior for document URLs and disk-aware access:
  - `app/Models/Sop.php`

### 3) SOP Document Endpoints
- Confirmed/used authenticated document routes:
  - `GET /api/sops/{id}/document/view`
  - `GET /api/sops/{id}/document/download`
- Route definitions:
  - `routes/api.php`
- Controller handlers:
  - `app/Http/Controllers/SopController.php`

### 4) Authentication Flow Hardening for API Requests
- Fixed unauthenticated API handling behavior:
  - `app/Http/Middleware/Authenticate.php`
- Result:
  - unauthenticated doc-view request returns auth failure response
  - authenticated doc-view request returns PDF response correctly

### 5) Frontend + API Documentation Updates
- Frontend implementation guide updated:
  - `docs/FRONTEND_SOP_IMPLEMENTATION_GUIDE.md`
- API guide updated:
  - `docs/SOP_MANAGEMENT_API_GUIDE.md`

## Data/Operational Actions Completed
- Migration executed for SOP storage-disk support.
- Existing SOP records converted to PDF and updated in cloud storage (Laravel bucket / R2).

## Validation Results
- SOP conversion run result:
  - `Converted: 23`
  - `Skipped: 0`
  - `Failed: 0`
- Post-checks:
  - `total SOPs: 23`
  - `mime_type application/pdf: 23`
  - `non-PDF mime: 0`
  - `non-.pdf paths: 0`
  - `missing files in storage: 0`
- Endpoint behavior verification:
  - `GET /api/sops/{id}/document/view` with auth -> `200`, `Content-Type: application/pdf`
  - `GET /api/sops/{id}/document/view` without auth -> unauthorized response

## Frontend Implementation Requirement
- For token-based auth, do not rely on raw iframe URL alone if auth headers are required.
- Recommended flow:
  1. Fetch SOP details.
  2. Read `document_view_url`.
  3. Call document endpoint with auth token.
  4. Convert response to Blob.
  5. Render Blob URL in viewer.
- Use `document_download_url` for explicit download actions.

## Files Changed in the Update Commit
- `.gitignore`
- `app/Console/Commands/ConvertSopDocumentsToPdf.php`
- `app/Console/Commands/ImportSopDocuments.php`
- `app/Http/Controllers/SopController.php`
- `app/Http/Middleware/Authenticate.php`
- `app/Models/Sop.php`
- `app/Services/SopDocumentConversionService.php`
- `config/sop.php`
- `database/migrations/2026_02_19_000005_add_storage_disk_to_sops.php`
- `docs/FRONTEND_SOP_IMPLEMENTATION_GUIDE.md`
- `docs/SOP_MANAGEMENT_API_GUIDE.md`
- `routes/api.php`
