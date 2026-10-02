"use client"

import { useTransition } from "react"
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
import { createPricingPlan } from "../actions"

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  description: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Price must be a positive number." }),
  currency: z.string().min(1, { message: "Currency is required." }),
  interval: z.enum(["month", "year", "lifetime"]),
  features: z.string().optional(), // Comma-separated string
  is_active: z.boolean().default(true),
})

interface CreatePricingSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePricingSheet({ isOpen, onOpenChange }: CreatePricingSheetProps) {
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

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append("name", values.name)
      formData.append("description", values.description || "")
      formData.append("price", values.price.toString())
      formData.append("currency", values.currency)
      formData.append("interval", values.interval)
      formData.append("features", values.features || "")
      formData.append("is_active", values.is_active ? "on" : "off")

      const result = await createPricingPlan(formData)
      if (result.success) {
        toast.success(result.message)
        form.reset()
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
          <SheetTitle>Create New Pricing Plan</SheetTitle>
          <SheetDescription>Add a new subscription plan that will be available on the pricing page.</SheetDescription>
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
              {isPending ? "Creating..." : "Create Plan"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
