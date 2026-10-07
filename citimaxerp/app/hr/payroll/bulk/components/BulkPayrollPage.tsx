"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  Calendar, 
  DollarSign, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Plus,
  Eye,
  Send
} from "lucide-react";
import { Employee, employeesApi } from "@/lib/employees";
import { payrollApi } from "@/lib/payroll";
import { useToast } from "@/hooks/use-toast";
import { EmployeePayrollData, BulkPayrollRequest, BulkPayrollResponse } from "@/app/types";
import { EmployeeSelectionSheet } from "./EmployeeSelectionSheet";
import { EmployeePayrollCard } from "./EmployeePayrollCard";
import { PayrollSummary } from "./PayrollSummary";

interface ProcessingResult {
  success: boolean;
  data?: BulkPayrollResponse;
  error?: string;
}

const createDefaultPayrollData = (): EmployeePayrollData => ({
  basic_salary: 0,
  allowances: [],
  deductions: [],
  overtime_hours: 0,
  overtime_type: 'regular',
  region: 'nairobi',
  skill_level: 'skilled',
});

export function BulkPayrollPage() {
  const [currentTab, setCurrentTab] = useState<string>("selection");
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [employeeSelectionOpen, setEmployeeSelectionOpen] = useState(false);
  const [payrollDataMap, setPayrollDataMap] = useState<Record<string, EmployeePayrollData>>({});
  const [payPeriodStart, setPayPeriodStart] = useState("");
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payDate, setPayDate] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  const handleEmployeesSelected = (employees: Employee[]) => {
    setSelectedEmployees(employees);
    
    // Initialize payroll data for new employees
    const newPayrollDataMap = { ...payrollDataMap };
    employees.forEach(employee => {
      if (employee.id && !newPayrollDataMap[employee.id]) {
        // Pre-populate with employee's existing allowances and deductions if available
        // Disbursed allowances are paid outside payroll, so they never pre-fill a payslip.
        const allowances = Array.isArray(employee.allowances)
          ? employee.allowances
              .filter((a) => a.frequency !== "disbursed")
              .map((a) => ({ type: a.name, amount: Number(a.amount) || 0 }))
          : employee.allowances
            ? Object.entries(employee.allowances).map(([type, amount]) => ({ type, amount: Number(amount) }))
            : [];
        const deductions = employee.deductions ? 
          Object.entries(employee.deductions).map(([type, amount]) => ({ type, amount: Number(amount) })) : [];
        
        newPayrollDataMap[employee.id] = {
          ...createDefaultPayrollData(),
          basic_salary: Number(employee.basic_salary) || 0,
          allowances,
          deductions,
        };
      }
    });

    // Remove data for employees that are no longer selected
    const selectedIds = new Set(employees.map(emp => emp.id).filter(Boolean));
    Object.keys(newPayrollDataMap).forEach(id => {
      if (!selectedIds.has(id)) {
        delete newPayrollDataMap[id];
      }
    });

    setPayrollDataMap(newPayrollDataMap);
  };

  const handlePayrollDataChange = (employeeId: string, data: EmployeePayrollData) => {
    setPayrollDataMap(prev => ({
      ...prev,
      [employeeId]: data
    }));
  };

  const handleRemoveEmployee = (employeeId: string) => {
    setSelectedEmployees(prev => prev.filter(emp => emp.id !== employeeId));
    setPayrollDataMap(prev => {
      const updated = { ...prev };
      delete updated[employeeId];
      return updated;
    });
  };

  const validateFormData = (): string[] => {
    const errors: string[] = [];
    
    if (!payPeriodStart) errors.push("Pay period start date is required");
    if (!payPeriodEnd) errors.push("Pay period end date is required");
    if (!payDate) errors.push("Pay date is required");
    if (selectedEmployees.length === 0) errors.push("At least one employee must be selected");
    
    if (payPeriodStart && payPeriodEnd && payPeriodStart >= payPeriodEnd) {
      errors.push("Pay period end date must be after start date");
    }
    
    if (payDate && payPeriodEnd && payDate < payPeriodEnd) {
      errors.push("Pay date should be on or after the pay period end date");
    }

    // Validate employee payroll data
    selectedEmployees.forEach(employee => {
      if (!employee.id) return;
      const data = payrollDataMap[employee.id];
      if (!data) {
        errors.push(`Missing payroll data for ${employee.first_name} ${employee.last_name}`);
        return;
      }
      
      if (data.basic_salary <= 0) {
        errors.push(`Basic salary is required for ${employee.first_name} ${employee.last_name}`);
      }
    });

    return errors;
  };

  const handleProcessPayroll = async () => {
    const errors = validateFormData();
    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);
      
      const requestData: BulkPayrollRequest = {
        pay_period_start: payPeriodStart,
        pay_period_end: payPeriodEnd,
        pay_date: payDate,
        employee_ids: selectedEmployees.map(emp => emp.id).filter(Boolean) as string[],
        custom_data: payrollDataMap,
      };

      const response = await payrollApi.processBulkPayroll(requestData);
      
      setProcessingResult({ success: true, data: response as BulkPayrollResponse });
      setCurrentTab("results");
      
      toast({
        title: "Success",
        description: "Bulk payroll processed successfully!",
      });
    } catch (error: any) {
      setProcessingResult({ 
        success: false, 
        error: error.message || "Failed to process payroll" 
      });
      setCurrentTab("results");
      
      toast({
        title: "Error",
        description: error.message || "Failed to process payroll",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setShowConfirmDialog(false);
    }
  };

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
      payDate: new Date(year, month + 1, 5).toISOString().split('T')[0], // 5th of next month
    };
  };

  const setCurrentMonthDefaults = () => {
    const { start, end, payDate } = getCurrentMonth();
    setPayPeriodStart(start);
    setPayPeriodEnd(end);
    setPayDate(payDate);
  };

  const canProceedToSummary = () => {
    return selectedEmployees.length > 0 && 
           payPeriodStart && 
           payPeriodEnd && 
           payDate &&
           selectedEmployees.every(emp => emp.id && payrollDataMap[emp.id]?.basic_salary > 0);
  };

  const canProcessPayroll = () => {
    return canProceedToSummary() && validateFormData().length === 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Bulk Payroll Processing</h1>
        <p className="text-gray-600 mt-2">
          Process payroll for multiple employees with customized allowances, deductions, and overtime.
        </p>
      </div>

      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                currentTab === "selection" ? "bg-blue-100 text-blue-700" : 
                selectedEmployees.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Select Employees</span>
                {selectedEmployees.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedEmployees.length}
                  </Badge>
                )}
              </div>
              <div className="h-px bg-gray-300 w-8"></div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                currentTab === "configuration" ? "bg-blue-100 text-blue-700" : 
                canProceedToSummary() ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Configure Payroll</span>
              </div>
              <div className="h-px bg-gray-300 w-8"></div>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                currentTab === "summary" ? "bg-blue-100 text-blue-700" : 
                canProceedToSummary() ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">Review & Submit</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Step {currentTab === "selection" ? "1" : currentTab === "configuration" ? "2" : currentTab === "summary" ? "3" : "4"} of 4
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="selection">Employee Selection</TabsTrigger>
          <TabsTrigger value="configuration" disabled={selectedEmployees.length === 0}>
            Payroll Configuration
          </TabsTrigger>
          <TabsTrigger value="summary" disabled={!canProceedToSummary()}>
            Summary
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!processingResult}>
            Results
          </TabsTrigger>
        </TabsList>

        {/* Employee Selection Tab */}
        <TabsContent value="selection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Select the employees you want to include in this payroll batch.
                  </p>
                  {selectedEmployees.length > 0 && (
                    <p className="text-sm font-medium mt-1">
                      {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
                <Button onClick={() => setEmployeeSelectionOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {selectedEmployees.length === 0 ? "Select Employees" : "Manage Selection"}
                </Button>
              </div>

              {selectedEmployees.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Selected Employees</h4>
                  <div className="space-y-2">
                    {selectedEmployees.map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {employee.employee_number} • {employee.department} • {employee.position}
                          </p>
                        </div>
                        <Badge variant="outline">{employee.employment_type}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEmployees.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={() => setCurrentTab("configuration")}>
                    Next: Configure Payroll
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          {/* Pay Period Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pay Period Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pay_period_start">Pay Period Start</Label>
                  <Input
                    id="pay_period_start"
                    type="date"
                    value={payPeriodStart}
                    onChange={(e) => setPayPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_period_end">Pay Period End</Label>
                  <Input
                    id="pay_period_end"
                    type="date"
                    value={payPeriodEnd}
                    onChange={(e) => setPayPeriodEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pay_date">Pay Date</Label>
                  <Input
                    id="pay_date"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline" onClick={setCurrentMonthDefaults}>
                  Use Current Month Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Employee Payroll Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Employee Payroll Configuration</h3>
              <Badge variant="outline">
                {selectedEmployees.length} employee{selectedEmployees.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            
            {selectedEmployees.map((employee) => (
              <EmployeePayrollCard
                key={employee.id}
                employee={employee}
                payrollData={payrollDataMap[employee.id!] || createDefaultPayrollData()}
                onDataChange={handlePayrollDataChange}
                onRemove={handleRemoveEmployee}
              />
            ))}
          </div>

          {canProceedToSummary() && (
            <div className="flex justify-end">
              <Button onClick={() => setCurrentTab("summary")}>
                Next: Review Summary
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          <PayrollSummary
            employees={selectedEmployees}
            payrollDataMap={payrollDataMap}
            payPeriodStart={payPeriodStart}
            payPeriodEnd={payPeriodEnd}
            payDate={payDate}
          />

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentTab("configuration")}>
              Back to Configuration
            </Button>
            <Button 
              onClick={() => setShowConfirmDialog(true)}
              disabled={!canProcessPayroll() || processing}
            >
              {processing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Process Payroll
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {processingResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {processingResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  Processing Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {processingResult.success && processingResult.data ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Success
                      </Badge>
                      <span className="text-sm">{processingResult.data.message}</span>
                    </div>
                    
                    {processingResult.data.payroll_record_id && (
                      <div>
                        <p className="text-sm text-gray-600">Payroll Record ID:</p>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {processingResult.data.payroll_record_id}
                        </code>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-medium">Employee Results:</h4>
                      {processingResult.data.results.map((result, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">Employee {result.employee_id}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                              {result.status}
                            </Badge>
                            {result.payroll_item_id && (
                              <span className="text-xs text-gray-500">
                                ID: {result.payroll_item_id}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p className="font-medium">Error:</p>
                    <p className="text-sm">{processingResult.error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Employee Selection Sheet */}
      <EmployeeSelectionSheet
        open={employeeSelectionOpen}
        onOpenChange={setEmployeeSelectionOpen}
        selectedEmployees={selectedEmployees}
        onEmployeesSelected={handleEmployeesSelected}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payroll Processing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to process payroll for {selectedEmployees.length} employee
              {selectedEmployees.length !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcessPayroll} disabled={processing}>
              {processing ? "Processing..." : "Process Payroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}