"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { format } from "date-fns"
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Save,
  Calculator,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Check,
  ChevronsUpDown
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { 
  financeApi, 
  ChartOfAccount, 
  formatCurrency,
  JournalEntry
} from "@/lib/finance"
import { PermissionGuard } from "@/components/PermissionGuard"

interface JournalEntryLineItem {
  id?: string // For existing lines
  chart_of_account_id: string
  debit_amount: number
  credit_amount: number
  description: string
}

interface JournalEntryFormData {
  reference: string
  entry_date: string
  description: string
  memo: string
  entry_type: string
  currency_code: string
  exchange_rate: number
  items: JournalEntryLineItem[]
}

export default function EditJournalEntryPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [totalDebits, setTotalDebits] = useState(0)
  const [totalCredits, setTotalCredits] = useState(0)
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [accountSearchOpen, setAccountSearchOpen] = useState<{ [key: number]: boolean }>({})

  const entryId = params.id as string

  const form = useForm<JournalEntryFormData>({
    defaultValues: {
      reference: "",
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      description: "",
      memo: "",
      entry_type: "manual",
      currency_code: "KES",
      exchange_rate: 1.0,
      items: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedItems = form.watch("items")

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        await Promise.all([
          fetchAccounts(),
          fetchEntry()
        ])
      } catch (error) {
        console.error("Initialization error:", error)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    // Calculate totals whenever items change
    const debits = watchedItems.reduce((sum, item) => sum + (Number(item.debit_amount) || 0), 0)
    const credits = watchedItems.reduce((sum, item) => sum + (Number(item.credit_amount) || 0), 0)
    setTotalDebits(debits)
    setTotalCredits(credits)
  }, [watchedItems])

  const fetchAccounts = async () => {
    try {
      const response = await financeApi.getChartOfAccounts()
      // Flatten the accounts for the dropdown if they are hierarchical, or just use as is
      // Assuming flat list or need to process
      setAccounts(response.accounts)
    } catch (error) {
      console.error("Failed to fetch accounts:", error)
      toast({
        title: "Error",
        description: "Failed to load chart of accounts.",
        variant: "destructive",
      })
    }
  }

  const fetchEntry = async () => {
    try {
      const response = await financeApi.getJournalEntry(entryId)
      const fetchedEntry = response.entry
      setEntry(fetchedEntry)
      
      // Populate form
      form.reset({
        reference: fetchedEntry.reference,
        entry_date: fetchedEntry.entry_date.split('T')[0], // Extract standard date part
        description: fetchedEntry.description,
        memo: (fetchedEntry.metadata?.memo as string) || "",
        entry_type: fetchedEntry.entry_type,
        currency_code: (fetchedEntry.metadata?.currency_code as string) || "KES",
        exchange_rate: (fetchedEntry.metadata?.exchange_rate as number) || 1.0,
        items: fetchedEntry.items.map(item => ({
          id: item.id,
          chart_of_account_id: item.account_id ? item.account_id.toString() : item.chart_of_account.id.toString(), // Handle different response structures
          debit_amount: parseFloat(item.debit_amount),
          credit_amount: parseFloat(item.credit_amount),
          description: item.description || ""
        }))
      })
    } catch (error) {
      console.error("Failed to fetch entry:", error)
      toast({
        title: "Error",
        description: "Failed to load journal entry details.",
        variant: "destructive",
      })
      router.push('/finance/journal-entries')
    }
  }

  const onSubmit = async (data: JournalEntryFormData) => {
    // Validate balance
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      toast({
        title: "Entry Unbalanced",
        description: `Debits (${formatCurrency(totalDebits, 'KES')}) must equal Credits (${formatCurrency(totalCredits, 'KES')}). Difference: ${formatCurrency(Math.abs(totalDebits - totalCredits), 'KES')}`,
        variant: "destructive",
      })
      return
    }

    // Validate at least 2 lines
    if (data.items.length < 2) {
      toast({
        title: "Invalid Entry",
        description: "A journal entry must have at least two line items.",
        variant: "destructive",
      })
      return
    }

    // Validate amounts
    if (totalDebits === 0 && totalCredits === 0) {
      toast({
        title: "Invalid Amounts",
        description: "Journal entry cannot be zero value.",
        variant: "destructive",
      })
      return
    }
    
    // Validate account selection
    const missingAccounts = data.items.some(item => !item.chart_of_account_id)
    if (missingAccounts) {
      toast({
        title: "Missing Information",
        description: "All line items must have an account selected.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      
      const entryData = {
        entry_date: data.entry_date,
        reference: data.reference,
        description: data.description,
        items: data.items.map(item => ({
          id: item.id, // Include ID for updates if API supports partial updates on lines
          account_id: item.chart_of_account_id,
          description: item.description,
          debit_amount: parseFloat(item.debit_amount.toString()) || 0,
          credit_amount: parseFloat(item.credit_amount.toString()) || 0,
        })),
        entry_type: data.entry_type as any,
        metadata: {
           memo: data.memo,
           currency_code: data.currency_code,
           exchange_rate: data.exchange_rate
        }
      }

      await financeApi.updateJournalEntry(entryId, entryData)

      toast({
        title: "Success",
        description: "Journal entry updated successfully.",
      })

      router.push(`/finance/journal-entries/${entryId}`)
    } catch (error) {
      console.error("Failed to update journal entry:", error)
      toast({
        title: "Error",
        description: "Failed to update journal entry. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <PermissionGuard permissions={["can_edit_journal_entries"]}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
             <div className="flex items-center gap-2 mb-1">
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="h-6 w-6 p-0 hover:bg-transparent"
                 onClick={() => router.back()}
                 type="button"
               >
                 <ArrowLeft className="h-4 w-4 text-muted-foreground" />
               </Button>
               <h1 className="text-2xl font-bold tracking-tight">Edit Journal Entry</h1>
             </div>
             <p className="text-muted-foreground">Modify details for entry {entry?.entry_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !isBalanced} className={cn(!isBalanced && "opacity-50 cursor-not-allowed")}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Details */}
          <div className="xl:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Entry Details</CardTitle>
                <CardDescription>Basic information about this transaction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference #</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="reference" 
                      {...form.register("reference", { required: true })} 
                      placeholder="JE-2024-001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.watch("entry_date") && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.watch("entry_date") ? (
                          format(new Date(form.watch("entry_date")), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={form.watch("entry_date") ? new Date(form.watch("entry_date")) : undefined}
                        onSelect={(date) => form.setValue("entry_date", date ? format(date, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                   <Label>Entry Type</Label>
                   <Select 
                      onValueChange={(value) => form.setValue("entry_type", value)}
                      defaultValue={form.watch("entry_type")}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select type" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="manual">Manual Journal</SelectItem>
                       <SelectItem value="adjusting">Adjusting Entry</SelectItem>
                       <SelectItem value="closing">Closing Entry</SelectItem>
                       <SelectItem value="reversing">Reversing Entry</SelectItem>
                     </SelectContent>
                   </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select 
                      onValueChange={(value) => form.setValue("currency_code", value)}
                      defaultValue={form.watch("currency_code")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KES">KES</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exchange_rate">Exchange Rate</Label>
                    <Input 
                      id="exchange_rate" 
                      type="number" 
                      step="0.0001"
                      {...form.register("exchange_rate", { valueAsNumber: true })} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    {...form.register("description", { required: true })} 
                    placeholder="Enter a description for this journal entry"
                    className="resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memo">Private Memo (Optional)</Label>
                  <Textarea 
                    id="memo" 
                    {...form.register("memo")} 
                    placeholder="Internal notes..."
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className={cn("border-l-4", isBalanced ? "border-l-emerald-500 bg-emerald-50/50" : "border-l-rose-500 bg-rose-50/50")}>
               <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                     <Calculator className="h-4 w-4" />
                     Balance Check
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="space-y-3">
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Debits:</span>
                        <span className="font-mono font-medium">{formatCurrency(totalDebits, 'KES')}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Credits:</span>
                        <span className="font-mono font-medium">{formatCurrency(totalCredits, 'KES')}</span>
                     </div>
                     <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                        <span className={isBalanced ? "text-emerald-700" : "text-rose-700"}>Difference:</span>
                        <span className={cn("font-mono", isBalanced ? "text-emerald-700" : "text-rose-700")}>
                           {formatCurrency(Math.abs(totalDebits - totalCredits), 'KES')}
                        </span>
                     </div>
                  </div>
                  {!isBalanced && (
                     <div className="mt-4 flex items-start gap-2 text-xs text-rose-600 bg-rose-100 p-2 rounded">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>Entry is currently unbalanced. You cannot save until debits equal credits.</p>
                     </div>
                  )}
                  {isBalanced && (
                     <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-100 p-2 rounded">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <p>Entry is balanced and ready to save.</p>
                     </div>
                  )}
               </CardContent>
            </Card>
          </div>

          {/* Right Column: Line Items */}
          <div className="xl:col-span-2 space-y-6">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                   <CardTitle>Line Items</CardTitle>
                   <CardDescription>Add at least two line items to balance the entry</CardDescription>
                </div>
                <Button 
                   type="button" 
                   variant="outline" 
                   size="sm" 
                   onClick={() => append({ chart_of_account_id: "", debit_amount: 0, credit_amount: 0, description: "" })}
                >
                   <Plus className="h-4 w-4 mr-2" />
                   Add Line
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0">
                <Table>
                   <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                         <TableHead className="w-[30%]">Account</TableHead>
                         <TableHead className="w-[20%]">Description</TableHead>
                         <TableHead className="w-[20%] text-right">Debit</TableHead>
                         <TableHead className="w-[20%] text-right">Credit</TableHead>
                         <TableHead className="w-[10%]"></TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {fields.map((field, index) => (
                         <TableRow key={field.id} className="group">
                            <TableCell className="align-top">
                               <div className="space-y-1">
                                  <Popover
                                     open={accountSearchOpen[index] || false}
                                     onOpenChange={(open) => setAccountSearchOpen(prev => ({ ...prev, [index]: open }))}
                                  >
                                     <PopoverTrigger asChild>
                                        <Button
                                           variant="outline"
                                           role="combobox"
                                           aria-expanded={accountSearchOpen[index] || false}
                                           className={cn(
                                              "w-full justify-between font-normal",
                                              !form.watch(`items.${index}.chart_of_account_id`) && "border-rose-300 ring-rose-300 focus:ring-rose-300"
                                           )}
                                        >
                                           {form.watch(`items.${index}.chart_of_account_id`) ? (
                                              (() => {
                                                 const account = accounts.find(a => a.id.toString() === form.watch(`items.${index}.chart_of_account_id`))
                                                 return account ? (
                                                    <span className="truncate">
                                                       <span className="font-mono text-muted-foreground mr-2">{account.account_code}</span>
                                                       {account.account_name}
                                                    </span>
                                                 ) : "Select Account"
                                              })()
                                           ) : "Select Account"}
                                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                     </PopoverTrigger>
                                     <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                           <CommandInput placeholder="Search accounts..." />
                                           <CommandList>
                                              <CommandEmpty>No account found.</CommandEmpty>
                                              <CommandGroup>
                                                 {accounts.map(account => (
                                                    <CommandItem
                                                       key={account.id}
                                                       value={`${account.account_code} ${account.account_name}`}
                                                       onSelect={() => {
                                                          const formValues = form.getValues();
                                                          formValues.items[index].chart_of_account_id = account.id.toString();
                                                          form.setValue("items", formValues.items);
                                                          setAccountSearchOpen(prev => ({ ...prev, [index]: false }))
                                                       }}
                                                    >
                                                       <Check className={cn("mr-2 h-4 w-4", form.watch(`items.${index}.chart_of_account_id`) === account.id.toString() ? "opacity-100" : "opacity-0")} />
                                                       <span className="font-mono text-muted-foreground mr-2">{account.account_code}</span>
                                                       {account.account_name}
                                                    </CommandItem>
                                                 ))}
                                              </CommandGroup>
                                           </CommandList>
                                        </Command>
                                     </PopoverContent>
                                  </Popover>
                                  {/* Show account type helper */}
                                  {form.watch(`items.${index}.chart_of_account_id`) && (
                                     <div className="text-[10px] text-muted-foreground px-1">
                                        Type: {accounts.find(a => a.id.toString() === form.watch(`items.${index}.chart_of_account_id`))?.account_type}
                                     </div>
                                  )}
                               </div>
                            </TableCell>
                            <TableCell className="align-top">
                               <Input 
                                  {...form.register(`items.${index}.description` as const)} 
                                  placeholder="Line description"
                               />
                            </TableCell>
                            <TableCell className="align-top">
                               <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0"
                                  className="text-right font-mono"
                                  placeholder="0.00"
                                  {...form.register(`items.${index}.debit_amount` as const, { 
                                     valueAsNumber: true,
                                     onChange: (e) => {
                                        // Auto-clear credit if debit is entered
                                        if (parseFloat(e.target.value) > 0) {
                                           form.setValue(`items.${index}.credit_amount`, 0)
                                        }
                                     }
                                  })}
                               />
                            </TableCell>
                            <TableCell className="align-top">
                               <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0"
                                  className="text-right font-mono"
                                  placeholder="0.00"
                                  {...form.register(`items.${index}.credit_amount` as const, { 
                                     valueAsNumber: true,
                                     onChange: (e) => {
                                        // Auto-clear debit if credit is entered
                                        if (parseFloat(e.target.value) > 0) {
                                           form.setValue(`items.${index}.debit_amount`, 0)
                                        }
                                     }
                                  })}
                               />
                            </TableCell>
                            <TableCell className="align-top text-right">
                               <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => remove(index)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500"
                               >
                                  <Trash2 className="h-4 w-4" />
                               </Button>
                            </TableCell>
                         </TableRow>
                      ))}
                      {fields.length === 0 && (
                         <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground border-dashed">
                               <div className="flex flex-col items-center gap-2">
                                  <p>No line items added yet.</p>
                                  <Button variant="link" onClick={() => append({ chart_of_account_id: "", debit_amount: 0, credit_amount: 0, description: "" })}>
                                     Add your first line
                                  </Button>
                               </div>
                            </TableCell>
                         </TableRow>
                      )}
                   </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="bg-muted/20 border-t p-4 flex justify-between items-center text-sm font-medium">
                 <div className="flex items-center gap-4">
                    <span>Count: {fields.length} items</span>
                 </div>
                 <div className="flex items-center gap-8">
                    <div className="text-right">
                       <span className="text-muted-foreground mr-2">Total Debits:</span>
                       <span className="font-mono">{formatCurrency(totalDebits, 'KES')}</span>
                    </div>
                    <div className="text-right">
                       <span className="text-muted-foreground mr-2">Total Credits:</span>
                       <span className="font-mono">{formatCurrency(totalCredits, 'KES')}</span>
                    </div>
                 </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </PermissionGuard>
  )
}
