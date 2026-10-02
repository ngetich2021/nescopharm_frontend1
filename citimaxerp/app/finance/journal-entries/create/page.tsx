"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Calculator,
  Save,
  Info,
  Check,
  ChevronsUpDown
} from "lucide-react"
import { 
  createJournalEntry, 
  getChartOfAccounts, 
  formatCurrency, 
  ChartOfAccount, 
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import Link from "next/link"
import { PermissionGuard } from "@/components/PermissionGuard"
import { cn } from "@/lib/utils"

interface JournalEntryFormData {
  reference: string
  entry_date: string
  description: string
  memo: string
  entry_type: string
  currency_code: string
  exchange_rate: number
  items: {
    chart_of_account_id: string
    debit_amount: number
    credit_amount: number
    description: string
  }[]
}

const entryTypes = [
  { value: "manual", label: "Manual Entry" },
  { value: "adjusting", label: "Adjusting Entry" },
  { value: "closing", label: "Closing Entry" },
  { value: "reversing", label: "Reversing Entry" },
]

export default function CreateJournalEntryPage() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalDebits, setTotalDebits] = useState(0)
  const [totalCredits, setTotalCredits] = useState(0)
  const [accountSearchOpen, setAccountSearchOpen] = useState<{ [key: number]: boolean }>({})
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<JournalEntryFormData>({
    defaultValues: {
      reference: "",
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      description: "",
      memo: "",
      entry_type: "manual",
      currency_code: "KES",
      exchange_rate: 1.0,
      items: [
        { chart_of_account_id: "", debit_amount: 0, credit_amount: 0, description: "" },
        { chart_of_account_id: "", debit_amount: 0, credit_amount: 0, description: "" }
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedItems = form.watch("items")

  useEffect(() => {
    fetchAccounts()
    generateReference()
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
      const response = await getChartOfAccounts({ is_active: true })
      setAccounts(response.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast({
        title: "Error",
        description: "Failed to fetch chart of accounts. Please try again.",
        variant: "destructive",
      })
    }
  }

  const generateReference = () => {
    // Generate a reference number (you can make this more sophisticated)
    const date = new Date()
    const dateStr = format(date, 'yyyyMMdd')
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const reference = `JE-${dateStr}-${randomNum}`
    form.setValue("reference", reference)
  }

  const addLineItem = () => {
    append({ chart_of_account_id: "", debit_amount: 0, credit_amount: 0, description: "" })
  }

  const removeLineItem = (index: number) => {
    if (fields.length > 2) {
      remove(index)
    }
  }

  const isBalanced = () => {
    return Math.abs(totalDebits - totalCredits) < 0.01 // Allow for small rounding differences
  }

  const onSubmit = async (data: JournalEntryFormData) => {
    if (!isBalanced()) {
      toast({
        title: "Error",
        description: "Journal entry must be balanced. Total debits must equal total credits.",
        variant: "destructive",
      })
      return
    }

    // Validate that all line items have accounts selected
    const invalidItems = data.items.some(item => 
      !item.chart_of_account_id || (item.debit_amount === 0 && item.credit_amount === 0)
    )

    if (invalidItems) {
      toast({
        title: "Error",
        description: "All line items must have an account selected and either a debit or credit amount.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      
      const entryData = {
        entry_date: data.entry_date,
        reference: data.reference,
        description: data.description,
        status: 'pending' as const,
        items: data.items.map(item => ({
          account_id: item.chart_of_account_id,
          description: item.description,
          debit_amount: parseFloat(item.debit_amount.toString()) || 0,
          credit_amount: parseFloat(item.credit_amount.toString()) || 0,
        })),
        entry_type: data.entry_type as any,
        currency_code: data.currency_code,
        exchange_rate: data.exchange_rate,
      }

      await createJournalEntry(entryData)
      toast({
        title: "Success",
        description: "Journal entry created successfully.",
      })
      router.push('/finance/journal-entries')
    } catch (error) {
      console.error('Error creating journal entry:', error)
      toast({
        title: "Error",
        description: "Failed to create journal entry. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PermissionGuard permissions={["can_create_journal_entries"]}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Header Section */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 to-slate-900 p-8 text-white shadow-lg">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                   <Link href="/finance/journal-entries">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-200 hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                   </Link>
                   <h1 className="text-2xl font-bold tracking-tight">New Journal Entry</h1>
                </div>
                <p className="text-emerald-100 max-w-xl text-sm ml-10">
                  Create a double-entry bookkeeping record. Ensure credits match debits.
                </p>
              </div>
              <div className="flex gap-3">
                 <Link href="/finance/journal-entries">
                    <Button variant="outline" className="border-emerald-700 text-emerald-100 hover:bg-emerald-800 bg-emerald-900/50">
                      Cancel
                    </Button>
                 </Link>
                 <Button type="submit" disabled={isLoading || !isBalanced()} className="bg-emerald-500 hover:bg-emerald-400 text-white border-0">
                    {isLoading ? "Saving..." : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Entry
                      </>
                    )}
                 </Button>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Left Column: Entry Details */}
            <div className="lg:col-span-1 space-y-6">
               <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="bg-slate-50 border-b pb-4">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                       <Info className="h-4 w-4 text-slate-500" />
                       Entry Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                     <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Reference #</FormLabel>
                            <FormControl>
                              <Input {...field} className="font-mono bg-slate-50" readOnly />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="entry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Transaction Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="entry_type"
                        render={({ field }) => (
                          <FormItem>
                             <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Entry Type</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {entryTypes.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
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
                        name="currency_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Currency</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Currency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                                </SelectContent>
                             </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold text-slate-500 uppercase">Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Describe the transaction..." 
                                className="resize-none min-h-[80px]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  </CardContent>
               </Card>

               <Card className="border-slate-200 shadow-sm bg-slate-50/50">
                  <CardContent className="pt-6">
                     <h3 className="text-sm font-medium text-slate-900 mb-2">Summary</h3>
                     <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                           <span className="text-slate-500">Total Debits</span>
                           <span className="font-mono font-medium text-slate-900">{formatCurrency(totalDebits.toString())}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-slate-500">Total Credits</span>
                           <span className="font-mono font-medium text-slate-900">{formatCurrency(totalCredits.toString())}</span>
                        </div>
                        <div className="pt-3 border-t flex justify-between items-center">
                           <span className="text-sm font-semibold text-slate-900">Difference</span>
                           <div className={cn(
                             "flex items-center gap-2 px-2 py-1 rounded-md border",
                             isBalanced() ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
                           )}>
                              <span className="font-mono font-bold text-sm">
                                {formatCurrency((Math.abs(totalDebits - totalCredits)).toString())}
                              </span>
                              {isBalanced() ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                           </div>
                        </div>
                     </div>
                  </CardContent>
               </Card>
            </div>

            {/* Right Column: Line Items */}
            <div className="lg:col-span-2">
              <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
                   <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-slate-500" />
                      Journal Lines
                   </CardTitle>
                   <Button type="button" onClick={addLineItem} variant="outline" size="sm" className="bg-white hover:bg-slate-50">
                      <Plus className="h-3.5 w-3.5 mr-2" />
                      Add Line
                   </Button>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                   <div className="overflow-x-auto">
                     <Table>
                        <TableHeader>
                           <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[35%] pl-6">Account</TableHead>
                              <TableHead className="w-[25%]">Description</TableHead>
                              <TableHead className="w-[15%] text-right">Debit</TableHead>
                              <TableHead className="w-[15%] text-right">Credit</TableHead>
                              <TableHead className="w-[10%]"></TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {fields.map((field, index) => (
                              <TableRow key={field.id} className="hover:bg-slate-50/50">
                                 <TableCell className="pl-6 align-top pt-4">
                                    <FormField
                                       control={form.control}
                                       name={`items.${index}.chart_of_account_id`}
                                       render={({ field }) => (
                                          <FormItem className="space-y-0">
                                             <Popover
                                                open={accountSearchOpen[index] || false}
                                                onOpenChange={(open) => setAccountSearchOpen(prev => ({ ...prev, [index]: open }))}
                                             >
                                                <PopoverTrigger asChild>
                                                   <FormControl>
                                                      <Button
                                                         variant="outline"
                                                         role="combobox"
                                                         aria-expanded={accountSearchOpen[index] || false}
                                                         className="w-full justify-between font-normal h-9"
                                                      >
                                                         {field.value ? (
                                                            (() => {
                                                               const account = accounts.find((a) => a.id === field.value)
                                                               return account ? (
                                                                  <span className="truncate">
                                                                     <span className="font-mono text-xs text-slate-500 mr-2">{account.account_code}</span>
                                                                     {account.account_name}
                                                                  </span>
                                                               ) : "Select account"
                                                            })()
                                                         ) : "Select account"}
                                                         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                      </Button>
                                                   </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                   <Command>
                                                      <CommandInput placeholder="Search accounts..." />
                                                      <CommandList className="max-h-[300px]">
                                                         <CommandEmpty>No account found.</CommandEmpty>
                                                         <CommandGroup>
                                                            {accounts.map((account) => (
                                                               <CommandItem
                                                                  key={account.id}
                                                                  value={`${account.account_code} ${account.account_name}`}
                                                                  onSelect={() => {
                                                                     field.onChange(account.id)
                                                                     setAccountSearchOpen(prev => ({ ...prev, [index]: false }))
                                                                  }}
                                                               >
                                                                  <Check className={cn("mr-2 h-4 w-4", field.value === account.id ? "opacity-100" : "opacity-0")} />
                                                                  <span className="font-mono text-xs text-slate-500 mr-2">{account.account_code}</span>
                                                                  {account.account_name}
                                                               </CommandItem>
                                                            ))}
                                                         </CommandGroup>
                                                      </CommandList>
                                                   </Command>
                                                </PopoverContent>
                                             </Popover>
                                             <FormMessage />
                                          </FormItem>
                                       )}
                                    />
                                    {/* Account Type Hint (could look up type from accounts array based on selected id) */}
                                 </TableCell>
                                 <TableCell className="align-top pt-4">
                                    <FormField
                                       control={form.control}
                                       name={`items.${index}.description`}
                                       render={({ field }) => (
                                          <FormItem className="space-y-0">
                                             <FormControl>
                                                <Input {...field} placeholder="Line memo..." className="h-9" />
                                             </FormControl>
                                          </FormItem>
                                       )}
                                    />
                                 </TableCell>
                                 <TableCell className="align-top pt-4">
                                    <FormField
                                       control={form.control}
                                       name={`items.${index}.debit_amount`}
                                       render={({ field }) => (
                                          <FormItem className="space-y-0">
                                             <FormControl>
                                                <div className="relative">
                                                   <Input 
                                                      type="number" 
                                                      step="0.01"
                                                      {...field}
                                                      onChange={(e) => {
                                                         field.onChange(parseFloat(e.target.value) || 0)
                                                         if (parseFloat(e.target.value) > 0) {
                                                            form.setValue(`items.${index}.credit_amount`, 0)
                                                         }
                                                      }}
                                                      className="h-9 text-right font-mono pr-2"
                                                      placeholder="0.00"
                                                   />
                                                </div>
                                             </FormControl>
                                          </FormItem>
                                       )}
                                    />
                                 </TableCell>
                                 <TableCell className="align-top pt-4">
                                    <FormField
                                       control={form.control}
                                       name={`items.${index}.credit_amount`}
                                       render={({ field }) => (
                                          <FormItem className="space-y-0">
                                             <FormControl>
                                                <div className="relative">
                                                   <Input 
                                                      type="number" 
                                                      step="0.01"
                                                      {...field}
                                                      onChange={(e) => {
                                                         field.onChange(parseFloat(e.target.value) || 0)
                                                         if (parseFloat(e.target.value) > 0) {
                                                            form.setValue(`items.${index}.debit_amount`, 0)
                                                         }
                                                      }}
                                                      className="h-9 text-right font-mono pr-2"
                                                      placeholder="0.00"
                                                   />
                                                </div>
                                             </FormControl>
                                          </FormItem>
                                       )}
                                    />
                                 </TableCell>
                                 <TableCell className="align-top pt-4 text-center">
                                    {fields.length > 2 && (
                                       <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeLineItem(index)}
                                          className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                       >
                                          <Trash2 className="h-4 w-4" />
                                       </Button>
                                    )}
                                 </TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                   </div>
                   
                   {fields.length === 0 && (
                      <div className="p-8 text-center text-slate-400">
                         <Calculator className="h-10 w-10 mx-auto mb-3 opacity-20" />
                         <p>No lines added yet.</p>
                         <Button variant="link" onClick={addLineItem}>Add your first line</Button>
                      </div>
                   )}
                </CardContent>
              </Card>
            </div>

          </div>
        </form>
      </Form>
    </PermissionGuard>
  )
}
