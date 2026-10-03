"use client"

import type React from "react"

import { useState, useEffect } from "react" // Import useEffect
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Truck,
  CreditCard,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Store,
  Check,
  ChevronDown,
  PlusCircle,
  ReceiptText,
  Tags,
  LineChart,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Package,
  Calculator,
  UserCheck,
  ClipboardList,
  FileEdit,
  AlertTriangle,
  Wrench,
  LogOut,
  Clock,
  FileText,
  Banknote,
  BriefcaseBusiness,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth-context" // Import useAuth
import { hasPermission } from "@/lib/rbac" // Import hasPermission

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [salesDropdownOpen, setSalesDropdownOpen] = useState(false)
  const [crmDropdownOpen, setCrmdropdownOpen] = useState(false)
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(false)
  const [reportingDropdownOpen, setReportingDropdownOpen] = useState(false)
  const [hrDropdownOpen, setHrDropdownOpen] = useState(false)
  const pathname = usePathname()
  const { userProfile, isLoading: authLoading, signOut } = useAuth()

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Check if current path matches the nav item path
  const isActive = (path: string) => {
    // Special handling for HR & Payroll vs Finance
    if (path === "/finance") {
      // Finance should only be active for /finance root and finance-specific routes
      // but NOT for HR routes
      return pathname === "/finance" ||
             (pathname.startsWith("/finance/") &&
              !pathname.startsWith("/hr/"))
    }
    // For HR & Payroll, check if we're on HR routes
    if (path === "/hr") {
      return pathname === "/hr" || pathname.startsWith("/hr/")
    }
    // Special handling for sales dropdown - should be active for any sales route
    if (path === "/sales") {
      return pathname.startsWith("/sales/")
    }
    // Special handling for CRM dropdown - should be active for any CRM route
    if (path === "/customers") {
      return pathname.startsWith("/customers/")
    }
    // Special handling for inventory dropdown - should be active for any inventory route
    if (path === "/inventory") {
      return pathname === "/inventory" || pathname.startsWith("/inventory/")
    }
    // Special handling for reporting dropdown - should be active for any reporting route
    if (path === "/reports") {
      return pathname.startsWith("/reports/")
    }
    // Default behavior for other routes
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  // Define nav items with their required permissions (store removed)
  const navItems: { name: string; href: string; icon: React.ElementType; permission: string }[] = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "can_view_dashboard_menu" },
    { name: "CRM", href: "/customers", icon: Users, permission: "can_view_customers_menu" },
    // { name: "Logistics", href: "/logistics", icon: Truck, permission: "can_view_logistics_menu" },
    { name: "Dispatch", href: "/dispatch", icon: Truck, permission: "can_view_inventory_menu" },
    { name: "Requisitions", href: "/requisitions", icon: ClipboardList, permission: "can_view_requisitions_menu" },
    // { name: "Breakages", href: "/breakages", icon: AlertTriangle, permission: "can_view_breakages_menu" },
    // { name: "Repairs", href: "/repairs", icon: Wrench, permission: "can_view_repairs_menu" },
    { name: "Receipts", href: "/payments", icon: ReceiptText, permission: "can_view_payments_menu" },
    { name: "Payments", href: "/supplier-payments", icon: Banknote, permission: "can_view_payments_menu" },
    { name: "Suppliers", href: "/suppliers", icon: Truck, permission: "can_view_suppliers_menu" },
    { name: "Purchase Orders", href: "/purchase-orders", icon: Package, permission: "can_view_purchase_orders_menu" },
    { name: "Expenses", href: "/expenses", icon: ReceiptText, permission: "can_view_expenses_menu" },
    { name: "Finance", href: "/finance", icon: Calculator, permission: "can_view_finance_menu" },
    { name: "SOPs", href: "/sops", icon: ClipboardList, permission: "can_view_sops_menu" },
    { name: "HR & Payroll", href: "/hr", icon: UserCheck, permission: "can_view_employees_menu" },
    { name: "Employee Portal", href: "/employee-portal", icon: BriefcaseBusiness, permission: "can_view_employee_portal_menu" },
    { name: "POS", href: "/POS", icon: Store, permission: "can_view_pos_menu" },
    // { name: "Chat", href: "/chat", icon: MessageSquare, permission: "can_view_chat_menu" },
    { name: "Users", href: "/users", icon: UserCheck, permission: "can_manage_users_and_roles" },
  ]

  // Define CRM dropdown items
  const crmDropdownItems = [
    { name: "Customers", href: "/customers", icon: Users, permission: "can_view_customers_menu" },
    { name: "Accounts", href: "/customers/accounts", icon: CreditCard, permission: "can_view_customers_menu" },
  ]

  // Define sales dropdown items
  const salesDropdownItems = [
    { name: "Quotes", href: "/sales/quotes", icon: FileText, permission: "can_view_quotes_menu" },
    { name: "Orders", href: "/sales/orders", icon: ShoppingCart, permission: "can_view_sales_menu" },
    { name: "Invoices", href: "/sales/invoices", icon: ReceiptText, permission: "can_view_sales_menu" },
    { name: "Credit Notes", href: "/sales/credit-notes", icon: FileText, permission: "can_view_sales_menu" },
    { name: "Cheques", href: "/sales/cheques", icon: Banknote, permission: "can_view_sales_menu" },
  ]
  
  // Define inventory dropdown items
  const inventoryDropdownItems = [
    { name: "Products", href: "/inventory/products", icon: Package, permission: "can_view_inventory_menu" },
    { name: "Price Lists", href: "/inventory/price-lists", icon: Tags, permission: "can_create_products" },
    { name: "Product Receipts", href: "/product-receipt", icon: ReceiptText, permission: "can_view_product_receipt_menu" },
    { name: "Stock Counts", href: "/inventory/stock-counts", icon: ClipboardList, permission: "can_view_inventory_menu" },
    { name: "Stock Adjustments", href: "/inventory/stock-adjustments", icon: FileEdit, permission: "can_view_inventory_menu" },
  ]

  // Define reporting dropdown items
  const reportingDropdownItems = [
    { name: "eTIMS Compliance", href: "/etims/reports", icon: ShieldCheck, permission: "can_view_reports_menu" },
    { name: "eTIMS Supplier Receipts", href: "/etims/supplier-receipts", icon: ReceiptText, permission: "can_view_reports_menu" },
    { name: "Inventory Reports", href: "/reports/inventory", icon: Package, permission: "can_view_reports_menu", extraPermission: "can_view_inventory_reports" },
    { name: "Sales Reports", href: "/reports/sales", icon: ShoppingCart, permission: "can_view_reports_menu" },
    { name: "Logistics Reports", href: "/reports/logistics", icon: Truck, permission: "can_view_reports_menu", extraPermission: "can_view_logistics_reports" },
    { name: "Procurement Reports", href: "/reports/procurement", icon: ClipboardList, permission: "can_view_reports_menu" },
    { name: "CRM Reports", href: "/reports/customers", icon: Users, permission: "can_view_reports_menu" },
  ]

  // Define HR dropdown items
  const hrDropdownItems = [
    { name: "Employees", href: "/hr/employees", icon: Users, permission: "can_view_employees_menu" },
    { name: "Payroll", href: "/hr/payroll", icon: Calculator, permission: "can_view_payroll_menu" },
    { name: "Leave Management", href: "/hr/leave-management", icon: ClipboardList, permission: "can_view_leave_management_menu" },
    { name: "Salary Advance", href: "/hr/salary-advance", icon: CreditCard, permission: "can_view_salary_advance_menu" },
    { name: "Time Management", href: "/hr/time-management", icon: Clock, permission: "can_view_time_management_menu" },
    { name: "Daily Reports", href: "/hr/daily-reports", icon: FileText, permission: "can_view_daily_reports_menu" },
  ]

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-[70px] md:w-[250px] bg-white border-r border-gray-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-800/50 transition-all duration-300 shadow-xl",
        collapsed ? "w-[70px]" : "w-[260px]",
      )}
    >
      {/* Logo and collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E30040] to-[#ff1a5c] flex items-center justify-center shadow-lg shadow-[#E30040]/20">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">Citimax</span>
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all duration-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        <ul className="space-y-1 px-3">
          {/* Dashboard - everyone can see it; the page itself shows the full
              view only to users with can_view_dashboard_menu, and just a
              greeting to everyone else. */}
          <li>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive("/dashboard")
                      ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25"
                      : "text-slate-100 hover:bg-slate-800/50",
                  )}
                >
                  <LayoutDashboard size={20} className={cn("transition-transform duration-200", isActive("/dashboard") ? "" : "group-hover:scale-110")} />
                  {!collapsed && <span>Dashboard</span>}
                </Link>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                  Dashboard
                </TooltipContent>
              )}
            </Tooltip>
          </li>
          
          {/* CRM Dropdown */}
          {(hasPermission(userProfile as any, "can_view_customers_menu") || 
            hasPermission(userProfile as any, "can_manage_system") || 
            hasPermission(userProfile as any, "can_manage_company")) && (
            <li>
              <div className="relative">
                <button
                  onClick={() => {
                    setCrmdropdownOpen(!crmDropdownOpen)
                    setSalesDropdownOpen(false)
                    setInventoryDropdownOpen(false)
                    setReportingDropdownOpen(false)
                    setHrDropdownOpen(false)
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive("/customers") 
                      ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                      : "text-slate-100 hover:bg-slate-800/50",
                  )}
                >
                  <Users size={20} className={cn("transition-transform duration-200", isActive("/customers") ? "" : "group-hover:scale-110")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">CRM</span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          crmDropdownOpen ? "rotate-180" : ""
                        )}
                      />
                    </>
                  )}
                </button>
                
                {!collapsed && crmDropdownOpen && (
                  <ul className="mt-2 ml-4 space-y-1 border-l border-slate-700/50 pl-3">
                    {crmDropdownItems.map((subItem) =>
                      (hasPermission(userProfile as any, subItem.permission) || 
                        hasPermission(userProfile as any, "can_manage_system") || 
                        hasPermission(userProfile as any, "can_manage_company")) ? (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                              pathname === subItem.href
                                ? "bg-[#E30040]/10 text-[#E30040] font-medium"
                                : "text-slate-500 hover:text-white hover:bg-slate-800/30",
                            )}
                          >
                            <subItem.icon size={16} />
                            <span>{subItem.name}</span>
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>
            </li>
          )}
          
          


          {/* Sales Dropdown - positioned after Reporting */}
          {(hasPermission(userProfile as any, "can_view_sales_menu") || 
            hasPermission(userProfile as any, "can_view_quotes_menu") || 
            hasPermission(userProfile as any, "can_manage_system") || 
            hasPermission(userProfile as any, "can_manage_company")) && (
            <li>
              <div className="relative">
                <button
                  onClick={() => {
                    setSalesDropdownOpen(!salesDropdownOpen)
                    setCrmdropdownOpen(false)
                    setInventoryDropdownOpen(false)
                    setReportingDropdownOpen(false)
                    setHrDropdownOpen(false)
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive("/sales") 
                      ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                      : "text-slate-100 hover:bg-slate-800/50",
                  )}
                >
                  <ShoppingCart size={20} className={cn("transition-transform duration-200", isActive("/sales") ? "" : "group-hover:scale-110")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Sales</span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          salesDropdownOpen ? "rotate-180" : ""
                        )}
                      />
                    </>
                  )}
                </button>
                
                {!collapsed && salesDropdownOpen && (
                  <ul className="mt-2 ml-4 space-y-1 border-l border-slate-700/50 pl-3">
                    {salesDropdownItems.map((subItem) =>
                      hasPermission(userProfile as any, subItem.permission) ? (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                              pathname === subItem.href
                                ? "bg-[#E30040]/10 text-[#E30040] font-medium"
                                : "text-slate-500 hover:text-white hover:bg-slate-800/30",
                            )}
                          >
                            <subItem.icon size={16} />
                            <span>{subItem.name}</span>
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>
            </li>
          )}

                    {/* Inventory Dropdown - positioned after CRM and before Sales */}
          {hasPermission(userProfile as any, "can_view_inventory_menu") && (
            <li>
              <div className="relative">
                <button
                  onClick={() => {
                    setInventoryDropdownOpen(!inventoryDropdownOpen)
                    setCrmdropdownOpen(false)
                    setSalesDropdownOpen(false)
                    setReportingDropdownOpen(false)
                    setHrDropdownOpen(false)
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive("/inventory") || isActive("/product-receipt") 
                      ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                      : "text-slate-100 hover:bg-slate-800/50",
                  )}
                >
                  <BarChart3 size={20} className={cn("transition-transform duration-200", (isActive("/inventory") || isActive("/product-receipt")) ? "" : "group-hover:scale-110")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Inventory</span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          inventoryDropdownOpen ? "rotate-180" : ""
                        )}
                      />
                    </>
                  )}
                </button>
                
                {!collapsed && inventoryDropdownOpen && (
                  <ul className="mt-2 ml-4 space-y-1 border-l border-slate-700/50 pl-3">
                    {inventoryDropdownItems.map((subItem) =>
                      hasPermission(userProfile as any, subItem.permission) ? (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                              pathname === subItem.href
                                ? "bg-[#E30040]/10 text-[#E30040] font-medium"
                                : "text-slate-500 hover:text-white hover:bg-slate-800/30",
                            )}
                          >
                            <subItem.icon size={16} />
                            <span>{subItem.name}</span>
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>
            </li>
          )}

          {/* HR Dropdown */}
          {(hasPermission(userProfile as any, "can_view_employees_menu") || 
            hasPermission(userProfile as any, "can_manage_system") || 
            hasPermission(userProfile as any, "can_manage_company")) && (
            <li>
              <div className="relative">
                <button
                  onClick={() => {
                    setHrDropdownOpen(!hrDropdownOpen)
                    setCrmdropdownOpen(false)
                    setSalesDropdownOpen(false)
                    setInventoryDropdownOpen(false)
                    setReportingDropdownOpen(false)
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive("/hr") 
                      ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                      : "text-slate-100 hover:bg-slate-800/50",
                  )}
                >
                  <UserCheck size={20} className={cn("transition-transform duration-200", isActive("/hr") ? "" : "group-hover:scale-110")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">HR</span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          hrDropdownOpen ? "rotate-180" : ""
                        )}
                      />
                    </>
                  )}
                </button>
                
                {!collapsed && hrDropdownOpen && (
                  <ul className="mt-2 ml-4 space-y-1 border-l border-slate-700/50 pl-3">
                    {hrDropdownItems.map((subItem) =>
                      (hasPermission(userProfile as any, subItem.permission) || 
                        hasPermission(userProfile as any, "can_manage_system") || 
                        hasPermission(userProfile as any, "can_manage_company")) ? (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                              pathname === subItem.href
                                ? "bg-[#E30040]/10 text-[#E30040] font-medium"
                                : "text-slate-500 hover:text-white hover:bg-slate-800/30",
                            )}
                          >
                            <subItem.icon size={16} />
                            <span>{subItem.name}</span>
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>
            </li>
          )}

          {/* Rest of navigation items (excluding Dashboard, CRM, Sales, Inventory, and HR) */}
          {navItems
            .filter(item => item.name !== "Dashboard" && item.name !== "CRM" && item.name !== "Inventory" && item.name !== "Product Receipts" && item.name !== "HR & Payroll")
            .map((item) =>
              hasPermission(userProfile as any, item.permission) ? (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                      isActive(item.href) 
                        ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                        : "text-slate-100 hover:bg-slate-800/50",
                    )}
                  >
                    <item.icon size={20} className={cn("transition-transform duration-200", isActive(item.href) ? "" : "group-hover:scale-110")} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              ) : null,
            )}

          {/* Reporting Dropdown - Moved before Settings */}
          {(hasPermission(userProfile as any, "can_view_reports_menu") ||
            hasPermission(userProfile as any, "can_view_inventory_reports") ||
            hasPermission(userProfile as any, "can_view_logistics_reports") ||
            hasPermission(userProfile as any, "can_manage_system") ||
            hasPermission(userProfile as any, "can_manage_company")) && (
            <li>
              <div className="relative">
                <button
                  onClick={() => {
                    setReportingDropdownOpen(!reportingDropdownOpen)
                    setCrmdropdownOpen(false)
                    setSalesDropdownOpen(false)
                    setInventoryDropdownOpen(false)
                    setHrDropdownOpen(false)
                  }}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                    isActive("/reports") 
                      ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                      : "text-slate-100 hover:bg-slate-800/50",
                  )}
                >
                  <LineChart size={20} className={cn("transition-transform duration-200", isActive("/reports") ? "" : "group-hover:scale-110")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">Reporting</span>
                      <ChevronDown 
                        size={16} 
                        className={cn(
                          "transition-transform",
                          reportingDropdownOpen ? "rotate-180" : ""
                        )}
                      />
                    </>
                  )}
                </button>
                
                {!collapsed && reportingDropdownOpen && (
                  <ul className="mt-2 ml-4 space-y-1 border-l border-slate-700/50 pl-3">
                    {reportingDropdownItems.map((subItem) =>
                      (hasPermission(userProfile as any, subItem.permission) ||
                        (subItem.extraPermission && hasPermission(userProfile as any, subItem.extraPermission)) ||
                        hasPermission(userProfile as any, "can_manage_system") ||
                        hasPermission(userProfile as any, "can_manage_company")) ? (
                        <li key={subItem.name}>
                          <Link
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                              pathname === subItem.href
                                ? "bg-[#E30040]/10 text-[#E30040] font-medium"
                                : "text-slate-500 hover:text-white hover:bg-slate-800/30",
                            )}
                          >
                            <subItem.icon size={16} />
                            <span>{subItem.name}</span>
                          </Link>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>
            </li>
          )}

          {/* Settings Menu Item */}
          {hasPermission(userProfile as any, "can_view_settings_menu") && (
            <li>
              <Link
                href="/settings"
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm",
                  isActive("/settings") 
                    ? "bg-gradient-to-r from-[#E30040] to-[#ff1a5c] text-white shadow-lg shadow-[#E30040]/25" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                )}
              >
                <Settings size={20} className={cn("transition-transform duration-200", isActive("/settings") ? "" : "group-hover:scale-110")} />
                {!collapsed && <span>Settings</span>}
              </Link>
            </li>
          )}

          {/* Logout Menu Item */}
          <li>
            <button
              onClick={async () => {
                await signOut()
                window.location.href = "/sign-in"
              }}
              className={cn(
                "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10",
              )}
            >
              <LogOut size={20} className="transition-transform duration-200 group-hover:scale-110" />
              {!collapsed && <span>Logout</span>}
            </button>
          </li>
        </ul>
      </nav>
      </TooltipProvider>

      {/* User profile */}
      <div
        className={cn("border-t border-slate-800/50 p-4 bg-slate-950/50", collapsed ? "flex justify-center" : "flex items-center gap-3")}
      >
        <Avatar className="h-10 w-10 ring-2 ring-slate-700 ring-offset-2 ring-offset-slate-900">
          <AvatarImage src="/placeholder.svg" alt="User avatar" />
          <AvatarFallback className="bg-gradient-to-br from-[#E30040] to-[#ff1a5c] text-white font-semibold">
            {userProfile?.first_name?.[0] || ""}
            {userProfile?.last_name?.[0] || ""}
          </AvatarFallback>
        </Avatar>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {userProfile?.first_name} {userProfile?.last_name}
            </p>
            <p className="text-xs text-slate-400 truncate">{userProfile?.email}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export { Sidebar }
