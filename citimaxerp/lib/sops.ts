import apiCall from "./api"
import { getApiUrl } from "./config"
import { getToken } from "./token-manager"

export type SopStatus = "draft" | "active" | "archived"
export type CommentType = "guidance" | "capa" | "general"
export type AnnexureColumnType = "text" | "number" | "date" | "time" | "select" | "boolean"
export type UpdateFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "ad_hoc"

export interface UserLite {
  id: string
  first_name?: string
  last_name?: string
  email?: string
}

export interface Sop {
  id: string
  sop_number?: string | null
  title: string
  description?: string | null
  year: number
  status: SopStatus
  assigned_updater_id?: string | null
  assigned_updater?: UserLite | null
  effective_date?: string | null
  review_date?: string | null
  document_path?: string | null
  document_url?: string | null
  document_view_url?: string | null
  document_download_url?: string | null
  storage_disk?: string | null
  original_file_name?: string | null
  mime_type?: string | null
  file_size?: number | null
  metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  annexures_count?: number
  comments_count?: number
}

export interface AnnexureColumn {
  key: string
  label: string
  type: AnnexureColumnType
  required?: boolean
  options?: string[]
  placeholder?: string
}

export interface SopAnnexure {
  id: string
  sop_id: string
  name: string
  description?: string | null
  update_frequency: UpdateFrequency
  columns_definition: AnnexureColumn[]
  is_active: boolean
  entries_count?: number
}

export interface SopAnnexureEntry {
  id: string
  sop_annexure_id: string
  sop_id: string
  entry_date: string
  data_payload: Record<string, unknown>
  updated_by: string
  updated_by_user?: UserLite
  created_at: string
  updated_at: string
}

export interface SopComment {
  id: string
  sop_id: string
  sop_annexure_id?: string | null
  sop_annexure_entry_id?: string | null
  comment_type: CommentType
  comment: string
  commented_by: string
  commented_by_name?: string
  commented_by_user?: UserLite
  created_at: string
  file_path?: string | null
  file_name?: string | null
  file_type?: string | null
  file_size?: number | null
}

export interface SopPrintData {
  sop: Sop
  annexures: Array<{
    annexure: SopAnnexure
    entries: SopAnnexureEntry[]
  }>
  comments: SopComment[]
}

export interface SopListParams {
  search?: string
  year?: number | string
  status?: SopStatus | "all"
  assigned_updater_id?: string
  per_page?: number
  page?: number
}

export interface SopListResponse {
  data: Sop[]
  meta?: {
    current_page?: number
    last_page?: number
    per_page?: number
    total?: number
  }
}

export interface CreateSopRequest {
  title: string
  sop_number?: string
  description?: string
  year: number
  status: SopStatus
  assigned_updater_id?: string
  effective_date?: string
  review_date?: string
  metadata?: Record<string, unknown>
  document?: File | null
}

export interface UpdateSopRequest extends Partial<CreateSopRequest> {
  remove_document?: boolean
}

export interface CreateAnnexureRequest {
  name: string
  description?: string
  update_frequency: UpdateFrequency
  columns_definition: AnnexureColumn[]
  is_active?: boolean
}

export interface UpdateAnnexureRequest extends Partial<CreateAnnexureRequest> {}

export interface CreateAnnexureEntryRequest {
  entry_date: string
  data_payload: Record<string, unknown>
}

export interface UpdateAnnexureEntryRequest extends Partial<CreateAnnexureEntryRequest> {}

export interface CreateCommentRequest {
  comment_type: CommentType
  comment: string
  sop_annexure_id?: string
  sop_annexure_entry_id?: string
}

export interface EmailSopRequest {
  recipients: string[]
  subject?: string
  message?: string
}

export type SopDocumentTarget =
  | string
  | Pick<Sop, "id" | "document_view_url" | "document_download_url" | "document_url">

function toQueryString(params?: Record<string, unknown>): string {
  if (!params) {
    return ""
  }

  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return
    }
    queryParams.append(key, String(value))
  })

  const queryString = queryParams.toString()
  return queryString ? `?${queryString}` : ""
}

function unwrapArray<T>(response: any): T[] {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.data)) {
    return response.data
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data
  }

  return []
}

function unwrapData<T>(response: any): T {
  return (response?.data?.data ?? response?.data ?? response) as T
}

function extractPaginationMeta(response: any): SopListResponse["meta"] {
  if (!response || Array.isArray(response)) {
    return undefined
  }

  const metaFromResponse = response?.meta ?? response?.data?.meta
  if (metaFromResponse && typeof metaFromResponse === "object") {
    return {
      current_page: metaFromResponse.current_page,
      last_page: metaFromResponse.last_page,
      per_page: metaFromResponse.per_page,
      total: metaFromResponse.total,
    }
  }

  const current_page = response?.current_page ?? response?.data?.current_page
  const last_page = response?.last_page ?? response?.data?.last_page
  const per_page = response?.per_page ?? response?.data?.per_page
  const total = response?.total ?? response?.data?.total

  if (current_page === undefined && last_page === undefined && per_page === undefined && total === undefined) {
    return undefined
  }

  return {
    current_page,
    last_page,
    per_page,
    total,
  }
}

function parseApiError(error: any, defaultMessage: string): never {
  const message = error?.message || defaultMessage
  const wrapped = new Error(message) as any
  wrapped.apiResponse = error?.apiResponse
  wrapped.statusCode = error?.statusCode
  throw wrapped
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function toApiRelativePath(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim()
  if (!trimmed) {
    return ""
  }

  if (isAbsoluteUrl(trimmed)) {
    return trimmed
  }

  const withoutOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, "")
  const withoutApiPrefix = withoutOrigin.startsWith("/api/")
    ? withoutOrigin.slice(4)
    : withoutOrigin.startsWith("api/")
      ? `/${withoutOrigin.slice(4)}`
      : withoutOrigin

  return withoutApiPrefix.startsWith("/") ? withoutApiPrefix : `/${withoutApiPrefix}`
}

function resolveDocumentUrl(pathOrUrl: string | null | undefined, fallbackPath: string): string {
  const normalizedPathOrUrl = (pathOrUrl || "").trim()

  if (!normalizedPathOrUrl) {
    return getApiUrl(fallbackPath)
  }

  if (isAbsoluteUrl(normalizedPathOrUrl)) {
    return normalizedPathOrUrl
  }

  const relativePath = toApiRelativePath(normalizedPathOrUrl)
  return getApiUrl(relativePath || fallbackPath)
}

function normalizeDocumentTarget(target: SopDocumentTarget): {
  id: string
  viewUrl?: string | null
  downloadUrl?: string | null
  fallbackUrl?: string | null
} {
  if (typeof target === "string") {
    return { id: target }
  }

  return {
    id: target.id,
    viewUrl: target.document_view_url,
    downloadUrl: target.document_download_url,
    fallbackUrl: target.document_url,
  }
}

function parseFilenameFromHeaders(
  contentDisposition: string | null,
  fallbackFilename: string
): string {
  const safeFallback = fallbackFilename || "document.file"
  const headerValue = contentDisposition || ""
  const filenameMatch = headerValue.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i)
  return decodeURIComponent(filenameMatch?.[1] || filenameMatch?.[2] || safeFallback)
}

async function fetchSopDocumentBlob(
  url: string,
  token: string,
  defaultErrorMessage: string,
  fallbackFilename: string
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/octet-stream",
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    let message = defaultErrorMessage
    try {
      const errorData = await response.json()
      message = errorData?.message || message
    } catch {
      // no-op
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const filename = parseFilenameFromHeaders(
    response.headers.get("content-disposition"),
    fallbackFilename
  )

  return { blob, filename }
}

function buildSopFormData(payload: CreateSopRequest | UpdateSopRequest): FormData {
  const formData = new FormData()

  if (payload.title !== undefined) formData.append("title", payload.title)
  if (payload.sop_number !== undefined) formData.append("sop_number", payload.sop_number)
  if (payload.description !== undefined) formData.append("description", payload.description)
  if (payload.year !== undefined) formData.append("year", String(payload.year))
  if (payload.status !== undefined) formData.append("status", payload.status)
  if (payload.assigned_updater_id !== undefined) formData.append("assigned_updater_id", payload.assigned_updater_id)
  if (payload.effective_date !== undefined) formData.append("effective_date", payload.effective_date)
  if (payload.review_date !== undefined) formData.append("review_date", payload.review_date)

  if (payload.metadata !== undefined) {
    formData.append("metadata", JSON.stringify(payload.metadata ?? {}))
  }

  if ((payload as UpdateSopRequest).remove_document !== undefined) {
    formData.append("remove_document", (payload as UpdateSopRequest).remove_document ? "1" : "0")
  }

  if (payload.document) {
    formData.append("document", payload.document)
  }

  return formData
}

export async function fetchSops(params?: SopListParams): Promise<SopListResponse> {
  try {
    const query = toQueryString(params as Record<string, unknown>)
    const response = await apiCall<any>(`/sops${query}`, "GET", undefined, true)

    return {
      data: unwrapArray<Sop>(response),
      meta: extractPaginationMeta(response),
    }
  } catch (error: any) {
    parseApiError(error, "Failed to fetch SOPs")
  }
}

export async function fetchSopById(id: string): Promise<Sop> {
  try {
    const response = await apiCall<Sop | { data: Sop }>(`/sops/${id}`, "GET", undefined, true)
    return unwrapData<Sop>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to fetch SOP")
  }
}

export async function createSop(payload: CreateSopRequest): Promise<Sop> {
  try {
    const formData = buildSopFormData(payload)
    const response = await apiCall<Sop | { data: Sop }>(`/sops`, "POST", formData, true)
    return unwrapData<Sop>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to create SOP")
  }
}

export async function updateSop(id: string, payload: UpdateSopRequest): Promise<Sop> {
  try {
    const formData = buildSopFormData(payload)
    const response = await apiCall<Sop | { data: Sop }>(`/sops/${id}`, "PATCH", formData, true)
    return unwrapData<Sop>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to update SOP")
  }
}

export async function deleteSop(id: string): Promise<void> {
  try {
    await apiCall(`/sops/${id}`, "DELETE", undefined, true)
  } catch (error: any) {
    parseApiError(error, "Failed to delete SOP")
  }
}

export function hasSopDocument(sop?: Partial<Sop> | null): boolean {
  if (!sop) {
    return false
  }

  return Boolean(
    sop.document_download_url ||
      sop.document_view_url ||
      sop.document_url ||
      sop.document_path ||
      sop.original_file_name
  )
}

export function getSopDocumentViewUrl(target: SopDocumentTarget): string {
  const { id, viewUrl, fallbackUrl } = normalizeDocumentTarget(target)
  return resolveDocumentUrl(viewUrl || fallbackUrl, `/sops/${id}/document/view`)
}

export function getSopDocumentDownloadUrl(target: SopDocumentTarget): string {
  const { id, downloadUrl } = normalizeDocumentTarget(target)
  return resolveDocumentUrl(downloadUrl, `/sops/${id}/document/download`)
}

export async function viewSopDocument(target: SopDocumentTarget): Promise<{ blob: Blob; filename: string }> {
  const token = getToken()
  if (!token) {
    throw new Error("You are not logged in. Please sign in and try again.")
  }

  const { id } = normalizeDocumentTarget(target)
  const url = getSopDocumentViewUrl(target)
  return fetchSopDocumentBlob(url, token, "Failed to view SOP document", `sop-${id}.file`)
}

export async function downloadSopDocument(target: SopDocumentTarget): Promise<{ blob: Blob; filename: string }> {
  const token = getToken()
  if (!token) {
    throw new Error("You are not logged in. Please sign in and try again.")
  }

  const { id } = normalizeDocumentTarget(target)
  const url = getSopDocumentDownloadUrl(target)
  return fetchSopDocumentBlob(url, token, "Failed to download SOP document", `sop-${id}.file`)
}

export async function sendSopByEmail(id: string, payload: EmailSopRequest): Promise<void> {
  try {
    await apiCall(`/sops/${id}/email`, "POST", payload, true)
  } catch (error: any) {
    parseApiError(error, "Failed to email SOP")
  }
}

export async function fetchSopPrintData(
  id: string,
  params?: { date_from?: string; date_to?: string }
): Promise<SopPrintData> {
  try {
    const query = toQueryString(params)
    const response = await apiCall<SopPrintData | { data: SopPrintData }>(`/sops/${id}/print-data${query}`, "GET", undefined, true)
    return unwrapData<SopPrintData>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to load print data")
  }
}

export async function fetchAnnexures(sopId: string): Promise<SopAnnexure[]> {
  try {
    const response = await apiCall<SopAnnexure[] | { data: SopAnnexure[] }>(`/sops/${sopId}/annexures`, "GET", undefined, true)
    return unwrapArray<SopAnnexure>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to fetch annexures")
  }
}

export async function createAnnexure(sopId: string, payload: CreateAnnexureRequest): Promise<SopAnnexure> {
  try {
    const response = await apiCall<SopAnnexure | { data: SopAnnexure }>(`/sops/${sopId}/annexures`, "POST", payload, true)
    return unwrapData<SopAnnexure>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to create annexure")
  }
}

export async function updateAnnexure(
  sopId: string,
  annexureId: string,
  payload: UpdateAnnexureRequest
): Promise<SopAnnexure> {
  try {
    const response = await apiCall<SopAnnexure | { data: SopAnnexure }>(
      `/sops/${sopId}/annexures/${annexureId}`,
      "PATCH",
      payload,
      true
    )
    return unwrapData<SopAnnexure>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to update annexure")
  }
}

export async function deleteAnnexure(sopId: string, annexureId: string): Promise<void> {
  try {
    await apiCall(`/sops/${sopId}/annexures/${annexureId}`, "DELETE", undefined, true)
  } catch (error: any) {
    parseApiError(error, "Failed to delete annexure")
  }
}

export async function fetchAnnexureEntries(sopId: string, annexureId: string): Promise<SopAnnexureEntry[]> {
  try {
    const response = await apiCall<SopAnnexureEntry[] | { data: SopAnnexureEntry[] }>(
      `/sops/${sopId}/annexures/${annexureId}/entries`,
      "GET",
      undefined,
      true
    )
    return unwrapArray<SopAnnexureEntry>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to fetch annexure entries")
  }
}

export async function createAnnexureEntry(
  sopId: string,
  annexureId: string,
  payload: CreateAnnexureEntryRequest
): Promise<SopAnnexureEntry> {
  try {
    const response = await apiCall<SopAnnexureEntry | { data: SopAnnexureEntry }>(
      `/sops/${sopId}/annexures/${annexureId}/entries`,
      "POST",
      payload,
      true
    )
    return unwrapData<SopAnnexureEntry>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to create annexure entry")
  }
}

export async function updateAnnexureEntry(
  sopId: string,
  annexureId: string,
  entryId: string,
  payload: UpdateAnnexureEntryRequest
): Promise<SopAnnexureEntry> {
  try {
    const response = await apiCall<SopAnnexureEntry | { data: SopAnnexureEntry }>(
      `/sops/${sopId}/annexures/${annexureId}/entries/${entryId}`,
      "PATCH",
      payload,
      true
    )
    return unwrapData<SopAnnexureEntry>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to update annexure entry")
  }
}

export async function deleteAnnexureEntry(sopId: string, annexureId: string, entryId: string): Promise<void> {
  try {
    await apiCall(`/sops/${sopId}/annexures/${annexureId}/entries/${entryId}`, "DELETE", undefined, true)
  } catch (error: any) {
    parseApiError(error, "Failed to delete annexure entry")
  }
}

export async function fetchSopComments(sopId: string): Promise<SopComment[]> {
  try {
    const response = await apiCall<SopComment[] | { data: SopComment[] }>(`/sops/${sopId}/comments`, "GET", undefined, true)
    return unwrapArray<SopComment>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to fetch comments")
  }
}

export async function createSopComment(sopId: string, payload: CreateCommentRequest): Promise<SopComment> {
  try {
    const response = await apiCall<SopComment | { data: SopComment }>(`/sops/${sopId}/comments`, "POST", payload, true)
    return unwrapData<SopComment>(response)
  } catch (error: any) {
    parseApiError(error, "Failed to create comment")
  }
}

export async function deleteSopComment(sopId: string, commentId: string): Promise<void> {
  try {
    await apiCall(`/sops/${sopId}/comments/${commentId}`, "DELETE", undefined, true)
  } catch (error: any) {
    parseApiError(error, "Failed to delete comment")
  }
}

export function getUserDisplayName(user?: UserLite | null): string {
  if (!user) {
    return "Unknown"
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
  return name || user.email || "Unknown"
}

export function formatSopStatus(status: SopStatus | string): string {
  const value = status || "draft"
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
}

export function getSopStatusBadge(status: SopStatus | string): string {
  switch ((status || "draft").toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800"
    case "archived":
      return "bg-gray-100 text-gray-700"
    case "draft":
    default:
      return "bg-amber-100 text-amber-800"
  }
}

export function getCommentTypeBadge(commentType: CommentType | string): string {
  switch ((commentType || "general").toLowerCase()) {
    case "guidance":
      return "bg-blue-100 text-blue-800"
    case "capa":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-700"
  }
}
