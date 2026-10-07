'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  DollarSign,
  UserCheck,
  FileText,
  ClipboardList,
  CreditCard,
  Clock,
  Wallet,
} from 'lucide-react';
import { PermissionGuard } from '@/components/PermissionGuard';

export default function HRPage() {
  const navigationCards = [
    {
      title: "Employees",
      description: "Manage employee information and details",
      href: "/hr/employees",
      icon: Users,
      color: "bg-blue-500",
      permission: "can_view_employees_menu"
    },
    {
      title: "Payroll",
      description: "Process payroll and manage employee payments",
      href: "/hr/payroll",
      icon: DollarSign,
      color: "bg-green-500",
      permission: "can_view_payroll_menu"
    },
    {
      title: "Leave Management",
      description: "Manage employee leave requests and approvals",
      href: "/hr/leave-management",
      icon: ClipboardList,
      color: "bg-purple-500",
      permission: "can_view_leave_management_menu"
    },
    {
      title: "Salary Advance",
      description: "Manage employee salary advance requests",
      href: "/hr/salary-advance",
      icon: CreditCard,
      color: "bg-yellow-500",
      permission: "can_view_salary_advance_menu"
    },
    {
      title: "Allowances",
      description: "Track allowances disbursed outside payroll",
      href: "/hr/allowances",
      icon: Wallet,
      color: "bg-emerald-500",
      permission: "can_view_employees_menu"
    },
    {
      title: "Time Management",
      description: "Track and manage employee working hours",
      href: "/hr/time-management",
      icon: Clock,
      color: "bg-indigo-500",
      permission: "can_view_time_management_menu"
    },
  ];

  const quickActions = [
    {
      title: "Add New Employee",
      description: "Register a new employee",
      href: "/hr/employees",
      icon: UserCheck,
      variant: "default" as const,
      permission: "can_create_employees"
    },
    {
      title: "Process Payroll",
      description: "Create payroll for current period",
      href: "/hr/payroll",
      icon: DollarSign,
      variant: "outline" as const,
      permission: "can_process_payroll"
    },
    {
      title: "Request Leave",
      description: "Create a new leave request",
      href: "/hr/leave-management",
      icon: ClipboardList,
      variant: "outline" as const,
      permission: "can_request_leave"
    },
    {
      title: "Request Salary Advance",
      description: "Create a new salary advance request",
      href: "/hr/salary-advance",
      icon: CreditCard,
      variant: "outline" as const,
      permission: "can_request_salary_advance"
    },
  ];

  return (
    <PermissionGuard permissions={["can_view_hr_dashboard_menu", "can_manage_system", "can_manage_company"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Human Resources</h1>
            <p className="text-muted-foreground">
              Manage your workforce, payroll, and HR operations
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          {quickActions.map((action) => (
            <PermissionGuard key={action.title} permissions={[action.permission, "can_manage_system", "can_manage_company"]}>
              <Card key={action.title} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <action.icon className="h-5 w-5" />
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </div>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={action.href}>
                    <Button variant={action.variant} className="w-full">
                      {action.title}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </PermissionGuard>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {navigationCards.map((card) => (
            <PermissionGuard key={card.title} permissions={[card.permission, "can_manage_system", "can_manage_company"]}>
              <Link key={card.title} href={card.href}>
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${card.color}`}>
                        <card.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{card.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {card.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            </PermissionGuard>
          ))}
        </div>

        {/* Integration Note */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Integration with Finance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-700">
              Employee and payroll data is seamlessly integrated with the Finance module. 
              Payroll entries automatically create corresponding journal entries in the accounting system.
            </p>
            <div className="mt-4">
              <PermissionGuard permissions={["can_view_finance_menu", "can_manage_system", "can_manage_company"]} hideOnDenied>
                <Link href="/finance">
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                    View Finance Module
                  </Button>
                </Link>
              </PermissionGuard>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}