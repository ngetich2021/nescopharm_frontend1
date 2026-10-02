"use client"

import { EnhancedMetricCard, MiniMetricCard } from "../components/enhanced-metric-card"
import { InteractiveChartCard } from "../components/interactive-chart-card"
import { QuickActionsGrid, QuickActionsToolbar } from "../components/quick-action-cards"
import { ActivityFeed, CompactActivityFeed } from "../components/activity-feed"
import { StatCard, GoalCard, PerformanceCard } from "../components/stat-cards"
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  ArrowUpRight,
  Target,
  Award,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PermissionGuard } from "@/components/PermissionGuard"

export default function ModernDashboard() {
  // Sample data
  const salesData = [
    { label: "Monday", value: 45000 },
    { label: "Tuesday", value: 52000 },
    { label: "Wednesday", value: 48000 },
    { label: "Thursday", value: 61000 },
    { label: "Friday", value: 58000 },
    { label: "Saturday", value: 72000 },
    { label: "Sunday", value: 35000 },
  ]

  const categoryData = [
    { label: "Electronics", value: 145000 },
    { label: "Furniture", value: 98000 },
    { label: "Clothing", value: 76000 },
    { label: "Food", value: 52000 },
  ]

  return (
    <PermissionGuard
      permissions={["can_view_dashboard_menu", "can_manage_system", "can_manage_company"]}
    >
      <div className="container mx-auto py-6 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here's what's happening today.
            </p>
          </div>
          <QuickActionsToolbar />
        </div>

        {/* Enhanced Metric Cards */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <EnhancedMetricCard
              title="Total Revenue"
              value="2,456,890"
              currency="KES"
              changePercent={12.5}
              changeText="vs last month"
              icon={DollarSign}
              trend="up"
              gradient="from-blue-500/10 to-cyan-500/10"
              description="Monthly revenue performance"
            />
            <EnhancedMetricCard
              title="Total Orders"
              value="1,234"
              changePercent={8.2}
              changeText="vs last month"
              icon={ShoppingCart}
              trend="up"
              gradient="from-purple-500/10 to-pink-500/10"
              description="Orders processed this month"
            />
            <EnhancedMetricCard
              title="Active Customers"
              value="8,549"
              changePercent={-2.4}
              changeText="vs last month"
              icon={Users}
              trend="down"
              gradient="from-green-500/10 to-emerald-500/10"
              description="Customers with recent activity"
            />
            <EnhancedMetricCard
              title="Products in Stock"
              value="3,876"
              changePercent={5.1}
              changeText="vs last month"
              icon={Package}
              trend="up"
              gradient="from-orange-500/10 to-red-500/10"
              description="Available inventory items"
            />
          </div>
        </section>

        {/* Stats Cards with Different Variants */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Key Performance Indicators</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Sales Growth"
              value="24.5%"
              subtitle="Quarter over quarter"
              icon={TrendingUp}
              trend={{ value: 12.5, label: "from last quarter", isPositive: true }}
              variant="gradient"
            />
            <StatCard
              title="Customer Retention"
              value="87%"
              subtitle="Last 30 days"
              icon={Users}
              progress={{ value: 87, max: 100, label: "Retention rate" }}
              variant="default"
            />
            <StatCard
              title="Avg Order Value"
              value="KES 1,845"
              subtitle="Per transaction"
              icon={ShoppingCart}
              trend={{ value: 8.3, label: "vs last period", isPositive: true }}
              variant="default"
            />
            <StatCard
              title="Inventory Turnover"
              value="4.2x"
              subtitle="Annual rate"
              icon={Package}
              trend={{ value: 15.7, label: "improvement", isPositive: true }}
              variant="default"
            />
          </div>
        </section>

        {/* Goals Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Monthly Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GoalCard
              title="Sales Target"
              current={2456890}
              target={3000000}
              unit="KES"
              period="October 2025"
              icon={Target}
            />
            <GoalCard
              title="New Customers"
              current={342}
              target={500}
              unit="customers"
              period="October 2025"
              icon={Users}
            />
            <GoalCard
              title="Orders Processed"
              current={1234}
              target={1500}
              unit="orders"
              period="October 2025"
              icon={ShoppingCart}
            />
          </div>
        </section>

        {/* Charts and Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts */}
          <div className="lg:col-span-2 space-y-6">
            <InteractiveChartCard
              title="Weekly Sales Performance"
              description="Revenue breakdown by day"
              data={salesData}
              total={371000}
              trend={{ value: 12.5, label: "vs last week" }}
              chartType="bar"
              tabs={["Week", "Month", "Quarter", "Year"]}
              onTabChange={(tab: string) => console.log("Tab changed:", tab)}
            />

            <InteractiveChartCard
              title="Sales by Category"
              description="Product category distribution"
              data={categoryData}
              chartType="donut"
            />

            {/* Performance Card */}
            <PerformanceCard
              title="Overall Performance Score"
              score={87}
              maxScore={100}
              metrics={[
                { label: "Sales Performance", value: 92, max: 100 },
                { label: "Customer Satisfaction", value: 85, max: 100 },
                { label: "Operational Efficiency", value: 84, max: 100 },
              ]}
            />
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-1">
            <ActivityFeed maxHeight="800px" />
          </div>
        </div>

        {/* Quick Actions Grid */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <QuickActionsGrid />
        </section>

        {/* Mini Cards Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MiniMetricCard
              title="Today's Sales"
              value="45.2K"
              currency="KES"
              icon={DollarSign}
              trend="up"
            />
            <MiniMetricCard
              title="New Orders"
              value="24"
              icon={ShoppingCart}
              trend="up"
            />
            <MiniMetricCard
              title="Pending"
              value="8"
              icon={Package}
              trend="neutral"
            />
            <MiniMetricCard
              title="Completed"
              value="156"
              icon={Award}
              trend="up"
            />
            <MiniMetricCard
              title="Low Stock"
              value="12"
              icon={Package}
              trend="down"
            />
            <MiniMetricCard
              title="New Customers"
              value="18"
              icon={Users}
              trend="up"
            />
          </div>
        </section>
      </div>
    </PermissionGuard>
  )
}
