"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ProductReceiptDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: any | null;
}

export function ProductReceiptDetailsModal({ isOpen, onClose, receipt }: ProductReceiptDetailsModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;
  if (!receipt) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Product Receipt Details</h2>
            <p className="text-sm text-gray-500">View product receipt information</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-gray-100">
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {Object.entries(receipt).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-semibold capitalize whitespace-nowrap">{key.replace(/_/g, ' ')}:</span>
              <span className="break-all">{typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
