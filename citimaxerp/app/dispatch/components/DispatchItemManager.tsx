"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  CheckCircle2, 
  RotateCcw, 
  Package, 
  AlertTriangle,
  Loader2,
  Edit3,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { type DispatchItem, type Dispatch } from "@/lib/dispatch";

interface DispatchItemManagerProps {
  dispatch: Dispatch;
  items: DispatchItem[];
  onAcknowledgeItems: (items: { id: string; received_quantity: number }[]) => Promise<any>;
  onReturnItems: (items: { id: string; returned_quantity: number; return_notes?: string }[]) => Promise<void>;
  loading?: boolean;
}

export function DispatchItemManager({ 
  dispatch, 
  items, 
  onAcknowledgeItems, 
  onReturnItems,
  loading = false 
}: DispatchItemManagerProps) {
  const [acknowledgeMode, setAcknowledgeMode] = useState(false);
  const [returnMode, setReturnMode] = useState(false);
  const [acknowledgingItems, setAcknowledgingItems] = useState<Record<string, number>>({});
  const [returningItems, setReturningItems] = useState<Record<string, { quantity: number; notes: string }>>({});
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Initialize acknowledgment quantities
  const initializeAcknowledgment = () => {
    const initialAcknowledging: Record<string, number> = {};
    items.forEach(item => {
      const remainingQuantity = item.quantity - item.received_quantity;
      initialAcknowledging[item.id] = remainingQuantity > 0 ? remainingQuantity : 0;
    });
    setAcknowledgingItems(initialAcknowledging);
    setAcknowledgeMode(true);
  };

  // Initialize return quantities
  const initializeReturn = () => {
    const initialReturning: Record<string, { quantity: number; notes: string }> = {};
    items.forEach(item => {
      if (item.received_quantity > 0 && !item.is_returned) {
        initialReturning[item.id] = { quantity: 0, notes: "" };
      }
    });
    setReturningItems(initialReturning);
    setReturnMode(true);
  };

  const handleAcknowledgeSubmit = async () => {
    const itemsToAcknowledge = Object.entries(acknowledgingItems)
      .filter(([_, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ id, received_quantity: quantity }));
    
    if (!dispatch?.id) {
      setApiError('Dispatch ID is missing');
      return;
    }
    
    if (itemsToAcknowledge.length > 0) {
      setApiResponse(null);
      setApiError(null);
      
      try {
        const response = await onAcknowledgeItems(itemsToAcknowledge);
        setApiResponse(response);
        // Close the acknowledgment modal after success
        setTimeout(() => {
          setAcknowledgeMode(false);
        }, 1500); // Give time to see the success message
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      setApiError('No items to acknowledge');
    }
  };

  const handleReturnSubmit = async () => {
    const itemsToReturn = Object.entries(returningItems)
      .filter(([_, data]) => data.quantity > 0)
      .map(([id, data]) => ({ 
        id, 
        returned_quantity: data.quantity,
        return_notes: data.notes 
      }));
    
    if (itemsToReturn.length > 0) {
      await onReturnItems(itemsToReturn);
      setReturnMode(false);
    }
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-KE', {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(num).replace('KES', 'Ksh.');
  };

  const getItemStatus = (item: DispatchItem) => {
    if (item.is_returned) return "returned";
    if (item.received_quantity >= item.quantity) return "received";
    if (item.received_quantity > 0) return "partial";
    return "pending";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; text: string }> = {
      "pending": { className: "bg-yellow-100 text-yellow-800", text: "Pending" },
      "partial": { className: "bg-blue-100 text-blue-800", text: "Partial" },
      "received": { className: "bg-green-100 text-green-800", text: "Received" },
      "returned": { className: "bg-purple-100 text-purple-800", text: "Returned" },
    };
    
    const variant = variants[status] || variants["pending"];
    return (
      <Badge className={variant.className}>
        {variant.text}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        {items.some(item => item.received_quantity < item.quantity) && (
          <Button 
            onClick={initializeAcknowledgment}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Acknowledge Receipt
          </Button>
        )}
        
        {dispatch.is_returnable && items.some(item => 
          item.received_quantity > 0 && !item.is_returned
        ) && (
          <Button 
            onClick={initializeReturn}
            variant="outline"
            size="sm"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Return Items
          </Button>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <div className="font-medium text-lg">{item.product?.name}</div>
                    {getStatusBadge(getItemStatus(item))}
                  </div>
                  <div className="text-sm text-gray-500">
                    SKU: {item.product?.sku}
                  </div>
                  {item.variant && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Variant:</span> {item.variant.name} 
                      <span className="text-gray-500 ml-2">(SKU: {item.variant.sku})</span>
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded">
                      <span className="font-medium">Notes:</span> {item.notes}
                    </div>
                  )}
                </div>
                
                <div className="text-right space-y-1 ml-4">
                  <div className="text-lg font-semibold">
                    <span className="text-green-600">{item.received_quantity}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span>{item.quantity}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.product?.unit_of_measurement || 'pcs'}
                  </div>
                  {item.variant?.price && (
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(item.variant.price)} each
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Received Progress</span>
                  <span>{Math.round((item.received_quantity / item.quantity) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${Math.min((item.received_quantity / item.quantity) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Return Information */}
              {item.is_returned && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2 text-purple-800 mb-1">
                    <RotateCcw className="h-4 w-4" />
                    <span className="font-medium">
                      Returned: {item.returned_quantity} items
                    </span>
                  </div>
                  {item.return_date && (
                    <div className="flex items-center space-x-2 text-purple-600 text-sm">
                      <Calendar className="h-3 w-3" />
                      <span>Return Date: {format(new Date(item.return_date), "MMM dd, yyyy")}</span>
                    </div>
                  )}                  {item.return_notes && (
                    <div className="text-sm text-purple-600 mt-1">
                      <span className="font-medium">Return Notes:</span> {item.return_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Item Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Category:</span> {item.product?.category || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Brand:</span> {item.product?.brand || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Unit Cost:</span> {
                    item.product?.unit_cost ? formatCurrency(item.product.unit_cost) : "N/A"
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        ))}      </div>

      {/* Acknowledge Dialog */}
      <Dialog open={acknowledgeMode} onOpenChange={setAcknowledgeMode}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Acknowledge Receipt</DialogTitle>
            <DialogDescription>
              Specify the quantities received for each item
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {items.filter(item => item.received_quantity < item.quantity).map((item) => (
              <div key={item.id} className="border rounded-lg p-4">
                
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{item.product?.name}</div>
                    {item.variant && (
                      <div className="text-sm text-gray-500">
                        Variant: {item.variant.name}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    Remaining: {item.quantity - item.received_quantity}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`acknowledge-${item.id}`} className="text-sm">
                    Receive Quantity:
                  </Label>
                  <Input
                    id={`acknowledge-${item.id}`}
                    type="number"
                    min="0"
                    max={item.quantity - item.received_quantity}
                    value={acknowledgingItems[item.id] || 0}
                    onChange={(e) => setAcknowledgingItems(prev => ({
                      ...prev,
                      [item.id]: parseInt(e.target.value) || 0
                    }))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">
                    {item.product?.unit_of_measurement || 'pcs'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeMode(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAcknowledgeSubmit} 
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Acknowledge Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnMode} onOpenChange={setReturnMode}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Return Items</DialogTitle>
            <DialogDescription>
              Specify the quantities to return and provide return notes
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {items.filter(item => item.received_quantity > 0 && !item.is_returned).map((item) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{item.product?.name}</div>
                    {item.variant && (
                      <div className="text-sm text-gray-500">
                        Variant: {item.variant.name}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    Available: {item.received_quantity}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`return-${item.id}`} className="text-sm">
                    Return Quantity:
                  </Label>
                  <Input
                    id={`return-${item.id}`}
                    type="number"
                    min="0"
                    max={item.received_quantity}
                    value={returningItems[item.id]?.quantity || 0}
                    onChange={(e) => setReturningItems(prev => ({
                      ...prev,
                      [item.id]: {
                        ...prev[item.id],
                        quantity: parseInt(e.target.value) || 0
                      }
                    }))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">
                    {item.product?.unit_of_measurement || 'pcs'}
                  </span>
                </div>

                <div className="space-y-1">
                  <Label htmlFor={`return-notes-${item.id}`} className="text-sm">
                    Return Notes:
                  </Label>
                  <Textarea
                    id={`return-notes-${item.id}`}
                    placeholder="Reason for return..."
                    value={returningItems[item.id]?.notes || ""}
                    onChange={(e) => setReturningItems(prev => ({
                      ...prev,
                      [item.id]: {
                        ...prev[item.id],
                        notes: e.target.value
                      }
                    }))}
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnMode(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReturnSubmit} 
              disabled={loading}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Return Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}