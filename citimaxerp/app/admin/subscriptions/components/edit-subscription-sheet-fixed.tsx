"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createSubscription, updateSubscription } from "../actions"
import { fetchAllCompaniesForUserCreation } from "../../users/actions"
import type { CompanySubscription } from "@/lib/admin"
import type { Company } from "@/app/types"

type CompanyOption = Pick<Company, "id" | "name">

interface EditSubscriptionSheetProps {
  subscription: CompanySubscription | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubscriptionUpdated: () => void
}

export function EditSubscriptionSheet({
  subscription,
  isOpen,
  onOpenChange,
  onSubscriptionUpdated,
}: EditSubscriptionSheetProps) {
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const fetchedCompanies = await fetchAllCompaniesForUserCreation()
        setCompanies(fetchedCompanies)
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load companies for subscription form.",
          variant: "destructive",
        })
      }
    }
    if (isOpen) {
      loadCompanies()
    }
  }, [isOpen, toast])

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData(event.currentTarget)

    try {
      let result
      if (subscription) {
        result = await updateSubscription(subscription.id.toString(), formData)
      } else {
        result = await createSubscription(formData)
      }

      if (result?.message) {
        toast({
          title: "Success",
          description: result.message,
        })
        onSubscriptionUpdated()
        onOpenChange(false)
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred.",
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
          <SheetTitle>{subscription ? "Edit Subscription" : "Create New Subscription"}</SheetTitle>
          <SheetDescription>
            {subscription ? "Make changes to this subscription." : "Add a new subscription for a company."}
          </SheetDescription>
        </SheetHeader>
        
        <form id="edit-subscription-form" onSubmit={handleFormSubmit} className="grid gap-6 py-4 flex-grow overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="company_id">Company</Label>
            <Select name="company_id" defaultValue="" required disabled={!!subscription}>
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
            <Label htmlFor="plan_name">Plan Name</Label>
            <Input id="plan_name" name="plan_name" defaultValue={subscription?.plan_name || ""} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={subscription?.status || ""} required>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="started_at">Start Date</Label>
            <Input
              id="started_at"
              name="started_at"
              type="date"
              defaultValue={
                subscription?.started_at ? new Date(subscription.started_at).toISOString().split("T")[0] : ""
              }
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="expires_at">Expires Date</Label>
            <Input
              id="expires_at"
              name="expires_at"
              type="date"
              defaultValue={subscription?.expires_at ? new Date(subscription.expires_at).toISOString().split("T")[0] : ""}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="auto_renew">Auto Renew</Label>
            <Select name="auto_renew" defaultValue={subscription?.auto_renew ? "true" : ""} required>
              <SelectTrigger>
                <SelectValue placeholder="Select auto renew" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>
        
        <SheetFooter className="mt-auto pt-4 border-t bg-background dark:bg-gray-950">
          <Button type="submit" form="edit-subscription-form" disabled={saving}>
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
