"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Filter, X } from "lucide-react";
import { Employee, employeesApi } from "@/lib/employees";
import { useToast } from "@/hooks/use-toast";

interface EmployeeSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployees: Employee[];
  onEmployeesSelected: (employees: Employee[]) => void;
}

export function EmployeeSelectionSheet({ 
  open, 
  onOpenChange, 
  selectedEmployees,
  onEmployeesSelected 
}: EmployeeSelectionSheetProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Initialize selected IDs when selectedEmployees change
  useEffect(() => {
    const ids = new Set(selectedEmployees.map(emp => emp.id).filter(Boolean) as string[]);
    setSelectedIds(ids);
  }, [selectedEmployees]);

  // Fetch employees when sheet opens
  useEffect(() => {
    if (open) {
      fetchEmployees();
    }
  }, [open]);

  // Filter employees based on search and filters
  useEffect(() => {
    let filtered = employees;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.first_name?.toLowerCase().includes(term) ||
        emp.last_name?.toLowerCase().includes(term) ||
        emp.employee_number?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.department?.toLowerCase().includes(term) ||
        emp.position?.toLowerCase().includes(term)
      );
    }

    // Department filter
    if (departmentFilter !== "all") {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
    }

    // Employment type filter
    if (employmentTypeFilter !== "all") {
      filtered = filtered.filter(emp => emp.employment_type === employmentTypeFilter);
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, departmentFilter, employmentTypeFilter]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeesApi.getEmployees({ 
        per_page: 1000,
        employment_status: 'active'
      });
      setEmployees(response.employees || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch employees. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeToggle = (employee: Employee) => {
    if (!employee.id) return;
    
    const newSelectedIds = new Set(selectedIds);
    if (selectedIds.has(employee.id)) {
      newSelectedIds.delete(employee.id);
    } else {
      newSelectedIds.add(employee.id);
    }
    setSelectedIds(newSelectedIds);
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredEmployees
      .map(emp => emp.id)
      .filter(Boolean) as string[];
    
    const newSelectedIds = new Set(selectedIds);
    const allSelected = allFilteredIds.every(id => selectedIds.has(id));
    
    if (allSelected) {
      // Deselect all filtered employees
      allFilteredIds.forEach(id => newSelectedIds.delete(id));
    } else {
      // Select all filtered employees
      allFilteredIds.forEach(id => newSelectedIds.add(id));
    }
    
    setSelectedIds(newSelectedIds);
  };

  const handleSaveSelection = () => {
    const selected = employees.filter(emp => 
      emp.id && selectedIds.has(emp.id)
    );
    onEmployeesSelected(selected);
    onOpenChange(false);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDepartmentFilter("all");
    setEmploymentTypeFilter("all");
  };

  // Get unique departments and employment types
  const departments = Array.from(new Set(
    employees
      .map(emp => emp.department)
      .filter(Boolean)
  )).sort();

  const employmentTypes = Array.from(new Set(
    employees
      .map(emp => emp.employment_type)
      .filter(Boolean)
  )).sort();

  const allFilteredSelected = filteredEmployees.length > 0 && 
    filteredEmployees.every(emp => emp.id && selectedIds.has(emp.id));
  const someFilteredSelected = filteredEmployees.some(emp => 
    emp.id && selectedIds.has(emp.id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Employees for Payroll
          </SheetTitle>
          <SheetDescription>
            Choose the employees you want to include in this payroll processing batch.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees by name, number, email, department, or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-48">
                <Label htmlFor="department-filter">Department</Label>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-48">
                <Label htmlFor="employment-filter">Employment Type</Label>
                <Select value={employmentTypeFilter} onValueChange={setEmploymentTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Filter info and select all */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {filteredEmployees.length} of {employees.length} employees
                </Badge>
                <Badge variant="secondary">
                  {selectedIds.size} selected
                </Badge>
              </div>
              
              {filteredEmployees.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all"
                    checked={allFilteredSelected}
                    className={someFilteredSelected && !allFilteredSelected ? "data-[state=checked]:bg-blue-500" : ""}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm">
                    Select all visible
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Employee List */}
          <div className="flex-1 overflow-y-auto max-h-96 border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading employees...</div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">
                  {employees.length === 0 ? "No employees found" : "No employees match your filters"}
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {filteredEmployees.map((employee) => {
                  const isSelected = employee.id && selectedIds.has(employee.id);
                  
                  return (
                    <div 
                      key={employee.id} 
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => handleEmployeeToggle(employee)}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={!!isSelected}
                          onChange={() => handleEmployeeToggle(employee)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {employee.first_name} {employee.last_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {employee.employee_number} • {employee.email}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="outline">{employee.department}</Badge>
                              <Badge variant="secondary">{employee.employment_type}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {employee.position}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSelection}
              disabled={selectedIds.size === 0}
            >
              Select {selectedIds.size} Employee{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}