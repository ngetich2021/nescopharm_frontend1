"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Loader2, UploadCloud, XCircle, PlusCircle, FileText } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { createExpense, updateExpense, createExpenseCategory } from "@/lib/expenses"
import { useToast } from "@/hooks/use-toast"
import type { Expense, ExpenseCategory, PaymentMethod, RecurringFrequency, ExpenseStatus } from "@/types/expenses"
import { Switch } from "@/components/ui/switch"
import { Plus } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { uploadMedia } from "@/lib/uploadMedia"
import Image from "next/image"
import { getCachedStores } from "@/lib/stores"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"

const paymentMethods: PaymentMethod[] = ["cash", "card", "bank_transfer", "check", "other"]
const recurringFrequencies: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "yearly"]
const expenseStatuses: ExpenseStatus[] = ["pending", "approved", "rejected", "paid"]

const formSchema = z.object({
  vendorName: z.string().min(1, { message: "Vendor name is required." }),
  amount: z.string().min(1, { message: "Amount is required." }).refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number.",
  }),
  description: z.string().min(1, { message: "Description is required." }),
  categoryId: z.string().min(1, { message: "Category is required." }),
  expenseDate: z.date({ message: "Expense date is required." }),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "check", "other"] as const),
  storeId: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"] as const).optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "paid"] as const).default("pending"),
})

type FormData = z.infer<typeof formSchema>

interface CreateExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onExpenseCreatedOrUpdated: () => void
  initialData?: Expense | null
  categories: ExpenseCategory[]
}

export function CreateExpenseModal({
  isOpen,
  onClose,
  onExpenseCreatedOrUpdated,
  initialData,
  categories,
}: CreateExpenseModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [localCategories, setLocalCategories] = useState<ExpenseCategory[]>(categories)
  const [saving, setSaving] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string>("")
  const [isNewCategoryModalOpen, setIsNewCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryDescription, setNewCategoryDescription] = useState("")
  const [creatingCategory, setCreatingCategory] = useState(false)

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorName: "",
      amount: "",
      description: "",
      categoryId: "",
      expenseDate: new Date(),
      paymentMethod: "cash" as const,
      storeId: "",
      isRecurring: false,
      recurringFrequency: undefined,
      tags: "",
      notes: "",
      status: "pending" as const,
    },
  })

  useEffect(() => {
    if (initialData) {
      form.reset({
        vendorName: initialData.vendor_name,
        amount: initialData.amount.toString(),
        description: initialData.description,
        categoryId: initialData.category_id,
        expenseDate: new Date(initialData.expense_date),
        paymentMethod: initialData.payment_method,
        storeId: initialData.store_id || "",
        isRecurring: initialData.is_recurring,
        recurringFrequency: initialData.recurring_frequency || undefined,
        tags: initialData.tags?.join(", ") || "",
        notes: initialData.notes || "",
        status: initialData.status as ExpenseStatus,
      })
      setReceiptUrl(initialData.receipt_url || "")
      setReceiptFile(null)
    } else {
      form.reset({
        vendorName: "",
        amount: "",
        description: "",
        categoryId: "",
        expenseDate: new Date(),
        paymentMethod: "cash",
        storeId: "",
        isRecurring: false,
        recurringFrequency: undefined,
        tags: "",
        notes: "",
        status: "pending",
      })
      setReceiptUrl("")
      setReceiptFile(null)
    }
  }, [isOpen, initialData, form])

  // Update local categories when prop changes
  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  useEffect(() => {
    const fetchStores = async () => {
      if (!isOpen) return

      try {
        const fetchedStores = await getCachedStores()
        setStores(fetchedStores)
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load stores for selection.",
          variant: "destructive",
        })
      }
    }

    if (isOpen) {
      fetchStores()
    }
  }, [toast, isOpen])

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name cannot be empty.",
        variant: "destructive",
      })
      return
    }

    setCreatingCategory(true)
    try {
      const newCategory = await createExpenseCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || null,
        color: "#" + Math.floor(Math.random() * 16777215).toString(16),
        is_active: true
      })
      
      toast({
        title: "Success",
        description: `Category "${newCategory.name}" created.`,
      })
      
      // Add the new category to local state and select it
      setLocalCategories(prev => [...prev, newCategory])
      form.setValue("categoryId", newCategory.id)
      
      // Reset the category creation form
      setNewCategoryName("")
      setNewCategoryDescription("")
      setIsNewCategoryModalOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create category. It might already exist.",
        variant: "destructive",
      })
    } finally {
      setCreatingCategory(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setReceiptFile(event.target.files[0])
      setReceiptUrl("")
    } else {
      setReceiptFile(null)
    }
  }

  const handleUploadReceipt = async () => {
    if (!receiptFile) {
      toast({
        title: "No file selected",
        description: "Please select a receipt image to upload.",
        variant: "destructive",
      })
      return
    }

    setUploadingReceipt(true)
    try {
      const response = await uploadMedia(receiptFile, "expense-receipts")
      const url = typeof response === 'string' ? response : response.url
      setReceiptUrl(url)
      toast({
        title: "Success",
        description: "Receipt uploaded successfully.",
      })
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your receipt. Please try again.",
        variant: "destructive",
      })
      setReceiptUrl("")
    } finally {
      setUploadingReceipt(false)
    }
  }

  const onSubmit = async (values: any) => {
    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "User not found. Please log in again.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      // Upload receipt if a new file is selected
      if (receiptFile && !uploadingReceipt && !receiptUrl) {
        setUploadingReceipt(true)
        try {
          const response = await uploadMedia(receiptFile, "expense-receipts")
          const url = typeof response === 'string' ? response : (response && 'url' in response ? String((response as any).url ?? "") : "")
          setReceiptUrl(url)
        } catch (uploadError) {
          toast({
            title: "Upload Failed",
            description: "There was a problem uploading the receipt.",
            variant: "destructive",
          })
        } finally {
          setUploadingReceipt(false)
        }
      }

      const expenseData = {
        store_id: values.storeId || null,
        category_id: values.categoryId,
        vendor_name: values.vendorName.trim(),
        description: values.description.trim(),
        amount: Number.parseFloat(values.amount),
        expense_date: format(values.expenseDate, "yyyy-MM-dd"),
        payment_method: values.paymentMethod,
        receipt_url: receiptUrl.trim() || null,
        notes: values.notes?.trim() || null,
        is_recurring: values.isRecurring,
        recurring_frequency: values.isRecurring ? values.recurringFrequency : null,
        tags: values.tags?.trim() ? values.tags.split(",").map((tag: string) => tag.trim()) : null,
        status: values.status,
      }

      if (initialData) {
        await updateExpense(initialData.id, expenseData)
        toast({
          title: "Success",
          description: "Expense updated successfully.",
        })
      } else {
        await createExpense(expenseData)
        toast({
          title: "Success",
          description: "Expense created successfully.",
        })
      }
      onExpenseCreatedOrUpdated()
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${initialData ? "update" : "create"} expense.`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initialData ? "Edit Expense" : "Add New Expense"}</SheetTitle>
          <SheetDescription>
            Fill in the details below to {initialData ? "update" : "add"} an expense to your system.
          </SheetDescription>
        </SheetHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter vendor name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (KES)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter expense description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {localCategories.length === 0 ? (
                            <SelectItem value="no-categories" disabled>
                              No categories available
                            </SelectItem>
                          ) : (
                            localCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <AlertDialog open={isNewCategoryModalOpen} onOpenChange={setIsNewCategoryModalOpen}>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" title="Add New Category">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Add New Expense Category</AlertDialogTitle>
                            <AlertDialogDescription>
                              Enter the name and an optional description for the new expense category.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="newCategoryName" className="text-right">
                                Name
                              </Label>
                              <Input
                                id="newCategoryName"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="newCategoryDescription" className="text-right">
                                Description
                              </Label>
                              <Textarea
                                id="newCategoryDescription"
                                value={newCategoryDescription}
                                onChange={(e) => setNewCategoryDescription(e.target.value)}
                                className="col-span-3"
                              />
                            </div>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={creatingCategory}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCreateCategory} disabled={creatingCategory}>
                              {creatingCategory ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                                </>
                              ) : (
                                "Create Category"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                        onChange={(e) => {
                          const dateValue = e.target.value ? new Date(e.target.value + "T00:00:00") : new Date()
                          field.onChange(dateValue)
                        }}
                        max={format(new Date(), "yyyy-MM-dd")}
                        min="1900-01-01"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="storeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store (Optional)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a store" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {stores.length === 0 ? (
                          <SelectItem value="no-stores" disabled>
                            No stores available
                          </SelectItem>
                        ) : (
                          stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Recurring Expense</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark this expense as recurring
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch("isRecurring") && (
                <FormField
                  control={form.control}
                  name="recurringFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {recurringFrequencies.map((freq) => (
                            <SelectItem key={freq} value={freq}>
                              {freq}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., travel, client, projectX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {initialData && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {expenseStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes about this expense..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Receipt</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    className="flex-grow"
                    accept="image/*,application/pdf"
                  />
                  <Button
                    type="button"
                    onClick={handleUploadReceipt}
                    disabled={!receiptFile || uploadingReceipt}
                    size="icon"
                    title="Upload Receipt"
                  >
                    {uploadingReceipt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {receiptFile && <p className="text-sm text-muted-foreground mt-1">Selected: {receiptFile.name}</p>}
              </div>

              {receiptUrl && (
                <div className="relative w-full h-32 border rounded-md overflow-hidden flex items-center justify-center bg-gray-100">
                  {receiptUrl.endsWith(".pdf") ? (
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <FileText className="h-5 w-5" /> View PDF Receipt
                    </a>
                  ) : (
                    <Image
                      src={receiptUrl || "/placeholder.svg"}
                      alt="Receipt Preview"
                      layout="fill"
                      objectFit="contain"
                      className="p-1"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 text-primary hover:text-primary/70"
                    onClick={() => setReceiptUrl("")}
                    title="Remove Receipt"
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              )}

              {!receiptFile && !receiptUrl && initialData?.receipt_url && (
                <div className="relative w-full h-32 border rounded-md overflow-hidden flex items-center justify-center bg-gray-100">
                  {initialData.receipt_url.endsWith(".pdf") ? (
                    <a
                      href={initialData.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <FileText className="h-5 w-5" /> View PDF Receipt
                    </a>
                  ) : (
                    <Image
                      src={initialData.receipt_url || "/placeholder.svg"}
                      alt="Existing Receipt"
                      layout="fill"
                      objectFit="contain"
                      className="p-1"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 text-primary hover:text-primary/70"
                    onClick={() => setReceiptUrl("")}
                    title="Remove Receipt"
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving || uploadingReceipt}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || uploadingReceipt}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {saving || uploadingReceipt ? (
                  <Spinner />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                {saving || uploadingReceipt
                  ? uploadingReceipt
                    ? "Uploading..."
                    : initialData
                    ? "Updating..."
                    : "Creating..."
                  : initialData
                  ? "Update Expense"
                  : "Create Expense"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
