"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EmployeeListSkeleton } from "@/components/ui/skeletons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Plus,
  Filter,
  Users,
  DollarSign,
  UserCheck,
  UserX,
  Briefcase,
  Calendar,
  Eye,
  Edit,
  Trash2,
  Download
} from "lucide-react"

import { employeesApi, Employee } from "@/lib/employees"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { EmployeesTable } from "./EmployeesTable"
import { CreateEmployeeSheet } from "./CreateEmployeeSheet"
import { EmployeeDetailsSheet } from "./EmployeeDetailsSheet"
import { EditEmployeeSheet } from "./EditEmployeeSheet"
import { DeleteEmployeeDialog } from "./DeleteEmployeeDialog"
import { formatCurrency } from "@/lib/utils"

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeStats, setEmployeeStats] = useState({
    total_employees: 0,
    active_employees: 0,
    inactive_employees: 0,
    departments_count: 0,
    positions_count: 0,
    by_department: {} as Record<string, number>,
    by_employment_type: {} as Record<string, number>
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [showDetailsSheet, setShowDetailsSheet] = useState(false)
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const { toast } = useToast()

  useEffect(() => {
    fetchEmployees()
    fetchEmployeeStatistics()
  }, [currentPage, searchTerm, rowsPerPage])

  const fetchEmployees = async () => {
    try {
      setIsLoading(true)
      const params: any = {
        page: currentPage,
        per_page: rowsPerPage,
      }
      
      if (searchTerm) {
        params.search = searchTerm
      }

      const response = await employeesApi.getEmployees(params)
      const fetchedEmployees = response.employees || []
      setEmployees(fetchedEmployees)
      setTotalPages(response.pagination?.last_page || 1)
      setTotalItems(response.total || 0)
      
      // Calculate positions count from the fetched employees
      const positionsSet = new Set(fetchedEmployees.map(emp => emp.position))
      
      // Update stats with the new positions count
      setEmployeeStats(prevStats => ({
        ...prevStats,
        positions_count: positionsSet.size
      }))
    } catch (error) {
      console.error('Error fetching employees:', error)
      toast({
        title: "Error",
        description: "Failed to fetch employees. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="h-4 w-4" />
      case 'inactive':
        return <UserX className="h-4 w-4" />
      case 'terminated':
        return <UserX className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const fetchEmployeeStatistics = async () => {
    try {
      const response = await employeesApi.getEmployeeStatistics()
      const stats = response.statistics
      
      // Get current positions count from the employees state
      const positionsSet = new Set(employees.map(emp => emp.position))
      
      setEmployeeStats({
        total_employees: stats.total_employees,
        active_employees: stats.active_employees,
        inactive_employees: stats.inactive_employees,
        departments_count: Object.keys(stats.by_department).length,
        positions_count: positionsSet.size,
        by_department: stats.by_department,
        by_employment_type: stats.by_employment_type
      })
    } catch (error) {
      console.error('Error fetching employee statistics:', error)
      toast({
        title: "Error",
        description: "Failed to fetch employee statistics. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateSheet(false)
    fetchEmployees()
    fetchEmployeeStatistics()
  }

  const handleEditSuccess = () => {
    setShowEditSheet(false)
    setSelectedEmployee(null)
    fetchEmployees()
    fetchEmployeeStatistics()
  }

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowDetailsSheet(true)
  }

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowEditSheet(true)
  }

  const handleEditFromDetails = (employee: Employee) => {
    setShowDetailsSheet(false)
    setSelectedEmployee(employee)
    setShowEditSheet(true)
  }

  const handleDeleteEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setShowDeleteDialog(true)
  }

  const handleTerminateEmployee = async (employee: Employee) => {
    try {
      await employeesApi.terminateEmployee(employee.id!, {
        termination_date: new Date().toISOString().slice(0, 10),
      })
      toast({
        title: "Success",
        description: "Employee terminated successfully.",
      })
      fetchEmployees()
      fetchEmployeeStatistics()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to terminate employee.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false)
    setSelectedEmployee(null)
    fetchEmployees()
    fetchEmployeeStatistics()
  }

  const handleRefresh = () => {
    fetchEmployees()
    fetchEmployeeStatistics()
  }

  const handleExportExcel = () => {
    if (employees.length === 0) {
      toast({
        title: "No Data",
        description: "No employees to export.",
        variant: "destructive",
      })
      return
    }

    const headers = ["Employee #", "Name", "Email", "Phone", "Department", "Position", "Employment Type", "Hire Date", "Basic Salary", "Status"]
    const rows = employees.map(emp => [
      emp.employee_number || "",
      `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
      emp.email || "",
      emp.phone_number || "",
      emp.department || "",
      emp.position || "",
      emp.employment_type || "",
      emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : "",
      emp.basic_salary ? emp.basic_salary.toLocaleString() : "",
      emp.termination_date ? "Terminated" : "Active"
    ])

    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n"
    rows.forEach(row => {
      csvContent += row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",") + "\n"
    })

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `employees_${new Date().toISOString().slice(0, 10)}.csv`)
    link.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: `Exported ${employees.length} employees to Excel.`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee</h1>
          <p className="text-muted-foreground">
            Manage employees records
          </p>
        </div>
      </div>

      {/* Stats Cards - Updated to use API statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeStats.total_employees}</div>
            <p className="text-xs text-muted-foreground">Active workforce</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <UserCheck className="h-4 w-4 text-[#1E2764]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeStats.active_employees}</div>
            <p className="text-xs text-muted-foreground">Currently employed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <Briefcase className="h-4 w-4 text-[#1E2764]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeStats.departments_count}</div>
            <p className="text-xs text-muted-foreground">Organization units</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positions</CardTitle>
            <Users className="h-4 w-4 text-[#1E2764]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeStats.positions_count}</div>
            <p className="text-xs text-muted-foreground">Job roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Employees Table */}
      <EmployeesTable
        employees={employees}
        loading={isLoading}
        onViewEmployee={handleViewEmployee}
        onEditEmployee={handleEditEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        search={searchTerm}
        onSearchChange={setSearchTerm}
        currentPage={currentPage}
        totalPages={totalPages}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={setRowsPerPage}
        totalItems={totalItems}
          onRefresh={handleRefresh}
          onCreateNew={() => setShowCreateSheet(true)}
          onTerminateEmployee={handleTerminateEmployee}
          onExportExcel={handleExportExcel}
        />
      
      {/* Create Employee Sheet */}
      <CreateEmployeeSheet
        open={showCreateSheet}
        onOpenChange={setShowCreateSheet}
        onSuccess={handleCreateSuccess}
      />
      
      {/* Employee Details Sheet */}
      <EmployeeDetailsSheet
        employee={selectedEmployee}
        open={showDetailsSheet}
        onOpenChange={setShowDetailsSheet}
        onEdit={handleEditFromDetails}
      />
      
      {/* Edit Employee Sheet */}
      <EditEmployeeSheet
        employee={selectedEmployee}
        open={showEditSheet}
        onOpenChange={setShowEditSheet}
        onSuccess={handleEditSuccess}
      />
      
      {/* Delete Employee Dialog */}
      <DeleteEmployeeDialog
        employee={selectedEmployee}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  )
}
