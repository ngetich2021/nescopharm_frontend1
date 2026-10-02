"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Loader2, 
  DollarSign, 
  Users, 
  CreditCard, 
  AlertCircle,
  Building2,
  Shield,
  Key,
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowRight
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import {
  getCompanies,
  getAdminUsers,
  getSubscriptionPlans,
  getActivityLogs,
  type Company,
  type AdminUser,
  type SubscriptionPlan,
  type ActivityLog
} from "@/lib/admin"

interface DashboardStats {
  totalRevenue: number
  totalUsers: number
  activeSubscriptions: number
  totalCompanies: number
  activeCompanies: number
  suspendedCompanies: number
  totalRoles: number
  totalPermissions: number
  todayActivities: number
  monthlyGrowth: {
    companies: number
    users: number
    revenue: number
  }
}

export function AdminDashboardClient() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalUsers: 0,
    activeSubscriptions: 0,
    totalCompanies: 0,
    activeCompanies: 0,
    suspendedCompanies: 0,
    totalRoles: 0,
    totalPermissions: 0,
    todayActivities: 0,
    monthlyGrowth: { companies: 0, users: 0, revenue: 0 }
  })
  const [recentCompanies, setRecentCompanies] = useState<Company[]>([])
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load data in parallel
      const [
        companiesData,
        usersData,
        subscriptionPlans,
        activityLogs
      ] = await Promise.all([
        getCompanies({ per_page: 1000 }),
        getAdminUsers({ per_page: 1000 }),
        getSubscriptionPlans(true), // Include inactive plans
        getActivityLogs({ per_page: 20 })
      ])

      const companies = companiesData.data || []
      const users = usersData.data || []
      const activities = activityLogs.data || []

      // Calculate stats
      const activeCompanies = companies.filter(c => c.status === 'active').length
      const suspendedCompanies = companies.filter(c => c.status === 'suspended').length
      const activeSubscriptions = companies.filter(c => c.subscription_status === 'active').length
      
      // Calculate revenue (mock calculation - you'd get this from actual payment data)
      const totalRevenue = activeSubscriptions * 99.99 // Average subscription price

      // Today's activities
      const today = new Date().toDateString()
      const todayActivities = activities.filter(a => 
        new Date(a.created_at).toDateString() === today
      ).length

      // Mock monthly growth (you'd calculate this from historical data)
      const monthlyGrowth = {
        companies: 12, // 12% growth
        users: 8,      // 8% growth  
        revenue: 15    // 15% growth
      }

      setStats({
        totalRevenue,
        totalUsers: users.length,
        activeSubscriptions,
        totalCompanies: companies.length,
        activeCompanies,
        suspendedCompanies,
        totalRoles: 0, // You'd get this from roles API
        totalPermissions: 0, // You'd get this from permissions API
        todayActivities,
        monthlyGrowth
      })

      // Set recent data
      setRecentCompanies(companies.slice(0, 5))
      setRecentActivities(activities.slice(0, 10))

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load dashboard data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created')) return "default"
    if (action.includes('updated')) return "secondary"
    if (action.includes('deleted') || action.includes('suspended')) return "destructive"
    if (action.includes('login')) return "outline"
    return "secondary"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30040]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{stats.monthlyGrowth.revenue}% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{stats.monthlyGrowth.users}% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.activeSubscriptions / stats.totalCompanies) * 100).toFixed(1)}% of companies
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayActivities}</div>
            <p className="text-xs text-muted-foreground">System activities</p>
          </CardContent>
        </Card>
      </div>

      {/* Company Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              +{stats.monthlyGrowth.companies}% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <Building2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.activeCompanies / stats.totalCompanies) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended Companies</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspendedCompanies}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Companies and Activities */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Companies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Companies</CardTitle>
            <Link href="/admin/companies">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCompanies.map((company) => (
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
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(company.created_at), "MMM dd, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activities</CardTitle>
            <Link href="/admin/activity-logs">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Badge variant={getActionBadgeVariant(activity.action)}>
                      {activity.action.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.description}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <span>{activity.user_name}</span>
                      <span>•</span>
                      <span>{activity.company_name}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(activity.created_at), "MMM dd, HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/admin/companies">
              <Button variant="outline" className="w-full justify-start">
                <Building2 className="mr-2 h-4 w-4" />
                Manage Companies
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
            <Link href="/admin/roles">
              <Button variant="outline" className="w-full justify-start">
                <Shield className="mr-2 h-4 w-4" />
                Manage Roles
              </Button>
            </Link>
            <Link href="/admin/subscriptions">
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Subscriptions
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
