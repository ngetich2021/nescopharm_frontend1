"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getCustomerDisplayName } from "@/lib/customers"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Input } from "@/components/ui/input"
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Ban,
  Paperclip,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import {
  Cheque,
  ChequeStatus,
  approveCheque,
  bounceCheque,
  cancelCheque,
  fetchCheques,
  getChequeStatusColor,
} from "@/lib/cheques"
import { formatCurrency, formatDate } from "@/lib/utils"
import { RecordIssuedChequeModal } from "./record-issued-cheque-modal"

interface ChequesTableProps {
  initialCheques?: Cheque[]
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function isOverdue(cheque: Cheque) {
  return cheque.status === "pending" && new Date(cheque.maturity_date) < new Date(new Date().toDateString())
}

export function ChequesTable({ initialCheques = [] }: ChequesTableProps) {
  const [cheques, setCheques] = useState<Cheque[]>(initialCheques)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [directionFilter, setDirectionFilter] = useState<string>("all")
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showRecordIssued, setShowRecordIssued] = useState(false)

  const refreshCheques = useCallback(async () => {
    setIsLoading(true)
    try {
      const fetched = await fetchCheques()
      setCheques(fetched)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load cheques",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialCheques.length === 0) {
      refreshCheques()
    }
  }, [initialCheques.length, refreshCheques])

  const filteredCheques = useMemo(() => {
    return cheques.filter((cheque) => {
      const matchesSearch =
        searchQuery === "" ||
        cheque.cheque_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cheque.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cheque.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cheque.invoice?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === "all" || cheque.status === statusFilter
      const matchesDirection = directionFilter === "all" || cheque.direction === directionFilter

      return matchesSearch && matchesStatus && matchesDirection
    })
  }, [cheques, searchQuery, statusFilter, directionFilter])

  const handleAction = async (
    cheque: Cheque,
    action: (id: string) => Promise<Cheque>,
    successMessage: string,
    confirmMessage?: string
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return

    setActioningId(cheque.id)
    try {
      await action(cheque.id)
      toast({ title: "Success", description: successMessage })
      await refreshCheques()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Action failed",
        variant: "destructive",
      })
    } finally {
      setActioningId(null)
    }
  }

  const ActionsDropdown = ({ cheque }: { cheque: Cheque }) => {
    if (cheque.status !== "pending") {
      return null
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={actioningId === cheque.id}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() =>
              handleAction(
                cheque,
                approveCheque,
                cheque.direction === "issued"
                  ? `Cheque ${cheque.cheque_number} marked as cleared.`
                  : `Cheque ${cheque.cheque_number} approved and applied to the invoice.`
              )
            }
          >
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
            {cheque.direction === "issued" ? "Mark Cleared" : "Approve (Matured)"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              handleAction(
                cheque,
                bounceCheque,
                `Cheque ${cheque.cheque_number} marked as bounced.`,
                `Mark cheque ${cheque.cheque_number} as bounced?`
              )
            }
          >
            <XCircle className="h-4 w-4 mr-2 text-red-600" />
            Mark Bounced
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              handleAction(
                cheque,
                cancelCheque,
                `Cheque ${cheque.cheque_number} cancelled.`,
                `Cancel cheque ${cheque.cheque_number}?`
              )
            }
          >
            <Ban className="h-4 w-4 mr-2 text-gray-600" />
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              className="pl-8 max-w-sm"
              placeholder="Search cheque #, bank, customer, invoice..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Cheques" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Received &amp; Issued</SelectItem>
              <SelectItem value="received">Received (from customers)</SelectItem>
              <SelectItem value="issued">Issued (to suppliers)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowRecordIssued(true)} className="w-fit">
            <Plus className="h-4 w-4 mr-2" />
            Record Issued Cheque
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshCheques}
            disabled={isLoading}
            className="border-gray-800 text-gray-800 hover:bg-gray-100 w-fit"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""} mr-2`} />
            Refresh
          </Button>
        </div>
      </div>

      <RecordIssuedChequeModal
        open={showRecordIssued}
        onOpenChange={setShowRecordIssued}
        onSuccess={refreshCheques}
      />

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Cheque #</TableHead>
              <TableHead className="font-semibold">Direction</TableHead>
              <TableHead className="font-semibold">Bank</TableHead>
              <TableHead className="font-semibold">Party</TableHead>
              <TableHead className="font-semibold">Invoice</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Issue Date</TableHead>
              <TableHead className="font-semibold">Maturity Date</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span>Loading cheques...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredCheques.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  <div className="text-gray-500">
                    <p className="font-semibold">No cheques found</p>
                    <p className="text-sm">Cheques recorded from invoice payments will appear here</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCheques.map((cheque) => (
                <TableRow key={cheque.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {cheque.cheque_number}
                      {cheque.attachment_url && (
                        <a
                          href={cheque.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View attached cheque"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cheque.direction === "issued" ? (
                      <Badge variant="outline" className="gap-1 text-orange-700 border-orange-300 bg-orange-50">
                        <ArrowUpFromLine className="h-3 w-3" /> Issued
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300 bg-blue-50">
                        <ArrowDownToLine className="h-3 w-3" /> Received
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{cheque.bank_name}</TableCell>
                  <TableCell>
                    {cheque.direction === "issued"
                      ? cheque.payee_display_name || cheque.supplier?.name || "-"
                      : cheque.customer
                        ? getCustomerDisplayName(cheque.customer)
                        : "-"}
                  </TableCell>
                  <TableCell>{cheque.invoice?.invoice_number || cheque.purchase_order?.order_number || "-"}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(cheque.amount)}</TableCell>
                  <TableCell>{formatDate(cheque.issue_date)}</TableCell>
                  <TableCell>
                    <span className={isOverdue(cheque) ? "text-red-600 font-semibold" : ""}>
                      {formatDate(cheque.maturity_date)}
                    </span>
                    {isOverdue(cheque) && (
                      <div className="text-xs text-red-500">Matured, awaiting approval</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getChequeStatusColor(cheque.status)}>
                      {formatStatus(cheque.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionsDropdown cheque={cheque} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
