"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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
  // Shown in the dropdown when there is nobody to pick at all.
  empty?: React.ReactNode
}

const nameOf = (p: Person) => p.full_name || p.name || ""
const phoneOf = (p: Person) => p.phone_number || p.phone || ""

// A select-style field; the list (searchable by name or phone) only opens when clicked.
export function DeliveryPersonPicker({ persons, value, onChange, loading, id, empty }: Props) {
  const [open, setOpen] = useState(false)
  const selected = persons.find((p) => p.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading
              ? "Loading delivery persons..."
              : selected
                ? [nameOf(selected), phoneOf(selected)].filter(Boolean).join(" - ")
                : "Select delivery person"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        {persons.length === 0 ? (
          empty ?? <p className="p-2 text-center text-sm text-muted-foreground">No delivery persons found</p>
        ) : (
          <Command>
            <CommandInput placeholder="Search by name or phone" />
            <CommandList>
              <CommandEmpty>No one matches.</CommandEmpty>
              <CommandGroup>
                {persons.map((person) => (
                  <CommandItem
                    key={person.id}
                    value={`${nameOf(person)} ${phoneOf(person)} ${person.id}`}
                    onSelect={() => {
                      onChange(person.id)
                      setOpen(false)
                    }}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{nameOf(person)}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {[phoneOf(person), person.availability_status?.replace(/_/g, " ")].filter(Boolean).join(" - ")}
                        </span>
                      </span>
                      {person.id === value && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
