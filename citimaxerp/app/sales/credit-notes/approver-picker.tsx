"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApproverOption, fetchApproverOptions } from "@/lib/credit-notes"

/**
 * The 2 people who must approve a credit note before it is credited. Lists active users other than
 * the one creating it; the same person cannot be picked twice.
 */
export function ApproverPicker({
  value,
  onChange,
  disabled,
}: {
  value: [string, string]
  onChange: (value: [string, string]) => void
  disabled?: boolean
}) {
  const [options, setOptions] = useState<ApproverOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchApproverOptions()
      .then(setOptions)
      .catch((e) => setError(e?.message || "Could not load the list of people"))
      .finally(() => setLoading(false))
  }, [])

  const label = (o: ApproverOption) => (o.role ? `${o.name} (${o.role})` : o.name)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((slot) => {
          const other = value[slot === 0 ? 1 : 0]
          return (
            <div key={slot} className="space-y-2">
              <Label>Approver {slot + 1} *</Label>
              <Select
                value={value[slot] || undefined}
                onValueChange={(id) => {
                  const next: [string, string] = [...value] as [string, string]
                  next[slot] = id
                  onChange(next)
                }}
                disabled={disabled || loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading ? "Loading..." : "Choose a person"} />
                </SelectTrigger>
                <SelectContent>
                  {options
                    .filter((o) => o.id !== other)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {label(o)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Both must approve it, each with a comment (e.g. &quot;Products in good shape&quot;), before the customer is
          credited and the stock goes back. If either rejects it, it is not credited.
        </p>
      )}
    </div>
  )
}
