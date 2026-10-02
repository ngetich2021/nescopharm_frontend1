"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getRoles } from "@/lib/roles"
import { assignRoleToUser } from "@/lib/users"

interface Role {
  id: string
  name: string
  description: string | null
}

interface UserData {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: { id: string; name: string } | null
}

interface AssignRoleSheetProps {
  user: UserData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRoleAssigned: () => void
}

export function AssignRoleSheet({ user, open, onOpenChange, onRoleAssigned }: AssignRoleSheetProps) {
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [openPopover, setOpenPopover] = useState(false)
  const { toast } = useToast()

  // Fetch roles when the sheet opens
  useEffect(() => {
    if (open) {
      fetchRoles()
      // Set the current role as selected
      if (user?.role?.id) {
        setSelectedRoleId(user.role.id)
      } else {
        setSelectedRoleId(null)
      }
    }
  }, [open, user])

  const fetchRoles = async () => {
    try {
      const rolesData = await getRoles()
      setRoles(rolesData)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load roles.",
        variant: "destructive",
      })
      setRoles([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !selectedRoleId) return

    try {
      setSaving(true)
      
      // Assign role to user
      await assignRoleToUser(user.id, selectedRoleId)
      
      toast({
        title: "Success",
        description: "User role updated successfully.",
      })
      onOpenChange(false)
      onRoleAssigned()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Assign Role</SheetTitle>
          <SheetDescription>
            Assign a role to user <span className="font-semibold">{user?.first_name} {user?.last_name}</span>.
            Select a role from the list below.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-grow py-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Popover open={openPopover} onOpenChange={setOpenPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openPopover}
                    className="w-full justify-between"
                  >
                    {selectedRoleId
                      ? roles.find((role) => role.id === selectedRoleId)?.name
                      : "Select role..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search roles..." />
                    <CommandList>
                      <CommandEmpty>No roles found.</CommandEmpty>
                      <CommandGroup>
                        {roles.map((role) => (
                          <CommandItem
                            key={role.id}
                            value={role.name}
                            onSelect={() => {
                              setSelectedRoleId(role.id)
                              setOpenPopover(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedRoleId === role.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {role.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <SheetFooter className="mt-auto pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !selectedRoleId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Role
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}