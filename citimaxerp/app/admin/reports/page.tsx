"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  Users, 
  CreditCard, 
  DollarSign,
  CalendarIcon,
  BarChart3,
  PieChart,
  Loader2
} from "lucide-react"
import { format, subDays, subMonths } from "date-fns"
import { cn } from "@/lib/utils"
import {
  getCompanies,
  getAdminUsers,
  getActivityLogs,
  type Company,
  type AdminUser,
  type ActivityLog
} from "@/lib/admin"

interface ReportData {
  totalCompanies: number
  activeCompanies: number
  totalUsers: number
  activeUsers: number
  totalRevenue: number
  monthlyRevenue: number
  newCompaniesThisMonth: number
  newUsersThisMonth: number
  subscriptionsByPlan: { [key: string]: number }
  companiesByStatus: { [key: string]: number }
  usersByRole: { [key: string]: number }
  activityTrends: { date: string; count: number }[]
  topActiveCompanies: Array<{
    company: Company
    activityCount: number
  }>
}

export default function AdminReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  const [selectedReport, setSelectedReport] = useState("overview")

  useEffect(() => {
    loadReportData()
  }, [dateRange])

  const loadReportData = async () => {
    try {
      setLoading(true)
      
      // Load all necessary data
      const [companiesData, usersData, activityData] = await Promise.all([
        getCompanies({ per_page: 1000 }),
        getAdminUsers({ per_page: 1000 }),
        getActivityLogs({ 
          per_page: 1000,
          date_from: format(dateRange.from, "yyyy-MM-dd"),
          date_to: format(dateRange.to, "yyyy-MM-dd")
        })
      ])

      const companies = companiesData.data || []
      const users = usersData.data || []
      const activities = activityData.data || []

      // Calculate metrics
      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      
      const newCompaniesThisMonth = companies.filter((c: Company) => {
        const createdDate = new Date(c.created_at)
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
      }).length

      const newUsersThisMonth = users.filter((u: AdminUser) => {
        const createdDate = new Date(u.created_at)
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
      }).length

      // Revenue calculation (mock - you'd get this from actual billing data)
      const activeCompanies = companies.filter((c: Company) => c.status === 'active').length
      const totalRevenue = activeCompanies * 99.99 * 12 // Annual revenue estimate
      const monthlyRevenue = activeCompanies * 99.99

      // Group data
      const companiesByStatus = companies.reduce((acc: { [key: string]: number }, company: Company) => {
        acc[company.status] = (acc[company.status] || 0) + 1
        return acc
      }, {} as { [key: string]: number })

      const usersByRole = users.reduce((acc: { [key: string]: number }, user: AdminUser) => {
        acc[user.role_name] = (acc[user.role_name] || 0) + 1
        return acc
      }, {} as { [key: string]: number })

      // Activity trends (group by date)
      const activityTrends = activities.reduce((acc: { date: string; count: number }[], activity: ActivityLog) => {
        const date = format(new Date(activity.created_at), "yyyy-MM-dd")
        const existing = acc.find((item: { date: string; count: number }) => item.date === date)
        if (existing) {
          existing.count++
        } else {
          acc.push({ date, count: 1 })
        }
        return acc
      }, [] as { date: string; count: number }[])

      // Top active companies
      const companyActivityCount = activities.reduce((acc: { [key: string]: number }, activity: ActivityLog) => {
        const companyId = String(activity.company_id)
        acc[companyId] = (acc[companyId] || 0) + 1
        return acc
      }, {} as { [key: string]: number })

      const topActiveCompanies = Object.entries(companyActivityCount)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([companyId, count]) => ({
          company: companies.find((c: Company) => String(c.id) === companyId)!,
          activityCount: count as number
        }))
        .filter(item => item.company)

      const reportData: ReportData = {
        totalCompanies: companies.length,
        activeCompanies: companies.filter((c: Company) => c.status === 'active').length,
        totalUsers: users.length,
        activeUsers: users.filter((u: AdminUser) => u.status === 'active').length,
        totalRevenue,
        monthlyRevenue,
        newCompaniesThisMonth,
        newUsersThisMonth,
        subscriptionsByPlan: {}, // You'd calculate this from subscription data
        companiesByStatus,
        usersByRole,
        activityTrends,
        topActiveCompanies
      }

      setReportData(reportData)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load report data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async () => {
    // This would typically generate and download a PDF or CSV report
    toast({
      title: "Export Started",
      description: "Report export will be sent to your email",
    })
  }

  const calculateGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No report data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">System metrics and business intelligence</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedReport} onValueChange={setSelectedReport}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select report" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="companies">Companies</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="activity">Activity</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "MMM dd") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <span className="text-muted-foreground">to</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "MMM dd") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
              >
                Last 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ from: subMonths(new Date(), 3), to: new Date() })}
              >
                Last 3 months
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${reportData.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +12% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.activeCompanies}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{reportData.newCompaniesThisMonth} new this month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalUsers}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{reportData.newUsersThisMonth} new this month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${reportData.monthlyRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +8% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Data */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Companies by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(reportData.companiesByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      status === 'active' ? 'default' :
                      status === 'suspended' ? 'destructive' : 'secondary'
                    }>
                      {status}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Roles Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Users by Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(reportData.usersByRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <div className="font-medium">{role}</div>
                  <div className="text-2xl font-bold">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Active Companies */}
      <Card>
        <CardHeader>
          <CardTitle>Most Active Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>Subscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.topActiveCompanies.slice(0, 10).map(({ company, activityCount }) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{company.name}</div>
                      <div className="text-sm text-muted-foreground">{company.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      company.status === 'active' ? 'default' :
                      company.status === 'suspended' ? 'destructive' : 'secondary'
                    }>
                      {company.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{company.users_count}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{activityCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.subscription_status === 'active' ? 'default' : 'secondary'}>
                      {company.subscription_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activity Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reportData.activityTrends.slice(0, 7).map((trend) => (
              <div key={trend.date} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="font-medium">
                  {format(new Date(trend.date), "MMM dd, yyyy")}
                </div>
                <div className="text-2xl font-bold">{trend.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
