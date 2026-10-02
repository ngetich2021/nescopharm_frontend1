"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Store, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { forceRefreshStores } from "@/lib/stores"
import apiCall from "@/lib/api"

interface StoreCreationResponse {
  status: string;
  message: string;
  store: {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    store_code: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
    manager_name: string | null;
    is_active: boolean;
    updated_at: string;
    created_at: string;
    company: {
      id: string;
      name: string;
      description: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      postal_code: string | null;
      website: string | null;
      logo_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      is_first_time?: boolean;
    }
  }
}

const formSchema = z.object({
  name: z.string().min(2, { message: "Store name must be at least 2 characters." }),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal("")),
})

interface CreateStoreSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onStoreCreated: () => void
}

export function CreateStoreSheet({ isOpen, onOpenChange, onStoreCreated }: CreateStoreSheetProps) {
  const { toast } = useToast()
  const { companyId, isLoading: authLoading, user, setUser, setUserProfile } = useAuth() as any // setUser/setUserProfile are available in context
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      phone: "",
      email: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "Company ID is missing. Cannot create store.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Use query param for name, send other fields in body if needed
      const query = `?name=${encodeURIComponent(values.name.trim())}`
      const storeData = {
        company_id: companyId,
        description: values.description?.trim() || null,
        address: values.address?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        is_active: true,
      }
      const response = (await apiCall<StoreCreationResponse>(`/stores${query}`, "POST", storeData)) as StoreCreationResponse
      // After store creation, update the company's is_first_time to false
      const companyUpdateResponse = await apiCall<{ status: string; message: string; company: StoreCreationResponse["store"]["company"] }>(
        `/companies/${companyId}?is_first_time=0`,
        "PUT"
      )
      if (companyUpdateResponse && companyUpdateResponse.company) {
        const updatedUser = {
          ...user,
          company: {
            ...user.company,
            ...companyUpdateResponse.company
          }
        }
        setUser && setUser(updatedUser)
        setUserProfile && setUserProfile(updatedUser)
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(updatedUser))
          document.cookie = `user=${JSON.stringify(updatedUser)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`
        }
        // Force refresh store cache for the new store
        forceRefreshStores(companyId)
        
        // Seamlessly refresh the page to show the dashboard with real data
        router.replace(window.location.pathname + window.location.search)
      }

      toast({
        title: "Success",
        description: "Store created successfully!",
      })

      form.reset()
      onStoreCreated()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create store.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Create Your First Store
          </SheetTitle>
          <SheetDescription>
            Set up your store to start managing inventory and sales. You can always add more stores later.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Store Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter store name" {...field} />
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of your store"
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Store address"
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone number" {...field} />
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
                      <Input placeholder="store@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || authLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Store...
                </>
              ) : (
                <>
                  <Store className="mr-2 h-4 w-4" />
                  Create Store
                </>
              )}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
} 