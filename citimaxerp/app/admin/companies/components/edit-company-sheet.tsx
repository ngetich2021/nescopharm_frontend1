"use client"

import type React from "react"

import { useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateCompany } from "../actions"
import type { Database } from "@/lib/database.types"

type Company = Database["public"]["Tables"]["companies"]["Row"]

interface EditCompanySheetProps {
  company: Company
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCompanyUpdated: () => void
}

export function EditCompanySheet({ company, isOpen, onOpenChange, onCompanyUpdated }: EditCompanySheetProps) {
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData(event.currentTarget)

    try {
      const companyData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        is_active: formData.get('is_active') === 'on'
      }
      const result = await updateCompany(company.id, companyData)
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        onCompanyUpdated() // Refresh the list of companies
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
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit Company: {company.name}</SheetTitle>
          <SheetDescription>Make changes to the company details here.</SheetDescription>
        </SheetHeader>
        <form id="edit-company-form" onSubmit={handleFormSubmit} className="grid gap-6 py-4 flex-grow overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="name">Company Name</Label>
            <Input id="name" name="name" defaultValue={company.name || ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={company.email || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={company.phone || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={company.address || ""} rows={3} />
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <Switch id="is_active" name="is_active" defaultChecked={company.is_active ?? false} />
            <Label htmlFor="is_active">Active Company</Label>
          </div>
        </form>
        <SheetFooter className="mt-auto pt-4 border-t bg-background dark:bg-gray-950">
          <Button type="submit" form="edit-company-form" disabled={saving}>
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
