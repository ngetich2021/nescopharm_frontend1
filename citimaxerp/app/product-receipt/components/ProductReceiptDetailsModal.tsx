"use client";
import { useState } from "react";
import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProductReceipt, ProductReceiptApiResponse } from "@/lib/productreceipt";
import { Package, User, Store, FileText, Calendar, Hash, Eye, Edit, Download } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { DocumentViewerModal } from "./DocumentViewerModal";

interface ProductReceiptDetailsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receiptId: string | null;
  onEdit?: (receiptId: string) => void;
}

export function ProductReceiptDetailsModal({ 
  open, 
  onOpenChange, 
  receiptId, 
  onEdit 
}: ProductReceiptDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductReceiptApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);

  React.useEffect(() => {
    if (open && receiptId) {
      setLoading(true);
      setError(null);
      getProductReceipt(receiptId)
        .then((response) => {
          setData(response);
        })
        .catch((error) => {
          console.error('Error fetching receipt:', error);
          setError("Failed to load receipt details");
        })
        .finally(() => setLoading(false));
    } else if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, receiptId]);

  const receipt = data?.receipt;
  const totalValue = receipt?.product_receipt_items?.reduce((sum, item) => {
    return sum + (parseFloat(item.unit_price) * item.quantity);
  }, 0) || 0;

  const handleDownload = async () => {
    if (!receipt?.document_url) return;
    
    try {
      const response = await fetch(receipt.document_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${receipt.product_receipt_number || receipt.reference_number}-document`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to opening in new tab
      window.open(receipt.document_url, '_blank');
    }
  };

  const handleEdit = () => {
    if (receiptId && onEdit) {
      onEdit(receiptId);
      onOpenChange(false);
    }
  };

  const getDocumentTypeBadge = (documentType: string) => {
    switch (documentType?.toLowerCase()) {
      case "purchase_order":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Purchase Order</Badge>;
      case "invoice":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Invoice</Badge>;
      case "delivery_note":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Delivery Note</Badge>;
      case "manual":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Manual</Badge>;
      default:
        return <Badge variant="secondary">{documentType}</Badge>;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-4xl flex flex-col h-full">
          <SheetHeader className="border-b border-gray-200 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Product Receipt Details
            </SheetTitle>
            <SheetDescription>
              {receipt?.product_receipt_number ? (
                <>View details for receipt {receipt.product_receipt_number}</>
              ) : (
                "Loading receipt details..."
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-6 space-y-6">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                Loading receipt details...
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <div className="text-red-500 mb-2">{error}</div>
              </div>
            ) : receipt ? (
              <>
                {/* Receipt Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      Receipt Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Hash className="h-4 w-4" />
                            Receipt Number
                          </span>
                          <span className="font-medium">{receipt.product_receipt_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            Reference Number
                          </span>
                          <span className="font-medium">{receipt.reference_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Document Type</span>
                          <div>{getDocumentTypeBadge(receipt.document_type)}</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Store className="h-4 w-4" />
                            Store
                          </span>
                          <span className="font-medium">{receipt.store?.name || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <User className="h-4 w-4" />
                            Received By
                          </span>
                          <span className="font-medium">
                            {[receipt.recipient?.first_name, receipt.recipient?.last_name]
                              .filter(Boolean)
                              .join(" ") || "Unknown"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Created At
                          </span>
                          <span className="font-medium">
                            {receipt.created_at ? new Date(receipt.created_at).toLocaleDateString() : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Supplier Information */}
                {receipt.supplier && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-green-600" />
                        Supplier Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {receipt.supplier.name && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Name</span>
                            <span className="font-medium">{receipt.supplier.name}</span>
                          </div>
                        )}
                        {receipt.supplier.email && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Email</span>
                            <span className="font-medium">{receipt.supplier.email}</span>
                          </div>
                        )}
                        {receipt.supplier.phone && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Phone</span>
                            <span className="font-medium">{receipt.supplier.phone}</span>
                          </div>
                        )}
                        {receipt.supplier.contact_person && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Contact Person</span>
                            <span className="font-medium">{receipt.supplier.contact_person}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Product Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-600" />
                      Product Items ({receipt.product_receipt_items?.length || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {receipt.product_receipt_items?.map((item, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                <span className="text-gray-500 tabular-nums mr-2">{index + 1}.</span>
                                {item.product?.name || `Product ${item.product_id}`}
                              </h4>
                              {item.variant && (
                                <p className="text-sm text-gray-600">
                                  Variant: {item.variant.name}
                                </p>
                              )}
                              {item.product?.sku && (
                                <p className="text-sm text-gray-500">SKU: {item.product.sku}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-lg text-gray-900">
                                {formatCurrency(parseFloat(item.unit_price) * item.quantity)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.quantity} × {formatCurrency(parseFloat(item.unit_price))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Quantity:</span>
                              <span className="ml-2 font-medium">{item.quantity}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Unit Price:</span>
                              <span className="ml-2 font-medium">{formatCurrency(parseFloat(item.unit_price))}</span>
                            </div>
                            {item.expiry_date && (
                              <div className="col-span-2">
                                <span className="text-gray-600">Expiry Date:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(item.expiry_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {item.notes && (
                              <div className="col-span-2">
                                <span className="text-gray-600">Notes:</span>
                                <span className="ml-2 font-medium">{item.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Separator className="my-4" />

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Items Subtotal:</span>
                      <span>{formatCurrency(totalValue)}</span>
                    </div>
                    {Number(receipt.shipping_cost) > 0 && (
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-gray-600">Shipping Cost:</span>
                        <span>{formatCurrency(Number(receipt.shipping_cost))}</span>
                      </div>
                    )}
                    {Number(receipt.logistics_cost) > 0 && (
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-gray-600">Logistics Cost:</span>
                        <span>{formatCurrency(Number(receipt.logistics_cost))}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-lg font-semibold mt-2">
                      <span>{(Number(receipt.shipping_cost) > 0 || Number(receipt.logistics_cost) > 0) ? "Landed Total:" : "Total Value:"}</span>
                      <span className="text-green-600">
                        {formatCurrency(totalValue + Number(receipt.shipping_cost || 0) + Number(receipt.logistics_cost || 0))}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Document Link */}
                {receipt.document_url && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-orange-600" />
                        Attached Document
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Document</span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDocumentViewerOpen(true)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Document
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-gray-500">No receipt data available</p>
              </div>
            )}
          </div>

          {receipt && (
            <SheetFooter className="border-t border-gray-200 pt-4">
              <div className="flex justify-between w-full">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                {onEdit && (
                  <Button
                    onClick={handleEdit}
                    className="bg-[#E30040] hover:bg-[#E30040]/90 text-white"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Receipt
                  </Button>
                )}
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Document Viewer Modal */}
      {receipt && (
        <DocumentViewerModal
          open={documentViewerOpen}
          onOpenChange={setDocumentViewerOpen}
          documentUrl={receipt.document_url || null}
          documentName={`Receipt ${receipt.product_receipt_number || receipt.reference_number} Document`}
          receiptNumber={receipt.product_receipt_number}
        />
      )}
    </>
  );
}