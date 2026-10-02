"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { type Customer, createCustomer } from "@/lib/customers"
import { Spinner } from "@/components/ui/spinner"

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
  phone: z.string().min(10, { message: "Phone number must be at least 10 characters." }),
  notes: z.string().optional().or(z.literal("")),
  preferred_communication_channel: z.enum(["email", "phone", "whatsapp", "sms"]).optional().or(z.literal("")),
  customer_type: z.enum(["individual", "company", "reseller", "other"]).optional().or(z.literal("")),
})

interface CreateCustomerSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onCustomerCreated: (customer: Customer) => void
}

export function CreateCustomerSheet({ isOpen, onOpenChange, onCustomerCreated }: CreateCustomerSheetProps) {
  const { toast } = useToast()
  const { companyId, isLoading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      notes: "",
      preferred_communication_channel: "phone", // Default value
      customer_type: "individual", // Default value
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true)
    try {
      // Prepare customer data without company_id - it will be handled by the backend
      const customerData = {
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        notes: values.notes || null,
        preferred_communication_channel: values.preferred_communication_channel || null,
        customer_type: values.customer_type || null,
        company: null,
        // These fields are no longer collected via form, assuming backend handles defaults or they are not required
        first_name: values.name.split(" ")[0] || "", // Derive first_name from name
        last_name: values.name.split(" ").slice(1).join(" ") || "", // Derive last_name from name
        address: null,
        city: null,
        state: null,
        country: null,
        postal_code: null,
        tags: [],
        last_contact_date: null,
        // company_id is intentionally omitted - will be handled by the backend
      };

      const newCustomer = await createCustomer(customerData as any);

      if (newCustomer) {
        onCustomerCreated(newCustomer)
        onOpenChange(false)
        form.reset()
        toast({ title: "Success", description: "Customer created successfully." })
      } else {
        toast({ title: "Error", description: "Failed to create customer.", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to create customer: ${error.message}`, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add New Customer</SheetTitle>
          <SheetDescription>Fill in the details below to add a new customer to your inventory system.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+254712345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any special notes about this customer..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preferred_communication_channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Communication (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a communication channel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Type (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="reseller">Reseller</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-[primary] hover:bg-[primary]/90"
              disabled={isLoading || authLoading}
            >
              {isLoading ? <Spinner /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {isLoading ? "Creating..." : "Create Customer"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
