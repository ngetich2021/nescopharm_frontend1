"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Plus, Thermometer, AlertTriangle, Trash2, X } from "lucide-react"
import {
  createTemperatureLog,
  deleteTemperatureLog,
  fetchTemperatureLogs,
  updateTemperatureLog,
  TemperatureLog,
} from "@/lib/temperature-logs"
import { formatDate } from "@/lib/utils"

// Local-time date strings - toISOString() is UTC and can land on the wrong
// calendar day near midnight for timezones ahead of UTC (e.g. Kenya).
function todayDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function currentMonthString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// Morning readings must be logged before 10:00, afternoon ones from 12:00 -
// matches the physical routine (open-of-day vs midday check), and keeps
// someone from backfilling a reading outside the window it's meant to
// represent. Only enforced for today's row; past dates can still be edited.
// Must match TemperatureLogController::MORNING_CUTOFF_HOUR/AFTERNOON_START_HOUR
// exactly - these need to meet at the same hour, or there's a dead zone
// where neither field can be captured (that's the bug this used to have).
const MORNING_CUTOFF_HOUR = 12
const AFTERNOON_START_HOUR = 12

function getErrorMessage(error: any): string {
  const validationErrors = error?.apiResponse?.errors
  if (validationErrors && typeof validationErrors === "object") {
    return Object.values(validationErrors).flat().join(", ")
  }
  return error?.message || "An unexpected error occurred"
}

const emptyForm = {
  thermometer_name: "",
  area_room: "",
  acceptance_max_celsius: "30",
  log_date: todayDateString(),
  morning_temp: "",
  afternoon_temp: "",
  checked_by: "",
  remarks: "",
}

/**
 * A "pick from existing, or add a new one" field - a Select of known values
 * with a "+" button that swaps in a plain text input for typing a brand new
 * value (there's no separate master list to manage; a new name just starts
 * showing up in the lookup once it's used).
 */
function LookupField({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const [addingNew, setAddingNew] = useState(options.length === 0)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          onClick={() => setAddingNew((prev) => !prev)}
          title={addingNew ? "Back to the list" : "Add a new value"}
        >
          {addingNew ? (
            <X className="h-3 w-3" />
          ) : (
            <>
              <Plus className="h-3 w-3" /> Add new
            </>
          )}
        </button>
      </div>
      {addingNew ? (
        <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

export default function TemperatureRecordsTab() {
  const { toast } = useToast()
  const { user, hasPermission } = useAuth()
  // Matches the backend's isGmOrDirector() check for destroy() - deletion is
  // reserved for GM/Director specifically, not the general can_delete_sops
  // permission other temperature-log actions accept.
  const canDeleteLogs = hasPermission("can_manage_company")

  const [logs, setLogs] = useState<TemperatureLog[]>([])
  const [thermometers, setThermometers] = useState<string[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filters - default to this month, all thermometers.
  const [thermometerFilter, setThermometerFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState(currentMonthString())

  // Quick-entry form - defaults to today's reading, checked by whoever's
  // logged in (still editable, in case someone else did the check).
  const [form, setForm] = useState(emptyForm)
  // Set once the form's thermometer+date matches an existing reading, so
  // submitting updates that same row (e.g. adding the afternoon reading to
  // a row the morning check already created) instead of creating a
  // duplicate and hitting the one-reading-per-day conflict.
  const [editingId, setEditingId] = useState<string | null>(null)

  // Ticks every 30s purely to force a re-render, so the morning/afternoon
  // capture window (below) stays accurate if the tab is left open across
  // the 10:00/12:00 boundary rather than freezing at whatever time the
  // page happened to load.
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  const isTodaySelected = form.log_date === todayDateString()
  const currentHour = new Date().getHours()
  const morningWindowOpen = !isTodaySelected || currentHour < MORNING_CUTOFF_HOUR
  const afternoonWindowOpen = !isTodaySelected || currentHour >= AFTERNOON_START_HOUR

  const maxAllowedCelsius = form.acceptance_max_celsius ? Number(form.acceptance_max_celsius) : null
  const morningOutOfRange = maxAllowedCelsius !== null && form.morning_temp !== "" && Number(form.morning_temp) > maxAllowedCelsius
  const afternoonOutOfRange = maxAllowedCelsius !== null && form.afternoon_temp !== "" && Number(form.afternoon_temp) > maxAllowedCelsius

  useEffect(() => {
    if (user) {
      const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
      if (name) {
        setForm((prev) => (prev.checked_by ? prev : { ...prev, checked_by: name }))
      }
    }
  }, [user])

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, thermometers: names, areas: areaNames } = await fetchTemperatureLogs({
        thermometer_name: thermometerFilter !== "all" ? thermometerFilter : undefined,
        month: monthFilter || undefined,
      })
      setLogs(data)
      setThermometers(names)
      setAreas(areaNames)
    } catch (error: any) {
      toast({
        title: "Failed to load temperature records",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [thermometerFilter, monthFilter, toast])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()),
    [logs]
  )

  const outOfRangeCount = useMemo(() => sortedLogs.filter((log) => log.is_out_of_range).length, [sortedLogs])

  const handleFormChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Whenever the thermometer or date changes, check whether a reading
  // already exists for that pair - if so, load it into the form (so an
  // afternoon check adds to the morning one's row rather than colliding
  // with it) and switch to update mode; otherwise start fresh.
  useEffect(() => {
    if (!form.thermometer_name || !form.log_date) {
      setEditingId(null)
      return
    }

    const existing = logs.find(
      (log) => log.thermometer_name === form.thermometer_name && log.log_date.slice(0, 10) === form.log_date
    )

    if (existing) {
      setEditingId(existing.id)
      setForm((prev) => ({
        ...prev,
        area_room: existing.area_room || prev.area_room,
        acceptance_max_celsius: existing.acceptance_max_celsius ?? prev.acceptance_max_celsius,
        morning_temp: existing.morning_temp ?? "",
        afternoon_temp: existing.afternoon_temp ?? "",
        checked_by: existing.checked_by || prev.checked_by,
        remarks: existing.remarks || "",
      }))
    } else {
      setEditingId(null)
    }
    // Only re-check when the identifying fields change, not on every
    // keystroke of the other fields (which would fight the user's typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.thermometer_name, form.log_date, logs])

  const handleSubmit = async () => {
    if (!form.thermometer_name.trim()) {
      toast({ title: "Missing thermometer", description: "Enter which thermometer this reading is for.", variant: "destructive" })
      return
    }
    if (!form.morning_temp && !form.afternoon_temp) {
      toast({ title: "Missing reading", description: "Enter at least a morning or afternoon temperature.", variant: "destructive" })
      return
    }

    // The Log/Update button is disabled whenever a value is out of range,
    // so this is just a defensive guard against calling handleSubmit some
    // other way while the form is still in that state.
    if (morningOutOfRange || afternoonOutOfRange) {
      toast({
        title: "Reading exceeds the acceptance limit",
        description: `Bring it within ${maxAllowedCelsius}°C, or correct the acceptance max, before logging.`,
        variant: "destructive",
      })
      return
    }

    const payload = {
      thermometer_name: form.thermometer_name.trim(),
      area_room: form.area_room.trim() || undefined,
      acceptance_max_celsius: form.acceptance_max_celsius ? Number(form.acceptance_max_celsius) : undefined,
      log_date: form.log_date,
      morning_temp: form.morning_temp ? Number(form.morning_temp) : null,
      afternoon_temp: form.afternoon_temp ? Number(form.afternoon_temp) : null,
      checked_by: form.checked_by.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
    }

    setIsSubmitting(true)
    try {
      if (editingId) {
        await updateTemperatureLog(editingId, payload)
        toast({ title: "Reading updated", description: `${form.thermometer_name} - ${form.log_date}` })
      } else {
        await createTemperatureLog(payload)
        toast({ title: "Reading logged", description: `${form.thermometer_name} - ${form.log_date}` })
      }

      setEditingId(null)
      setForm({ ...emptyForm, checked_by: form.checked_by })
      loadLogs()
    } catch (error: any) {
      toast({
        title: "Failed to save reading",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (log: TemperatureLog) => {
    if (!window.confirm(`Delete the ${log.thermometer_name} reading for ${log.log_date}?`)) {
      return
    }
    try {
      setDeletingId(log.id)
      await deleteTemperatureLog(log.id)
      toast({ title: "Deleted", description: "Temperature record deleted." })
      loadLogs()
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: getErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Thermometer className="h-4 w-4" />
            {editingId ? "Update Today's Reading" : "Log Today's Reading"}
          </CardTitle>
          {editingId && (
            <p className="text-xs text-muted-foreground">
              A reading already exists for this thermometer and date - saving will update it.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <LookupField
              label="Thermometer"
              placeholder="e.g. Thermometer 2"
              value={form.thermometer_name}
              options={thermometers}
              onChange={(value) => handleFormChange("thermometer_name", value)}
            />
            <LookupField
              label="Area/Room"
              placeholder="e.g. Cold Room"
              value={form.area_room}
              options={areas}
              onChange={(value) => handleFormChange("area_room", value)}
            />
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.log_date} onChange={(e) => handleFormChange("log_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Acceptance Max (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.acceptance_max_celsius}
                onChange={(e) => handleFormChange("acceptance_max_celsius", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Morning Temp (°C)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 22.5"
                value={form.morning_temp}
                onChange={(e) => handleFormChange("morning_temp", e.target.value)}
                disabled={!morningWindowOpen}
                className={morningOutOfRange ? "border-red-500 text-red-700 focus-visible:ring-red-500" : undefined}
              />
              <p className={`text-[11px] ${morningOutOfRange ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                {morningOutOfRange
                  ? `Exceeds the ${maxAllowedCelsius}°C limit`
                  : morningWindowOpen
                    ? `Must be logged before ${MORNING_CUTOFF_HOUR}:00`
                    : `Window closed - only before ${MORNING_CUTOFF_HOUR}:00`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Afternoon Temp (°C)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 24.0"
                value={form.afternoon_temp}
                onChange={(e) => handleFormChange("afternoon_temp", e.target.value)}
                disabled={!afternoonWindowOpen}
                className={afternoonOutOfRange ? "border-red-500 text-red-700 focus-visible:ring-red-500" : undefined}
              />
              <p className={`text-[11px] ${afternoonOutOfRange ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                {afternoonOutOfRange
                  ? `Exceeds the ${maxAllowedCelsius}°C limit`
                  : afternoonWindowOpen
                    ? `Open from ${AFTERNOON_START_HOUR}:00`
                    : `Not yet - opens at ${AFTERNOON_START_HOUR}:00`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Checked By</Label>
              <Input
                placeholder="Name"
                value={form.checked_by}
                onChange={(e) => handleFormChange("checked_by", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Input
                placeholder="Optional"
                value={form.remarks}
                onChange={(e) => handleFormChange("remarks", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {(morningOutOfRange || afternoonOutOfRange) && (
              <p className="text-xs text-red-600 font-medium">
                Bring the reading within {maxAllowedCelsius}°C to log it, or correct the acceptance max above.
              </p>
            )}
            <Button onClick={handleSubmit} disabled={isSubmitting || morningOutOfRange || afternoonOutOfRange}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {editingId ? "Update Reading" : "Log Reading"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {outOfRangeCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            {outOfRangeCount} reading{outOfRangeCount === 1 ? "" : "s"} in this view breached the acceptance limit.
          </p>
        </div>
      )}

      {/* Filters + chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Temperature Record Chart</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={thermometerFilter} onValueChange={setThermometerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All thermometers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All thermometers</SelectItem>
                  {thermometers.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                className="w-[160px]"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Thermometer</TableHead>
                  <TableHead>Area/Room</TableHead>
                  <TableHead>Morning (°C)</TableHead>
                  <TableHead>Afternoon (°C)</TableHead>
                  <TableHead>Checked By</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                      No temperature readings for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLogs.map((log) => (
                    <TableRow key={log.id} className={log.is_out_of_range ? "bg-red-50" : undefined}>
                      <TableCell>{formatDate(log.log_date)}</TableCell>
                      <TableCell className="font-medium">{log.thermometer_name}</TableCell>
                      <TableCell>{log.area_room || "-"}</TableCell>
                      <TableCell>{log.morning_temp ?? "-"}</TableCell>
                      <TableCell>{log.afternoon_temp ?? "-"}</TableCell>
                      <TableCell>{log.checked_by || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.is_out_of_range && (
                          <Badge variant="destructive" className="mr-1">Out of range</Badge>
                        )}
                        {log.remarks || (log.is_out_of_range ? "" : "-")}
                      </TableCell>
                      <TableCell className="text-right">
                        {canDeleteLogs && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(log)}
                            disabled={deletingId === log.id}
                          >
                            {deletingId === log.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
