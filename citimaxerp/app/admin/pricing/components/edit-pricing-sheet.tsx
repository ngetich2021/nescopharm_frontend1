"use client"

import { useEffect, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updatePricingPlan } from "../actions"
import type { Database } from "@/lib/database.types"

type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"]

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  description: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Price must be a positive number." }),
  currency: z.string().min(1, { message: "Currency is required." }),
  interval: z.enum(["month", "year", "lifetime"]),
  features: z.string().optional(), // Comma-separated string
  is_active: z.boolean().default(true),
})

interface EditPricingSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  plan: SubscriptionPlan | null
}

export function EditPricingSheet({ isOpen, onOpenChange, plan }: EditPricingSheetProps) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      currency: "KES",
      interval: "month",
      features: "",
      is_active: true,
    },
  })

  useEffect(() => {
    if (plan) {
      form.reset({
        name: plan.name,
        description: plan.description || "",
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features ? plan.features.join(", ") : "",
        is_active: plan.is_active,
      })
    }
  }, [plan, form])

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!plan) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append("name", values.name)
      formData.append("description", values.description || "")
      formData.append("price", values.price.toString())
      formData.append("currency", values.currency)
      formData.append("interval", values.interval)
      formData.append("features", values.features || "")
      formData.append("is_active", values.is_active ? "on" : "off")

      const result = await updatePricingPlan(plan.id, formData)
      if (result.success) {
        toast.success(result.message)
        onOpenChange(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit Pricing Plan</SheetTitle>
          <SheetDescription>Make changes to the pricing plan. Click save when you're done.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Basic Plan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="A short description of the plan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="9.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input placeholder="KES" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Interval</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an interval" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Features (comma-separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="Feature 1, Feature 2" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter features as a comma-separated list (e.g., "5 Users, 10GB Storage").
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Active Plan</FormLabel>
                    <FormDescription>Toggle to make this plan visible on the public pricing page.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Toggle plan active status"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
