"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Building, 
  CreditCard, 
  FileText,
  UserCheck,
  UserX,
  Users
} from "lucide-react";
import { Employee } from "@/lib/employees";

interface EmployeeDetailsSheetProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: Employee) => void;
}

export function EmployeeDetailsSheet({ employee, open, onOpenChange, onEdit }: EmployeeDetailsSheetProps) {
  const [loading, setLoading] = useState(false);

  if (!employee) return null;

  const getStatusBadge = (status: string | undefined) => {
    if (!status) {
      return <Badge variant="secondary">Unknown</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Inactive</Badge>;
      case "terminated":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Terminated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    if (!status) {
      return <Users className="h-4 w-4" />;
    }
    
    switch (status.toLowerCase()) {
      case "active":
        return <UserCheck className="h-4 w-4" />;
      case "inactive":
        return <UserX className="h-4 w-4" />;
      case "terminated":
        return <UserX className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const handleEdit = () => {
    onEdit(employee);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>Employee Details</SheetTitle>
          <SheetDescription>
            Detailed information about {employee.first_name} {employee.last_name}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Personal Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Employee Number</p>
                  <p className="font-medium">{employee.employee_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{employee.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{employee.phone}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Date of Birth</p>
                  <p className="font-medium">
                    {employee.date_of_birth 
                      ? new Date(employee.date_of_birth).toLocaleDateString() 
                      : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium">
                    {employee.gender 
                      ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1).toLowerCase()
                      : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">National ID</p>
                  <p className="font-medium">
                    {employee.national_id || "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">
                    {employee.address || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">City</p>
                  <p className="font-medium">
                    {employee.city || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">State/County</p>
                  <p className="font-medium">
                    {employee.state || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Postal Code</p>
                  <p className="font-medium">
                    {employee.postal_code || "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Employment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Hire Date</p>
                  <p className="font-medium">
                    {employee.hire_date 
                      ? new Date(employee.hire_date).toLocaleDateString() 
                      : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Employment Type</p>
                  <p className="font-medium">
                    {employee.employment_type 
                      ? employee.employment_type.charAt(0).toUpperCase() + employee.employment_type.slice(1).toLowerCase()
                      : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium">{employee.department}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Position</p>
                  <p className="font-medium">{employee.position}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(employee.employment_status || (employee.termination_date ? 'terminated' : employee.is_active ? 'active' : 'inactive'))}
                    {getStatusBadge(employee.employment_status || (employee.termination_date ? 'terminated' : employee.is_active ? 'active' : 'inactive'))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Termination Date</p>
                  <p className="font-medium">
                    {employee.termination_date ? new Date(employee.termination_date).toLocaleDateString() : "Not terminated"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Payment Frequency</p>
                  <p className="font-medium">
                    {employee.payment_frequency 
                      ? employee.payment_frequency.charAt(0).toUpperCase() + employee.payment_frequency.slice(1).toLowerCase()
                      : "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Basic Salary</p>
                  <p className="font-medium">
                    {employee.basic_salary ? `KES ${parseFloat(employee.basic_salary).toLocaleString()}` : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Hourly Rate</p>
                  <p className="font-medium">
                    {employee.hourly_rate 
                      ? `KES ${parseFloat(employee.hourly_rate).toLocaleString()}` 
                      : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">KRA PIN</p>
                  <p className="font-medium">
                    {employee.statutory_details?.kra_pin || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">NSSF Number</p>
                  <p className="font-medium">
                    {employee.statutory_details?.nssf_number || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">SHIF Number</p>
                  <p className="font-medium">
                    {employee.statutory_details?.shif_number || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Bank Name</p>
                  <p className="font-medium">
                    {employee.bank_name || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Bank Account</p>
                  <p className="font-medium">
                    {employee.bank_account || "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Bank Branch</p>
                  <p className="font-medium">
                    {employee.bank_branch || "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statutory Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Statutory Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Has Disability</p>
                  <Badge variant={employee.statutory_details?.has_disability ? "default" : "secondary"}>
                    {employee.statutory_details?.has_disability ? "Yes" : "No"}
                  </Badge>
                </div>
                {employee.statutory_details?.has_disability && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Disability Certificate</p>
                      <p className="font-medium">
                        {employee.statutory_details?.disability_exemption_certificate || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Exemption Amount</p>
                      <p className="font-medium">
                        {employee.statutory_details?.disability_exemption_amount 
                          ? `KES ${employee.statutory_details.disability_exemption_amount.toLocaleString()}` 
                          : "Not provided"}
                      </p>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Has Insurance Relief</p>
                  <Badge variant={employee.statutory_details?.has_insurance_relief ? "default" : "secondary"}>
                    {employee.statutory_details?.has_insurance_relief ? "Yes" : "No"}
                  </Badge>
                </div>
                {employee.statutory_details?.has_insurance_relief && (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Insurance Relief Amount</p>
                    <p className="font-medium">
                      {employee.statutory_details?.insurance_relief_amount 
                        ? `KES ${employee.statutory_details.insurance_relief_amount.toLocaleString()}` 
                        : "Not provided"}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Allowances Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Allowances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employee.allowances && (Array.isArray(employee.allowances) ? employee.allowances.length > 0 : Object.keys(employee.allowances).length > 0) ? (
                <div className="space-y-2">
                  {(Array.isArray(employee.allowances) ? employee.allowances : Object.entries(employee.allowances).map(([k, v]) => ({ name: k, amount: v, frequency: 'monthly', is_taxable: true }))).map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{a.name}</p>
                        <p className="text-xs text-gray-500">
                          {(a.frequency || 'monthly').charAt(0).toUpperCase() + (a.frequency || 'monthly').slice(1).replace('_', '-')}
                          {a.is_taxable === false && ' · Non-taxable'}
                        </p>
                      </div>
                      <p className="font-semibold text-sm">KES {typeof a.amount === 'number' ? a.amount.toLocaleString() : a.amount}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No allowances configured</p>
              )}
            </CardContent>
          </Card>

          {/* Deductions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Deductions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employee.deductions && (Array.isArray(employee.deductions) ? employee.deductions.length > 0 : Object.keys(employee.deductions).length > 0) ? (
                <div className="space-y-2">
                  {(Array.isArray(employee.deductions) ? employee.deductions : Object.entries(employee.deductions).map(([k, v]) => ({ name: k, amount: v, frequency: 'monthly' }))).map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-gray-500">
                          {(d.frequency || 'monthly').charAt(0).toUpperCase() + (d.frequency || 'monthly').slice(1).replace('_', '-')}
                        </p>
                      </div>
                      <p className="font-semibold text-sm">KES {typeof d.amount === 'number' ? d.amount.toLocaleString() : d.amount}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No deductions configured</p>
              )}
            </CardContent>
          </Card>

          {/* Additional Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Termination Date</p>
                  <p className="font-medium">
                    {employee.termination_date 
                      ? new Date(employee.termination_date).toLocaleDateString() 
                      : "Not terminated"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium">
                    {employee.created_at 
                      ? new Date(employee.created_at).toLocaleString() 
                      : "Not provided"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="font-medium">
                    {employee.updated_at 
                      ? new Date(employee.updated_at).toLocaleString() 
                      : "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleEdit}>
              Edit Employee
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
