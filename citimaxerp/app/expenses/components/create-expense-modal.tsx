"use client"

import { useState, useEffect, useMemo, type ChangeEvent, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, UploadCloud, XCircle, PlusCircle, FileText, Landmark, Wallet } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { createExpense, updateExpense, getExpenseLedgerAccounts } from "@/lib/expenses"
import { useToast } from "@/hooks/use-toast"
import type {
  Expense,
  ExpenseCategory,
  ExpenseLedgerGroup,
  ExpensePaidFrom,
  RecurringFrequency,
  ExpenseStatus,
} from "@/types/expenses"
import { Switch } from "@/components/ui/switch"
import { uploadMedia } from "@/lib/uploadMedia"
import Image from "next/image"
import { getCachedStores } from "@/lib/stores"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { FileLink } from "@/components/file-preview"

const recurringFrequencies: RecurringFrequency[] = ["weekly", "monthly", "quarterly", "yearly"]
const expenseStatuses: ExpenseStatus[] = ["pending", "approved", "rejected", "paid"]

const formSchema = z
  .object({
    vendorName: z.string().min(1, { message: "Who was paid is required." }),
    amount: z.string().min(1, { message: "Amount is required." }).refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be a positive number.",
    }),
    description: z.string().min(1, { message: "Description is required." }),
    groupId: z.string().min(1, { message: "Choose the main account." }),
    accountId: z.string().min(1, { message: "Choose the sub-account." }),
    expenseDate: z.date({ message: "Expense date is required." }),
    paidFrom: z.enum(["petty_cash", "prime_bank"] as const),
    bankMethod: z.enum(["check", "bank_transfer"] as const),
    storeId: z.string().optional(),
    isRecurring: z.boolean().default(false),
    recurringFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"] as const).optional(),
    tags: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected", "paid"] as const).default("pending"),
  })
  .refine((v) => !v.isRecurring || !!v.recurringFrequency, { message: "Choose how often it recurs.", path: ["recurringFrequency"] })

type FormData = z.infer<typeof formSchema>

interface CreateExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onExpenseCreatedOrUpdated: () => void
  initialData?: Expense | null
  /** Kept for callers; expenses are now charged to ledger accounts, not categories. */
  categories?: ExpenseCategory[]
}

const blank = (): FormData => ({
  vendorName: "",
  amount: "",
  description: "",
  groupId: "",
  accountId: "",
  expenseDate: new Date(),
  paidFrom: "petty_cash",
  bankMethod: "check",
  storeId: "",
  isRecurring: false,
  recurringFrequency: undefined,
  tags: "",
  notes: "",
  status: "pending",
})

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {step}
        </span>
        <div>
          <h3 className="text-sm font-semibold leading-6">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function CreateExpenseModal({ isOpen, onClose, onExpenseCreatedOrUpdated, initialData }: CreateExpenseModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [groups, setGroups] = useState<ExpenseLedgerGroup[]>([])
  const [paidFrom, setPaidFrom] = useState<ExpensePaidFrom[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptUrl, setReceiptUrl] = useState<string>("")

  const form = useForm<FormData>({ resolver: zodResolver(formSchema) as any, defaultValues: blank() })

  // Ledger accounts and the two money sources.
  useEffect(() => {
    if (!isOpen) return
    setLoadingAccounts(true)
    getExpenseLedgerAccounts()
      .then((d) => {
        setGroups(d.groups)
        setPaidFrom(d.paid_from)
      })
      .catch((e) => toast({ title: "Could not load ledger accounts", description: e.message, variant: "destructive" }))
      .finally(() => setLoadingAccounts(false))
    getCachedStores()
      .then(setStores)
      .catch(() => {})
  }, [isOpen, toast])

  // Fill the form; the main account is found from the sub-account once the accounts are loaded.
  useEffect(() => {
    if (!isOpen) return
    if (initialData) {
      const accountId = initialData.account_id || ""
      const method = initialData.payment_method
      form.reset({
        vendorName: initialData.vendor_name,
        amount: initialData.amount.toString(),
        description: initialData.description,
        groupId: groups.find((g) => g.accounts.some((a) => a.id === accountId))?.id || "",
        accountId,
        expenseDate: new Date(initialData.expense_date),
        paidFrom: method === "check" || method === "bank_transfer" || method === "card" ? "prime_bank" : "petty_cash",
        bankMethod: method === "bank_transfer" || method === "card" ? "bank_transfer" : "check",
        storeId: initialData.store_id || "",
        isRecurring: initialData.is_recurring,
        recurringFrequency: initialData.recurring_frequency || undefined,
        tags: initialData.tags?.join(", ") || "",
        notes: initialData.notes || "",
        status: initialData.status as ExpenseStatus,
      })
      setReceiptUrl(initialData.receipt_url || "")
    } else {
      form.reset(blank())
      setReceiptUrl("")
    }
    setReceiptFile(null)
  }, [isOpen, initialData, groups, form])

  const groupId = form.watch("groupId")
  const accountId = form.watch("accountId")
  const source = form.watch("paidFrom")
  const isRecurring = form.watch("isRecurring")
  const group = groups.find((g) => g.id === groupId)

  // The expense's current account when it is no longer offered (e.g. an old one charged to Inventory).
  const legacyAccount = useMemo(() => {
    if (!initialData?.account || groups.some((g) => g.accounts.some((a) => a.id === initialData.account_id))) return null
    return initialData.account
  }, [initialData, groups])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setReceiptFile(event.target.files[0])
      setReceiptUrl("")
    } else {
      setReceiptFile(null)
    }
  }

  const uploadReceipt = async (): Promise<string> => {
    if (!receiptFile) return receiptUrl
    setUploadingReceipt(true)
    try {
      const response = await uploadMedia(receiptFile, "expense-receipts")
      const url = typeof response === "string" ? response : String((response as any)?.url ?? "")
      setReceiptUrl(url)
      setReceiptFile(null)
      return url
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handleUploadReceipt = async () => {
    try {
      await uploadReceipt()
      toast({ title: "Receipt uploaded" })
    } catch {
      toast({ title: "Upload failed", description: "The receipt could not be uploaded. Please try again.", variant: "destructive" })
    }
  }

  const onSubmit = async (values: FormData) => {
    if (!user?.id) {
      toast({ title: "Authentication Error", description: "User not found. Please log in again.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      let url = receiptUrl
      if (receiptFile) {
        try {
          url = await uploadReceipt()
        } catch {
          toast({ title: "Upload failed", description: "The receipt could not be uploaded; the expense is saved without it.", variant: "destructive" })
        }
      }

      const expenseData: Record<string, unknown> = {
        store_id: values.storeId || null,
        account_id: values.accountId,
        vendor_name: values.vendorName.trim(),
        description: values.description.trim(),
        amount: Number.parseFloat(values.amount),
        expense_date: format(values.expenseDate, "yyyy-MM-dd"),
        // Petty Cash is paid in cash; Prime Bank by cheque or transfer.
        payment_method: values.paidFrom === "petty_cash" ? "cash" : values.bankMethod,
        receipt_url: url?.trim() || null,
        notes: values.notes?.trim() || null,
        is_recurring: values.isRecurring,
        recurring_frequency: values.isRecurring ? values.recurringFrequency : null,
        tags: values.tags?.trim() ? values.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : null,
        status: values.status,
      }

      if (initialData) {
        await updateExpense(initialData.id, expenseData as Partial<Expense>)
        toast({ title: "Expense updated" })
      } else {
        await createExpense(expenseData as Partial<Expense>)
        toast({ title: "Expense recorded" })
      }
      onExpenseCreatedOrUpdated()
      onClose()
    } catch (error: any) {
      toast({
        title: `Could not ${initialData ? "update" : "record"} the expense`,
        description: String(error?.message || "Please try again.").replace(/^Failed to (create|update) expense: /, ""),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const sourceCard = (key: ExpensePaidFrom["key"], title: string, Icon: typeof Wallet) => {
    const active = source === key
    return (
      <button
        type="button"
        onClick={() => form.setValue("paidFrom", key, { shouldDirty: true })}
        className={cn(
          "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-medium">{title}</span>
      </button>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initialData ? "Edit Expense" : "Record Expense"}</SheetTitle>
          <SheetDescription>Choose the ledger account it is charged to and where the money came from.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-6">
            {/* 1. Ledger account */}
            <Section step={1} title="Ledger Account" hint="Main account first, then the sub-account the expense is charged to.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v)
                          const g = groups.find((x) => x.id === v)
                          form.setValue("accountId", g && g.accounts.length === 1 ? g.accounts[0].id : "")
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingAccounts ? "Loading..." : "e.g. Expenses"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
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
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-account</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!group && !legacyAccount}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={group ? "Choose sub-account" : "Choose the account first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-80">
                          {legacyAccount && !group && (
                            <SelectItem value={legacyAccount.id}>
                              <span className="font-mono text-xs text-muted-foreground mr-2">{legacyAccount.account_code}</span>
                              {legacyAccount.account_name}
                            </SelectItem>
                          )}
                          {group?.accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              <span className="font-mono text-xs text-muted-foreground mr-2">{a.code}</span>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            {/* 2. Payment */}
            <Section step={2} title="Payment" hint="Who pays: Petty Cash (cash) or Prime Bank (cheque or transfer).">
              <FormField
                control={form.control}
                name="paidFrom"
                render={() => (
                  <FormItem>
                    <FormLabel>Paid from</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sourceCard("petty_cash", "Petty Cash / Cash at Hand", Wallet)}
                      {sourceCard("prime_bank", "Prime Bank", Landmark)}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (Ksh)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" className="min-w-[9rem]" {...field} />
                      </FormControl>
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
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value + "T00:00:00") : new Date())}
                          max={format(new Date(), "yyyy-MM-dd")}
                          min="1900-01-01"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {source === "prime_bank" ? (
                  <FormField
                    control={form.control}
                    name="bankMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid by</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="check">Cheque</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="hidden md:block" />
                )}
              </div>
            </Section>

            {/* 3. Details */}
            <Section step={3} title="Details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid to</FormLabel>
                      <FormControl>
                        <Input placeholder="Person or business paid" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store (optional)</FormLabel>
                      <Select onValueChange={(value) => field.onChange(value === "none" ? "" : value)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a store" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Textarea rows={2} placeholder="What was paid for" {...field} />
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
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Cheque number, reference, anything else" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Section>

            {/* 4. Receipt & more */}
            <Section step={4} title="Receipt & more">
              <div>
                <Label className="text-sm font-medium">Receipt</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="file" onChange={handleFileChange} className="flex-grow" accept="image/*,application/pdf" />
                  <Button
                    type="button"
                    onClick={handleUploadReceipt}
                    disabled={!receiptFile || uploadingReceipt}
                    size="icon"
                    title="Upload Receipt"
                  >
                    {uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  </Button>
                </div>
                {receiptFile && <p className="text-sm text-muted-foreground mt-1">Selected: {receiptFile.name}</p>}
              </div>

              {receiptUrl && (
                <div className="relative w-full h-32 border rounded-md overflow-hidden flex items-center justify-center bg-muted">
                  {receiptUrl.endsWith(".pdf") ? (
                    <FileLink href={receiptUrl} className="text-primary hover:underline flex items-center gap-1">
                      <FileText className="h-5 w-5" /> View PDF Receipt
                    </FileLink>
                  ) : (
                    <Image src={receiptUrl} alt="Receipt" layout="fill" objectFit="contain" className="p-1" />
                  )}
                  <Button
                    type="button"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <FormLabel className="m-0">Recurring expense</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {isRecurring && (
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
                              <SelectItem key={freq} value={freq} className="capitalize">
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
                      <FormLabel>Tags (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. travel, client" {...field} />
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
                              <SelectItem key={s} value={s} className="capitalize">
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
            </Section>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving || uploadingReceipt} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploadingReceipt} className="flex-1">
                {saving || uploadingReceipt ? <Spinner /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {uploadingReceipt ? "Uploading..." : saving ? "Saving..." : initialData ? "Update Expense" : "Record Expense"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
