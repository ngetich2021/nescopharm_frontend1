"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Minus } from "lucide-react";
import { Employee } from "@/lib/employees";
import { PayrollAllowance, PayrollDeduction, EmployeePayrollData } from "@/app/types";

interface EmployeePayrollCardProps {
  employee: Employee;
  payrollData: EmployeePayrollData;
  onDataChange: (employeeId: string, data: EmployeePayrollData) => void;
  onRemove: (employeeId: string) => void;
}

const ALLOWANCE_TYPES = [
  { value: "transport", label: "Transport Allowance" },
  { value: "house", label: "House Allowance" },
  { value: "medical", label: "Medical Allowance" },
  { value: "meal", label: "Meal Allowance" },
  { value: "communication", label: "Communication Allowance" },
  { value: "other", label: "Other Allowance" },
];

const DEDUCTION_TYPES = [
  { value: "loan_repayment", label: "Loan Repayment" },
  { value: "insurance", label: "Insurance" },
  { value: "cooperative", label: "Cooperative" },
  { value: "advance", label: "Salary Advance" },
  { value: "other", label: "Other Deduction" },
];

const REGIONS = [
  { value: "nairobi", label: "Nairobi" },
  { value: "mombasa", label: "Mombasa" },
  { value: "kisumu", label: "Kisumu" },
  { value: "nakuru", label: "Nakuru" },
  { value: "eldoret", label: "Eldoret" },
  { value: "other", label: "Other" },
];

const SKILL_LEVELS = [
  { value: "unskilled", label: "Unskilled" },
  { value: "semi_skilled", label: "Semi-Skilled" },
  { value: "skilled", label: "Skilled" },
  { value: "highly_skilled", label: "Highly Skilled" },
];

const OVERTIME_TYPES = [
  { value: "regular", label: "Regular Overtime" },
  { value: "weekend", label: "Weekend Overtime" },
  { value: "holiday", label: "Holiday Overtime" },
];

export function EmployeePayrollCard({ 
  employee, 
  payrollData, 
  onDataChange, 
  onRemove 
}: EmployeePayrollCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateData = (updates: Partial<EmployeePayrollData>) => {
    if (!employee.id) return;
    onDataChange(employee.id, { ...payrollData, ...updates });
  };

  const addAllowance = () => {
    const newAllowance: PayrollAllowance = { type: "transport", amount: 0 };
    updateData({ allowances: [...payrollData.allowances, newAllowance] });
  };

  const updateAllowance = (index: number, field: keyof PayrollAllowance, value: string | number) => {
    const updatedAllowances = [...payrollData.allowances];
    updatedAllowances[index] = { ...updatedAllowances[index], [field]: value };
    updateData({ allowances: updatedAllowances });
  };

  const removeAllowance = (index: number) => {
    const updatedAllowances = payrollData.allowances.filter((_, i) => i !== index);
    updateData({ allowances: updatedAllowances });
  };

  const addDeduction = () => {
    const newDeduction: PayrollDeduction = { type: "loan_repayment", amount: 0 };
    updateData({ deductions: [...payrollData.deductions, newDeduction] });
  };

  const updateDeduction = (index: number, field: keyof PayrollDeduction, value: string | number) => {
    const updatedDeductions = [...payrollData.deductions];
    updatedDeductions[index] = { ...updatedDeductions[index], [field]: value };
    updateData({ deductions: updatedDeductions });
  };

  const removeDeduction = (index: number) => {
    const updatedDeductions = payrollData.deductions.filter((_, i) => i !== index);
    updateData({ deductions: updatedDeductions });
  };

  const calculateTotalAllowances = () => {
    return payrollData.allowances.reduce((sum, allowance) => sum + allowance.amount, 0);
  };

  const calculateTotalDeductions = () => {
    return payrollData.deductions.reduce((sum, deduction) => sum + deduction.amount, 0);
  };

  const calculateGrossEstimate = () => {
    return payrollData.basic_salary + calculateTotalAllowances();
  };

  const calculateNetEstimate = () => {
    return calculateGrossEstimate() - calculateTotalDeductions();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <CardTitle className="text-lg">
                {employee.first_name} {employee.last_name}
              </CardTitle>
              <p className="text-sm text-gray-500">
                {employee.employee_number} • {employee.department} • {employee.position}
              </p>
            </div>
            <Badge variant="outline">
              {employee.employment_type}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              Est. Net: KES {calculateNetEstimate().toLocaleString()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => employee.id && onRemove(employee.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`basic_salary_${employee.id}`}>Basic Salary (KES)</Label>
              <Input
                id={`basic_salary_${employee.id}`}
                type="number"
                value={payrollData.basic_salary}
                onChange={(e) => updateData({ basic_salary: parseFloat(e.target.value) || 0 })}
                placeholder="85000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`region_${employee.id}`}>Region</Label>
              <Select 
                value={payrollData.region} 
                onValueChange={(value) => updateData({ region: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`skill_level_${employee.id}`}>Skill Level</Label>
              <Select 
                value={payrollData.skill_level} 
                onValueChange={(value: any) => updateData({ skill_level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select skill level" />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_LEVELS.map((skill) => (
                    <SelectItem key={skill.value} value={skill.value}>
                      {skill.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overtime Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`overtime_hours_${employee.id}`}>Overtime Hours</Label>
              <Input
                id={`overtime_hours_${employee.id}`}
                type="number"
                step="0.5"
                value={payrollData.overtime_hours}
                onChange={(e) => updateData({ overtime_hours: parseFloat(e.target.value) || 0 })}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`overtime_type_${employee.id}`}>Overtime Type</Label>
              <Select 
                value={payrollData.overtime_type} 
                onValueChange={(value: any) => updateData({ overtime_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select overtime type" />
                </SelectTrigger>
                <SelectContent>
                  {OVERTIME_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Allowances */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium">Allowances</h4>
              <Button type="button" variant="outline" size="sm" onClick={addAllowance}>
                <Plus className="h-4 w-4 mr-2" />
                Add Allowance
              </Button>
            </div>
            {payrollData.allowances.length === 0 ? (
              <p className="text-sm text-gray-500">No allowances added yet.</p>
            ) : (
              <div className="space-y-3">
                {payrollData.allowances.map((allowance, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Select
                      value={allowance.type}
                      onValueChange={(value) => updateAllowance(index, "type", value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALLOWANCE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={allowance.amount}
                      onChange={(e) => updateAllowance(index, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="Amount"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeAllowance(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="text-right">
                  <Badge variant="outline">
                    Total Allowances: KES {calculateTotalAllowances().toLocaleString()}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Deductions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium">Deductions</h4>
              <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
                <Plus className="h-4 w-4 mr-2" />
                Add Deduction
              </Button>
            </div>
            {payrollData.deductions.length === 0 ? (
              <p className="text-sm text-gray-500">No deductions added yet.</p>
            ) : (
              <div className="space-y-3">
                {payrollData.deductions.map((deduction, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Select
                      value={deduction.type}
                      onValueChange={(value) => updateDeduction(index, "type", value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEDUCTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={deduction.amount}
                      onChange={(e) => updateDeduction(index, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="Amount"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeDeduction(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="text-right">
                  <Badge variant="outline">
                    Total Deductions: KES {calculateTotalDeductions().toLocaleString()}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-md font-medium mb-3">Salary Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Basic Salary</p>
                <p className="font-medium">KES {payrollData.basic_salary.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Allowances</p>
                <p className="font-medium text-green-600">+KES {calculateTotalAllowances().toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Deductions</p>
                <p className="font-medium text-red-600">-KES {calculateTotalDeductions().toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Estimated Net</p>
                <p className="font-bold">KES {calculateNetEstimate().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}