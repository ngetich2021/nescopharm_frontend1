"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAVE_TYPES,
  REASON_CATEGORIES,
  formatLeaveDate,
  isRecordDate,
  leaveDates,
  type LeaveFormValues,
} from "@/lib/leave";

const SELECT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A date chosen from a calendar (never typed), kept as yyyy-mm-dd. */
function DatePick({ value, onChange, label, placeholder = "Pick a date" }: { value: string; onChange: (date: string) => void; label: string; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" aria-label={label} className="h-10 w-full justify-start px-3 text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value ? formatLeaveDate(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (!d) return;
            const pad = (n: number) => String(n).padStart(2, "0");
            onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface LeaveFormFieldsProps {
  value: LeaveFormValues;
  onChange: (value: LeaveFormValues) => void;
  /** Days left after this leave (worked out from the employee's other approved leave), null if not known. */
  balanceAfter: number | null;
  /** Full name of the user who approves leave entered as a record. */
  recordsApprover: string | null;
  /** True when editing leave already saved as a record (its approval date can be corrected). */
  isRecord?: boolean;
}

/** The fields of the paper Employee Leave Request Form. */
export function LeaveFormFields({ value, onChange, balanceAfter, recordsApprover, isRecord }: LeaveFormFieldsProps) {
  const set = (patch: Partial<LeaveFormValues>) => onChange({ ...value, ...patch });
  const record = isRecord ?? isRecordDate(value.start_date);

  // The start date and how much leave decide the last day and the day the employee reports back
  // (working days, Sundays off) - those two are worked out, never typed.
  const unitChoice = value.duration_unit === "hours" ? "hours" : "days";
  const setLeave = (start: string, total: string, unit: string) => {
    const n = Number(total) || 0;
    const { end, reporting } = leaveDates(start, n, unit);
    set({
      start_date: start,
      total_requested: total,
      duration_unit: unit === "hours" ? "hours" : n === 1 ? "day" : "days",
      end_date: end,
      reporting_date: reporting,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="leaveType">Leave Type</Label>
          <select id="leaveType" value={value.leave_type} onChange={(e) => set({ leave_type: e.target.value })} className={SELECT_CLASS} required>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label} ({t.days} days)</option>
            ))}
            {value.leave_type === "unpaid" && <option value="unpaid">Unpaid Leave</option>}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Date of Request</Label>
          <DatePick value={value.request_date} onChange={(d) => set({ request_date: d })} label="Date of request" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Start Date (Day Out)</Label>
          <DatePick value={value.start_date} onChange={(d) => setLeave(d, value.total_requested || "1", unitChoice)} label="Start date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalRequested">Total Requested</Label>
          <div className="flex h-10 overflow-hidden rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
            <input
              id="totalRequested"
              type="number"
              min="0.5"
              step="0.5"
              value={value.total_requested}
              placeholder="1"
              onChange={(e) => setLeave(value.start_date, e.target.value, unitChoice)}
              className="w-full min-w-0 bg-background px-3 text-sm outline-none"
            />
            <select
              aria-label="Days or hours"
              value={unitChoice}
              onChange={(e) => setLeave(value.start_date, value.total_requested, e.target.value)}
              className="border-l border-input bg-muted px-2 text-sm outline-none"
            >
              <option value="days">Days</option>
              <option value="hours">Hours</option>
            </select>
          </div>
        </div>
      </div>

      {value.start_date && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <span><span className="text-muted-foreground">Day out:</span> <span className="font-medium">{formatLeaveDate(value.start_date)}</span></span>
          <span><span className="text-muted-foreground">Last day:</span> <span className="font-medium">{formatLeaveDate(value.end_date)}</span></span>
          <span><span className="text-muted-foreground">Reports back (day in):</span> <span className="font-medium">{formatLeaveDate(value.reporting_date)}</span></span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reasonCategory">Reason for Request</Label>
          <select id="reasonCategory" value={value.reason_category} onChange={(e) => set({ reason_category: e.target.value })} className={SELECT_CLASS}>
            <option value="">Select reason</option>
            {REASON_CATEGORIES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="balanceDays">Balance After This Leave (days)</Label>
          {record ? (
            <Input
              id="balanceDays"
              type="number"
              step="0.5"
              value={value.balance_days}
              placeholder={balanceAfter != null ? String(balanceAfter) : "Not applicable"}
              onChange={(e) => set({ balance_days: e.target.value })}
            />
          ) : (
            <div className="rounded-md border bg-muted px-3 py-2 text-sm">
              {balanceAfter == null ? "Not applicable" : `${balanceAfter} days`}
            </div>
          )}
          {record && <p className="text-xs text-muted-foreground">Enter the balance written on the paper form, or leave blank to work it out.</p>}
          {!record && balanceAfter != null && balanceAfter < 0 && (
            <p className="text-xs text-red-600">This is more than the days left for this leave type this year.</p>
          )}
        </div>
      </div>

      {record && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Date Approved</Label>
            <DatePick value={value.approved_on} onChange={(d) => set({ approved_on: d })} label="Date approved" placeholder={value.start_date ? `Default: ${formatLeaveDate(value.start_date)}` : "Pick a date"} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason">Details{value.reason_category ? " (optional)" : ""}</Label>
        <Textarea id="reason" value={value.reason} onChange={(e) => set({ reason: e.target.value })} rows={3} required={!value.reason_category} />
      </div>

      {record && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          This leave starts today or earlier, so it is saved as a record, approved by {recordsApprover || "the General Manager"}
          {value.approved_on ? ` on ${formatLeaveDate(value.approved_on)}` :" (dated its start date unless you set Date Approved)"}.
        </div>
      )}
    </div>
  );
}
