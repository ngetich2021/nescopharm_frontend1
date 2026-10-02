"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FinanceTableSkeleton } from "@/components/ui/skeletons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Filter,
  CheckCircle,
  RotateCcw,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  BookOpen
} from "lucide-react"
import { 
  financeApi,
  formatCurrency, 
  getStatusColor,
  JournalEntry,
} from "@/lib/finance"
import { useToast } from "@/hooks/use-toast"
import { format, formatDistanceToNow } from "date-fns"
import { PermissionGuard } from "@/components/PermissionGuard"

// Helper function to get entry type badge color
const getEntryTypeColor = (entryType: string): string => {
  const colors: Record<string, string> = {
    manual: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10',
    automatic: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10',
    adjusting: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10',
    closing: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/10',
    reversing: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
  };
  return colors[entryType] || 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10';
};

// Get status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'posted':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
    case 'draft':
      return <FileText className="h-3.5 w-3.5 text-slate-500" />;
    case 'pending':
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case 'reversed':
      return <RotateCcw className="h-3.5 w-3.5 text-slate-400" />;
    case 'cancelled':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return null;
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

export default function JournalEntriesPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedEntryType, setSelectedEntryType] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const { toast } = useToast()

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending" },
    { value: "posted", label: "Posted" },
    { value: "cancelled", label: "Cancelled" },
    { value: "reversed", label: "Reversed" },
  ]

  const entryTypeOptions = [
    { value: "all", label: "All Types" },
    { value: "manual", label: "Manual" },
    { value: "automatic", label: "Automatic" },
    { value: "adjusting", label: "Adjusting" },
    { value: "closing", label: "Closing" },
    { value: "reversing", label: "Reversing" },
  ]

  useEffect(() => {
    fetchEntries()
  }, [])

  const fetchEntries = async () => {
    try {
      setIsLoading(true)
      const response = await financeApi.getJournalEntries({})
      setEntries(response.entries || [])
    } catch (error) {
      console.error('Error fetching journal entries:', error)
      toast({
        title: "Error",
        description: "Failed to fetch journal entries. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Filter entries based on search and filters
  const filteredEntries = entries.filter((entry) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = !searchTerm || 
      entry.entry_number?.toLowerCase().includes(searchLower) ||
      entry.reference?.toLowerCase().includes(searchLower) ||
      entry.description?.toLowerCase().includes(searchLower)
    
    const matchesStatus = selectedStatus === "all" || entry.status === selectedStatus
    const matchesType = selectedEntryType === "all" || entry.entry_type === selectedEntryType
    
    let matchesDateFrom = true
    let matchesDateTo = true
    
    if (dateFrom) {
      matchesDateFrom = new Date(entry.entry_date) >= new Date(dateFrom)
    }
    if (dateTo) {
      matchesDateTo = new Date(entry.entry_date) <= new Date(dateTo)
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + rowsPerPage)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedStatus, selectedEntryType, dateFrom, dateTo, rowsPerPage])

  const handlePostEntry = async (entry: JournalEntry) => {
    if (!confirm(`Are you sure you want to post "${entry.entry_number}"?`)) {
      return
    }

    try {
      await financeApi.postJournalEntry(entry.id)
      toast({
        title: "Success",
        description: "Journal entry posted successfully.",
      })
      fetchEntries()
    } catch (error) {
      console.error('Error posting entry:', error)
      toast({
        title: "Error",
        description: "Failed to post journal entry. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteEntry = async (entry: JournalEntry) => {
    if (!confirm(`Are you sure you want to delete "${entry.entry_number}"?`)) {
      return
    }

    try {
      await financeApi.deleteJournalEntry(entry.id)
      toast({
        title: "Success",
        description: "Journal entry deleted successfully.",
      })
      fetchEntries()
    } catch (error) {
      console.error('Error deleting entry:', error)
      toast({
        title: "Error",
        description: "Failed to delete journal entry. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <FinanceTableSkeleton />
  }

  return (
    <PermissionGuard permissions={["can_view_journal_entries"]}>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 to-slate-900 p-8 text-white shadow-lg">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                 <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                   <BookOpen className="h-5 w-5 text-emerald-200" />
                 </div>
                 <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
              </div>
              <p className="text-emerald-100 max-w-xl text-sm">
                Record, review, and approve financial transactions. Maintain a complete audit trail of your business activities.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/finance/journal-entries/create">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Entry
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <Card className="border-slate-200 shadow-sm">
          <div className="p-4 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-slate-50/50">
             
             {/* Left: Search & Filters */}
             <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                <div className="relative w-full sm:w-64">
                   <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                   <Input
                    placeholder="Search entry #, reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white"
                   />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[130px] bg-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={selectedEntryType} onValueChange={setSelectedEntryType}>
                    <SelectTrigger className="w-[130px] bg-white">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {entryTypeOptions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {(dateFrom || dateTo) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => { setDateFrom(""); setDateTo(""); }}
                      className="text-muted-foreground whitespace-nowrap"
                    >
                      Clear Dates
                    </Button>
                  )}
                </div>
             </div>

             {/* Right: Date Range & Refresh */}
             <div className="flex items-center gap-2 w-full xl:w-auto justify-end">
                <div className="flex items-center bg-white border rounded-md px-2 py-1 shadow-sm">
                   <Calendar className="h-4 w-4 text-slate-400 mr-2" />
                   <input 
                      type="date" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="text-xs border-none focus:ring-0 text-slate-600 w-24 p-0 outline-none"
                   />
                   <span className="text-slate-300 mx-2">-</span>
                   <input 
                      type="date" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="text-xs border-none focus:ring-0 text-slate-600 w-24 p-0 outline-none"
                   />
                </div>
                <Button variant="outline" size="icon" onClick={fetchEntries} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
             </div>
          </div>

          {/* Table */}
          <div className="relative min-h-[400px]">
            <div className="rounded-md border-t bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider w-32">Entry #</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider w-32">Date</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Description</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider w-24">Type</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider text-right w-28">Debit</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider text-right w-28">Credit</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider w-28">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 uppercase tracking-wider w-32 hidden md:table-cell">Created By</TableHead>
                    <TableHead className="text-right font-semibold text-xs text-slate-500 uppercase tracking-wider w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center">
                            <FileText className="h-6 w-6 text-slate-300" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900">No journal entries found</p>
                            <p className="text-sm text-slate-500">
                              {searchTerm || selectedStatus !== "all" || selectedEntryType !== "all" || dateFrom || dateTo
                                ? "Adjust filters to see more results"
                                : "Start by creating a new journal entry"
                              }
                            </p>
                          </div>
                          {!searchTerm && selectedStatus === "all" && selectedEntryType === "all" && !dateFrom && !dateTo && (
                            <Link href="/finance/journal-entries/create">
                              <Button size="sm" variant="outline" className="mt-2">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Entry
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <TableRow 
                        key={entry.id} 
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                        onClick={() => router.push(`/finance/journal-entries/${entry.id}`)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 font-mono group-hover:text-emerald-600 transition-colors">
                              {entry.entry_number}
                            </span>
                            {entry.reference && <span className="text-[10px] text-slate-400">{entry.reference}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-700 font-medium">
                              {format(new Date(entry.entry_date), 'MMM dd, yyyy')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col max-w-[240px]">
                            <span className="text-sm font-medium text-slate-800 truncate" title={entry.description}>
                              {entry.description}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {entry.items?.length || 0} line item{(entry.items?.length || 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-semibold border-0 ${getEntryTypeColor(entry.entry_type)}`}>
                            {entry.entry_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                            {formatCurrency(entry.total_debit, 'KES')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm text-slate-600">
                            {formatCurrency(entry.total_credit, 'KES')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(entry.status)}
                            <span className="text-xs font-medium capitalize text-slate-700">
                              {entry.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                                {entry.creator?.full_name ? getInitials(entry.creator.full_name) : '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-slate-600 truncate max-w-[100px]" title={entry.creator?.full_name}>
                              {entry.creator?.full_name || 'System'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/finance/journal-entries/${entry.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {(entry.status === 'draft' || entry.status === 'pending') && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/finance/journal-entries/${entry.id}/edit`}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Order
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handlePostEntry(entry)}>
                                    <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                                    Post Entry
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteEntry(entry)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                              {entry.status === 'posted' && (
                                <DropdownMenuItem asChild>
                                  <Link href={`/finance/journal-entries/${entry.id}/reverse`}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Reverse Entry
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
           {/* Footer / Pagination */}
           <div className="bg-slate-50 border-t p-3 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
             <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <Select
                  value={rowsPerPage.toString()}
                  onValueChange={(value) => {
                    setRowsPerPage(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-7 w-[60px] bg-white text-xs">
                    <SelectValue placeholder={rowsPerPage} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[5, 10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={pageSize.toString()} className="text-xs">
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
             
             <div className="flex items-center gap-2">
                <span>Page {currentPage} of {totalPages || 1}</span>
                <div className="flex gap-1">
                   <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-3 w-3" />
                   </Button>
                   <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages || 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>
             </div>
           </div>

        </Card>
      </div>
    </PermissionGuard>
  )
}
