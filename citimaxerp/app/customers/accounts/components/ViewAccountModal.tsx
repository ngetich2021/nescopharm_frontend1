"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCustomerDisplayName } from "@/lib/customers";
import { 
  CreditCard, 
  Calendar, 
  User, 
  Building, 
  Phone, 
  Mail,
  MapPin,
  FileText,
  CheckCircle,
  XCircle
} from "lucide-react";
import { type CustomerAccountWithDetails } from "@/lib/customer-accounts";
import { ApprovalModal } from "./ApprovalModal";

interface ViewAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CustomerAccountWithDetails | null;
  onRefresh?: () => void;
}

export function ViewAccountModal({ open, onOpenChange, account, onRefresh }: ViewAccountModalProps) {
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");

  if (!account) return null;

  const handleApprovalSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const openApprovalModal = (action: "approve" | "reject") => {
    setApprovalAction(action);
    setApprovalModalOpen(true);
  };

  const canApproveOrReject = account.approval_status !== "approved" && !account.is_approved;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "draft":
        return <Badge className="bg-blue-100 text-blue-800">Draft</Badge>;
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
    }
  };

  // Format currency values
  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) return "N/A";
    const num = parseFloat(amount);
    return isNaN(num) ? "N/A" : `KES ${num.toLocaleString()}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Account Details
          </SheetTitle>
          <SheetDescription>
            View detailed information about this customer account
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 py-6">
          <div className="space-y-6">
            {/* Account Summary Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-blue-900">Account Summary</h3>
                {getStatusBadge(account.approval_status || "unknown")}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Account Number</p>
                  <p className="text-lg font-bold text-blue-900">{account.account_number}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Credit Limit</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(account.credit_required)}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Current Balance</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(account.current_balance)}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Credit Period</p>
                  <p className="text-lg font-bold text-gray-900">
                    {account.credit_days
                      ? `${account.credit_days} days`
                      : account.credit_period_required || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Customer Name</p>
                  <p className="font-medium">
                    {account.customer ? getCustomerDisplayName(account.customer) : "N/A"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Customer Number</p>
                  <p className="font-medium">{account.customer?.customer_number || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{account.customer?.email || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{account.customer?.phone || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Customer Type</p>
                  <p className="font-medium">
                    {account.customer?.customer_type === "company" ? "Company" : "Individual"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Customer Status</p>
                  <div>{getStatusBadge(account.customer?.status || "unknown")}</div>
                </div>
                {account.customer?.business_name && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Business Name</p>
                    <p className="font-medium">{account.customer.business_name}</p>
                  </div>
                )}
                {account.customer?.nature_of_business && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Nature of Business</p>
                    <p className="font-medium">{account.customer.nature_of_business}</p>
                  </div>
                )}
                {account.customer?.pin_number && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">PIN Number</p>
                    <p className="font-medium">{account.customer.pin_number}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{account.customer?.payment_method || "N/A"}</p>
                </div>
                {account.customer?.contact_person_name && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Contact Person</p>
                      <p className="font-medium">{account.customer.contact_person_name}</p>
                    </div>
                    {account.customer?.contact_person_phone && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Contact Person Phone</p>
                        <p className="font-medium">{account.customer.contact_person_phone}</p>
                      </div>
                    )}
                    {account.customer?.contact_person_email && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Contact Person Email</p>
                        <p className="font-medium">{account.customer.contact_person_email}</p>
                      </div>
                    )}
                  </>
                )}
                {account.customer?.state && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">State/Region</p>
                    <p className="font-medium">{account.customer.state}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="font-medium">{account.customer?.total_orders || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Spend</p>
                  <p className="font-medium">{formatCurrency(account.customer?.total_spend)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Loyalty Points</p>
                  <p className="font-medium">{account.customer?.loyalty_points || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Preferred Communication</p>
                  <p className="font-medium">{account.customer?.preferred_communication_channel || "N/A"}</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Account Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Account Details
              </h3>
              <div className="space-y-3">
                {account.credit_terms && (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Credit Terms</p>
                    <p className="font-medium">{account.credit_terms}</p>
                  </div>
                )}
                {account.credit_period_pd_cheque_days ? (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Credit Period (PD Cheques)</p>
                    <p className="font-medium">{account.credit_period_pd_cheque_days} days</p>
                  </div>
                ) : null}
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Currently Defaulted</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${account.currently_defaulted ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <p className={`font-medium ${account.currently_defaulted ? 'text-red-600' : 'text-green-600'}`}>
                      {account.currently_defaulted ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Account Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${account.is_approved ? 'bg-green-500' : account.is_rejected ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                    <p className="font-medium">
                      {account.is_approved ? "Approved" : account.is_rejected ? "Rejected" : "Pending"}
                    </p>
                  </div>
                </div>
                {account.workflow_instance_id && (
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Workflow Instance</p>
                    <p className="font-medium text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                      {account.workflow_instance_id}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Company Information - Only show if there's data */}
            {(account.certificate_of_incorporation_number || account.annual_turnover || account.company_type) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    Company Information
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="space-y-4">
                      {account.company_type && (
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Company Type</p>
                          <p className="font-medium">{account.company_type}</p>
                        </div>
                      )}
                      {account.certificate_of_incorporation_number && (
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Certificate of Incorporation</p>
                          <p className="font-medium">{account.certificate_of_incorporation_number}</p>
                        </div>
                      )}
                      {account.annual_turnover && (
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">Annual Turnover</p>
                          <p className="font-semibold text-green-600">{formatCurrency(account.annual_turnover)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Directors */}
            {account.directors && account.directors.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Directors ({account.directors.length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="space-y-0">
                      {account.directors.map((director, index) => (
                        <div key={director.id} className={`p-4 ${index !== account.directors.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <h4 className="font-semibold text-gray-800 mb-3">{director.name}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <p className="text-sm text-muted-foreground">ID/Passport</p>
                              <p className="font-medium">{director.id_passport_number}</p>
                            </div>
                            {director.pin && (
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">PIN</p>
                                <p className="font-medium">{director.pin}</p>
                              </div>
                            )}
                            {director.phone_number && (
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Phone</p>
                                <p className="font-medium">{director.phone_number}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Authorised Purchase Persons */}
            {account.authorised_purchase_persons && account.authorised_purchase_persons.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Authorised Purchase Persons ({account.authorised_purchase_persons.length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="space-y-0">
                      {account.authorised_purchase_persons.map((person, index) => (
                        <div key={person.id} className={`p-4 ${index !== account.authorised_purchase_persons.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">Name</p>
                              <p className="font-semibold">{person.name}</p>
                            </div>
                            {person.phone_number && (
                              <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Phone</p>
                                <p className="font-medium">{person.phone_number}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Suppliers */}
            {account.suppliers && account.suppliers.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Building className="h-5 w-5 text-blue-600" />
                    Associated Suppliers ({account.suppliers.length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="space-y-0">
                      {account.suppliers.map((supplier, index) => (
                        <div key={supplier.id} className={`p-4 ${index !== account.suppliers.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-semibold">{supplier.name}</h4>
                            {supplier.credit_limit && (
                              <Badge variant="outline">
                                {formatCurrency(supplier.credit_limit)}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-3">
                            {supplier.contact_person_name && (
                              <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Contact Person</p>
                                <p className="font-medium">{supplier.contact_person_name}</p>
                              </div>
                            )}
                            {supplier.phone_number && (
                              <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Phone</p>
                                <p className="font-medium">{supplier.phone_number}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Bank Details */}
            {account.bank_details && account.bank_details.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Banking Information ({account.bank_details.length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="space-y-0">
                      {account.bank_details.map((bank, index) => (
                        <div key={bank.id} className={`p-4 ${index !== account.bank_details.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <h4 className="font-semibold mb-3">{bank.bank_name}</h4>
                          <div className="space-y-3">
                            {bank.branch && (
                              <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Branch</p>
                                <p className="font-medium">{bank.branch}</p>
                              </div>
                            )}
                            {bank.account_number && (
                              <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">Account Number</p>
                                <p className="font-medium font-mono">{bank.account_number}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Approvals */}
            {account.approvals && account.approvals.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Approvals ({account.approvals.length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="space-y-0">
                      {account.approvals
                        .sort((a, b) => new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime())
                        .map((approval, index) => (
                        <div key={approval.id} className={`p-4 ${index !== (account.approvals?.length || 0) - 1 ? 'border-b border-gray-100' : ''}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge 
                                className={
                                  approval.status === "approved" 
                                    ? "bg-green-100 text-green-800" 
                                    : approval.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }
                              >
                                {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
                              </Badge>
                              <Badge variant="outline">
                                {approval.approval_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Badge>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-muted-foreground">by {approval.approver?.full_name || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(approval.approved_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          
                          {approval.notes && (
                            <p className="text-sm text-muted-foreground mb-2">{approval.notes}</p>
                          )}
                          
                          {approval.approval_type === "credit_limit_update" && (
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-sm font-medium mb-1">Credit Limit Change:</p>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">
                                  {formatCurrency(approval.previous_credit_limit)}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium text-green-600">
                                  {formatCurrency(approval.new_credit_limit)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Documents */}
            {account.documents && account.documents.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Documents ({account.documents.length})
                  </h3>
                  <div className="space-y-3">
                    {account.documents.map((document) => (
                      <div key={document.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">Document Name</p>
                            <p className="font-medium">{document.document_name}</p>
                          </div>
                          {document.reference_number && (
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">Reference Number</p>
                              <p className="font-medium">{document.reference_number}</p>
                            </div>
                          )}
                          {document.expiry_date && (
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">Expiry Date</p>
                              <p className="font-medium">{new Date(document.expiry_date).toLocaleDateString()}</p>
                            </div>
                          )}
                          {document.regulatory_body && (
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">Regulatory Body</p>
                              <p className="font-medium">{document.regulatory_body}</p>
                            </div>
                          )}
                          {document.other_information && (
                            <div className="flex justify-between items-start">
                              <p className="text-sm text-muted-foreground">Other Information</p>
                              <p className="font-medium text-right max-w-xs">{document.other_information}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {/* Notes */}
            {account.notes && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Notes
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-700">{account.notes}</p>
                  </div>
                </div>
              </>
            )}
            
            <Separator />
            
            {/* Account Timeline */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Account Timeline
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(account.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{new Date(account.updated_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        {canApproveOrReject && (
          <SheetFooter className="border-t border-gray-200 pt-4">
            <div className="flex justify-end gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => openApprovalModal("reject")}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Account
              </Button>
              <Button
                onClick={() => openApprovalModal("approve")}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Account
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>

      {/* Approval Modal */}
      <ApprovalModal
        open={approvalModalOpen}
        onOpenChange={setApprovalModalOpen}
        account={account}
        action={approvalAction}
        onSuccess={handleApprovalSuccess}
      />
    </Sheet>
  );
}