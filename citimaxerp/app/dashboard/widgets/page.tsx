"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EnhancedMetricCard, MiniMetricCard } from "../components/enhanced-metric-card"
import { InteractiveChartCard } from "../components/interactive-chart-card"
import { QuickActionsGrid, QuickActionCard, CompactActionButton } from "../components/quick-action-cards"
import { ActivityFeed, CompactActivityFeed } from "../components/activity-feed"
import { StatCard, GoalCard, PerformanceCard } from "../components/stat-cards"
import { ComparisonCard, SideBySideCard } from "../components/comparison-cards"
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Target,
  Plus,
  FileText,
  Truck,
} from "lucide-react"

export default function WidgetShowcase() {
  const sampleData = [
    { label: "Mon", value: 45000 },
    { label: "Tue", value: 52000 },
    { label: "Wed", value: 48000 },
    { label: "Thu", value: 61000 },
    { label: "Fri", value: 58000 },
  ]

  const comparisonData = [
    {
      label: "Revenue",
      currentValue: 2456890,
      previousValue: 2189450,
      unit: "KES ",
      icon: DollarSign,
    },
    {
      label: "Orders",
      currentValue: 1234,
      previousValue: 1089,
      icon: ShoppingCart,
    },
    {
      label: "Customers",
      currentValue: 8549,
      previousValue: 8321,
      icon: Users,
    },
  ]

  return (
    <div className="container mx-auto py-6 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Dashboard Widget Showcase
        </h1>
        <p className="text-muted-foreground">
          A collection of modern, interactive dashboard components built with shadcn/ui
        </p>
      </div>

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="comparison">Compare</TabsTrigger>
        </TabsList>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Metric Cards</CardTitle>
              <CardDescription>
                Beautiful metric cards with hover effects and animations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                />
                <EnhancedMetricCard
                  title="Total Orders"
                  value="1,234"
                  changePercent={8.2}
                  icon={ShoppingCart}
                  trend="up"
                  gradient="from-purple-500/10 to-pink-500/10"
                />
                <EnhancedMetricCard
                  title="Active Users"
                  value="8,549"
                  changePercent={-2.4}
                  icon={Users}
                  trend="down"
                  gradient="from-green-500/10 to-emerald-500/10"
                />
                <EnhancedMetricCard
                  title="In Stock"
                  value="3,876"
                  icon={Package}
                  gradient="from-orange-500/10 to-red-500/10"
                  loading={false}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Mini Metric Cards</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <MiniMetricCard
                    title="Sales"
                    value="45.2K"
                    currency="KES"
                    icon={DollarSign}
                    trend="up"
                  />
                  <MiniMetricCard
                    title="Orders"
                    value="24"
                    icon={ShoppingCart}
                    trend="up"
                  />
                  <MiniMetricCard
                    title="Pending"
                    value="8"
                    icon={Package}
                  />
                  <MiniMetricCard
                    title="Stock"
                    value="156"
                    icon={Package}
                    trend="up"
                  />
                  <MiniMetricCard
                    title="Low Stock"
                    value="12"
                    icon={Package}
                    trend="down"
                  />
                  <MiniMetricCard
                    title="New Users"
                    value="18"
                    icon={Users}
                    trend="up"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InteractiveChartCard
              title="Weekly Sales"
              description="Revenue by day"
              data={sampleData}
              total={264000}
              trend={{ value: 12.5, label: "vs last week" }}
              chartType="bar"
              tabs={["Week", "Month", "Year"]}
            />
            <InteractiveChartCard
              title="Category Distribution"
              data={[
                { label: "Electronics", value: 145000 },
                { label: "Furniture", value: 98000 },
                { label: "Clothing", value: 76000 },
                { label: "Food", value: 52000 },
              ]}
              chartType="donut"
            />
          </div>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions Grid</CardTitle>
              <CardDescription>Interactive cards for common operations</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickActionsGrid />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Action Cards</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QuickActionCard
                title="Create Report"
                description="Generate analytics report"
                icon={FileText}
                color="text-indigo-600"
                bgColor="bg-indigo-500/10"
                badge={3}
              />
              <QuickActionCard
                title="Schedule Delivery"
                description="Plan delivery routes"
                icon={Truck}
                color="text-teal-600"
                bgColor="bg-teal-500/10"
              />
              <QuickActionCard
                title="Add Product"
                description="Register new product"
                icon={Plus}
                color="text-purple-600"
                bgColor="bg-purple-500/10"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compact Action Buttons</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <CompactActionButton icon={Plus} label="New Sale" />
              <CompactActionButton icon={Users} label="Add Customer" />
              <CompactActionButton icon={Package} label="Add Stock" />
              <CompactActionButton icon={FileText} label="Invoice" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityFeed maxHeight="600px" />
            </div>
            <div>
              <CompactActivityFeed />
            </div>
          </div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
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
              title="Retention"
              value="87%"
              subtitle="Last 30 days"
              icon={Users}
              progress={{ value: 87, max: 100, label: "Rate" }}
            />
            <StatCard
              title="Avg Order"
              value="KES 1,845"
              subtitle="Per transaction"
              icon={ShoppingCart}
              trend={{ value: 8.3, isPositive: true }}
            />
            <StatCard
              title="Turnover"
              value="4.2x"
              subtitle="Annual rate"
              icon={Package}
              trend={{ value: 15.7, isPositive: true }}
            />
          </div>

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
              current={450}
              target={500}
              unit="customers"
              period="October 2025"
              icon={Users}
            />
            <PerformanceCard
              title="Performance"
              score={87}
              metrics={[
                { label: "Sales", value: 92, max: 100 },
                { label: "Service", value: 85, max: 100 },
              ]}
            />
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ComparisonCard
              title="Month-over-Month Comparison"
              description="Key metrics compared to previous period"
              data={comparisonData}
              timeframe={{ current: "This Month", previous: "Last Month" }}
            />

            <div className="space-y-6">
              <SideBySideCard
                title="Revenue Comparison"
                leftLabel="This Month"
                leftValue={2456890}
                rightLabel="Last Month"
                rightValue={2189450}
                leftIcon={DollarSign}
                rightIcon={DollarSign}
                unit="KES "
              />
              <SideBySideCard
                title="Order Volume"
                leftLabel="This Week"
                leftValue={287}
                rightLabel="Last Week"
                rightValue={245}
                leftIcon={ShoppingCart}
                rightIcon={ShoppingCart}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
