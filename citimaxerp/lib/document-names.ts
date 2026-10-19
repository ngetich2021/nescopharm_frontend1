// Downloaded files get a readable name that says what they are and who/when
// they're for, e.g. "Lenexa Pharmacy - Account Statement for period
// 01-01-2025 to 31-08-2026.pdf", instead of "Statement-12.pdf".

type NamePart = string | number | null | undefined | false

/** Strips characters Windows/macOS refuse in file names and tidies spacing. */
export function cleanFileNamePart(value: NamePart): string {
  if (value === null || value === undefined || value === false) return ""
  return String(value)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "")
}

/** "2025-01-01" -> "01-01-2025". Anything unparseable passes through cleaned. */
export function fileDate(value: string | Date | null | undefined): string {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(String(value).length === 10 ? `${value}T00:00:00` : value)
  if (isNaN(d.getTime())) return cleanFileNamePart(String(value))
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`
}

export function todayFileDate(): string {
  return fileDate(new Date())
}

/** "for period 01-01-2025 to 31-08-2026", or "as at 31-08-2026" for a single date. */
export function filePeriod(from?: string | Date | null, to?: string | Date | null): string {
  const f = fileDate(from)
  const t = fileDate(to)
  if (f && t) return `for period ${f} to ${t}`
  if (t || f) return `as at ${t || f}`
  return ""
}

/**
 * Joins the non-empty parts with " - " and appends the extension.
 * documentFileName(["Lenexa", "Order ORD-0012"], "pdf") -> "Lenexa - Order ORD-0012.pdf"
 */
export function documentFileName(parts: NamePart[], ext?: string): string {
  const base = parts.map(cleanFileNamePart).filter(Boolean).join(" - ").slice(0, 180) || "document"
  return ext ? `${base}.${ext.replace(/^\./, "")}` : base
}

/**
 * Browsers use document.title as the suggested name for "Save as PDF" in the
 * print dialog, so set it for the duration of the print.
 */
export function printWithFileName(fileName: string) {
  const previous = document.title
  document.title = fileName.replace(/\.pdf$/i, "")
  const restore = () => {
    document.title = previous
    window.removeEventListener("afterprint", restore)
  }
  window.addEventListener("afterprint", restore)
  window.print()
}

/** Company name as stored on the logged-in user's session, for report file names. */
export function sessionCompanyName(): string {
  if (typeof window === "undefined") return ""
  try {
    for (const key of ["company", "user"]) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const name = parsed?.company?.name ?? parsed?.company_name ?? (key === "company" ? parsed?.name : undefined)
      if (typeof name === "string" && name.trim()) return name.trim()
    }
  } catch {
    /* storage unavailable */
  }
  return ""
}
