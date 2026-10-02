"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Employee } from "@/lib/employees";
import { employeesApi } from "@/lib/employees";
import { getUsers, type UserData } from "@/lib/users";
import { useAuth } from "@/lib/auth-context";

// Type for allowance/deduction items
interface AllowanceDeductionItem {
  name: string;
  amount: string;
  frequency: string;
  is_taxable: boolean;
}

interface EditEmployeeSheetProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditEmployeeSheet({ employee, open, onOpenChange, onSuccess }: EditEmployeeSheetProps) {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Restricted to actual GM/Director (or anyone explicitly granted the matching
  // approval permission) - not just any employee, so this can't be pointed at
  // someone with no real authority to approve leave/salary changes.
  const [leaveApprovers, setLeaveApprovers] = useState<UserData[]>([]);
  const [salaryApprovers, setSalaryApprovers] = useState<UserData[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [leaveApproverSearchOpen, setLeaveApproverSearchOpen] = useState(false);
  const [salaryAdvanceApproverSearchOpen, setSalaryAdvanceApproverSearchOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canEditSalary = hasPermission("can_approve_salary_changes");
  
  const [formData, setFormData] = useState({
    // Personal Information
    employee_number: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    national_id: "",
    
    // Address Information
    address: "",
    city: "",
    state: "",
    postal_code: "",
    
    // Employment Information
    hire_date: "",
    termination_date: "",
    employment_type: "full_time",
    payment_frequency: "monthly",
    employment_status: "active",
    department: "Information Technology",
    position: "",
    supervisor_id: "",
    leave_approver_id: "",
    salary_advance_approver_id: "",
    tax_status: "single",
    tax_dependents: 0,
    
    // Financial Information
    basic_salary: "",
    hourly_rate: "0",
    bank_name: "",
    bank_account: "",
    bank_branch: "",
    
    // Statutory Details
    statutory_details: {
      kra_pin: "",
      nssf_number: "",
      shif_number: "",
      has_disability: false,
      disability_exemption_certificate: "",
      disability_exemption_amount: "",
      has_insurance_relief: false,
      insurance_relief_amount: "",
    },
    
    // Allowances - dynamic array
    allowances: [] as AllowanceDeductionItem[],
    
    // Deductions - dynamic array
    deductions: [] as AllowanceDeductionItem[],
  });

  // Fetch employees for supervisor selection
  useEffect(() => {
    if (open) {
      fetchEmployeesForSupervisorSelection();
      fetchUsersForApproverSelection();
    }
  }, [open]);

  // Populate form with employee data when employee changes
  useEffect(() => {
    if (employee && employee.id) {
      // Format dates for input fields (convert to YYYY-MM-DD format)
      const formatDateForInput = (dateString: string | undefined | null): string => {
        if (!dateString) return "";
        
        try {
          // If it's already in YYYY-MM-DD format, return as is
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
          }
          
          // Handle ISO date strings with time (2023-01-15T00:00:00.000Z)
          if (dateString.includes('T')) {
            return dateString.split('T')[0];
          }
          
          // Try to parse various date formats
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          
          return "";
        } catch (error) {
          return "";
        }
      };

      // Convert allowances to dynamic array format (supports both object and array formats)
      const allowancesArray: AllowanceDeductionItem[] = [];
      if (employee.allowances) {
        if (Array.isArray(employee.allowances)) {
          employee.allowances.forEach((a: any) => {
            allowancesArray.push({ name: a.name || '', amount: String(a.amount || ''), frequency: a.frequency || 'monthly', is_taxable: a.is_taxable !== false });
          });
        } else if (typeof employee.allowances === 'object') {
          Object.entries(employee.allowances).forEach(([key, value]) => {
            allowancesArray.push({ name: key, amount: String(value || ''), frequency: 'monthly', is_taxable: true });
          });
        }
      }

      // Convert deductions to dynamic array format
      const deductionsArray: AllowanceDeductionItem[] = [];
      if (employee.deductions) {
        if (Array.isArray(employee.deductions)) {
          employee.deductions.forEach((d: any) => {
            deductionsArray.push({ name: d.name || '', amount: String(d.amount || ''), frequency: d.frequency || 'monthly', is_taxable: false });
          });
        } else if (typeof employee.deductions === 'object') {
          Object.entries(employee.deductions).forEach(([key, value]) => {
            deductionsArray.push({ name: key, amount: String(value || ''), frequency: 'monthly', is_taxable: false });
          });
        }
      }

      setFormData({
        // Personal Information
        employee_number: employee.employee_number || "",
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        date_of_birth: formatDateForInput(employee.date_of_birth),
        gender: employee.gender || "",
        national_id: employee.national_id || "",
        
        // Address Information
        address: employee.address || "",
        city: employee.city || "",
        state: employee.state || "",
        postal_code: employee.postal_code || "",
        
        // Employment Information
        hire_date: formatDateForInput(employee.hire_date),
        termination_date: formatDateForInput(employee.termination_date),
        employment_type: employee.employment_type || "full_time",
        payment_frequency: employee.payment_frequency || "monthly",
        employment_status: employee.employment_status || (employee.termination_date ? "terminated" : employee.is_active ? "active" : "inactive"),
        department: employee.department || "Information Technology",
        position: employee.position || "",
        supervisor_id: employee.supervisor_id || "",
        leave_approver_id: employee.leave_approver_id || "",
        salary_advance_approver_id: employee.salary_advance_approver_id || "",
        tax_status: "single",
        tax_dependents: 0,
        
        // Financial Information
        basic_salary: employee.basic_salary?.toString() || "",
        hourly_rate: employee.hourly_rate?.toString() || "0",
        bank_name: employee.bank_name || "",
        bank_account: employee.bank_account || "",
        bank_branch: employee.bank_branch || "",
        
        // Statutory Details
        statutory_details: {
          kra_pin: employee.statutory_details?.kra_pin || "",
          nssf_number: employee.statutory_details?.nssf_number || "",
          shif_number: employee.statutory_details?.shif_number || "",
          has_disability: employee.statutory_details?.has_disability || false,
          disability_exemption_certificate: employee.statutory_details?.disability_exemption_certificate?.toString() || "",
          disability_exemption_amount: employee.statutory_details?.disability_exemption_amount?.toString() || "",
          has_insurance_relief: employee.statutory_details?.has_insurance_relief || false,
          insurance_relief_amount: employee.statutory_details?.insurance_relief_amount?.toString() || "",
        },
        
        // Dynamic allowances and deductions
        allowances: allowancesArray,
        deductions: deductionsArray,
      });
    }
  }, [employee]);

  const fetchEmployeesForSupervisorSelection = async () => {
    try {
      setEmployeesLoading(true);
      const response = await employeesApi.getEmployees({ per_page: 100 });
      setEmployees(response.employees || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load employees for supervisor selection.",
        variant: "destructive",
      });
    } finally {
      setEmployeesLoading(false);
    }
  };

  // The currently-assigned approver may no longer hold the permission (e.g.
  // an old assignment predating this restriction) and so won't be in the
  // filtered list below - fall back to the employee's own approver relation
  // so the field doesn't just render blank.
  const getApproverLabel = (
    userId: string,
    list: UserData[],
    fallback?: { first_name: string; last_name: string; email?: string } | null
  ) => {
    const match = list.find((user) => user.id === userId);
    const source = match || fallback;
    if (!source) return "Unknown user";
    return [source.first_name, source.last_name].filter(Boolean).join(" ") || source.email || "Unknown user";
  };

  const fetchUsersForApproverSelection = async () => {
    try {
      const [leaveData, salaryData] = await Promise.all([
        getUsers({ role_scope: "can_approve_leave" }),
        getUsers({ role_scope: "can_approve_salary_changes" }),
      ]);
      setLeaveApprovers(leaveData || []);
      setSalaryApprovers(salaryData || []);
    } catch (error) {
      console.error("Failed to load users for approver selection", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employee?.id) {
      toast({
        title: "Error",
        description: "No employee selected for editing.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // Prepare the payload according to the API requirements
      const payload = {
        employee_number: formData.employee_number.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        date_of_birth: formData.date_of_birth.trim() || undefined,
        gender: formData.gender.trim() || undefined,
        national_id: formData.national_id.trim() || undefined,
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        postal_code: formData.postal_code.trim() || undefined,
        hire_date: formData.hire_date.trim(),
        termination_date: formData.termination_date.trim() || null,
        employment_type: formData.employment_type.trim(),
        payment_frequency: formData.payment_frequency.trim(),
        employment_status: formData.employment_status as "active" | "inactive" | "terminated",
        basic_salary: formData.basic_salary,
        hourly_rate: formData.hourly_rate !== "0" ? formData.hourly_rate : null,
        bank_name: formData.bank_name.trim() || undefined,
        bank_account: formData.bank_account.trim() || undefined,
        bank_branch: formData.bank_branch.trim() || undefined,
        department: formData.department.trim(),
        position: formData.position.trim(),
        supervisor_id: formData.supervisor_id || null,
        leave_approver_id: formData.leave_approver_id || null,
        salary_advance_approver_id: formData.salary_advance_approver_id || null,
        statutory_details: {
          kra_pin: formData.statutory_details.kra_pin?.trim() || null,
          nssf_number: formData.statutory_details.nssf_number?.trim() || null,
          shif_number: formData.statutory_details.shif_number?.trim() || null,
          has_disability: Boolean(formData.statutory_details.has_disability),
          ...(formData.statutory_details.has_disability && {
            disability_exemption_certificate: formData.statutory_details.disability_exemption_certificate?.trim() || "",
            disability_exemption_amount: formData.statutory_details.disability_exemption_amount ? parseFloat(formData.statutory_details.disability_exemption_amount) : 0,
          }),
          has_insurance_relief: Boolean(formData.statutory_details.has_insurance_relief),
          ...(formData.statutory_details.has_insurance_relief && {
            insurance_relief_amount: formData.statutory_details.insurance_relief_amount ? parseFloat(formData.statutory_details.insurance_relief_amount) : 0,
          }),
        },
        allowances: formData.allowances
          .filter(a => a.name.trim())
          .map(a => ({ name: a.name, amount: parseFloat(a.amount) || 0, frequency: a.frequency || 'monthly', is_taxable: a.is_taxable !== false })),
        deductions: formData.deductions
          .filter(d => d.name.trim())
          .map(d => ({ name: d.name, amount: parseFloat(d.amount) || 0, frequency: d.frequency || 'monthly' })),
      };

      console.log('Updating employee with payload:', JSON.stringify(payload, null, 2));
      const response = await employeesApi.updateEmployee(employee.id, payload);
      console.log('Full API response:', JSON.stringify(response, null, 2));
      
      if (response.status === 'success') {
        toast({
          title: "Success",
          description: response.message || "Employee updated successfully.",
        });
        
        onSuccess();
        onOpenChange(false);
      } else {
        console.error('API returned failure:', response);
        
        let errorMessage = "Failed to update employee";
        if (response.message) {
          if (typeof response.message === 'string') {
            errorMessage = response.message;
          } else {
            // Handle validation error object format
            const errorMessages = Object.values(response.message).flat();
            errorMessage = errorMessages.join(', ');
          }
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Employee update error:', error);
      
      // Handle validation errors from ApiValidationError
      if (error.name === 'ApiValidationError' && error.errors) {
        const errorMessages = Object.entries(error.errors).map(([field, messages]) => {
          const fieldMessages = Array.isArray(messages) ? messages : [messages];
          // Clean up field names for better display
          const cleanField = field.replace('statutory_details.', '').replace('_', ' ');
          return `${cleanField}: ${fieldMessages.join(', ')}`;
        });
        
        toast({
          title: "Validation Errors",
          description: errorMessages.join('; '),
          variant: "destructive",
        });
      } else {
        // Fallback for other types of errors
        toast({
          title: "Error",
          description: error.message || "Failed to update employee. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>Edit Employee</SheetTitle>
          <SheetDescription>
            Update the employee details below. Click save when you're done.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Personal Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee_number">Employee Number</Label>
                    <Input
                      id="employee_number"
                      value={formData.employee_number}
                      onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                      placeholder="EMP001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hire_date">Hire Date</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john.doe@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+254712345678"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select 
                      value={formData.gender} 
                      onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="national_id">National ID</Label>
                    <Input
                      id="national_id"
                      value={formData.national_id}
                      onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      placeholder="12345678"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Address Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Main Street, Apartment 4B"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Nairobi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State/County</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="Nairobi County"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      placeholder="00100"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Employment Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Employment Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="employment_type">Employment Type</Label>
                    <Select 
                      value={formData.employment_type} 
                      onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select employment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employment_status">Status</Label>
                    <Select
                      value={formData.employment_status}
                      onValueChange={(value) => setFormData({ ...formData, employment_status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="termination_date">Termination Date</Label>
                    <Input
                      id="termination_date"
                      type="date"
                      value={formData.termination_date}
                      onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select 
                      value={formData.department} 
                      onValueChange={(value) => setFormData({ ...formData, department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Information Technology">Information Technology</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Human Resources">Human Resources</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="Software Developer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supervisor_id">Supervisor</Label>
                    <Select 
                      value={formData.supervisor_id} 
                      onValueChange={(value) => setFormData({ ...formData, supervisor_id: value })}
                      disabled={employeesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeesLoading ? (
                          <SelectItem value="loading" disabled>
                            Loading employees...
                          </SelectItem>
                        ) : (
                          employees
                            .filter((emp) => emp.id !== employee?.id) // Don't allow self-supervision
                            .map((emp) => (
                              <SelectItem key={emp.id} value={emp.id || ""}>
                                {[emp.first_name, emp.last_name].filter(Boolean).join(" ") || "Unnamed Employee"}
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leave_approver_id">Leave Approver</Label>
                    <Popover open={leaveApproverSearchOpen} onOpenChange={setLeaveApproverSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={leaveApproverSearchOpen}
                          className="w-full justify-between font-normal"
                        >
                          {formData.leave_approver_id
                            ? getApproverLabel(formData.leave_approver_id, leaveApprovers, employee?.leave_approver)
                            : "Select leave approver"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search leave approver..." />
                          <CommandList>
                            <CommandEmpty>No user found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="Not assigned"
                                onSelect={() => {
                                  setFormData({ ...formData, leave_approver_id: "" });
                                  setLeaveApproverSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !formData.leave_approver_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Not assigned
                              </CommandItem>
                              {leaveApprovers.map((user) => {
                                const label = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
                                return (
                                  <CommandItem
                                    key={user.id}
                                    value={label}
                                    onSelect={() => {
                                      setFormData({ ...formData, leave_approver_id: user.id });
                                      setLeaveApproverSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.leave_approver_id === user.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {label}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Only GM, Directors, or users explicitly granted leave-approval rights can be picked here.
                    </p>
                    {formData.leave_approver_id && !leaveApprovers.some((u) => u.id === formData.leave_approver_id) && (
                      <p className="text-xs text-amber-600">
                        Current assignee no longer has approval rights - consider reassigning.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary_advance_approver_id">Salary Advance Approver</Label>
                    <Popover open={salaryAdvanceApproverSearchOpen} onOpenChange={setSalaryAdvanceApproverSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={salaryAdvanceApproverSearchOpen}
                          className="w-full justify-between font-normal"
                        >
                          {formData.salary_advance_approver_id
                            ? getApproverLabel(formData.salary_advance_approver_id, salaryApprovers, employee?.salary_advance_approver)
                            : "Select salary advance approver"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search salary advance approver..." />
                          <CommandList>
                            <CommandEmpty>No user found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="Not assigned"
                                onSelect={() => {
                                  setFormData({ ...formData, salary_advance_approver_id: "" });
                                  setSalaryAdvanceApproverSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !formData.salary_advance_approver_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Not assigned
                              </CommandItem>
                              {salaryApprovers.map((user) => {
                                const label = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
                                return (
                                  <CommandItem
                                    key={user.id}
                                    value={label}
                                    onSelect={() => {
                                      setFormData({ ...formData, salary_advance_approver_id: user.id });
                                      setSalaryAdvanceApproverSearchOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.salary_advance_approver_id === user.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {label}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Only GM, Directors, or users explicitly granted salary-approval rights can be picked here.
                    </p>
                    {formData.salary_advance_approver_id && !salaryApprovers.some((u) => u.id === formData.salary_advance_approver_id) && (
                      <p className="text-xs text-amber-600">
                        Current assignee no longer has approval rights - consider reassigning.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Financial Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_frequency">Payment Frequency</Label>
                    <Select
                      value={formData.payment_frequency}
                      onValueChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                      disabled={!canEditSalary}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="basic_salary">Basic Salary</Label>
                    <Input
                      id="basic_salary"
                      type="number"
                      step="0.01"
                      value={formData.basic_salary}
                      onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                      placeholder="50000.00"
                      disabled={!canEditSalary}
                    />
                  </div>
                </div>
                {!canEditSalary && (
                  <p className="text-xs text-muted-foreground">
                    Only GM or Directors can change compensation (payment frequency, salary, allowances, deductions).
                  </p>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kra_pin">KRA PIN</Label>
                    <Input
                      id="kra_pin"
                      value={formData.statutory_details.kra_pin}
                      onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, kra_pin: e.target.value } })}
                      placeholder="A123456789B"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nssf_number">NSSF Number</Label>
                    <Input
                      id="nssf_number"
                      value={formData.statutory_details.nssf_number}
                      onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, nssf_number: e.target.value } })}
                      placeholder="NSSF123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shif_number">SHIF Number</Label>
                    <Input
                      id="shif_number"
                      value={formData.statutory_details.shif_number}
                      onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, shif_number: e.target.value } })}
                      placeholder="SHIF789012"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="Equity Bank"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Bank Account</Label>
                    <Input
                      id="bank_account"
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_branch">Bank Branch</Label>
                    <Input
                      id="bank_branch"
                      value={formData.bank_branch}
                      onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                      placeholder="Westlands Branch"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Statutory Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Statutory Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_disability"
                      checked={formData.statutory_details.has_disability}
                      onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, has_disability: e.target.checked } })}
                    />
                    <Label htmlFor="has_disability">Has Disability</Label>
                  </div>
                  {formData.statutory_details.has_disability && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="disability_exemption_certificate">Disability Exemption Certificate</Label>
                        <Input
                          id="disability_exemption_certificate"
                          value={formData.statutory_details.disability_exemption_certificate}
                          onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, disability_exemption_certificate: e.target.value } })}
                          placeholder="Certificate number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="disability_exemption_amount">Disability Exemption Amount</Label>
                        <Input
                          id="disability_exemption_amount"
                          type="number"
                          step="0.01"
                          value={formData.statutory_details.disability_exemption_amount}
                          onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, disability_exemption_amount: e.target.value } })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_insurance_relief"
                      checked={formData.statutory_details.has_insurance_relief}
                      onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, has_insurance_relief: e.target.checked } })}
                    />
                    <Label htmlFor="has_insurance_relief">Has Insurance Relief</Label>
                  </div>
                  {formData.statutory_details.has_insurance_relief && (
                    <div className="space-y-2">
                      <Label htmlFor="insurance_relief_amount">Insurance Relief Amount (Max 5000)</Label>
                      <Input
                        id="insurance_relief_amount"
                        type="number"
                        step="0.01"
                        max="5000"
                        value={formData.statutory_details.insurance_relief_amount}
                        onChange={(e) => setFormData({ ...formData, statutory_details: { ...formData.statutory_details, insurance_relief_amount: e.target.value } })}
                        placeholder="5000.00"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Allowances Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Allowances
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEditSalary}
                    onClick={() => {
                      setFormData({ ...formData, allowances: [...formData.allowances, { name: "", amount: "", frequency: "monthly", is_taxable: true }] });
                    }}
                  >
                    Add Allowance
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canEditSalary && (
                  <p className="text-xs text-muted-foreground">
                    Only GM or Directors can change allowances.
                  </p>
                )}
                <fieldset disabled={!canEditSalary} className="contents">
                {formData.allowances.length === 0 ? (
                  <p className="text-gray-500 text-sm">No allowances added. Click &quot;Add Allowance&quot; to get started.</p>
                ) : (
                  formData.allowances.map((allowance, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={allowance.name}
                            onChange={(e) => {
                              const updated = [...formData.allowances];
                              updated[index] = { ...updated[index], name: e.target.value };
                              setFormData({ ...formData, allowances: updated });
                            }}
                            placeholder="House Allowance"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amount (KES)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={allowance.amount}
                            onChange={(e) => {
                              const updated = [...formData.allowances];
                              updated[index] = { ...updated[index], amount: e.target.value };
                              setFormData({ ...formData, allowances: updated });
                            }}
                            placeholder="15000"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Frequency</Label>
                          <Select
                            value={allowance.frequency || "monthly"}
                            onValueChange={(val) => {
                              const updated = [...formData.allowances];
                              updated[index] = { ...updated[index], frequency: val };
                              setFormData({ ...formData, allowances: updated });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                              <SelectItem value="one_time">One-time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                            <input
                              type="checkbox"
                              checked={allowance.is_taxable !== false}
                              onChange={(e) => {
                                const updated = [...formData.allowances];
                                updated[index] = { ...updated[index], is_taxable: e.target.checked };
                                setFormData({ ...formData, allowances: updated });
                              }}
                              className="rounded"
                            />
                            Taxable
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 ml-auto"
                            onClick={() => {
                              const updated = formData.allowances.filter((_, i) => i !== index);
                              setFormData({ ...formData, allowances: updated });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                </fieldset>
              </CardContent>
            </Card>

            {/* Deductions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Deductions
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEditSalary}
                    onClick={() => {
                      setFormData({ ...formData, deductions: [...formData.deductions, { name: "", amount: "", frequency: "monthly", is_taxable: false }] });
                    }}
                  >
                    Add Deduction
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!canEditSalary && (
                  <p className="text-xs text-muted-foreground">
                    Only GM or Directors can change deductions.
                  </p>
                )}
                <fieldset disabled={!canEditSalary} className="contents">
                {formData.deductions.length === 0 ? (
                  <p className="text-gray-500 text-sm">No deductions added. Click &quot;Add Deduction&quot; to get started.</p>
                ) : (
                  formData.deductions.map((deduction, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={deduction.name}
                          onChange={(e) => {
                            const updated = [...formData.deductions];
                            updated[index] = { ...updated[index], name: e.target.value };
                            setFormData({ ...formData, deductions: updated });
                          }}
                          placeholder="SACCO Contribution"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (KES)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={deduction.amount}
                          onChange={(e) => {
                            const updated = [...formData.deductions];
                            updated[index] = { ...updated[index], amount: e.target.value };
                            setFormData({ ...formData, deductions: updated });
                          }}
                          placeholder="4000"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="space-y-1 flex-1">
                          <Label className="text-xs">Frequency</Label>
                          <Select
                            value={deduction.frequency || "monthly"}
                            onValueChange={(val) => {
                              const updated = [...formData.deductions];
                              updated[index] = { ...updated[index], frequency: val };
                              setFormData({ ...formData, deductions: updated });
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                              <SelectItem value="one_time">One-time</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            const updated = formData.deductions.filter((_, i) => i !== index);
                            setFormData({ ...formData, deductions: updated });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                  ))
                )}
                </fieldset>
              </CardContent>
            </Card>

          </div>
          
          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
            <SheetFooter className="flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Employee"}
              </Button>
            </SheetFooter>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
