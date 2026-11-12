"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ApproverOption, fetchApproverOptions } from "@/lib/credit-notes"

/**
 * The 2 people who must approve a credit note before it is credited: chosen from the GM and the
 * Accountants (never the one creating it); the same person cannot be picked twice.
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

  const label = (o: ApproverOption) =>
    (o.role ? `${o.name} (${o.role})` : o.name) + (o.is_you ? " - you" : "")
  const selfListed = options.some((o) => o.is_you)

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
      ) : !loading && options.length < 2 ? (
        <p className="text-sm text-destructive">
          {options.length === 0 ? "There is no one" : "There is only 1 person"} with the GM or Accountant role to
          choose, so it cannot be sent for approval. Ask an admin to give the role to someone under Users &amp; Roles.
        </p>
      ) : selfListed ? (
        <p className="text-xs text-amber-700">
          Fewer than 2 other GM/Accountants are available, so you may be one of the 2 approvers yourself. Both must
          still approve it, each with a comment, before it is credited.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Choose from the GM and the Accountants. Both must approve it, each with a comment (e.g. &quot;Products in good shape&quot;), before the customer is
          credited and the stock goes back. If either rejects it, it is not credited.
        </p>
      )}
    </div>
  )
}
