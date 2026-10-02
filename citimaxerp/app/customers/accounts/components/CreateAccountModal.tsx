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
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { createCustomerAccount, type CreateCustomerAccountPayload } from "@/lib/customer-accounts";
import { getCustomers, type Customer, getCustomerDisplayName } from "@/lib/customers";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

import { DocumentForm, DocumentData } from "@/app/customers/components/DocumentForm";
import { uploadDocument } from "@/lib/documents";

interface CreateAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateAccountModal({ open, onOpenChange, onSuccess }: CreateAccountModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  
  // Form state
  const [customerId, setCustomerId] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [creditPeriod, setCreditPeriod] = useState("");
  const [currentlyDefaulted, setCurrentlyDefaulted] = useState(false);
  const [creditTerms, setCreditTerms] = useState("");
  const [notes, setNotes] = useState("");

  // Directors state
  const [directors, setDirectors] = useState([
    { name: "", id_passport_number: "", pin: "", phone_number: "" }
  ]);

  // Authorised purchase persons state
  const [authorisedPersons, setAuthorisedPersons] = useState([
    { name: "", phone_number: "" }
  ]);

  // Suppliers state
  const [suppliers, setSuppliers] = useState([
    { name: "", contact_person_name: "", phone_number: "", credit_limit: "" }
  ]);

  // Bank details state
  const [bankDetails, setBankDetails] = useState([
    { bank_name: "", branch: "", account_number: "" }
  ]);

  // Fetch customers for dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      if (open) {
        setLoadingCustomers(true);
        try {
          const data = await getCustomers();
          setCustomers(data);
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to load customers",
            variant: "destructive",
          });
        } finally {
          setLoadingCustomers(false);
        }
      }
    };

    fetchCustomers();
  }, [open, toast]);

  const resetForm = () => {
    setCustomerId("");
    setCertificateNumber("");
    setAnnualTurnover("");
    setCreditLimit("");
    setCreditPeriod("");
    setCurrentlyDefaulted(false);
    setCreditTerms("");
    setNotes("");
    setDirectors([{ name: "", id_passport_number: "", pin: "", phone_number: "" }]);
    setAuthorisedPersons([{ name: "", phone_number: "" }]);
    setSuppliers([{ name: "", contact_person_name: "", phone_number: "", credit_limit: "" }]);
    setBankDetails([{ bank_name: "", branch: "", account_number: "" }]);
    setDocuments([]);
  };

  const handleSubmit = async () => {
    // Only customer_id is required for creating a customer account
    if (!customerId.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer is required",
        variant: "destructive",
      });
      return;
    }
    
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
      const payload: CreateCustomerAccountPayload = {
        customer_id: customerId,
        certificate_of_incorporation_number: certificateNumber || null,
        annual_turnover: annualTurnover ? parseFloat(annualTurnover) : null,
        credit_required: creditLimit ? parseFloat(creditLimit) : null,
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
          })),
        directors: directors.map(director => ({
          name: director.name,
          id_passport_number: director.id_passport_number,
          pin: director.pin || null,
          phone_number: director.phone_number || null
        })),
        authorised_purchase_persons: authorisedPersons.map(person => ({
          name: person.name,
          phone_number: person.phone_number || null
        })),
        suppliers: suppliers.map(supplier => ({
          name: supplier.name,
          contact_person_name: supplier.contact_person_name || null,
          phone_number: supplier.phone_number || null,
          credit_limit: supplier.credit_limit ? supplier.credit_limit.toString() : null
        })),
        bank_details: bankDetails.map(bank => ({
          bank_name: bank.bank_name,
          branch: bank.branch || null,
          account_number: bank.account_number || null
        }))
      };

      const newAccount = await createCustomerAccount(payload);
      
      // Upload documents
      await uploadAccountDocuments(newAccount.id);
      
      toast({
        title: "Success",
        description: "Customer account created successfully.",
      });
      
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer account",
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
            Create Account
          </SheetTitle>
          <SheetDescription>
            Create a new customer credit account
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 py-6">
          <div className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between font-normal"
                    disabled={isSubmitting || loadingCustomers}
                  >
                    {customerId
                      ? (() => {
                          const selectedCustomer = customers.find((customer) => customer.id === customerId);
                          return selectedCustomer
                            ? `${getCustomerDisplayName(selectedCustomer)}${selectedCustomer.email ? ` (${selectedCustomer.email})` : ''}`
                            : "Select a customer";
                        })()
                      : loadingCustomers ? "Loading customers..." : "Select a customer"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>No customer found.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${getCustomerDisplayName(customer)} ${customer.email || ''}`}
                            onSelect={() => {
                              setCustomerId(customer.id);
                              setCustomerSearchOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", customerId === customer.id ? "opacity-100" : "opacity-0")} />
                            {getCustomerDisplayName(customer)} {customer.email ? `(${customer.email})` : ''}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Basic Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Account Information</h3>
              
              <div className="p-4 border rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="certificate-number">Certificate of Incorporation Number</Label>
                    <Input
                      id="certificate-number"
                      value={certificateNumber}
                      onChange={(e) => setCertificateNumber(e.target.value)}
                      placeholder="C123456"
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="credit-period">Credit Period</Label>
                    <Input
                      id="credit-period"
                      value={creditPeriod}
                      onChange={(e) => setCreditPeriod(e.target.value)}
                      placeholder="30 days"
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                </div>
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
                  disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`director-id-${index}`}>ID/Passport Number *</Label>
                    <Input
                      id={`director-id-${index}`}
                      value={director.id_passport_number}
                      onChange={(e) => updateDirector(index, 'id_passport_number', e.target.value)}
                      placeholder="A1234567"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`director-pin-${index}`}>PIN</Label>
                    <Input
                      id={`director-pin-${index}`}
                      value={director.pin}
                      onChange={(e) => updateDirector(index, 'pin', e.target.value)}
                      placeholder="D123456"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`director-phone-${index}`}>Phone Number</Label>
                    <Input
                      id={`director-phone-${index}`}
                      value={director.phone_number}
                      onChange={(e) => updateDirector(index, 'phone_number', e.target.value)}
                      placeholder="0712345678"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  {directors.length > 1 && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeDirector(index)}
                        disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`person-phone-${index}`}>Phone Number</Label>
                    <Input
                      id={`person-phone-${index}`}
                      value={person.phone_number}
                      onChange={(e) => updateAuthorisedPerson(index, 'phone_number', e.target.value)}
                      placeholder="0723456789"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  {authorisedPersons.length > 1 && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeAuthorisedPerson(index)}
                        disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`supplier-contact-${index}`}>Contact Person</Label>
                    <Input
                      id={`supplier-contact-${index}`}
                      value={supplier.contact_person_name}
                      onChange={(e) => updateSupplier(index, 'contact_person_name', e.target.value)}
                      placeholder="Mike Brown"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`supplier-phone-${index}`}>Phone Number</Label>
                    <Input
                      id={`supplier-phone-${index}`}
                      value={supplier.phone_number}
                      onChange={(e) => updateSupplier(index, 'phone_number', e.target.value)}
                      placeholder="0734567890"
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  {suppliers.length > 1 && (
                    <div className="md:col-span-2 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeSupplier(index)}
                        disabled={isSubmitting}
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
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`bank-branch-${index}`}>Branch</Label>
                    <Input
                      id={`bank-branch-${index}`}
                      value={bank.branch}
                      onChange={(e) => updateBankDetail(index, 'branch', e.target.value)}
                      placeholder="Westlands"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`bank-account-${index}`}>Account Number</Label>
                    <Input
                      id={`bank-account-${index}`}
                      value={bank.account_number}
                      onChange={(e) => updateBankDetail(index, 'account_number', e.target.value)}
                      placeholder="1234567890"
                      disabled={isSubmitting}
                    />
                  </div>
                  
                  {bankDetails.length > 1 && (
                    <div className="md:col-span-3 flex justify-end">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => removeBankDetail(index)}
                        disabled={isSubmitting}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
