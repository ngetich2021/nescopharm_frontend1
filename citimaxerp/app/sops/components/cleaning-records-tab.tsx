"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, ClipboardCheck, Loader2, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { displayDate, displayDateTime } from "@/lib/date-format"
import { ExportMenu, useTableExport } from "@/components/export-menu"
import { TablePager, usePaged } from "@/components/ui/table-pager"
import {
  checkCleaningLog,
  createCleaningLog,
  deleteCleaningLog,
  fetchCleaningLogs,
  fetchSopCheckers,
  updateCleaningLog,
  type CleaningLog,
  type SopChecker,
} from "@/lib/cleaning-logs"
import { SortHead, useSorted } from "./sortable"
import { SheetImport } from "./sheet-import"

// Local calendar day (toISOString is UTC and can be yesterday in Kenya before 03:00).
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const blankForm = () => ({ cleaning_date: today(), start_time: "", end_time: "", areas: "", cleaned_by: "", checker_user_id: "", remarks: "" })

type SortKey = "date" | "start" | "areas" | "cleaned_by" | "prepared_by" | "checker" | "status"

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong")

/**
 * The cleaning services sheet. The store manager records each cleaning and picks who checks it; the
 * checker is notified, writes a comment and confirms. Who prepared and who checked are both kept.
 */
export default function CleaningRecordsTab() {
  const { toast } = useToast()
  const { user, hasPermission } = useAuth()
  const isManager = hasPermission("can_manage_company") || hasPermission("can_manage_system")

  const [logs, setLogs] = useState<CleaningLog[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [cleaners, setCleaners] = useState<string[]>([])
  const [checkers, setCheckers] = useState<SopChecker[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState<CleaningLog | null>(null)
  const set = (k: keyof ReturnType<typeof blankForm>, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const [checking, setChecking] = useState<CleaningLog | null>(null)
  const [comment, setComment] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filters: the date range is asked of the server, the rest is applied here.
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"all" | "pending" | "checked">("all")
  const [checkerFilter, setCheckerFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCleaningLogs({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
      setLogs(res.data)
      setAreas(res.areas)
      setCleaners(res.cleaners)
    } catch (e) {
      toast({ title: "Could not load cleaning records", description: errorText(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchSopCheckers().then(setCheckers).catch(() => setCheckers([])) }, [])

  const mine = useMemo(() => logs.filter((l) => l.status === "pending" && l.checker_user_id === user?.id), [logs, user?.id])
  const checkerNames = useMemo(() => Array.from(new Set(logs.map((l) => l.checker_name).filter(Boolean) as string[])).sort(), [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((l) =>
      (status === "all" || l.status === status) &&
      (checkerFilter === "all" || l.checker_name === checkerFilter) &&
      (!q || [l.areas, l.cleaned_by, l.prepared_by_name, l.checker_name, l.checker_comment, l.remarks, displayDate(l.cleaning_date)]
        .some((v) => v && v.toLowerCase().includes(q))))
  }, [logs, search, status, checkerFilter])

  const { sorted, sortKey, sortDir, toggle } = useSorted<CleaningLog, SortKey>(filtered, (l, key) => ({
    date: `${l.cleaning_date} ${l.start_time ?? ""}`,
    start: l.start_time,
    areas: l.areas,
    cleaned_by: l.cleaned_by,
    prepared_by: l.prepared_by_name,
    checker: l.checker_name,
    status: l.status,
  })[key], "date", "desc")
  const { pageRows, start, pager } = usePaged(sorted, 20, `${search}|${status}|${checkerFilter}|${dateFrom}|${dateTo}`)

  const exportLogs = useTableExport(() => ({
    fileName: `cleaning-records${dateFrom ? `-${dateFrom}` : ""}${dateTo ? `-to-${dateTo}` : ""}`,
    title: "Cleaning Services",
    subtitle: dateFrom || dateTo ? `${dateFrom ? displayDate(dateFrom) : "Start"} to ${dateTo ? displayDate(dateTo) : "today"}` : undefined,
    headers: ["S/No", "Date", "Start", "End", "Areas Cleaned", "Cleaned By", "Prepared By", "Checked By", "Status", "Checker Comment", "Remarks"],
    rows: sorted.map((l, i) => [
      i + 1, displayDate(l.cleaning_date), l.start_time || "", l.end_time || "", l.areas, l.cleaned_by || "",
      l.prepared_by_name || "", l.checker_name || "", l.status === "checked" ? "Checked" : "Awaiting check",
      l.checker_comment || "", l.remarks || "",
    ]),
  }))

  const resetForm = () => { setEditing(null); setForm(blankForm()) }

  const startEdit = (l: CleaningLog) => {
    setEditing(l)
    setForm({
      cleaning_date: l.cleaning_date.slice(0, 10), start_time: l.start_time || "", end_time: l.end_time || "", areas: l.areas,
      cleaned_by: l.cleaned_by || "", checker_user_id: l.checker_user_id || "", remarks: l.remarks || "",
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const save = async () => {
    if (!form.cleaning_date || !form.areas.trim()) {
      toast({ title: "Missing details", description: "Give the date and the areas cleaned (write Holiday for a day off).", variant: "destructive" })
      return
    }
    if (!form.checker_user_id) {
      toast({ title: "Pick a checker", description: "Choose who will check this cleaning.", variant: "destructive" })
      return
    }
    if (form.start_time && form.end_time && form.end_time < form.start_time) {
      toast({ title: "Check the times", description: "The end time is before the start time.", variant: "destructive" })
      return
    }
    const payload = {
      cleaning_date: form.cleaning_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      areas: form.areas.trim(),
      cleaned_by: form.cleaned_by.trim() || null,
      remarks: form.remarks.trim() || null,
      checker_user_id: form.checker_user_id,
    }
    setSaving(true)
    try {
      const res = editing ? await updateCleaningLog(editing.id, payload) : await createCleaningLog(payload)
      toast({ title: editing ? "Cleaning updated" : "Cleaning recorded", description: res.message })
      resetForm()
      load()
    } catch (e) {
      toast({ title: "Could not save", description: errorText(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const confirmCheck = async () => {
    if (!checking) return
    if (!comment.trim()) {
      toast({ title: "Write a comment", description: "Say how the cleaning was before confirming it.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await checkCleaningLog(checking.id, comment.trim())
      toast({ title: "Cleaning checked", description: `${displayDate(checking.cleaning_date)} - ${checking.areas}` })
      setChecking(null)
      setComment("")
      load()
    } catch (e) {
      toast({ title: "Could not check it", description: errorText(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (l: CleaningLog) => {
    if (!window.confirm(`Delete the cleaning of ${l.areas} on ${displayDate(l.cleaning_date)}?`)) return
    setDeletingId(l.id)
    try {
      await deleteCleaningLog(l.id)
      toast({ title: "Deleted", description: "Cleaning record deleted." })
      if (editing?.id === l.id) resetForm()
      load()
    } catch (e) {
      toast({ title: "Delete failed", description: errorText(e), variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const canEdit = (l: CleaningLog) => l.status === "pending" || isManager

  return (
    <div className="space-y-6">
      {mine.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <ClipboardCheck className="h-4 w-4" />
              Waiting for your check ({mine.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mine.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{displayDate(l.cleaning_date)}</span>
                  {l.start_time && ` ${l.start_time}${l.end_time ? `-${l.end_time}` : ""}`} · {l.areas}
                  {l.cleaned_by && ` · cleaned by ${l.cleaned_by}`} · prepared by {l.prepared_by_name || "-"}
                </span>
                <Button size="sm" onClick={() => { setChecking(l); setComment("") }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Check
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {editing ? `Edit Cleaning of ${displayDate(editing.cleaning_date)}` : "Record Cleaning"}
          </CardTitle>
          <CardDescription>
            Pick who checks it; they are notified, write their comment and confirm. Any past date can be chosen to type in an old sheet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" max={today()} value={form.cleaning_date} onChange={(e) => set("cleaning_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Time</Label>
              <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Areas Cleaned *</Label>
              <Input list="cleaning-areas" placeholder="e.g. All areas, Offices/windows" value={form.areas} onChange={(e) => set("areas", e.target.value)} />
              <datalist id="cleaning-areas">
                {["All areas", "Offices/windows", "Godown/ctns", "Offices", "Holiday", ...areas].filter((v, i, a) => a.indexOf(v) === i).map((a) => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Cleaned By</Label>
              <Input list="cleaning-cleaners" placeholder="Cleaner's name" value={form.cleaned_by} onChange={(e) => set("cleaned_by", e.target.value)} />
              <datalist id="cleaning-cleaners">
                {cleaners.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Checked By *</Label>
              <Select value={form.checker_user_id || undefined} onValueChange={(v) => set("checker_user_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={checkers.length ? "Pick who checks it" : "No checkers set up"} />
                </SelectTrigger>
                <SelectContent>
                  {checkers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {checkers.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Give a role &quot;Check SOP Records&quot; on Users &gt; Roles.</p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Remarks</Label>
              <Input placeholder="Optional" value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editing && <Button variant="outline" onClick={resetForm} disabled={saving}>Cancel</Button>}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {editing ? "Save Changes" : "Record & Send to Checker"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Cleaning Services</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <SheetImport entity="cleaning_logs" label="Cleaning Records" onImported={load} />
              <ExportMenu onExport={exportLogs} disabled={sorted.length === 0} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input className="pl-8 w-[220px]" placeholder="Search cleaning..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Awaiting check</SelectItem>
                <SelectItem value="checked">Checked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={checkerFilter} onValueChange={setCheckerFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="All checkers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All checkers</SelectItem>
                {checkerNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              From
              <Input type="date" className="w-[150px]" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
              to
              <Input type="date" className="w-[150px]" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-center">S/No</TableHead>
                  <SortHead label="Date" column="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortHead label="Start-End" column="start" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortHead label="Areas Cleaned" column="areas" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortHead label="Cleaned By" column="cleaned_by" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortHead label="Prepared By" column="prepared_by" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortHead label="Checked By" column="checker" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <SortHead label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                  <TableHead>Checker Comment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-gray-500">No cleaning records match these filters.</TableCell>
                  </TableRow>
                ) : pageRows.map((l, i) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-center text-muted-foreground">{start + i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayDate(l.cleaning_date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{l.start_time || l.end_time ? `${l.start_time || "-"} - ${l.end_time || "-"}` : "-"}</TableCell>
                    <TableCell className="font-medium">{l.areas}</TableCell>
                    <TableCell>{l.cleaned_by || "-"}</TableCell>
                    <TableCell>{l.prepared_by_name || "-"}</TableCell>
                    <TableCell>{l.checker_name || "-"}</TableCell>
                    <TableCell>
                      {l.status === "checked" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100" title={l.checked_at ? `Checked ${displayDateTime(l.checked_at)}` : undefined}>Checked</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Awaiting check</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-normal text-sm">{l.checker_comment || "-"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {l.status === "pending" && l.checker_user_id === user?.id && (
                        <Button size="sm" variant="outline" className="mr-1" onClick={() => { setChecking(l); setComment("") }}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Check
                        </Button>
                      )}
                      {canEdit(l) && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => startEdit(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {isManager && (
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(l)} disabled={deletingId === l.id}>
                          {deletingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <TablePager {...pager} />
        </CardContent>
      </Card>

      <Dialog open={!!checking} onOpenChange={(o) => { if (!o && !saving) setChecking(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check Cleaning</DialogTitle>
            <DialogDescription>
              {checking && `${displayDate(checking.cleaning_date)}${checking.start_time ? ` ${checking.start_time}-${checking.end_time || ""}` : ""} · ${checking.areas}${checking.cleaned_by ? ` · cleaned by ${checking.cleaned_by}` : ""}. Prepared by ${checking.prepared_by_name || "-"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Your comment *</Label>
            <Textarea rows={3} placeholder="e.g. All areas clean, bins emptied" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChecking(null)} disabled={saving}>Cancel</Button>
            <Button onClick={confirmCheck} disabled={saving || !comment.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Checked
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
