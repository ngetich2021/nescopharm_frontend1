"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DURATION_UNITS,
  LEAVE_TYPES,
  REASON_CATEGORIES,
  daysInclusive,
  isRecordDate,
  nextDay,
  type LeaveFormValues,
} from "@/lib/leave";

const SELECT_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  // Dates fill in the reporting day and the number of days, unless they were set by hand to hours.
  const setDates = (start: string, end: string) => {
    const patch: Partial<LeaveFormValues> = { start_date: start, end_date: end };
    if (end && (!value.reporting_date || value.reporting_date === nextDay(value.end_date))) patch.reporting_date = nextDay(end);
    if (value.duration_unit !== "hours" && start && end) {
      const days = daysInclusive(start, end);
      patch.total_requested = String(days);
      patch.duration_unit = days === 1 ? "day" : "days";
    }
    set(patch);
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
          <Label htmlFor="requestDate">Date of Request</Label>
          <Input id="requestDate" type="date" value={value.request_date} onChange={(e) => set({ request_date: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date (Day Out)</Label>
          <Input id="startDate" type="date" value={value.start_date} onChange={(e) => setDates(e.target.value, value.end_date || e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Last Day of Leave</Label>
          <Input id="endDate" type="date" value={value.end_date} min={value.start_date || undefined} onChange={(e) => setDates(value.start_date, e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reportingDate">Reporting Date (Day In)</Label>
          <Input id="reportingDate" type="date" value={value.reporting_date} onChange={(e) => set({ reporting_date: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="totalRequested">Total Requested</Label>
          <div className="flex gap-2">
            <Input id="totalRequested" type="number" min="0" step="0.5" value={value.total_requested} onChange={(e) => set({ total_requested: e.target.value })} className="w-28" />
            <select aria-label="Hours, day or days" value={value.duration_unit} onChange={(e) => set({ duration_unit: e.target.value })} className={SELECT_CLASS}>
              {DURATION_UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
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
        {record && (
          <div className="space-y-2">
            <Label htmlFor="approvedOn">Date Approved</Label>
            <Input id="approvedOn" type="date" value={value.approved_on} placeholder={value.start_date} onChange={(e) => set({ approved_on: e.target.value })} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Details{value.reason_category ? " (optional)" : ""}</Label>
        <Textarea id="reason" value={value.reason} onChange={(e) => set({ reason: e.target.value })} rows={3} required={!value.reason_category} />
      </div>

      {record && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          This leave starts today or earlier, so it is saved as a record, approved by {recordsApprover || "the General Manager"}
          {value.approved_on ? ` on ${value.approved_on}` : " (dated its start date unless you set Date Approved)"}.
        </div>
      )}
    </div>
  );
}
