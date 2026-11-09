"use client"

import { useEffect, useState } from "react"
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createOneTimeAllowance, getEmployees } from "@/lib/employees"

type Emp = { id: string; name: string; number?: string | null; position?: string | null }

/** Record an allowance paid once, outside payroll (e.g. a rep's field allowance for the week). */
export function OneTimeAllowanceButton({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [employees, setEmployees] = useState<Emp[]>([])
  const [loadingEmps, setLoadingEmps] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const [name, setName] = useState("Field allowance")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [taxable, setTaxable] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmployeeId(""); setName("Field allowance"); setAmount(""); setTaxable(false)
    setDate(new Date().toISOString().slice(0, 10))
    if (employees.length) return
    setLoadingEmps(true)
    getEmployees({ per_page: 1000 })
      .then((res) => setEmployees((res.employees || []).map((e: any) => ({
        id: e.id,
        name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
        number: e.employee_number,
        position: e.position,
      })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => toast({ title: "Could not load employees", description: e?.message, variant: "destructive" }))
      .finally(() => setLoadingEmps(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const chosen = employees.find((e) => e.id === employeeId)

  const save = async () => {
    if (!employeeId || !name.trim() || !(Number(amount) > 0) || !date) {
      toast({ title: "Missing details", description: "Pick the employee and enter the allowance, amount and date.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await createOneTimeAllowance({ employee_id: employeeId, name: name.trim(), amount: Number(amount), date, is_taxable: taxable })
      toast({ title: "Allowance recorded", description: res.message })
      setOpen(false)
      onSaved()
    } catch (e: any) {
      toast({ title: "Not saved", description: e?.message || "Nothing was changed", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-[#E30040] hover:bg-[#E30040]/90">
        <Plus className="mr-2 h-4 w-4" /> One-time Allowance
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>One-time Allowance</DialogTitle>
            <DialogDescription>
              Paid once, outside payroll. It shows here in its month and counts against the rep&apos;s invoices in ROI for Reps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Popover open={pickOpen} onOpenChange={setPickOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {chosen ? `${chosen.name}${chosen.number ? ` (${chosen.number})` : ""}` : loadingEmps ? "Loading employees..." : "Choose employee"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search name or number..." />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((e) => (
                          <CommandItem key={e.id} value={`${e.name} ${e.number ?? ""} ${e.position ?? ""}`} onSelect={() => { setEmployeeId(e.id); setPickOpen(false) }}>
                            <Check className={cn("mr-2 h-4 w-4", e.id === employeeId ? "opacity-100" : "opacity-0")} />
                            <div>
                              <div>{e.name}</div>
                              {(e.number || e.position) && <div className="text-xs text-muted-foreground">{[e.number, e.position].filter(Boolean).join(" · ")}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="ota_name">Allowance</Label>
              <Input id="ota_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Field allowance, transport, airtime..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ota_amount">Amount (KES)</Label>
                <Input id="ota_amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ota_date">Date paid</Label>
                <Input id="ota_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ota_tax" checked={taxable} onCheckedChange={setTaxable} />
              <Label htmlFor="ota_tax">Taxable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-[#E30040] hover:bg-[#E30040]/90">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
