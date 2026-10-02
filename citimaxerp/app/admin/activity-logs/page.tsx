"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "@/hooks/use-toast"
import { 
  Search, 
  Activity, 
  Users, 
  Building2,
  CalendarIcon,
  Download,
  Filter,
  Loader2,
  Eye,
  X
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import {
  getActivityLogs,
  getCompanies,
  getAdminUsers,
  type ActivityLog,
  type Company,
  type AdminUser,
  type ActivityLogFilters
} from "@/lib/admin"

export default function ActivityLogsPage() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 50,
    total: 0,
    last_page: 1
  })
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [selectedAction, setSelectedAction] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [currentPage, setCurrentPage] = useState(1)

  // Available actions (you can extend this list based on your system)
  const actionTypes = [
    "user_created", "user_updated", "user_deleted",
    "company_created", "company_updated", "company_suspended",
    "role_created", "role_updated", "role_deleted",
    "permission_assigned", "permission_removed",
    "subscription_created", "subscription_renewed", "subscription_cancelled",
    "login", "logout", "password_changed"
  ]

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadActivityLogs()
  }, [currentPage, searchTerm, selectedCompany, selectedUser, selectedAction, dateFrom, dateTo])

  const loadInitialData = async () => {
    try {
      const [companiesData, usersData] = await Promise.all([
        getCompanies({ per_page: 1000 }),
        getAdminUsers({ per_page: 1000 })
      ])
      
      setCompanies(companiesData.data || [])
      setUsers(usersData.data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load initial data",
        variant: "destructive",
      })
    }
  }

  const loadActivityLogs = async () => {
    try {
      setLoading(true)
      
      const filters: ActivityLogFilters = {
        page: currentPage,
        per_page: pagination.per_page,
      }

      if (selectedCompany !== "all") {
        filters.company_id = selectedCompany
      }
      
      if (selectedUser !== "all") {
        filters.user_id = selectedUser
      }
      
      if (selectedAction !== "all") {
        filters.action = selectedAction
      }
      
      if (dateFrom) {
        filters.date_from = format(dateFrom, "yyyy-MM-dd")
      }
      
      if (dateTo) {
        filters.date_to = format(dateTo, "yyyy-MM-dd")
      }

      const response = await getActivityLogs(filters)
      
      setActivityLogs(response.data || [])
        setPagination({
            current_page: response.pagination.current_page,
            per_page: response.pagination.per_page,
            total: response.pagination.total,
            last_page: response.pagination.last_page
        })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load activity logs",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCompany("all")
    setSelectedUser("all")
    setSelectedAction("all")
    setDateFrom(undefined)
    setDateTo(undefined)
    setCurrentPage(1)
  }

  const exportLogs = async () => {
    // This would typically call an API endpoint to export logs
    toast({
      title: "Export Started",
      description: "Activity logs export will be sent to your email",
    })
  }

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created')) return "default"
    if (action.includes('updated')) return "secondary"
    if (action.includes('deleted') || action.includes('suspended')) return "destructive"
    if (action.includes('login')) return "outline"
    return "secondary"
  }

  const formatMetadata = (metadata: Record<string, any>) => {
    if (!metadata || Object.keys(metadata).length === 0) return "No additional data"
    
    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">Track system activities and user actions</p>
        </div>
        <Button onClick={exportLogs} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(activityLogs.map(log => log.user_id)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies Involved</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(activityLogs.map(log => log.company_id)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activityLogs.filter(log => 
                new Date(log.created_at).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Company Filter */}
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger>
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User Filter */}
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action Filter */}
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "MMM dd") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "MMM dd") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Activity Logs ({activityLogs.length} of {pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(log.created_at), "MMM dd, yyyy")}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(log.created_at), "HH:mm:ss")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{log.user_name}</div>
                          <div className="text-muted-foreground">ID: {log.user_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{log.company_name}</div>
                          <div className="text-muted-foreground">ID: {log.company_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate" title={log.description}>
                          {log.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm text-muted-foreground" title={formatMetadata(log.metadata)}>
                          {formatMetadata(log.metadata)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.last_page > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.current_page - 1) * pagination.per_page) + 1} to{" "}
                    {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{" "}
                    {pagination.total} activities
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                        const page = i + 1
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === pagination.last_page}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
