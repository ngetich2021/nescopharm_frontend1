"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Trash2, Check, X, MoreHorizontal } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchAllCompanies, deleteCompany } from "./actions"
import type { Database } from "@/lib/database.types"

type Company = Database["public"]["Tables"]["companies"]["Row"]

export function CompaniesClient() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const data = await fetchAllCompanies()
      setCompanies(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load company data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm("Are you sure you want to delete this company?")) {
      return
    }

    try {
      const result = await deleteCompany(companyId)
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
        await loadCompanies()
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  // Define columns inside the component to avoid serialization issues
  const columns: ColumnDef<Company>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <div>{row.getValue("email") || "-"}</div>,
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => <div>{row.getValue("phone") || "-"}</div>,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.getValue("is_active") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {row.getValue("is_active") ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
          {row.getValue("is_active") ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => <div>{new Date(row.getValue("created_at")).toLocaleDateString()}</div>,
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
            <DropdownMenuItem onClick={() => handleDeleteCompany(row.original.id)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return <DataTable columns={columns} data={companies} filterColumn="name" exportFileName="companies" />
}
