"use client";
import { useState, useEffect } from "react";
import { type OrderDispatch } from "@/lib/order-dispatches";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { X, RotateCcw, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReturnItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: OrderDispatch | null;
  onSuccess?: () => void;
}

export function ReturnItemsModal({ open, onOpenChange, dispatch, onSuccess }: ReturnItemsModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Handle visibility for animation
  useEffect(() => {
    if (open) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!dispatch || !isVisible) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      
      <div
        className={cn(
          "fixed left-[50%] top-[50%] z-[100] grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white shadow-lg duration-200 sm:rounded-lg",
          open ? "animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]" : "animate-out fade-out-0 zoom-out-95 slide-out-to-left-1/2 slide-out-to-top-[48%]"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <RotateCcw className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Return Items
              </h2>
              <p className="text-sm text-gray-500">
                Return items from dispatch {dispatch.dispatch_number}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-6 py-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Returns Not Supported</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Handling returns for Order Dispatches is currently managed through the central Order Management system.
            </p>
            <Button 
                className="mt-6" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
            >
                Close
            </Button>
        </div>
      </div>
    </>
  );
}