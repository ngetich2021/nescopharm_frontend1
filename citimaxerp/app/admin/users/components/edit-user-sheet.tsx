"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createGlobalUser, updateGlobalUser, fetchAllCompaniesForUserCreation, fetchRolesForCompany } from "../actions"
import type { Database } from "@/lib/database.types"
import type { Role } from "@/types/rbac"

type UserData = Database["public"]["Tables"]["users"]["Row"] & {
  company: Database["public"]["Tables"]["companies"]["Row"] | null
  role: Role | null
}
type CompanyOption = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "name">
type RoleOption = Pick<Role, "id" | "name">

interface EditUserSheetProps {
  user: UserData | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onUserUpdated: () => void
}

export function EditUserSheet({ user, isOpen, onOpenChange, onUserUpdated }: EditUserSheetProps) {
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(user?.company_id || "")
  const { toast } = useToast()

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const fetchedCompanies = await fetchAllCompaniesForUserCreation()
        setCompanies(fetchedCompanies)

        if (user?.company_id) {
          setSelectedCompanyId(user.company_id)
          const fetchedRoles = await fetchRolesForCompany(user.company_id)
          setRoles(fetchedRoles)
        } else if (fetchedCompanies.length > 0) {
          // For new user, pre-select first company and load its roles
          setSelectedCompanyId(fetchedCompanies[0].id)
          const fetchedRoles = await fetchRolesForCompany(fetchedCompanies[0].id)
          setRoles(fetchedRoles)
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load necessary data for user form.",
          variant: "destructive",
        })
      }
    }
    if (isOpen) {
      loadInitialData()
    }
  }, [isOpen, user?.company_id, toast])

  useEffect(() => {
    const loadRoles = async () => {
      if (selectedCompanyId) {
        try {
          const fetchedRoles = await fetchRolesForCompany(selectedCompanyId)
          setRoles(fetchedRoles)
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to load roles for the selected company.",
            variant: "destructive",
          })
        }
      } else {
        setRoles([])
      }
    }
    loadRoles()
  }, [selectedCompanyId, toast])

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData(event.currentTarget)

    try {
      let result
      if (user) {
        result = await updateGlobalUser(user.id, formData)
      } else {
        result = await createGlobalUser(formData)
      }

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        onUserUpdated() // Refresh the list of users
        onOpenChange(false) // Close the sheet
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
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
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>{user ? "Edit User" : "Create New User"}</SheetTitle>
          <SheetDescription>
            {user ? "Make changes to this user's profile." : "Add a new user to any company."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleFormSubmit} className="grid gap-6 py-4 flex-grow overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input id="first_name" name="first_name" defaultValue={user?.first_name || ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input id="last_name" name="last_name" defaultValue={user?.last_name || ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={user?.email || ""} required disabled={!!user} />
          </div>
          {!user && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required={!user} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={user?.phone || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_id">Company</Label>
            <Select
              name="company_id"
              value={selectedCompanyId}
              onValueChange={setSelectedCompanyId}
              required
              disabled={!companies.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role_id">Role</Label>
            <Select name="role_id" defaultValue={user?.role?.id || ""} required disabled={!roles.length}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Switch id="is_active" name="is_active" defaultChecked={user?.is_active ?? false} />
            <Label htmlFor="is_active">Active User</Label>
          </div>
        </form>
        <SheetFooter className="mt-auto pt-4 border-t bg-background dark:bg-gray-950">
          <Button type="submit" form="edit-user-form" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
