"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Calendar,
  CreditCard,
  ShoppingCart,
  FileText,
  Edit,
  Users
} from "lucide-react";
import { type Customer, getCustomerProfile, type CustomerProfileData } from "@/lib/customers";
import { type Payment } from "@/lib/customers";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { PermissionGuard } from "@/components/PermissionGuard";
import { ApplicationStatusSection } from "@/app/customers/[id]/application-status-section";

interface CustomerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onClose: () => void;
  onRefresh: () => void;
  onEdit?: (customer: Customer) => void;
  onViewAccount?: (customer: Customer) => void;
}

export function CustomerProfileModal({
  open,
  onOpenChange,
  customer,
  onClose,
  onRefresh,
  onEdit,
  onViewAccount,
}: CustomerProfileModalProps) {
  const [customerProfile, setCustomerProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load detailed customer profile when modal opens
  useEffect(() => {
    if (open && customer?.id) {
      setLoading(true);
      setError(null);
      getCustomerProfile(customer.id)
        .then((profile) => {
          setCustomerProfile(profile);
        })
        .catch((error) => {
          console.error('Error fetching customer profile:', error);
          setError("Failed to load customer profile");
        })
        .finally(() => setLoading(false));
    } else if (!open) {
      setCustomerProfile(null);
      setError(null);
    }
  }, [open, customer?.id]);

  const currentCustomer = customerProfile || customer;

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case "lead":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Lead</Badge>;
      case "churned":
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Churned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (!customer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-full">
        <SheetHeader className="border-b border-gray-200 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Customer Profile
          </SheetTitle>
          <SheetDescription>
            {currentCustomer ? `Viewing profile for ${currentCustomer.name}` : "Loading customer details..."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-gray-500">Loading customer profile...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-red-600 font-medium">{error}</div>
                <Button variant="outline" onClick={() => onRefresh()} className="mt-4">
                  Try Again
                </Button>
              </div>
            </div>
          ) : currentCustomer ? (
            <>
              {/* Customer Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={""} alt={currentCustomer.name} />
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                          {getInitials(currentCustomer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-gray-900">{currentCustomer.name}</h3>
                        {currentCustomer.company && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-600">{currentCustomer.company}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(currentCustomer.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Contact Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span>{currentCustomer.email || "No email"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{currentCustomer.phone || "No phone"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address
                      </h4>
                      <div className="text-sm text-gray-600">
                        {[
                          currentCustomer.address,
                          currentCustomer.city,
                          (currentCustomer as any).county,
                          (currentCustomer as any).region,
                          currentCustomer.country,
                          currentCustomer.postal_code
                        ].filter(Boolean).join(", ") || "No address provided"}
                      </div>
                    </div>
                  </div>

                  {/* Company Details - only meaningful when at least one field was captured */}
                  {(currentCustomer as any).trading_name ||
                  (currentCustomer as any).business_type ||
                  (currentCustomer as any).registration_number ||
                  (currentCustomer as any).ppb_license_number ||
                  (currentCustomer as any).website ||
                  (currentCustomer as any).telephone ? (
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Company Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                        {currentCustomer.business_name && <div><span className="text-gray-400">Business Name:</span> {currentCustomer.business_name}</div>}
                        {(currentCustomer as any).trading_name && <div><span className="text-gray-400">Trading Name:</span> {(currentCustomer as any).trading_name}</div>}
                        {(currentCustomer as any).business_type && <div><span className="text-gray-400">Business Type:</span> {(currentCustomer as any).business_type}</div>}
                        {(currentCustomer as any).registration_number && <div><span className="text-gray-400">Registration No.:</span> {(currentCustomer as any).registration_number}</div>}
                        {(currentCustomer as any).ppb_license_number && <div><span className="text-gray-400">PPB License No.:</span> {(currentCustomer as any).ppb_license_number}</div>}
                        {(currentCustomer as any).website && <div><span className="text-gray-400">Website:</span> {(currentCustomer as any).website}</div>}
                        {(currentCustomer as any).telephone && <div><span className="text-gray-400">Telephone:</span> {(currentCustomer as any).telephone}</div>}
                      </div>
                    </div>
                  ) : null}

                  {/* Accounts Contact - separate from the primary contact above */}
                  {(currentCustomer as any).accounts_contact_name || (currentCustomer as any).accounts_contact_email || (currentCustomer as any).accounts_contact_phone ? (
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Accounts Contact
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                        {(currentCustomer as any).accounts_contact_name && <div><span className="text-gray-400">Name:</span> {(currentCustomer as any).accounts_contact_name}</div>}
                        {(currentCustomer as any).accounts_contact_designation && <div><span className="text-gray-400">Designation:</span> {(currentCustomer as any).accounts_contact_designation}</div>}
                        {(currentCustomer as any).accounts_contact_phone && <div><span className="text-gray-400">Phone:</span> {(currentCustomer as any).accounts_contact_phone}</div>}
                        {(currentCustomer as any).accounts_contact_email && <div><span className="text-gray-400">Email:</span> {(currentCustomer as any).accounts_contact_email}</div>}
                      </div>
                    </div>
                  ) : null}

                  {/* Linked credit account - full directors/suppliers/bank-details/credit-terms
                      already live in ViewAccountModal, reused here rather than duplicated */}
                  {currentCustomer.account_id && onViewAccount && (
                    <div className="pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={() => onViewAccount(currentCustomer as Customer)}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        View Credit Account Details
                      </Button>
                    </div>
                  )}

                  {/* Customer Metrics */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[primary]">
                        {customerProfile?.total_orders || customer?.total_orders || 0}
                      </div>
                      <div className="text-xs text-gray-500">Total Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[primary]">
                        KES {(customerProfile?.total_spend || customer?.total_spend || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Total Spend</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-[primary]">
                        {customerProfile?.avg_order_value ? `KES ${customerProfile.avg_order_value.toLocaleString()}` : "N/A"}
                      </div>
                      <div className="text-xs text-gray-500">Avg Order</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credit-approval workflow status (rep-submitted customers only) */}
              <ApplicationStatusSection
                customerId={currentCustomer.id}
                approvalStatus={(currentCustomer as any).approval_status}
                customer={currentCustomer as any}
                onRefresh={() => {
                  if (customer?.id) {
                    getCustomerProfile(customer.id).then((profile) => setCustomerProfile(profile));
                  }
                  onRefresh();
                }}
              />

              {/* Tabs for detailed information */}
              <Tabs defaultValue="orders" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="orders" className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Orders
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payments
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger value="activities" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Activities
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="orders" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Recent Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const orders = customerProfile?.orders || [];
                        return orders.length > 0 ? (
                          <div className="space-y-3">
                            {orders.slice(0, 3).map((order) => (
                              <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                  <div className="font-medium">Order {order.order_number}</div>
                                  <div className="text-sm text-gray-500">
                                    {format(new Date(order.created_at), "MMM dd, yyyy")}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">KES {parseFloat(order.total_amount).toLocaleString()}</div>
                                  <Badge variant="outline" className={`text-xs ${
                                    order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {order.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No orders found</p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Payment History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const payments = customerProfile?.payments || [];
                        return payments.length > 0 ? (
                          <div className="space-y-3">
                            {payments.slice(0, 3).map((payment: Payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div>
                                  <div className="font-medium">Payment for Order {payment.order_id}</div>
                                  <div className="text-sm text-gray-500">
                                    {format(new Date(payment.created_at), "MMM dd, yyyy")}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">KES {parseFloat(payment.amount_paid).toLocaleString()}</div>
                                  <div className="flex gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {payment.payment_method}
                                    </Badge>
                                    <Badge variant="outline" className={`text-xs ${
                                      payment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {payment.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No payments found</p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Customer Notes
                        </CardTitle>
                        <Link href={`/customers/${currentCustomer.id}/statement`}>
                          <Button variant="outline" size="sm">
                            View Statement
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        // The customer's own free-text notes field, plus
                        // actual CustomerNote records (which includes the
                        // auto-generated monthly account statements).
                        const plainNote = customerProfile?.notes;
                        const records = customerProfile?.customer_notes ?? [];

                        if (!plainNote && records.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                              <p>No notes found</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {plainNote && (
                              <div className="p-3 border rounded-lg">
                                <div className="text-sm whitespace-pre-wrap">{plainNote}</div>
                                <div className="text-xs text-gray-500 mt-2">Customer notes</div>
                              </div>
                            )}
                            {records.map((note) => {
                              const isStatement = note.note_content?.startsWith("ACCOUNT STATEMENT")
                              return (
                                <div key={note.id} className="p-3 border rounded-lg">
                                  {isStatement && (
                                    <span className="inline-block mb-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                      Auto-generated statement
                                    </span>
                                  )}
                                  <div className="text-sm whitespace-pre-wrap">{note.note_content}</div>
                                  <div className="text-xs text-gray-500 mt-2">
                                    {note.created_at ? format(new Date(note.created_at), "MMM dd, yyyy 'at' HH:mm") : "Customer note"}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activities" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Recent Activities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customerProfile?.activities && customerProfile.activities.length > 0 ? (
                        <div className="space-y-3">
                          {customerProfile.activities.slice(0, 3).map((activity) => (
                            <div key={activity.id} className="p-3 border rounded-lg">
                              <div className="font-medium">{activity.title}</div>
                              <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                              <div className="text-xs text-gray-500 mt-2">
                                {format(new Date(activity.start_time), "MMM dd, yyyy 'at' HH:mm")}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No activities found</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Failed to load customer details</p>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-gray-200 pt-4">
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <PermissionGuard permissions={["can_update_customers", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <Button onClick={() => onEdit?.(customerProfile as Customer || customer)} className="bg-[primary] hover:bg-[primary]/90">
                <Edit className="mr-2 h-4 w-4" />
                Edit Customer
              </Button>
            </PermissionGuard>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}