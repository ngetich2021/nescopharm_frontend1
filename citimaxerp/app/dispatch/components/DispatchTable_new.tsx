"use client";

import { useState } from "react";
import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Eye, CheckCircle, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Dispatch } from "@/lib/dispatch";

interface DispatchTableProps {
  dispatches: Dispatch[];
  onViewDispatch: (dispatch: Dispatch) => void;
  onAcknowledgeDispatch?: (dispatch: Dispatch) => void;
  onReturnItems?: (dispatch: Dispatch) => void;
  loading?: boolean;
}

export function DispatchTable({ 
  dispatches, 
  onViewDispatch, 
  onAcknowledgeDispatch, 
  onReturnItems,
  loading = false
}: DispatchTableProps) {
  
  const getDispatchStatus = (dispatch: Dispatch) => {
    const items = dispatch.dispatch_items || [];
    
    if (items.length === 0) return "Empty";
    
    const allReturned = items.every(item => item.is_returned);
    if (allReturned) return "Returned";
    
    const allReceived = items.every(item => item.received_quantity >= item.quantity);
    if (allReceived) return "Received";
    
    const partiallyReceived = items.some(item => item.received_quantity > 0);
    if (partiallyReceived) return "Partial";
    
    return "Pending";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; text: string }> = {
      "Pending": { className: "bg-yellow-100 text-yellow-800", text: "Pending" },
      "Partial": { className: "bg-blue-100 text-blue-800", text: "Partial" },
      "Received": { className: "bg-green-100 text-green-800", text: "Received" },
      "Returned": { className: "bg-purple-100 text-purple-800", text: "Returned" },
      "Empty": { className: "bg-gray-100 text-gray-800", text: "Empty" },
    };
    
    const variant = variants[status] || variants["Pending"];
    return (
      <Badge variant="secondary" className={variant.className}>
        {variant.text}
      </Badge>
    );
  };

  const getTotalItems = (dispatch: Dispatch) => {
    return dispatch.dispatch_items?.reduce((total, item) => total + item.quantity, 0) || 0;
  };

  const getReceivedItems = (dispatch: Dispatch) => {
    return dispatch.dispatch_items?.reduce((total, item) => total + item.received_quantity, 0) || 0;
  };

  return (
    <>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Dispatch #</TableHead>
              <TableHead className="font-semibold">From Store</TableHead>
              <TableHead className="font-semibold">To User</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Items</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Acknowledged By</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E30040]"></div>
                    <span>Loading dispatches...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : dispatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No dispatches found
                </TableCell>
              </TableRow>
            ) : (
              dispatches.map((dispatch) => {
                const status = getDispatchStatus(dispatch);
                const total = getTotalItems(dispatch);
                const received = getReceivedItems(dispatch);
                
                return (
                  <TableRow 
                    key={dispatch.id} 
                    className="hover:bg-[#E30040]/5 transition-colors duration-200 cursor-pointer" 
                    onClick={() => onViewDispatch(dispatch)}
                  >
                    <TableCell className="font-medium">{dispatch.dispatch_number}</TableCell>
                    <TableCell>{dispatch.from_store?.name || "Unknown Store"}</TableCell>
                    <TableCell>
                      {dispatch.to_user ? (
                        <div>
                          <div>{dispatch.to_user.first_name} {dispatch.to_user.last_name}</div>
                          <div className="text-xs text-muted-foreground">{dispatch.to_user.email}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{dispatch.type || "Unknown"}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{received}/{total} items</div>
                        <div className="text-xs text-muted-foreground">
                          {dispatch.dispatch_items?.length || 0} products
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {dispatch.acknowledged_by ? (
                          <div>
                            <div>{dispatch.acknowledged_by.first_name} {dispatch.acknowledged_by.last_name}</div>
                            <div className="text-xs text-muted-foreground">{dispatch.acknowledged_by.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not acknowledged</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(dispatch.created_at), "MMM dd, yyyy")}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(dispatch.created_at), "HH:mm")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionsDropdown
                        dispatch={dispatch}
                        status={status}
                        onView={() => onViewDispatch(dispatch)}
                        onAcknowledge={onAcknowledgeDispatch ? () => onAcknowledgeDispatch(dispatch) : undefined}
                        onReturn={onReturnItems ? () => onReturnItems(dispatch) : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ActionsDropdown({ 
  dispatch, 
  status, 
  onView, 
  onAcknowledge, 
  onReturn 
}: { 
  dispatch: Dispatch;
  status: string;
  onView: () => void; 
  onAcknowledge?: () => void; 
  onReturn?: () => void; 
}) {
  const canAcknowledge = (status === "Pending" || status === "Partial") && onAcknowledge;
  const canReturn = status === "Received" && dispatch.is_returnable && onReturn;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> View Details
        </DropdownMenuItem>
        {canAcknowledge && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAcknowledge}>
              <CheckCircle className="h-4 w-4 mr-2" /> Acknowledge Receipt
            </DropdownMenuItem>
          </>
        )}
        {canReturn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReturn}>
              <RotateCcw className="h-4 w-4 mr-2" /> Return Items
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}