"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingCart, Store, Layers } from "lucide-react";
import { useDataCache } from "@/lib/data-cache";
import { getProductReceiptSummary, type ApiProductReceiptSummary } from "@/lib/productreceipt";

export default function ProductReceiptSummary() {
  const {
    data: receiptSummaryData,
    isLoading: isLoadingSummary,
    error: summaryError
  } = useDataCache<ApiProductReceiptSummary>(
    "product_receipt_summary",
    () => getProductReceiptSummary(),
    {
      expirationMs: 5 * 60 * 1000, // 5 minutes cache - only refresh on mutations or manual refresh
      autoRefresh: false, // Disable auto-refresh, only update on cache invalidation
    }
  );

  // Extract key metrics from the API response
  const keyMetrics = {
    totalReceipts: receiptSummaryData?.data?.overview?.total_receipts || 0,
    totalQuantity: receiptSummaryData?.data?.overview?.total_items_received || 0,
    uniqueProducts: receiptSummaryData?.data?.overview?.total_line_items || 0,
    totalValue: receiptSummaryData?.data?.financial?.total_receipt_value || 0
  };

  // Handle error state
  if (summaryError) {
    console.error("Error loading product receipt summary:", summaryError);
    // We'll still show the cards but with error indication
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Receipts</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingSummary ? (
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              keyMetrics.totalReceipts
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            All time receipts
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingSummary ? (
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              keyMetrics.totalQuantity.toLocaleString()
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Items received
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Line Items</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingSummary ? (
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              keyMetrics.uniqueProducts
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Total line items
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <Store className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingSummary ? (
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
            ) : (
              `KES ${keyMetrics.totalValue.toLocaleString()}`
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Receipt value
          </p>
        </CardContent>
      </Card>
    </div>
  );
}