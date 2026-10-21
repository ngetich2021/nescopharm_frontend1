"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const VISIBLE = 3

interface Person {
  id: string
  full_name?: string | null
  name?: string | null
  phone_number?: string | null
  phone?: string | null
  availability_status?: string | null
}

interface Props {
  persons: Person[]
  value: string | null | undefined
  onChange: (id: string) => void
  loading?: boolean
  id?: string
  // Shown in place of the list when there is nobody to pick at all.
  empty?: React.ReactNode
}

const nameOf = (p: Person) => p.full_name || p.name || ""
const phoneOf = (p: Person) => p.phone_number || p.phone || ""

// The delivery person list runs long, so only a few show at once; typing narrows it by name or phone.
export function DeliveryPersonPicker({ persons, value, onChange, loading, id, empty }: Props) {
  const [query, setQuery] = useState("")

  const { shown, total } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, "")
    const matches = q
      ? persons.filter(
          (p) => nameOf(p).toLowerCase().includes(q) || (digits && phoneOf(p).replace(/\D/g, "").includes(digits)),
        )
      : persons
    // The picked person stays in view so the choice is always visible.
    const picked = matches.find((p) => p.id === value)
    const rest = matches.filter((p) => p.id !== value)
    return { shown: (picked ? [picked, ...rest] : rest).slice(0, VISIBLE), total: matches.length }
  }, [persons, query, value])

  if (loading) return <p className="text-sm text-muted-foreground py-2">Loading delivery persons...</p>
  if (persons.length === 0) return <>{empty ?? <p className="text-sm text-muted-foreground py-2">No delivery persons found</p>}</>

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          id={id}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${persons.length} delivery persons by name or phone`}
          className="pl-8"
          autoComplete="off"
        />
      </div>
      <div className="rounded-md border divide-y bg-white">
        {shown.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No one matches "{query}"</p>
        ) : (
          shown.map((person) => {
            const selected = person.id === value
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onChange(person.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50",
                  selected && "bg-blue-50 hover:bg-blue-50",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-medium text-gray-900">{nameOf(person)}</span>
                  <span className="text-xs text-muted-foreground">
                    {[phoneOf(person), person.availability_status?.replace(/_/g, " ")].filter(Boolean).join(" - ")}
                  </span>
                </span>
                {selected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
              </button>
            )
          })
        )}
      </div>
      {total > shown.length && (
        <p className="text-xs text-muted-foreground">
          Showing {shown.length} of {total} - type to find others
        </p>
      )}
    </div>
  )
}
