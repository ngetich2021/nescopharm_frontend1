"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ChevronDown, ChevronRight, Eye, FileText, User } from "lucide-react";
import { PayrollItem } from "@/lib/payroll";
import { formatCurrency } from "@/lib/finance";

interface EmployeePayrollTableProps {
  items: PayrollItem[];
}

export function EmployeePayrollTable({ items }: EmployeePayrollTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (itemId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedRows(newExpanded);
  };

  const getOvertimeRate = (item: PayrollItem) => {
    const overtime = parseFloat(item.overtime_amount);
    const hours = parseFloat(item.overtime_hours);
    return hours > 0 ? overtime / hours : 0;
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="font-semibold">Employee</TableHead>
            <TableHead className="font-semibold">Basic Salary</TableHead>
            <TableHead className="font-semibold">Allowances</TableHead>
            <TableHead className="font-semibold">Overtime</TableHead>
            <TableHead className="font-semibold">Gross Pay</TableHead>
            <TableHead className="font-semibold">Deductions</TableHead>
            <TableHead className="font-semibold">Net Pay</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isExpanded = expandedRows.has(item.id);
            return (
              <>
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(item.id)}
                      className="p-1 h-6 w-6"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {item.employee.first_name} {item.employee.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.employee.employee_number} • {item.employee.department}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(parseFloat(item.basic_salary))}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(parseFloat(item.allowances))}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatCurrency(parseFloat(item.overtime_amount))}
                      {parseFloat(item.overtime_hours) > 0 && (
                        <div className="text-xs text-gray-500">
                          {item.overtime_hours}h @ {formatCurrency(getOvertimeRate(item))}/h
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(parseFloat(item.gross_pay))}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(parseFloat(item.total_deductions))}
                  </TableCell>
                  <TableCell className="font-bold text-primary">
                    {formatCurrency(parseFloat(item.net_pay))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expanded Details Row */}
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <div className="bg-gray-50 p-4 border-t">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Allowances Breakdown */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Allowances Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {item.allowance_breakdown.length > 0 ? (
                                item.allowance_breakdown.map((allowance, index) => (
                                  <div key={index} className="flex justify-between text-sm">
                                    <span className="capitalize">{allowance.type.replace('_', ' ')}</span>
                                    <span className="font-medium">
                                      {formatCurrency(allowance.amount)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-gray-500">No allowances</div>
                              )}
                              {item.allowance_breakdown.length > 0 && (
                                <>
                                  <div className="border-t pt-2 mt-2">
                                    <div className="flex justify-between text-sm font-medium">
                                      <span>Total Allowances</span>
                                      <span>{formatCurrency(parseFloat(item.allowances))}</span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </CardContent>
                          </Card>

                          {/* Deductions Breakdown */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm">Deductions Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>PAYE Tax</span>
                                <span className="font-medium">
                                  {formatCurrency(parseFloat(item.paye_amount))}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>NSSF</span>
                                <span className="font-medium">
                                  {formatCurrency(parseFloat(item.nssf_amount))}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>SHIF</span>
                                <span className="font-medium">
                                  {formatCurrency(parseFloat(item.shif_amount))}
                                </span>
                              </div>
                              
                              {item.deduction_breakdown.length > 0 && (
                                <>
                                  <div className="border-t pt-2 mt-2">
                                    <div className="text-xs text-gray-600 mb-2">Other Deductions:</div>
                                    {item.deduction_breakdown.map((deduction, index) => (
                                      <div key={index} className="flex justify-between text-sm">
                                        <span className="capitalize">
                                          {deduction.type.replace('_', ' ')}
                                        </span>
                                        <span className="font-medium">
                                          {formatCurrency(deduction.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              <div className="border-t pt-2 mt-2">
                                <div className="flex justify-between text-sm font-medium">
                                  <span>Total Deductions</span>
                                  <span>{formatCurrency(parseFloat(item.total_deductions))}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Additional Employee Info */}
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Position</div>
                            <div className="font-medium">{item.employee.position}</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Employment Type</div>
                            <div className="font-medium capitalize">
                              {item.employee.employment_type.replace('_', ' ')}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Hire Date</div>
                            <div className="font-medium">
                              {format(new Date(item.employee.hire_date), 'MMM d, yyyy')}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Days/Hours Worked</div>
                            <div className="font-medium">
                              {item.days_worked} days / {item.hours_worked} hours
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      {/* Summary Footer */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total Employees</div>
            <div className="font-bold text-lg">{items.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Total Basic Salary</div>
            <div className="font-bold text-lg">
              {formatCurrency(
                items.reduce((sum, item) => sum + parseFloat(item.basic_salary), 0)
              )}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Total Allowances</div>
            <div className="font-bold text-lg">
              {formatCurrency(
                items.reduce((sum, item) => sum + parseFloat(item.allowances), 0)
              )}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Total Deductions</div>
            <div className="font-bold text-lg text-red-600">
              {formatCurrency(
                items.reduce((sum, item) => sum + parseFloat(item.total_deductions), 0)
              )}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Total Net Pay</div>
            <div className="font-bold text-lg text-primary">
              {formatCurrency(
                items.reduce((sum, item) => sum + parseFloat(item.net_pay), 0)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}