# Frontend SOP Implementation Guide

## 1) Objective
Build a complete SOP module in the frontend for:
- managing SOP records and document files
- year-wise filtering and retrieval
- annexure template setup (dynamic tabular columns)
- annexure entries with assigned-updater-only edit access
- user-tracked comments with timestamps
- print-friendly display flow
- emailing an SOP as an attachment

This guide is implementation-focused and maps directly to the backend endpoints already available.

## 2) Backend Status
Backend is implemented and routes are live:
- SOP CRUD
- annexures CRUD
- annexure entries CRUD (with assigned updater enforcement)
- comments CRUD
- document download
- print data
- email attachment endpoint

Reference:
- `docs/SOP_MANAGEMENT_API_GUIDE.md`

## 3) Frontend Module Structure
Suggested screens:
- SOP List
- SOP Create/Edit
- SOP Detail
- Annexure Builder (inside SOP Detail)
- Annexure Entries (grid/table per annexure)
- Comments Panel (timeline style)
- Print View page/modal
- Email SOP modal

Suggested route map:
- `/sops`
- `/sops/new`
- `/sops/:id`
- `/sops/:id/edit`
- `/sops/:id/print`

## 4) API Endpoints (Frontend Consumption)

### SOP
- `GET /api/sops`
- `POST /api/sops` (multipart/form-data)
- `GET /api/sops/{id}`
- `PATCH /api/sops/{id}` (multipart when replacing file)
- `DELETE /api/sops/{id}`
- `GET /api/sops/{id}/document/view`
- `GET /api/sops/{id}/document/access-url`
- `GET /api/sops/{id}/document/download`
- `POST /api/sops/{id}/email`
- `GET /api/sops/{id}/print-data`

ID note:
- `id` is a UUID string (not numeric, not auto-increment).
- Use UUID-safe routing/state keys in frontend.

### Annexures
- `GET /api/sops/{sopId}/annexures`
- `POST /api/sops/{sopId}/annexures`
- `PATCH /api/sops/{sopId}/annexures/{annexureId}`
- `DELETE /api/sops/{sopId}/annexures/{annexureId}`

### Annexure Entries
- `GET /api/sops/{sopId}/annexures/{annexureId}/entries`
- `POST /api/sops/{sopId}/annexures/{annexureId}/entries`
- `PATCH /api/sops/{sopId}/annexures/{annexureId}/entries/{entryId}`
- `DELETE /api/sops/{sopId}/annexures/{annexureId}/entries/{entryId}`

### Comments
- `GET /api/sops/{sopId}/comments`
- `POST /api/sops/{sopId}/comments`
- `DELETE /api/sops/{sopId}/comments/{commentId}`

## 5) Key Business Rules for UI

### 5.1 Assigned updater restriction
- Only `assigned_updater_id` can create/update/delete annexure entries.
- If backend returns:
- `400`: no updater assigned
- `403`: current user is not the assigned updater
- Then UI must show the table read-only and a clear banner message.

### 5.2 Comments are user-tracked
- Do not create fixed person-specific comment columns.
- Show each comment with:
- commenter name
- `comment_type` (`guidance|capa|general`)
- timestamp (`created_at`)

### 5.3 Year-wise operations
- SOP list must support year filter and default sorting by descending year.
- Keep year visible in list rows and detail header.

### 5.4 Print-friendly flow
- Use `GET /api/sops/{id}/print-data` to build a print layout.
- Offer browser print (`window.print()`).

### 5.5 Email SOP
- Email modal should accept multiple recipients.
- Submit to `POST /api/sops/{id}/email`.

## 6) Suggested TypeScript Interfaces

```ts
type SopStatus = "draft" | "active" | "archived";
type CommentType = "guidance" | "capa" | "general";
type UpdateFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "ad_hoc";

interface UserLite {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface Sop {
  id: string;
  sop_number?: string | null;
  title: string;
  description?: string | null;
  year: number;
  status: SopStatus;
  assigned_updater_id?: string | null;
  assigned_updater?: UserLite | null;
  effective_date?: string | null;
  review_date?: string | null;
  document_path?: string | null;
  document_url?: string | null;
  document_view_url?: string | null;
  document_download_url?: string | null;
  storage_disk?: string | null;
  original_file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface AnnexureColumn {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "select" | "boolean";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface SopAnnexure {
  id: string;
  sop_id: string;
  name: string;
  description?: string | null;
  update_frequency: UpdateFrequency;
  columns_definition: AnnexureColumn[];
  is_active: boolean;
  entries_count?: number;
}

interface SopAnnexureEntry {
  id: string;
  sop_annexure_id: string;
  sop_id: string;
  entry_date: string;
  data_payload: Record<string, unknown>;
  updated_by: string;
  updated_by_user?: UserLite;
  created_at: string;
  updated_at: string;
}

interface SopComment {
  id: string;
  sop_id: string;
  sop_annexure_id?: string | null;
  sop_annexure_entry_id?: string | null;
  comment_type: CommentType;
  comment: string;
  commented_by: string;
  commented_by_user?: UserLite;
  created_at: string;
}
```

## 7) Screen-by-Screen Implementation

### 7.1 SOP List
UI controls:
- search by title/SOP number
- year dropdown
- status dropdown
- assigned updater dropdown (optional)
- create SOP button

API:
- `GET /api/sops?search=&year=&status=&assigned_updater_id=&per_page=`

Columns:
- SOP number
- title
- year
- status
- assigned updater
- annexure count
- comment count
- actions (view/edit/delete/download)

### 7.2 SOP Create/Edit
Form fields:
- `title`, `sop_number`, `description`, `year`, `status`
- `assigned_updater_id`, `effective_date`, `review_date`
- file upload (`document`)

Validation mirrored from backend:
- `year` between 2000 and 2100
- file types: `pdf/doc/docx/xls/xlsx`, max 50MB

On save success:
- navigate to detail page

### 7.3 SOP Detail
Sections:
- header metadata
- document actions (`view`, `download`, `email`, `print`)
- annexures tab
- comments tab

API:
- `GET /api/sops/{id}`

Document rendering:
- preferred: call `GET /api/sops/{id}/document/access-url` and use returned `data.view_url` directly in iframe/object (no auth header needed on that final file URL)
- fallback: use `document_view_url` (or `document_url`) with authenticated fetch + blob rendering
- use `document_download_url` for explicit download action
- `document_url` now resolves to authenticated view endpoint (`/api/sops/{id}/document/view`)
- backend now normalizes non-PDF uploads/imports to PDF for viewer compatibility
- if frontend and backend origins differ, prepend API base URL before calling relative document URLs
- call document view/download endpoints with auth token; if using an iframe/object, prefer fetching as blob then rendering the blob URL

Suggested view flow:
1. `GET /api/sops/{id}` to fetch SOP detail
2. Call `GET /api/sops/{id}/document/access-url?ttl_minutes=15`
3. Read `data.view_url` from response
4. Render `data.view_url` directly in PDF viewer (`<iframe src={viewUrl}>`)
5. Refresh access URL if expired (401/403 from signed URL)
6. Use `document_download_url` for explicit download action

### 7.4 Annexure Builder
Use a dynamic-column designer:
- add/remove columns
- define column key, label, type, required
- optional select options

Persist:
- `POST /api/sops/{sopId}/annexures`
- `PATCH /api/sops/{sopId}/annexures/{annexureId}`

### 7.5 Annexure Entries Grid
Render based on `columns_definition`.

API:
- list: `GET /api/sops/{sopId}/annexures/{annexureId}/entries`
- create: `POST .../entries`
- edit: `PATCH .../entries/{entryId}`
- delete: `DELETE .../entries/{entryId}`

Behavior:
- If current user is not assigned updater, disable edit actions.
- Show backend error messages for 400/403 directly in UI.

### 7.6 Comments Panel
Filters:
- type (`guidance|capa|general`)
- annexure-specific or entry-specific context

API:
- list: `GET /api/sops/{sopId}/comments`
- create: `POST /api/sops/{sopId}/comments`
- delete: `DELETE /api/sops/{sopId}/comments/{commentId}`

Display:
- commenter full name/email
- timestamp
- type badge
- comment body

### 7.7 Print View
API:
- `GET /api/sops/{id}/print-data?date_from=&date_to=`

Render:
- SOP header
- annexure tables (with entries)
- comments section

Then trigger browser print.

### 7.8 Email Modal
Fields:
- recipients (multi-email)
- subject (optional)
- message (optional)

API:
- `POST /api/sops/{id}/email`

## 8) Error Handling Matrix
- `401/403`: show access denied state
- `404`: SOP or document not found
- `422`: field validation errors; bind to form fields
- `400` (entry updates): likely no assigned updater; show guidance message
- `500`: generic retry toast + error logging

## 9) Suggested Integration Order
1. SOP list + create + detail
2. File upload/download
3. Annexure template builder
4. Annexure entries grid + assigned-updater guard
5. Comments panel
6. Print view
7. Email modal

## 10) QA Checklist for Frontend
- SOP list filters by year/status/search correctly.
- New SOP creation with and without document works.
- SOP document download works.
- Assigned updater can CRUD entries.
- Non-assigned user cannot amend entries and sees clear message.
- Comments show commenter identity and timestamp.
- Print view renders correctly and prints.
- Email SOP flow sends with multi recipients.

## 11) Notes for Cloud Storage
Backend stores files via Laravel filesystem disk.
- SOP storage uses `SOP_STORAGE_DISK` fallback to `FILESYSTEM_DISK`.
- Current configuration is cloud-backed (`s3` to Laravel bucket / R2 endpoint).
- Existing SOP records retain their per-record `storage_disk` to avoid broken files during migrations.
- Frontend should treat `document_url`/download endpoint as source of truth.
