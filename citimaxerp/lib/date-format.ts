// How a date is shown everywhere in the system: dd/mm/yyyy, with the time as 24-hour HH:mm.
// Date inputs and API values keep yyyy-mm-dd; this is only for what people read.

type DateValue = string | number | Date | null | undefined

const pad = (n: number) => String(n).padStart(2, "0")

// "2026-11-04" is that calendar day wherever the browser is, not midnight UTC.
function parse(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null
  const dayOnly = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = dayOnly ? new Date(+dayOnly[1], +dayOnly[2] - 1, +dayOnly[3]) : new Date(value)
  return isNaN(date.getTime()) ? null : date
}

/** 04/11/2026 */
export function displayDate(value: DateValue): string {
  const d = parse(value)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "-"
}

/** 04/11/2026 14:05 */
export function displayDateTime(value: DateValue): string {
  const d = parse(value)
  return d ? `${displayDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "-"
}

/** 04/11, for chart labels and lists where the year is plain. */
export function displayDayMonth(value: DateValue): string {
  const d = parse(value)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : "-"
}
