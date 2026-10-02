"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCustomerDisplayName } from "@/lib/customers";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { updateCustomerAccount, type CustomerAccountWithDetails, type CreateCustomerAccountPayload } from "@/lib/customer-accounts";
import { ApprovalModal } from "./ApprovalModal";
import { getCustomerAccount } from "@/lib/customer-accounts";
import { getDocuments, uploadDocument } from "@/lib/documents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentForm, DocumentData } from "@/app/customers/components/DocumentForm";

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CustomerAccountWithDetails | null;
  onSuccess: () => void;
}

export function EditAccountModal({ open, onOpenChange, account, onSuccess }: EditAccountModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  
  // Form state
  const [customerId, setCustomerId] = useState(account?.customer_id || "");
  const [certificateNumber, setCertificateNumber] = useState(account?.certificate_of_incorporation_number || "");
  const [annualTurnover, setAnnualTurnover] = useState(account?.annual_turnover?.toString() || "");
  const [creditLimit, setCreditLimit] = useState(account?.credit_required?.toString() || "");
  const [creditPeriod, setCreditPeriod] = useState(account?.credit_period_required || "");
  const [currentlyDefaulted, setCurrentlyDefaulted] = useState(account?.currently_defaulted || false);
  const [creditTerms, setCreditTerms] = useState(account?.credit_terms || "");
  const [notes, setNotes] = useState(account?.notes || "");

  // Directors state
  const [directors, setDirectors] = useState(account?.directors.map(d => ({
    name: d.name,
    id_passport_number: d.id_passport_number,
    pin: d.pin || "",
    phone_number: d.phone_number || ""
  })) || [{ name: "", id_passport_number: "", pin: "", phone_number: "" }]);

  // Authorised purchase persons state
  const [authorisedPersons, setAuthorisedPersons] = useState(account?.authorised_purchase_persons.map(p => ({
    name: p.name,
    phone_number: p.phone_number || ""
  })) || [{ name: "", phone_number: "" }]);

  // Suppliers state
  const [suppliers, setSuppliers] = useState(account?.suppliers.map(s => ({
    name: s.name,
    contact_person_name: s.contact_person_name || "",
    phone_number: s.phone_number || "",
    credit_limit: s.credit_limit || ""
  })) || [{ name: "", contact_person_name: "", phone_number: "", credit_limit: "" }]);

  // Bank details state
  const [bankDetails, setBankDetails] = useState(account?.bank_details.map(b => ({
    bank_name: b.bank_name,
    branch: b.branch || "",
    account_number: b.account_number || ""
  })) || [{ bank_name: "", branch: "", account_number: "" }]);

  // Load account data when account prop changes
  useEffect(() => {
    if (account) {
      setCustomerId(account.customer_id);
      setCertificateNumber(account.certificate_of_incorporation_number || "");
      setAnnualTurnover(account.annual_turnover?.toString() || "");
      setCreditLimit(account.credit_required?.toString() || "");
      setCreditPeriod(account.credit_period_required || "");
      setCurrentlyDefaulted(account.currently_defaulted || false);
      setCreditTerms(account.credit_terms || "");
      setNotes(account.notes || "");
      
      setDirectors(account.directors.map(d => ({
        name: d.name,
        id_passport_number: d.id_passport_number,
        pin: d.pin || "",
        phone_number: d.phone_number || ""
      })) || [{ name: "", id_passport_number: "", pin: "", phone_number: "" }]);
      
      setAuthorisedPersons(account.authorised_purchase_persons.map(p => ({
        name: p.name,
        phone_number: p.phone_number || ""
      })) || [{ name: "", phone_number: "" }]);
      
      setSuppliers(account.suppliers.map(s => ({
        name: s.name,
        contact_person_name: s.contact_person_name || "",
        phone_number: s.phone_number || "",
        credit_limit: s.credit_limit || ""
      })) || [{ name: "", contact_person_name: "", phone_number: "", credit_limit: "" }]);

      setBankDetails(account.bank_details.map(b => ({
        bank_name: b.bank_name,
        branch: b.branch || "",
        account_number: b.account_number || ""
      })) || [{ bank_name: "", branch: "", account_number: "" }]);

      // Load existing documents
      loadAccountDocuments(account.id);
    }
  }, [account]);

  const loadAccountDocuments = async (accountId: string) => {
    try {
      const docs = await getDocuments("customer_account", accountId);
      // Convert to DocumentData format
      const formattedDocs = docs.map(doc => ({
        id: doc.id,
        document_name: doc.document_name,
        reference_number: doc.reference_number || undefined,
        expiry_date: doc.expiry_date || undefined,
        regulatory_body: doc.regulatory_body || undefined,
        other_information: doc.other_information || undefined,
        document_image: doc.document_image || undefined,
      }));
      setDocuments(formattedDocs);
    } catch (error) {
      console.error("Failed to load account documents:", error);
      setDocuments([]);
    }
  };

  // Fetch full account data if only partial data is provided
  useEffect(() => {
    const fetchAccountData = async () => {
      if (open && account && !account.directors) {
        setLoadingAccount(true);
        try {
          const fullAccount = await getCustomerAccount(account.id);
          if (fullAccount) {
            setCustomerId(fullAccount.customer_id);
            setCertificateNumber(fullAccount.certificate_of_incorporation_number || "");
            setAnnualTurnover(fullAccount.annual_turnover?.toString() || "");
            setCreditLimit(fullAccount.credit_required?.toString() || "");
            setCreditPeriod(fullAccount.credit_period_required || "");
            setCurrentlyDefaulted(fullAccount.currently_defaulted || false);
            setCreditTerms(fullAccount.credit_terms || "");
            setNotes(fullAccount.notes || "");
            
            setDirectors(fullAccount.directors.map(d => ({
              name: d.name,
              id_passport_number: d.id_passport_number,
              pin: d.pin || "",
              phone_number: d.phone_number || ""
            })) || [{ name: "", id_passport_number: "", pin: "", phone_number: "" }]);
            
            setAuthorisedPersons(fullAccount.authorised_purchase_persons.map(p => ({
              name: p.name,
              phone_number: p.phone_number || ""
            })) || [{ name: "", phone_number: "" }]);
            
            setSuppliers(fullAccount.suppliers.map(s => ({
              name: s.name,
              contact_person_name: s.contact_person_name || "",
              phone_number: s.phone_number || "",
              credit_limit: s.credit_limit || ""
            })) || [{ name: "", contact_person_name: "", phone_number: "", credit_limit: "" }]);
            
            setBankDetails(fullAccount.bank_details.map(b => ({
              bank_name: b.bank_name,
              branch: b.branch || "",
              account_number: b.account_number || ""
            })) || [{ bank_name: "", branch: "", account_number: "" }]);
            
            // Load existing documents
            loadAccountDocuments(fullAccount.id);
          }
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to load account details",
            variant: "destructive",
          });
        } finally {
          setLoadingAccount(false);
        }
      }
    };

    fetchAccountData();
  }, [open, account, toast]);

  const handleSubmit = async () => {
    if (!account) return;
    
    // All fields are optional when updating a customer account
    // However, if arrays are provided, certain nested fields become required
    
    // Validate directors if any are provided
    const hasDirectors = directors.some(d => d.name || d.id_passport_number || d.pin || d.phone_number);
    if (hasDirectors) {
      for (let i = 0; i < directors.length; i++) {
        const director = directors[i];
        // If any field is filled, name and id_passport_number are required
        if (director.name || director.id_passport_number || director.pin || director.phone_number) {
          if (!director.name.trim()) {
            toast({
              title: "Validation Error",
              description: `Director ${i + 1}: Name is required`,
              variant: "destructive",
            });
            return;
          }
          if (!director.id_passport_number.trim()) {
            toast({
              title: "Validation Error",
              description: `Director ${i + 1}: ID/Passport number is required`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    // Validate authorised purchase persons if any are provided
    const hasAuthorisedPersons = authorisedPersons.some(p => p.name || p.phone_number);
    if (hasAuthorisedPersons) {
      for (let i = 0; i < authorisedPersons.length; i++) {
        const person = authorisedPersons[i];
        // If any field is filled, name is required
        if (person.name || person.phone_number) {
          if (!person.name.trim()) {
            toast({
              title: "Validation Error",
              description: `Authorised Person ${i + 1}: Name is required`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    // Validate suppliers if any are provided
    const hasSuppliers = suppliers.some(s => s.name || s.contact_person_name || s.phone_number || s.credit_limit);
    if (hasSuppliers) {
      for (let i = 0; i < suppliers.length; i++) {
        const supplier = suppliers[i];
        // If any field is filled, name is required
        if (supplier.name || supplier.contact_person_name || supplier.phone_number || supplier.credit_limit) {
          if (!supplier.name.trim()) {
            toast({
              title: "Validation Error",
              description: `Supplier ${i + 1}: Name is required`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    // Validate bank details if any are provided
    const hasBankDetails = bankDetails.some(b => b.bank_name || b.branch || b.account_number);
    if (hasBankDetails) {
      for (let i = 0; i < bankDetails.length; i++) {
        const bank = bankDetails[i];
        // If any field is filled, bank_name is required
        if (bank.bank_name || bank.branch || bank.account_number) {
          if (!bank.bank_name.trim()) {
            toast({
              title: "Validation Error",
              description: `Bank Detail ${i + 1}: Bank name is required`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    // Validate documents if any are added
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc.document_name.trim()) {
        toast({
          title: "Validation Error",
          description: `Document ${i + 1} name is required`,
          variant: "destructive",
        });
        return;
      }
      
      // For new documents, file is required
      if (!doc.id && !doc.file) {
        toast({
          title: "Validation Error",
          description: `Document ${i + 1} file is required`,
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      // Prepare payload
      const payload: Partial<Omit<CustomerAccountWithDetails, "id" | "created_at" | "updated_at">> = {
        customer_id: customerId,
        certificate_of_incorporation_number: certificateNumber || null,
        annual_turnover: annualTurnover ? annualTurnover.toString() : null,
        credit_required: creditLimit ? creditLimit.toString() : null,
        credit_period_required: creditPeriod || null,
        currently_defaulted: currentlyDefaulted,
        credit_terms: creditTerms || null,
        notes: notes || null,
        // Include documents in the payload (only for existing documents)
        documents: documents
          .filter(doc => doc.id) // Only include existing documents
          .map(doc => ({
            id: doc.id!,
            document_name: doc.document_name,
            reference_number: doc.reference_number || null,
            expiry_date: doc.expiry_date || null,
            regulatory_body: doc.regulatory_body || null,
            other_information: doc.other_information || null
          }))
        // Note: We're not including the related entities (directors, authorised_purchase_persons, etc.)
        // in the update payload as they would need separate API endpoints for update
      };

      await updateCustomerAccount(account.id, payload);
      
      // Upload new documents
      await uploadAccountDocuments(account.id);
      
      toast({
        title: "Success",
        description: "Customer account updated successfully.",
      });
      
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer account",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadAccountDocuments = async (accountId: string) => {
    try {
      // Filter documents that have files (new documents)
      const newDocuments = documents.filter(doc => doc.file && !doc.id);
      
      // Upload each new document
      for (const doc of newDocuments) {
        if (doc.file) {
          // Get company ID from localStorage
          const companyId = localStorage.getItem("companyId") || "";
          
          if (!companyId) {
            throw new Error("Company ID is missing");
          }
          
          // Prepare document data for upload
          const documentData = {
            document_name: doc.document_name,
            reference_number: doc.reference_number || undefined,
            expiry_date: doc.expiry_date || undefined,
            regulatory_body: doc.regulatory_body || undefined,
            other_information: doc.other_information || undefined,
            documentable_type: "customer_account",
            documentable_id: accountId,
            document_image: doc.file,
            company_id: companyId,
          };
          
          // Upload the document
          await uploadDocument(documentData as any);
        }
      }
    } catch (error) {
      console.error("Failed to upload account documents:", error);
      throw new Error("Failed to upload account documents");
    }
  };

  // Director handlers
  const addDirector = () => {
    setDirectors([...directors, { name: "", id_passport_number: "", pin: "", phone_number: "" }]);
  };

  const removeDirector = (index: number) => {
    if (directors.length > 1) {
      setDirectors(directors.filter((_, i) => i !== index));
    }
  };

  const updateDirector = (index: number, field: string, value: string) => {
    const updatedDirectors = [...directors];
    updatedDirectors[index] = { ...updatedDirectors[index], [field]: value };
    setDirectors(updatedDirectors);
  };

  // Authorised person handlers
  const addAuthorisedPerson = () => {
    setAuthorisedPersons([...authorisedPersons, { name: "", phone_number: "" }]);
  };

  const removeAuthorisedPerson = (index: number) => {
    if (authorisedPersons.length > 1) {
      setAuthorisedPersons(authorisedPersons.filter((_, i) => i !== index));
    }
  };

  const updateAuthorisedPerson = (index: number, field: string, value: string) => {
    const updatedPersons = [...authorisedPersons];
    updatedPersons[index] = { ...updatedPersons[index], [field]: value };
    setAuthorisedPersons(updatedPersons);
  };

  // Supplier handlers
  const addSupplier = () => {
    setSuppliers([...suppliers, { name: "", contact_person_name: "", phone_number: "", credit_limit: "" }]);
  };

  const removeSupplier = (index: number) => {
    if (suppliers.length > 1) {
      setSuppliers(suppliers.filter((_, i) => i !== index));
    }
  };

  const updateSupplier = (index: number, field: string, value: string) => {
    const updatedSuppliers = [...suppliers];
    updatedSuppliers[index] = { ...updatedSuppliers[index], [field]: value };
    setSuppliers(updatedSuppliers);
  };

  // Bank detail handlers
  const addBankDetail = () => {
    setBankDetails([...bankDetails, { bank_name: "", branch: "", account_number: "" }]);
  };

  const removeBankDetail = (index: number) => {
    if (bankDetails.length > 1) {
      setBankDetails(bankDetails.filter((_, i) => i !== index));
    }
  };

  const updateBankDetail = (index: number, field: string, value: string) => {
    const updatedBankDetails = [...bankDetails];
    updatedBankDetails[index] = { ...updatedBankDetails[index], [field]: value };
    setBankDetails(updatedBankDetails);
  };

  // Approval handlers
  const handleApprovalSuccess = () => {
    onSuccess();
  };

  const openApprovalModal = (action: "approve" | "reject") => {
    setApprovalAction(action);
    setApprovalModalOpen(true);
  };

  const canApproveOrReject = account?.approval_status !== "approved" && !account?.is_approved;

  if (!account) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl flex flex-col h-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-blue-600"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Edit Account
          </SheetTitle>
          <SheetDescription>
            Update customer account information
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 py-6">
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Input
                id="customer"
                value={`${account.customer ? getCustomerDisplayName(account.customer) : ''} (${account.customer?.email || 'No email'})`}
                disabled
              />
            </div>
            
            {/* Basic Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Account Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="account-number">Account Number</Label>
                  <Input
                    id="account-number"
                    value={account.account_number}
                    disabled
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="certificate-number">Certificate of Incorporation Number</Label>
                  <Input
                    id="certificate-number"
                    value={certificateNumber}
                    onChange={(e) => setCertificateNumber(e.target.value)}
                    placeholder="C123456"
                    disabled={isSubmitting || loadingAccount}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="annual-turnover">Annual Turnover (KES)</Label>
                  <Input
                    id="annual-turnover"
                    type="number"
                    value={annualTurnover}
                    onChange={(e) => setAnnualTurnover(e.target.value)}
                    placeholder="1000000"
                    disabled={isSubmitting || loadingAccount}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="credit-limit">Credit Limit (KES)</Label>
                  <Input
                    id="credit-limit"
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="50000"
                    disabled={true}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="credit-period">Credit Period</Label>
                  <Input
                    id="credit-period"
                    value={creditPeriod}
                    onChange={(e) => setCreditPeriod(e.target.value)}
                    placeholder="30 days"
                    disabled={isSubmitting || loadingAccount}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="currently-defaulted"
                    checked={currentlyDefaulted}
                    onChange={(e) => setCurrentlyDefaulted(e.target.checked)}
                    disabled={isSubmitting || loadingAccount}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="currently-defaulted">Currently Defaulted</Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="credit-terms">Credit Terms</Label>
                <Input
                  id="credit-terms"
                  value={creditTerms}
                  onChange={(e) => setCreditTerms(e.target.value)}
                  placeholder="Net 30"
                  disabled={isSubmitting || loadingAccount}
                />
              </div>
            </div>
            
            {/* Directors */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Directors (Optional)</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addDirector}
                  disabled={isSubmitting || loadingAccount}
                  size="sm"
                >
                  Add Director
                </Button>
              </div>
              
              {directors.map((director, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor={`director-name-${index}`}>Name *</Label>
                    <Input
                      id={`director-name-${index}`}
                      value={director.name}
                      onChange={(e) => updateDirector(index, 'name', e.target.value)}
                      placeholder="John Doe"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`director-id-${index}`}>ID/Passport Number *</Label>
                    <Input
                      id={`director-id-${index}`}
                      value={director.id_passport_number}
                      onChange={(e) => updateDirector(index, 'id_passport_number', e.target.value)}
                      placeholder="A1234567"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`director-pin-${index}`}>PIN</Label>
                    <Input
                      id={`director-pin-${index}`}
                      value={director.pin}
                      onChange={(e) => updateDirector(index, 'pin', e.target.value)}
                      placeholder="D123456"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`director-phone-${index}`}>Phone Number</Label>
                    <Input
                      id={`director-phone-${index}`}
                      value={director.phone_number}
                      onChange={(e) => updateDirector(index, 'phone_number', e.target.value)}
                      placeholder="0712345678"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  {directors.length > 1 && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeDirector(index)}
                        disabled={isSubmitting || loadingAccount}
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-600/10"
                      >
                        Remove Director
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Authorised Purchase Persons */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Authorised Purchase Persons (Optional)</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addAuthorisedPerson}
                  disabled={isSubmitting || loadingAccount}
                  size="sm"
                >
                  Add Person
                </Button>
              </div>
              
              {authorisedPersons.map((person, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor={`person-name-${index}`}>Name *</Label>
                    <Input
                      id={`person-name-${index}`}
                      value={person.name}
                      onChange={(e) => updateAuthorisedPerson(index, 'name', e.target.value)}
                      placeholder="Jane Smith"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`person-phone-${index}`}>Phone Number</Label>
                    <Input
                      id={`person-phone-${index}`}
                      value={person.phone_number}
                      onChange={(e) => updateAuthorisedPerson(index, 'phone_number', e.target.value)}
                      placeholder="0723456789"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  {authorisedPersons.length > 1 && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeAuthorisedPerson(index)}
                        disabled={isSubmitting || loadingAccount}
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-600/10"
                      >
                        Remove Person
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Suppliers */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Suppliers (Optional)</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addSupplier}
                  disabled={isSubmitting || loadingAccount}
                  size="sm"
                >
                  Add Supplier
                </Button>
              </div>
              
              {suppliers.map((supplier, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor={`supplier-name-${index}`}>Name *</Label>
                    <Input
                      id={`supplier-name-${index}`}
                      value={supplier.name}
                      onChange={(e) => updateSupplier(index, 'name', e.target.value)}
                      placeholder="Supplier Inc"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`supplier-contact-${index}`}>Contact Person</Label>
                    <Input
                      id={`supplier-contact-${index}`}
                      value={supplier.contact_person_name}
                      onChange={(e) => updateSupplier(index, 'contact_person_name', e.target.value)}
                      placeholder="Mike Brown"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`supplier-phone-${index}`}>Phone Number</Label>
                    <Input
                      id={`supplier-phone-${index}`}
                      value={supplier.phone_number}
                      onChange={(e) => updateSupplier(index, 'phone_number', e.target.value)}
                      placeholder="0734567890"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`supplier-credit-${index}`}>Credit Limit (KES)</Label>
                    <Input
                      id={`supplier-credit-${index}`}
                      type="number"
                      value={supplier.credit_limit}
                      onChange={(e) => updateSupplier(index, 'credit_limit', e.target.value)}
                      placeholder="20000"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  {suppliers.length > 1 && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeSupplier(index)}
                        disabled={isSubmitting || loadingAccount}
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-600/10"
                      >
                        Remove Supplier
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Bank Details */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Bank Account Details (Optional)</h3>
                <Button type="button" variant="outline" onClick={addBankDetail}>
                  Add Bank Account
                </Button>
              </div>
              
              {bankDetails.map((bank, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor={`bank-name-${index}`}>Bank Name *</Label>
                    <Input
                      id={`bank-name-${index}`}
                      value={bank.bank_name}
                      onChange={(e) => updateBankDetail(index, 'bank_name', e.target.value)}
                      placeholder="Bank of Africa"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`bank-branch-${index}`}>Branch</Label>
                    <Input
                      id={`bank-branch-${index}`}
                      value={bank.branch}
                      onChange={(e) => updateBankDetail(index, 'branch', e.target.value)}
                      placeholder="Westlands"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`bank-account-${index}`}>Account Number</Label>
                    <Input
                      id={`bank-account-${index}`}
                      value={bank.account_number}
                      onChange={(e) => updateBankDetail(index, 'account_number', e.target.value)}
                      placeholder="1234567890"
                      disabled={isSubmitting || loadingAccount}
                    />
                  </div>
                  
                  {bankDetails.length > 1 && (
                    <div className="md:col-span-3 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeBankDetail(index)}
                        disabled={isSubmitting || loadingAccount}
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-600/10"
                      >
                        Remove Bank Detail
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Document Upload */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Documents (Optional)</h3>
              <DocumentForm 
                documents={documents} 
                onChange={setDocuments} 
              />
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Notes</h3>
              <Textarea
                placeholder="Additional notes about this account..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </ScrollArea>
        
        <SheetFooter>
          <div className="flex justify-between w-full">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting || loadingAccount}
              >
                Cancel
              </Button>
            </div>
            
            <div className="flex gap-2">
              {canApproveOrReject && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => openApprovalModal("reject")}
                    disabled={isSubmitting || loadingAccount}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => openApprovalModal("approve")}
                    disabled={isSubmitting || loadingAccount}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || loadingAccount}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Account"
                )}
              </Button>
            </div>
          </div>
        </SheetFooter>
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
