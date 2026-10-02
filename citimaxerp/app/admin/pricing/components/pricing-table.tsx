"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Edit, MoreHorizontal, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { deletePricingPlan } from "../actions"
import { EditPricingSheet } from "./edit-pricing-sheet"
import { DeletePricingDialog } from "./delete-pricing-dialog"
import { DataTable } from "@/components/ui/data-table"
import type { Database } from "@/lib/database.types"

type PricingPlan = Database["public"]["Tables"]["subscription_plans"]["Row"]

interface PricingTableProps {
  plans: PricingPlan[]
}

export function PricingTable({ plans }: PricingTableProps) {
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)

  const handleEdit = (plan: PricingPlan) => {
    setEditingPlan(plan)
    setIsEditSheetOpen(true)
  }

  const handleDelete = (planId: string) => {
    setDeletingPlanId(planId)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (deletingPlanId) {
      const result = await deletePricingPlan(deletingPlanId)
      if (result.success) {
        toast.success(result.message)
        // Refresh the page to show updated data
        window.location.reload()
      } else {
        toast.error(result.message)
      }
      setIsDeleteDialogOpen(false)
      setDeletingPlanId(null)
    }
  }

  const columns: ColumnDef<PricingPlan>[] = [
    {
      accessorKey: "name",
      header: "Plan Name",
      cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <div>
          {row.original.price} {row.original.currency}
        </div>
      ),
    },
    {
      accessorKey: "interval",
      header: "Interval",
      cell: ({ row }) => <div className="capitalize">{row.getValue("interval")}</div>,
    },
    {
      accessorKey: "features",
      header: "Features",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">{(row.getValue("features") as string[])?.join(", ") || "-"}</div>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.getValue("is_active") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {row.getValue("is_active") ? "Yes" : "No"}
        </span>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDelete(row.original.id)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <DataTable columns={columns} data={plans} filterColumn="name" exportFileName="pricing_plans" />
      {editingPlan && (
        <EditPricingSheet plan={editingPlan} isOpen={isEditSheetOpen} onOpenChange={setIsEditSheetOpen} />
      )}
      <DeletePricingDialog isOpen={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} onConfirm={confirmDelete} />
    </>
  )
}
