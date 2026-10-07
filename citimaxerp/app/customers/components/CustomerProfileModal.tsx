"use client";

import { useState, useEffect, type ReactNode } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Phone,
  Building,
  Calendar,
  CreditCard,
  ShoppingCart,
  FileText,
  Edit,
  Plus,
  Landmark,
  Paperclip,
} from "lucide-react";
import { getDocuments, type Document as CustomerDocument } from "@/lib/documents";
import { type Customer, getCustomerProfile, createCustomerNote, type CustomerProfileData } from "@/lib/customers";
import { type Payment } from "@/lib/customers";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { PermissionGuard } from "@/components/PermissionGuard";
import { ApplicationStatusSection } from "@/app/customers/[id]/application-status-section";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  pharmacy: "Pharmacy",
  hospital_clinic: "Hospital / Clinic",
  distributor: "Distributor",
  ngo: "NGO",
  other: "Other",
};

const titleCase = (v?: string | null) =>
  v ? v.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()) : null;

const formatKes = (v: any) =>
  v === null || v === undefined || v === "" ? null : Number(v).toLocaleString();

function Field({ label, value }: { label: string; value: any }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{" "}
      <span className={empty ? "text-gray-400" : "text-gray-800"}>{empty ? "—" : value}</span>
    </div>
  );
}

function ProfileSection({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 pt-4 border-t first:border-t-0 first:pt-0">
      <h4 className="font-medium text-gray-900 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function ProfileTable({ icon: Icon, title, headers, rows }: { icon: any; title: string; headers: string[]; rows: any[][] }) {
  return (
    <div className="space-y-3 pt-4 border-t">
      <h4 className="font-medium text-gray-900 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">None captured</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium border-b">S/No</th>
                {headers.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-medium border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5">{i + 1}</td>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1.5">{cell || <span className="text-gray-400">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const { toast } = useToast();

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
      getDocuments("customer", customer.id)
        .then(setDocuments)
        .catch(() => setDocuments([]));
    } else if (!open) {
      setCustomerProfile(null);
      setError(null);
      setDocuments([]);
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

  const handleAddNote = async () => {
    if (!noteContent.trim() || !customer?.id) return;
    setAddingNote(true);
    try {
      const newNote = await createCustomerNote(customer.id, noteContent.trim());
      if (customerProfile) {
        setCustomerProfile({
          ...customerProfile,
          customer_notes: [newNote, ...customerProfile.customer_notes],
        });
      }
      setNoteContent("");
      setAddNoteOpen(false);
      toast({ title: "Note added successfully" });
    } catch (err: any) {
      toast({ title: "Failed to add note", description: err.message, variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
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
                  {(() => {
                    const c = currentCustomer as any;
                    const account = c.account;
                    // Approved credit data lives on the linked account; a rep's
                    // still-pending application only exists as this JSON snapshot.
                    const credit = account || c.pending_credit_application || {};
                    const directors: any[] = credit.directors || [];
                    const suppliers: any[] = credit.suppliers || [];
                    const banks: any[] = credit.bank_details || [];
                    const creditDays = account?.credit_days ?? credit.credit_period_required;
                    const hasCredit =
                      c.payment_method === "credit" || !!account || !!c.pending_credit_application;

                    return (
                      <>
                        <ProfileSection icon={Building} title="1. Company Details">
                          <Field label="Customer No." value={c.customer_number} />
                          <Field label="Customer Type" value={titleCase(c.customer_type)} />
                          <Field label="Payment Method" value={titleCase(c.payment_method)} />
                          <Field label="Status" value={titleCase(c.status)} />
                          <Field label="Registered Business Name" value={c.business_name} />
                          <Field label="Trading Name" value={c.trading_name} />
                          <Field label="Type of Business" value={BUSINESS_TYPE_LABELS[c.business_type] || titleCase(c.business_type)} />
                          <Field label="Registration/License No." value={c.registration_number} />
                          <Field label="PPB License No." value={c.ppb_license_number} />
                          <Field label="KRA PIN" value={c.pin_number} />
                          <Field label="Postal Address" value={c.postal_code} />
                          <Field label="Physical Address" value={c.address} />
                          <Field label="Town" value={c.city} />
                          <Field label="County" value={c.county} />
                          <Field label="Region" value={c.region} />
                          <Field label="Country" value={c.country} />
                          <Field label="Telephone" value={c.telephone} />
                          <Field label="Mobile" value={c.phone} />
                          <Field label="Email" value={c.email} />
                          <Field label="Website" value={c.website} />
                        </ProfileSection>

                        <ProfileSection icon={Phone} title="2. Contact Persons">
                          <p className="md:col-span-2 text-xs font-semibold text-gray-700">
                            Primary Contact (Procurement Officer / Pharmacist-in-Charge)
                          </p>
                          <Field label="Name" value={c.contact_person_name} />
                          <Field label="Designation" value={c.contact_person_designation} />
                          <Field label="Phone" value={c.contact_person_phone} />
                          <Field label="Email" value={c.contact_person_email} />
                          <p className="md:col-span-2 text-xs font-semibold text-gray-700 pt-2">Accounts Contact</p>
                          <Field label="Name" value={c.accounts_contact_name} />
                          <Field label="Designation" value={c.accounts_contact_designation} />
                          <Field label="Phone" value={c.accounts_contact_phone} />
                          <Field label="Email" value={c.accounts_contact_email} />
                        </ProfileSection>

                        {hasCredit && (
                          <>
                            <ProfileTable
                              icon={User}
                              title="3. Business Owners / Directors"
                              headers={["Full Name", "ID / Passport No.", "Phone Number", "PIN No."]}
                              rows={directors.map((d) => [d.name, d.id_passport_number, d.phone_number, d.pin])}
                            />
                            <ProfileTable
                              icon={Building}
                              title="4. Trade References (Supplier References)"
                              headers={["Supplier Name", "Contact Person", "Phone Number", "Credit Limit (KES)"]}
                              rows={suppliers.map((s) => [s.name, s.contact_person_name, s.phone_number, formatKes(s.credit_limit)])}
                            />
                            <ProfileTable
                              icon={Landmark}
                              title="5. Bank Details"
                              headers={["Bank Name", "Branch", "Account Name", "Account Number"]}
                              rows={banks.map((b) => [b.bank_name, b.branch, b.account_name, b.account_number])}
                            />
                            <ProfileSection icon={CreditCard} title="6. Credit Terms">
                              {!account && c.pending_credit_application && (
                                <p className="md:col-span-2 text-xs text-amber-700">Pending approval - values as submitted.</p>
                              )}
                              <Field label="Account No." value={account?.account_number} />
                              <Field label="Turnover (KES)" value={formatKes(credit.annual_turnover)} />
                              <Field label="Credit Limit (KES)" value={formatKes(credit.credit_required)} />
                              <Field label="Credit Period (days)" value={creditDays} />
                              <Field label="Credit Period on PD Cheques (days)" value={credit.credit_period_pd_cheque_days} />
                              {account && <Field label="Currently Defaulted" value={account.currently_defaulted === true || account.currently_defaulted === "true" ? "Yes" : "No"} />}
                            </ProfileSection>
                          </>
                        )}

                        <div className="space-y-3 pt-4 border-t">
                          <h4 className="font-medium text-gray-900 flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            Documents
                          </h4>
                          {documents.length === 0 ? (
                            <p className="text-sm text-gray-400">No documents attached</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {documents.map((doc, i) => (
                                <li key={doc.id} className="flex flex-wrap items-center gap-x-3">
                                  <span className="text-gray-400 w-5">{i + 1}.</span>
                                  {doc.document_image ? (
                                    <a href={doc.document_image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                      {doc.document_name}
                                    </a>
                                  ) : (
                                    <span>{doc.document_name}</span>
                                  )}
                                  {doc.reference_number && <span className="text-gray-500">Ref: {doc.reference_number}</span>}
                                  {doc.expiry_date && <span className="text-gray-500">Expires: {format(new Date(doc.expiry_date), "MMM dd, yyyy")}</span>}
                                  {doc.regulatory_body && <span className="text-gray-500">{doc.regulatory_body}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <ProfileSection icon={FileText} title="Notes">
                          <div className="md:col-span-2 whitespace-pre-wrap">{c.notes || <span className="text-gray-400">—</span>}</div>
                        </ProfileSection>
                      </>
                    );
                  })()}

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
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setAddNoteOpen(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Note
                          </Button>
                          <Link href={`/customers/${currentCustomer.id}/statement`}>
                            <Button variant="outline" size="sm">
                              View Statement
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(() => {
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
                              const creatorName = note.creator
                                ? `${note.creator.first_name} ${note.creator.last_name}`
                                : "System"
                              return (
                                <div key={note.id} className="p-3 border rounded-lg">
                                  {isStatement && (
                                    <span className="inline-block mb-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                      Auto-generated statement
                                    </span>
                                  )}
                                  <div className="text-sm whitespace-pre-wrap">{note.note_content}</div>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs font-medium text-gray-600">{creatorName}</span>
                                    <span className="text-xs text-gray-500">
                                      {note.created_at ? format(new Date(note.created_at), "MMM dd, yyyy 'at' HH:mm") : ""}
                                    </span>
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

      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note for {currentCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Enter your note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddNoteOpen(false); setNoteContent(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={addingNote || !noteContent.trim()}>
              {addingNote ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}