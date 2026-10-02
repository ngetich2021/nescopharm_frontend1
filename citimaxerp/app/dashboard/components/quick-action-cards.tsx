"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  ShoppingCart, 
  Users, 
  Package, 
  FileText, 
  TrendingUp,
  Truck,
  DollarSign,
  LucideIcon,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface QuickActionCardProps {
  title: string
  description: string
  icon: LucideIcon
  color: string
  bgColor: string
  href?: string
  onClick?: () => void
  badge?: string | number
  disabled?: boolean
}

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  color,
  bgColor,
  href,
  onClick,
  badge,
  disabled = false,
}: QuickActionCardProps) {
  const content = (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer",
        !disabled && "hover:scale-[1.02] active:scale-[0.98]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Background Pattern */}
      <div className={cn("absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10", bgColor)} />
      
      <CardContent className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", bgColor)}>
            <Icon className={cn("h-6 w-6", color)} />
          </div>
          {badge !== undefined && (
            <Badge variant="secondary" className="font-semibold">
              {badge}
            </Badge>
          )}
        </div>

        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        <div className="flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
          <span>Get started</span>
          <ArrowRight className="h-4 w-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  )

  if (disabled) {
    return content
  }

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return <div onClick={onClick}>{content}</div>
}

// Predefined Quick Actions
export function QuickActionsGrid() {
  const actions = [
    {
      title: "New Sale",
      description: "Create a new sales order or invoice",
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
      href: "/sales/new",
    },
    {
      title: "Add Customer",
      description: "Register a new customer account",
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
      href: "/customers/new",
    },
    {
      title: "Stock Receipt",
      description: "Record new inventory items",
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
      href: "/product-receipt/new",
    },
    {
      title: "Create Invoice",
      description: "Generate customer invoice",
      icon: FileText,
      color: "text-orange-600",
      bgColor: "bg-orange-500/10",
      href: "/sales/invoices/new",
    },
    {
      title: "Record Expense",
      description: "Add business expense entry",
      icon: DollarSign,
      color: "text-red-600",
      bgColor: "bg-red-500/10",
      href: "/expenses/new",
    },
    {
      title: "Dispatch Order",
      description: "Process order delivery",
      icon: Truck,
      color: "text-teal-600",
      bgColor: "bg-teal-500/10",
      href: "/dispatch/new",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {actions.map((action, index) => (
        <QuickActionCard key={index} {...action} />
      ))}
    </div>
  )
}

// Compact Quick Action Button
interface CompactActionButtonProps {
  icon: LucideIcon
  label: string
  href?: string
  onClick?: () => void
  variant?: "default" | "outline" | "secondary"
}

export function CompactActionButton({
  icon: Icon,
  label,
  href,
  onClick,
  variant = "outline",
}: CompactActionButtonProps) {
  const buttonContent = (
    <Button
      variant={variant}
      size="sm"
      className="w-full justify-start gap-2 hover:scale-[1.02] transition-transform"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  )

  if (href) {
    return <Link href={href}>{buttonContent}</Link>
  }

  return buttonContent
}

// Quick Actions Toolbar
export function QuickActionsToolbar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <CompactActionButton icon={Plus} label="New Sale" href="/sales/new" />
        <CompactActionButton icon={Users} label="Add Customer" href="/customers/new" />
        <CompactActionButton icon={Package} label="Add Stock" href="/product-receipt/new" />
        <CompactActionButton icon={FileText} label="Create Invoice" href="/sales/invoices/new" />
      </CardContent>
    </Card>
  )
}
