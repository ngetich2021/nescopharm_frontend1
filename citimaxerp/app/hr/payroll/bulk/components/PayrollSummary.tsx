"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Employee } from "@/lib/employees";
import { EmployeePayrollData } from "@/app/types";

interface PayrollSummaryProps {
  employees: Employee[];
  payrollDataMap: Record<string, EmployeePayrollData>;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
}

export function PayrollSummary({ 
  employees, 
  payrollDataMap, 
  payPeriodStart, 
  payPeriodEnd, 
  payDate 
}: PayrollSummaryProps) {
  const calculateEmployeeTotals = (employeeId: string) => {
    const data = payrollDataMap[employeeId];
    if (!data) return { basic: 0, allowances: 0, deductions: 0, net: 0 };

    const basic = data.basic_salary;
    const allowances = data.allowances.reduce((sum, a) => sum + a.amount, 0);
    const deductions = data.deductions.reduce((sum, d) => sum + d.amount, 0);
    const net = basic + allowances - deductions;

    return { basic, allowances, deductions, net };
  };

  const calculateGrandTotals = () => {
    return employees.reduce(
      (totals, employee) => {
        if (!employee.id) return totals;
        const employeeTotals = calculateEmployeeTotals(employee.id);
        return {
          basic: totals.basic + employeeTotals.basic,
          allowances: totals.allowances + employeeTotals.allowances,
          deductions: totals.deductions + employeeTotals.deductions,
          net: totals.net + employeeTotals.net,
        };
      },
      { basic: 0, allowances: 0, deductions: 0, net: 0 }
    );
  };

  const grandTotals = calculateGrandTotals();
  const departmentGroups = employees.reduce((groups, employee) => {
    const dept = employee.department || 'Unknown';
    if (!groups[dept]) groups[dept] = [];
    groups[dept].push(employee);
    return groups;
  }, {} as Record<string, Employee[]>);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Period Information */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Period Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Pay Period</p>
              <p className="font-semibold">
                {formatDate(payPeriodStart)} - {formatDate(payPeriodEnd)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Pay Date</p>
              <p className="font-semibold">{formatDate(payDate)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Employees</p>
              <p className="font-semibold">{employees.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grand Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Basic Salary</p>
              <p className="text-2xl font-bold">KES {grandTotals.basic.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Allowances</p>
              <p className="text-2xl font-bold text-green-600">
                KES {grandTotals.allowances.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Deductions</p>
              <p className="text-2xl font-bold text-red-600">
                KES {grandTotals.deductions.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Net Pay</p>
              <p className="text-3xl font-bold text-blue-600">
                KES {grandTotals.net.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Breakdown */}  
      <Card>
        <CardHeader>
          <CardTitle>Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(departmentGroups).map(([department, deptEmployees]) => {
              const deptTotals = deptEmployees.reduce(
                (totals, employee) => {
                  if (!employee.id) return totals;
                  const employeeTotals = calculateEmployeeTotals(employee.id);
                  return {
                    basic: totals.basic + employeeTotals.basic,
                    allowances: totals.allowances + employeeTotals.allowances,
                    deductions: totals.deductions + employeeTotals.deductions,
                    net: totals.net + employeeTotals.net,
                  };
                },
                { basic: 0, allowances: 0, deductions: 0, net: 0 }
              );

              return (
                <div key={department} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold">{department}</h4>
                      <Badge variant="outline">{deptEmployees.length} employees</Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">KES {deptTotals.net.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">Net Pay</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Basic</p>
                      <p className="font-medium">KES {deptTotals.basic.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Allowances</p>
                      <p className="font-medium text-green-600">
                        KES {deptTotals.allowances.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Deductions</p>
                      <p className="font-medium text-red-600">
                        KES {deptTotals.deductions.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {employees.map((employee) => {
              if (!employee.id) return null;
              const totals = calculateEmployeeTotals(employee.id);
              const data = payrollDataMap[employee.id];
              
              return (
                <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="font-medium">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {employee.employee_number} • {employee.department} • {employee.position}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Badge variant="outline">{data?.region || 'N/A'}</Badge>
                        <Badge variant="outline">{data?.skill_level || 'N/A'}</Badge>
                        {data?.overtime_hours > 0 && (
                          <Badge variant="secondary">
                            OT: {data.overtime_hours}h ({data.overtime_type})
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500">Basic</p>
                      <p className="font-medium">KES {totals.basic.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Allowances</p>
                      <p className="font-medium text-green-600">
                        KES {totals.allowances.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Deductions</p>
                      <p className="font-medium text-red-600">
                        KES {totals.deductions.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Net Pay</p>
                      <p className="font-bold">KES {totals.net.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}