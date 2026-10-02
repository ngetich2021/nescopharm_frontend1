"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { RefreshCw, Package, Calendar, AlertTriangle, CheckCircle, Eye } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { getBatches } from "@/lib/batches"
import type { Batch } from "@/types/batches"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BatchDetailsSheet } from "@/app/inventory/components/batch-details-sheet"

export function BatchesTab() {
  const { toast } = useToast()
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [filters, setFilters] = useState({
    status: "all",
    search: ""
  })
  const [selectedBatch, setSelectedBatch] = useState<{ productId: string; batchId: string } | null>(null)

  const fetchBatches = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await getBatches({
        status: filters.status !== "all" ? filters.status : undefined,
        batch_number: filters.search || undefined
      })
      
      setBatches(result.data)
      setLastRefreshTime(new Date())
    } catch (err: any) {
      setError(err.message || "Failed to fetch batches")
      toast({
        title: "Error",
        description: err.message || "Failed to fetch batches",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const handleRefresh = () => {
    fetchBatches()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "expired":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "damaged":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Package className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium"
    
    switch (status) {
      case "active":
        return `${baseClasses} bg-green-100 text-green-800`
      case "expired":
        return `${baseClasses} bg-red-100 text-red-800`
      case "damaged":
        return `${baseClasses} bg-orange-100 text-orange-800`
      case "sold_out":
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const filteredBatches = batches.filter(batch => {
    if (filters.status !== "all" && batch.status !== filters.status) {
      return false
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        batch.batch_number.toLowerCase().includes(searchLower) ||
        (batch.product_id && batch.product_id.toLowerCase().includes(searchLower))
      )
    }
    
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {lastRefreshTime && !loading && <span>Last updated: {lastRefreshTime.toLocaleTimeString()}</span>}
          {loading && <span>Loading batches...</span>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1 bg-transparent"
        >
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          <span>Refresh</span>
        </Button>
      </div>

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}.
            <Button variant="link" onClick={handleRefresh} className="p-0 h-auto font-normal">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Batch Tracking</CardTitle>
          <CardDescription>Manage and track inventory batches with expiration dates and serial numbers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Loading batches...
                        </div>
                      ) : (
                        "No batches found"
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.batch_number}</TableCell>
                      <TableCell>{batch.product_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(batch.status)}
                          <span className={getStatusBadge(batch.status)}>
                            {batch.status.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{batch.quantity_received}</TableCell>
                      <TableCell>{batch.quantity_available}</TableCell>
                      <TableCell>
                        {batch.expiry_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(batch.expiry_date).toLocaleDateString()}
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBatch({ productId: batch.product_id, batchId: batch.id })}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedBatch && (
        <BatchDetailsSheet
          productId={selectedBatch.productId}
          batchId={selectedBatch.batchId}
          open={!!selectedBatch}
          onOpenChange={(open) => !open && setSelectedBatch(null)}
        />
      )}
    </div>
  )
}