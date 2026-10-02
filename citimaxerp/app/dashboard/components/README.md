# Modern Dashboard Components

This directory contains a collection of attractive, interactive, and user-friendly dashboard components built with shadcn/ui.

## Components Overview

### 1. Enhanced Metric Card (`enhanced-metric-card.tsx`)

Beautiful metric cards with hover effects, gradients, and smooth animations.

**Features:**
- Hover effects with scale animation
- Gradient backgrounds
- Trend indicators with icons
- Loading states
- Customizable icons

**Usage:**
```tsx
import { EnhancedMetricCard, MiniMetricCard } from "./components/enhanced-metric-card"
import { DollarSign } from "lucide-react"

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

// Mini variant for compact layouts
<MiniMetricCard
  title="Today's Sales"
  value="45.2K"
  currency="KES"
  icon={DollarSign}
  trend="up"
/>
```

### 2. Interactive Chart Card (`interactive-chart-card.tsx`)

Chart widgets with tabs, export functionality, and multiple visualization types.

**Features:**
- Bar and donut chart types
- Tab filters for time periods
- Export and fullscreen actions
- Trend indicators
- Animated progress bars

**Usage:**
```tsx
import { InteractiveChartCard } from "./components/interactive-chart-card"

const salesData = [
  { label: "Monday", value: 45000 },
  { label: "Tuesday", value: 52000 },
  // ...
]

<InteractiveChartCard
  title="Weekly Sales Performance"
  description="Revenue breakdown by day"
  data={salesData}
  total={371000}
  trend={{ value: 12.5, label: "vs last week" }}
  chartType="bar"
  tabs={["Week", "Month", "Quarter", "Year"]}
  onTabChange={(tab) => handleTabChange(tab)}
/>
```

### 3. Quick Action Cards (`quick-action-cards.tsx`)

Interactive action cards for common dashboard operations.

**Features:**
- Hover animations
- Icon-based navigation
- Badge support for notifications
- Predefined action grid
- Compact toolbar variant

**Usage:**
```tsx
import { QuickActionsGrid, QuickActionsToolbar, QuickActionCard } from "./components/quick-action-cards"
import { ShoppingCart } from "lucide-react"

// Full grid
<QuickActionsGrid />

// Toolbar variant
<QuickActionsToolbar />

// Custom action card
<QuickActionCard
  title="New Sale"
  description="Create a new sales order"
  icon={ShoppingCart}
  color="text-blue-600"
  bgColor="bg-blue-500/10"
  href="/sales/new"
  badge={5}
/>
```

### 4. Activity Feed (`activity-feed.tsx`)

Timeline-style activity feed with scroll area and status indicators.

**Features:**
- Timeline visualization
- Activity type icons
- Relative timestamps
- Status badges
- Scrollable content area
- Compact variant available

**Usage:**
```tsx
import { ActivityFeed, CompactActivityFeed } from "./components/activity-feed"

// Full activity feed
<ActivityFeed 
  maxHeight="400px"
  showViewAll={true}
/>

// Compact variant
<CompactActivityFeed />

// With custom data
const activities = [
  {
    id: "1",
    type: "sale",
    title: "New Sale Order",
    description: "Order #ORD-1234 created",
    timestamp: new Date(),
    user: "Sarah M.",
    amount: 45000,
    status: "completed",
  },
  // ...
]

<ActivityFeed activities={activities} />
```

### 5. Stat Cards (`stat-cards.tsx`)

Versatile stat cards with multiple variants for different use cases.

**Features:**
- Multiple variants (default, gradient, minimal)
- Progress indicators
- Trend badges
- Goal tracking
- Performance scores with circular progress

**Usage:**
```tsx
import { StatCard, GoalCard, PerformanceCard } from "./components/stat-cards"
import { TrendingUp } from "lucide-react"

// Basic stat card
<StatCard
  title="Sales Growth"
  value="24.5%"
  subtitle="Quarter over quarter"
  icon={TrendingUp}
  trend={{ value: 12.5, label: "from last quarter", isPositive: true }}
  variant="gradient"
/>

// Goal tracking card
<GoalCard
  title="Sales Target"
  current={2456890}
  target={3000000}
  unit="KES"
  period="October 2025"
  icon={Target}
/>

// Performance score card
<PerformanceCard
  title="Overall Performance Score"
  score={87}
  maxScore={100}
  metrics={[
    { label: "Sales Performance", value: 92, max: 100 },
    { label: "Customer Satisfaction", value: 85, max: 100 },
  ]}
/>
```

## Example Dashboard

See `/app/dashboard/modern/page.tsx` for a complete example showcasing all components.

## Customization

All components support Tailwind CSS classes and can be customized using the `className` prop:

```tsx
<EnhancedMetricCard
  className="border-2 border-blue-500"
  // ... other props
/>
```

## Icons

Components use Lucide React icons. Import any icon from `lucide-react`:

```tsx
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  TrendingUp,
  AlertCircle
} from "lucide-react"
```

## Responsive Design

All components are fully responsive and work seamlessly across different screen sizes:
- Mobile-first approach
- Grid layouts adapt automatically
- Touch-friendly interactive elements

## Animation & Transitions

Components include smooth animations:
- Hover effects with scale transforms
- Progress bar animations
- Fade-in transitions
- Gradient shifts on interaction

## Accessibility

Components follow accessibility best practices:
- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- Screen reader friendly

## Dependencies

These components use:
- **shadcn/ui** - UI component library
- **Lucide React** - Icon library
- **date-fns** - Date formatting (ActivityFeed)
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible primitives

## Tips

1. **Performance**: Use the compact variants for dashboards with many widgets
2. **Loading States**: Enable loading states while fetching data
3. **Color Consistency**: Use theme-compatible colors for consistency
4. **Gradients**: Customize gradients to match your brand colors
5. **Data Updates**: Components work great with real-time data updates

## Future Enhancements

Potential additions:
- More chart types (line, area, scatter)
- Drag-and-drop layout customization
- Widget configuration modals
- Export to PDF/Excel functionality
- Real-time data websocket integration
