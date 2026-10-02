"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  ArrowLeft, 
  Edit, 
  CheckCircle, 
  RotateCcw, 
  Trash2, 
  Calendar,
  User,
  Building2,
  FileText,
  Hash,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Printer,
  Download,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  Info,
  Scale
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  financeApi,
  formatCurrency, 
  getStatusColor,
  JournalEntry
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format, formatDistanceToNow } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGuard } from "@/components/PermissionGuard"
import { cn } from "@/lib/utils"

// Helper function to get entry type badge color
const getEntryTypeColor = (entryType: string): string => {
  const colors: Record<string, string> = {
    manual: 'bg-blue-100 text-blue-800 border-blue-200',
    automatic: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    adjusting: 'bg-violet-100 text-violet-800 border-violet-200',
    closing: 'bg-orange-100 text-orange-800 border-orange-200',
    reversing: 'bg-pink-100 text-pink-800 border-pink-200',
  };
  return colors[entryType] || 'bg-slate-100 text-slate-800 border-slate-200';
};

// Helper function to get account type color with background
const getAccountTypeBadge = (type: string): string => {
  const colors: Record<string, string> = {
    asset: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    liability: 'bg-red-50 text-red-700 border-red-200',
    equity: 'bg-blue-50 text-blue-700 border-blue-200',
    income: 'bg-purple-50 text-purple-700 border-purple-200',
    expense: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return colors[type] || 'bg-slate-50 text-slate-700 border-slate-200';
};

// Get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'posted':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'draft':
      return <FileText className="h-4 w-4" />;
    case 'pending':
      return <Clock className="h-4 w-4" />;
    case 'reversed':
      return <RotateCcw className="h-4 w-4" />;
    case 'cancelled':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

// Get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

function JournalEntryDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-6 md:grid-cols-3">
         <Skeleton className="h-32 rounded-xl" />
         <Skeleton className="h-32 rounded-xl" />
         <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  )
}

export default function JournalEntryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const entryId = params.id as string

  useEffect(() => {
    if (entryId) {
      fetchEntry()
    }
  }, [entryId])

  const fetchEntry = async () => {
    try {
      setIsLoading(true)
      const response = await financeApi.getJournalEntry(entryId)
      setEntry(response.entry)
    } catch (error) {
      console.error('Error fetching journal entry:', error)
      toast({
        title: "Error",
        description: "Failed to fetch journal entry details.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePostEntry = async () => {
    if (!entry || !confirm(`Are you sure you want to post entry "${entry.entry_number}"?`)) {
      return
    }

    try {
      await financeApi.postJournalEntry(entry.id)
      toast({
        title: "Success",
        description: "Journal entry posted successfully.",
      })
      fetchEntry()
    } catch (error) {
      console.error('Error posting entry:', error)
      toast({
        title: "Error",
        description: "Failed to post journal entry.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteEntry = async () => {
    if (!entry || !confirm(`Are you sure you want to delete entry "${entry.entry_number}"? This action cannot be undone.`)) {
      return
    }

    try {
      await financeApi.deleteJournalEntry(entry.id)
      toast({
        title: "Success",
        description: "Journal entry deleted successfully.",
      })
      router.push('/finance/journal-entries')
    } catch (error) {
      console.error('Error deleting entry:', error)
      toast({
        title: "Error",
        description: "Failed to delete journal entry.",
        variant: "destructive",
      })
    }
  }

  const handleCopyReference = () => {
    if (entry) {
      navigator.clipboard.writeText(entry.reference)
      toast({
        title: "Copied",
        description: "Reference copied to clipboard.",
      })
    }
  }

  if (isLoading) {
    return <JournalEntryDetailSkeleton />
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-slate-100 p-4 mb-4">
          <FileText className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2 text-slate-900">Journal Entry Not Found</h2>
        <p className="text-slate-500 mb-6 text-center max-w-md">
          The journal entry you're looking for doesn't exist or may have been deleted.
        </p>
        <Link href="/finance/journal-entries">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Journal Entries
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <PermissionGuard permissions={["can_view_journal_entries"]}>
      <TooltipProvider>
        <div className="space-y-6">
          
          {/* Header Section */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-lg">
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                   <Link href="/finance/journal-entries">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10">
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                   </Link>
                   <div className="flex items-center gap-3">
                     <h1 className="text-3xl font-bold tracking-tight text-white">{entry.entry_number}</h1>
                     <Badge variant="outline" className={cn("ml-2 capitalize border-opacity-50 bg-opacity-10", getStatusColor(entry.status))}>
                        <span className="flex items-center gap-1.5">
                           {getStatusIcon(entry.status)}
                           {entry.status}
                        </span>
                     </Badge>
                   </div>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300 ml-11">
                    <div className="flex items-center gap-2">
                       <Calendar className="h-4 w-4 text-slate-400" />
                       <span>{format(new Date(entry.entry_date), 'MMMM dd, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Hash className="h-4 w-4 text-slate-400" />
                       <span className="font-mono">{entry.reference}</span>
                       <Button variant="ghost" size="icon" className="h-4 w-4 text-slate-400 hover:text-white p-0 ml-1" onClick={handleCopyReference}>
                          <Copy className="h-3 w-3" />
                       </Button>
                    </div>
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="border-slate-600 text-slate-300 bg-slate-800/50">
                          {entry.entry_type}
                       </Badge>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 ml-11 md:ml-0">
                 {/* Action Buttons */}
                 {(entry.status === 'draft' || entry.status === 'pending') ? (
                    <>
                      <Link href={`/finance/journal-entries/${entry.id}/edit`}>
                        <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button onClick={handlePostEntry} className="bg-emerald-500 hover:bg-emerald-400 text-white border-0">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Post Entry
                      </Button>
                    </>
                 ) : entry.status === 'posted' ? (
                    <Link href={`/finance/journal-entries/${entry.id}/reverse`}>
                      <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white hover:border-red-400/50 hover:text-red-400">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reverse
                      </Button>
                    </Link>
                 ) : null}
                 
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/10">
                          <MoreHorizontal className="h-5 w-5" />
                       </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                       <DropdownMenuItem>
                          <Printer className="h-4 w-4 mr-2" /> Print Entry
                       </DropdownMenuItem>
                       <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" /> Export PDF
                       </DropdownMenuItem>
                       {(entry.status === 'draft' || entry.status === 'pending') && (
                          <>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={handleDeleteEntry} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete Entry
                             </DropdownMenuItem>
                          </>
                       )}
                    </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
             {/* Stats Cards */}
             <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                      <div>
                         <p className="text-sm font-medium text-slate-500 mb-1">Total Debits</p>
                         <p className="text-2xl font-bold text-slate-900">{formatCurrency(entry.total_debit, 'KES')}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                         <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                      </div>
                   </div>
                </CardContent>
             </Card>

             <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                      <div>
                         <p className="text-sm font-medium text-slate-500 mb-1">Total Credits</p>
                         <p className="text-2xl font-bold text-slate-900">{formatCurrency(entry.total_credit, 'KES')}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                         <ArrowDownLeft className="h-5 w-5 text-rose-600" />
                      </div>
                   </div>
                </CardContent>
             </Card>

             <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
                <CardContent className="p-6">
                   <div className="flex items-center justify-between">
                      <div>
                         <p className="text-sm font-medium text-slate-500 mb-1">Items & Status</p>
                         <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-slate-900">{entry.items?.length || 0}</p>
                            <span className="text-sm text-slate-500">lines</span>
                         </div>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                         <Scale className="h-5 w-5 text-blue-600" />
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>

          <Tabs defaultValue="lines" className="space-y-6">
            <TabsList className="bg-slate-100 p-1 rounded-lg border border-slate-200">
               <TabsTrigger value="lines" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">Line Items</TabsTrigger>
               <TabsTrigger value="details" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">Entry Details</TabsTrigger>
               <TabsTrigger value="audit" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">Audit Trail</TabsTrigger>
            </TabsList>

            <TabsContent value="lines" className="space-y-4">
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                 <div className="overflow-x-auto">
                   <Table>
                      <TableHeader className="bg-slate-50">
                         <TableRow>
                            <TableHead className="w-[120px] font-semibold text-slate-600 uppercase text-xs tracking-wider">Account Code</TableHead>
                            <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wider">Account</TableHead>
                            <TableHead className="font-semibold text-slate-600 uppercase text-xs tracking-wider">Description</TableHead>
                            <TableHead className="w-[120px] font-semibold text-slate-600 uppercase text-xs tracking-wider">Type</TableHead>
                            <TableHead className="text-right w-[140px] font-semibold text-slate-600 uppercase text-xs tracking-wider">Debit</TableHead>
                            <TableHead className="text-right w-[140px] font-semibold text-slate-600 uppercase text-xs tracking-wider">Credit</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {entry.items?.map((item, index) => (
                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                               <TableCell className="font-mono text-sm text-slate-600">
                                  {item.chart_of_account?.account_code}
                               </TableCell>
                               <TableCell>
                                  <div className="flex flex-col">
                                     <span className="font-medium text-slate-900">{item.chart_of_account?.account_name}</span>
                                     <span className="text-xs text-slate-500">{item.chart_of_account?.full_path}</span>
                                  </div>
                               </TableCell>
                               <TableCell className="text-sm text-slate-600 max-w-[300px] truncate">
                                  {item.description || <span className="text-slate-400 italic">No description</span>}
                               </TableCell>
                               <TableCell>
                                  <Badge variant="outline" className={getAccountTypeBadge(item.chart_of_account?.account_type || '')}>
                                     {item.chart_of_account?.account_type}
                                  </Badge>
                               </TableCell>
                               <TableCell className="text-right font-mono text-sm">
                                  {parseFloat(item.debit_amount) > 0 ? (
                                     <span className="font-medium text-slate-900">
                                        {formatCurrency(item.debit_amount, 'KES')}
                                     </span>
                                  ) : <span className="text-slate-300">-</span>}
                               </TableCell>
                               <TableCell className="text-right font-mono text-sm">
                                  {parseFloat(item.credit_amount) > 0 ? (
                                     <span className="font-medium text-slate-900">
                                        {formatCurrency(item.credit_amount, 'KES')}
                                     </span>
                                  ) : <span className="text-slate-300">-</span>}
                               </TableCell>
                            </TableRow>
                         ))}
                      </TableBody>
                      <TableFooter className="bg-slate-50 border-t">
                         <TableRow>
                            {/* <TableCell colSpan={4} className="text-right font-bold text-slate-700 uppercase text-xs tracking-wider">Totals</TableCell> */}
                            <TableCell colSpan={4} className="text-right align-middle h-12">
                               <span className="font-semibold text-sm text-slate-900">Total Amounts</span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-700 text-sm align-middle">
                               {formatCurrency(entry.total_debit, 'KES')}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-rose-700 text-sm align-middle">
                               {formatCurrency(entry.total_credit, 'KES')}
                            </TableCell>
                         </TableRow>
                      </TableFooter>
                   </Table>
                 </div>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                 <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                       <CardTitle className="text-base font-semibold text-slate-800">
                          Entry Description
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                       <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                          {entry.description || "No description provided."}
                       </p>
                    </CardContent>
                 </Card>

                 <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                       <CardTitle className="text-base font-semibold text-slate-800">
                          System Metadata
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                       <dl className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                             <dt className="text-slate-500 mb-1">Created At</dt>
                             <dd className="font-medium text-slate-900">{format(new Date(entry.created_at), "PPp")}</dd>
                          </div>
                          <div>
                             <dt className="text-slate-500 mb-1">Last Updated</dt>
                             <dd className="font-medium text-slate-900">{format(new Date(entry.updated_at), "PPp")}</dd>
                          </div>
                          {entry.posted_by && (
                             <div>
                                <dt className="text-slate-500 mb-1">Posted By</dt>
                                <dd className="font-medium text-slate-900">{entry.posted_by}</dd>
                             </div>
                          )}
                          {entry.source_type && (
                             <div className="col-span-2">
                                <dt className="text-slate-500 mb-1">Source Context</dt>
                                <dd className="font-mono text-xs bg-slate-100 p-1 rounded inline-block text-slate-700">
                                   {entry.source_type} : {entry.source_id}
                                </dd>
                             </div>
                          )}
                       </dl>
                    </CardContent>
                 </Card>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50 border-b pb-4">
                  <CardTitle className="text-base font-semibold text-slate-800">Activity Log</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-8 pl-4 border-l-2 border-slate-100 ml-4">
                     {/* Creation Event */}
                     <div className="relative">
                        <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full border-2 border-white bg-blue-500 ring-4 ring-blue-50"></div>
                        <div className="space-y-1">
                           <p className="text-sm font-medium text-slate-900">
                              Entry Created
                              {entry.creator && <span className="text-slate-500 font-normal"> by {entry.creator.full_name}</span>}
                           </p>
                           <p className="text-xs text-slate-500">{format(new Date(entry.created_at), "PPP p")}</p>
                        </div>
                     </div>

                     {/* Posted Event */}
                     {entry.posted_at && (
                        <div className="relative">
                           <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 ring-4 ring-emerald-50"></div>
                           <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-900">
                                 Entry Posted
                                 {entry.approver && <span className="text-slate-500 font-normal"> by {entry.approver.full_name}</span>}
                              </p>
                              <p className="text-xs text-slate-500">{format(new Date(entry.posted_at), "PPP p")}</p>
                           </div>
                        </div>
                     )}

                     {/* Reversed Event */}
                     {entry.reversed_at && (
                        <div className="relative">
                           <div className="absolute -left-[25px] top-0 h-4 w-4 rounded-full border-2 border-white bg-red-500 ring-4 ring-red-50"></div>
                           <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-900">
                                 Entry Reversed
                                 {entry.reversed_by && <span className="text-slate-500 font-normal"> by {entry.reversed_by}</span>}
                              </p>
                              <p className="text-xs text-slate-500">{format(new Date(entry.reversed_at), "PPP p")}</p>
                              {entry.reversal_reason && (
                                 <p className="text-sm text-red-600 bg-red-50 p-2 rounded mt-2 inline-block">
                                    Reason: {entry.reversal_reason}
                                 </p>
                              )}
                           </div>
                        </div>
                     )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

        </div>
      </TooltipProvider>
    </PermissionGuard>
  )
}
