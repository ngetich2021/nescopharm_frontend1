"use client";

import { useState } from "react";
import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Eye, CheckCircle, RotateCcw, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn, toSentenceCase } from "@/lib/utils";
import { format } from "date-fns";
import { OrderDispatch } from "@/lib/order-dispatches";
import { getCustomerDisplayName } from "@/lib/customers";

interface DispatchTableProps {
  dispatches: OrderDispatch[];
  onViewDispatch: (dispatch: OrderDispatch) => void;
  onAcknowledgeDispatch?: (dispatch: OrderDispatch) => void;
  onReturnItems?: (dispatch: OrderDispatch) => void;
  onEditDispatch?: (dispatch: OrderDispatch) => void;
  onDeleteDispatch?: (dispatch: OrderDispatch) => void;
  loading?: boolean;
}

export function DispatchTable({ 
  dispatches, 
  onViewDispatch, 
  onAcknowledgeDispatch, 
  onReturnItems,
  onEditDispatch,
  onDeleteDispatch,
  loading = false
}: DispatchTableProps) {
  
  const getDispatchStatus = (dispatch: OrderDispatch) => {
    return dispatch.status || 'pending';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; text: string }> = {
      "pending": { className: "bg-blue-100 text-blue-800", text: "Pending" },
      "approved": { className: "bg-green-100 text-green-800", text: "Approved" },
      "in_transit": { className: "bg-purple-100 text-purple-800", text: "In Transit" },
      "delivered": { className: "bg-green-100 text-green-800", text: "Delivered" },
      "cancelled": { className: "bg-red-100 text-red-800", text: "Cancelled" },
    };
    
    // Normalize status to lowercase for lookup
    const lookup = status.toLowerCase();
    const variant = variants[lookup] || { className: "bg-gray-100 text-gray-800", text: toSentenceCase(status) };
    
    return (
      <Badge variant="secondary" className={cn("whitespace-nowrap capitalize", variant.className)}>
        {variant.text}
      </Badge>
    );
  };

  return (
    <>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Dispatch #</TableHead>
              <TableHead className="font-semibold">Order / Customer</TableHead>
              <TableHead className="font-semibold">Payment Status</TableHead>
              <TableHead className="font-semibold">Items</TableHead>
              <TableHead className="font-semibold">Dispatch Status</TableHead>
              <TableHead className="font-semibold">Approval</TableHead>
              <TableHead className="font-semibold">Created By</TableHead>
              <TableHead className="font-semibold">Date</TableHead>
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
                const itemCount = dispatch.items?.length || 0;
                const totalQuantity = dispatch.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
                
                return (
                  <TableRow 
                    key={dispatch.id} 
                    className="hover:bg-[#E30040]/5 transition-colors duration-200 cursor-pointer" 
                    onClick={() => onViewDispatch(dispatch)}
                  >
                    <TableCell className="font-medium">
                      {dispatch.dispatch_number}
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col">
                        <span className="font-medium text-sm">{dispatch.order?.order_number}</span>
                        <span className="text-xs text-muted-foreground">{dispatch.order?.customer ? getCustomerDisplayName(dispatch.order.customer) : ""}</span>
                       </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "whitespace-nowrap capitalize",
                        dispatch.order?.payment_status === 'paid' ? "text-green-600 border-green-200 bg-green-50" :
                        dispatch.order?.payment_status === 'partial' ? "text-orange-600 border-orange-200 bg-orange-50" :
                        "text-red-600 border-red-200 bg-red-50"
                      )}>
                        {dispatch.order?.payment_status ? toSentenceCase(dispatch.order.payment_status) : 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{totalQuantity}</span> units
                        <div className="text-xs text-muted-foreground">in {itemCount} items</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "whitespace-nowrap capitalize",
                        dispatch.approval_status === 'approved' ? "text-green-600 border-green-200" :
                        dispatch.approval_status === 'rejected' ? "text-red-600 border-red-200" :
                        "text-yellow-600 border-yellow-200"
                      )}>
                        {toSentenceCase(dispatch.approval_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {dispatch.created_by ? (
                        <div className="text-sm">
                          <div>{dispatch.created_by.first_name} {dispatch.created_by.last_name}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(dispatch.created_at), "MMM dd, yyyy")}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(dispatch.created_at), "HH:mm")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        dispatch={dispatch}
                        status={status}
                        onView={() => onViewDispatch(dispatch)}
                        onEdit={onEditDispatch ? () => onEditDispatch(dispatch) : undefined}
                        onDelete={onDeleteDispatch ? () => onDeleteDispatch(dispatch) : undefined}
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
  onEdit,
  onDelete
}: { 
  dispatch: OrderDispatch;
  status: string;
  onView: () => void; 
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const canEdit = dispatch.status === 'pending' && dispatch.approval_status === 'pending' && onEdit;
  const canDelete = dispatch.status === 'pending' && dispatch.approval_status === 'pending' && onDelete;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> View Details
        </DropdownMenuItem>
        
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" /> Edit Dispatch
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4 mr-2" /> Delete Dispatch
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}