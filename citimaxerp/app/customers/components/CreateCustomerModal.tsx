"use client";

import { useState, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  User,
  Phone,
  FileText,
  UserPlus,
  Loader2,
  Building,
  CreditCard,
  Check,
  ChevronsUpDown,
  Landmark
} from "lucide-react";
import { type Customer, createCustomer } from "@/lib/customers";
import { type CreateCustomerAccountPayload } from "@/lib/customer-accounts";
import { DocumentForm, DocumentData } from "./DocumentForm";
import { uploadDocument } from "@/lib/documents";
import { KENYA_REGIONS, KENYA_COUNTIES, getCountiesForRegion, COUNTRIES, DEFAULT_COUNTRY } from "@/lib/kenya-locations";

// Sections 3 and 4 of the paper form print three ruled rows, so the capture
// form opens with the same three rather than a single row the user must
// repeatedly expand.
const EMPTY_DIRECTORS = () =>
  Array.from({ length: 3 }, () => ({ name: "", idPassportNumber: "", pin: "", phoneNumber: "" }));
const EMPTY_SUPPLIERS = () =>
  Array.from({ length: 3 }, () => ({ name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }));
const EMPTY_BANK_DETAILS = () => [{ accountName: "", bankName: "", branch: "", accountNumber: "" }];

interface CreateCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called after a successful create. Receives the newly-created customer
  // when available (e.g. so a caller like the POS customer selector can
  // auto-select it) - callers that only need a refresh signal can ignore it.
  onSuccess: (customer?: Customer) => void;
}

export function CreateCustomerModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCustomerModalProps) {
  const { toast } = useToast();
  const { companyId, isLoading: authLoading, user } = useAuth();
  const isSalesRep = !!user?.role?.is_sales_rep;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [postalCode, setPostalCode] = useState("");
  const [customerType, setCustomerType] = useState("individual");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");

  // Company-specific fields
  const [businessName, setBusinessName] = useState("");
  const [pinNumber, setPinNumber] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [contactPersonPhone, setContactPersonPhone] = useState("");
  const [contactPersonEmail, setContactPersonEmail] = useState("");
  const [contactPersonDesignation, setContactPersonDesignation] = useState("");

  // Company Details (Nescopharm "Credit Appraisal Form" fields)
  const [tradingName, setTradingName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [ppbLicenseNumber, setPpbLicenseNumber] = useState("");
  const [website, setWebsite] = useState("");
  const [telephone, setTelephone] = useState("");
  const [region, setRegion] = useState("");
  const [county, setCounty] = useState("");
  const [countyPickerOpen, setCountyPickerOpen] = useState(false);

  // Accounts Contact - a separate contact block from Primary Contact above
  const [accountsContactName, setAccountsContactName] = useState("");
  const [accountsContactDesignation, setAccountsContactDesignation] = useState("");
  const [accountsContactPhone, setAccountsContactPhone] = useState("");
  const [accountsContactEmail, setAccountsContactEmail] = useState("");

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const paymentMethodRef = useRef("cash");

  // Sections 3-6 of the Credit Appraisal Form. A single set of fields feeds
  // both submission paths: a Sales Rep's goes into the nested
  // `credit_application` (two-stage approval), while staff selecting "Credit"
  // creates a CustomerAccount directly. Previously these were two parallel
  // sets of state rendering two near-identical sets of inputs.
  const [creditRequired, setCreditRequired] = useState("");
  const [creditDays, setCreditDays] = useState<"" | "30" | "45">("");
  const [pdChequeDays, setPdChequeDays] = useState<"" | "30" | "60">("");
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [directors, setDirectors] = useState(() => EMPTY_DIRECTORS());
  const [suppliers, setSuppliers] = useState(() => EMPTY_SUPPLIERS());
  const [bankDetails, setBankDetails] = useState(() => EMPTY_BANK_DETAILS());

  // Sections 3-6 only apply to a credit customer. Sales Reps never see the
  // Payment Method selector (choosing "Credit" there would create a
  // CustomerAccount immediately and bypass the two-stage approval gate), but
  // every rep submission is a credit application by definition.
  const isCreditApplication = isSalesRep || paymentMethod === "credit";

  // Documents state
  const [documents, setDocuments] = useState<DocumentData[]>([]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("");
    setCountry(DEFAULT_COUNTRY);
    setPostalCode("");
    setCustomerType("individual");
    setStatus("active");
    setNotes("");

    // Reset company-specific fields
    setBusinessName("");
    setPinNumber("");
    setContactPersonName("");
    setContactPersonPhone("");
    setContactPersonEmail("");
    setContactPersonDesignation("");

    // Reset Company Details
    setTradingName("");
    setBusinessType("");
    setRegistrationNumber("");
    setPpbLicenseNumber("");
    setWebsite("");
    setTelephone("");
    setRegion("");
    setCounty("");

    // Reset Accounts Contact
    setAccountsContactName("");
    setAccountsContactDesignation("");
    setAccountsContactPhone("");
    setAccountsContactEmail("");

    // Reset payment method
    setPaymentMethod("cash");
    paymentMethodRef.current = "cash";

    // Reset Credit Appraisal sections 3-6
    setCreditRequired("");
    setCreditDays("");
    setPdChequeDays("");
    setAnnualTurnover("");
    setDirectors(EMPTY_DIRECTORS());
    setSuppliers(EMPTY_SUPPLIERS());
    setBankDetails(EMPTY_BANK_DETAILS());
    setDocuments([]);
  };

  const validateForm = () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      });
      return false;
    }

    if (customerType === "company" && !pinNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "KRA PIN is required for company customers",
        variant: "destructive",
      });
      return false;
    }

    // Optional: validate email format if provided
    if (email && !email.includes("@")) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    // Sections 3-6 only exist for a credit customer. Each repeater row is
    // optional, but a row that has been started needs the one field the
    // backend marks `required_with`.
    if (isCreditApplication) {
      for (let i = 0; i < directors.length; i++) {
        const director = directors[i];
        const started = director.name || director.idPassportNumber || director.pin || director.phoneNumber;
        if (started && !director.name.trim()) {
          toast({
            title: "Validation Error",
            description: `Director ${i + 1}: Full Name is required`,
            variant: "destructive",
          });
          return false;
        }
      }

      for (let i = 0; i < suppliers.length; i++) {
        const supplier = suppliers[i];
        const started = supplier.name || supplier.contactPersonName || supplier.phoneNumber || supplier.creditLimit;
        if (started && !supplier.name.trim()) {
          toast({
            title: "Validation Error",
            description: `Trade Reference ${i + 1}: Supplier Name is required`,
            variant: "destructive",
          });
          return false;
        }
      }

      for (let i = 0; i < bankDetails.length; i++) {
        const bank = bankDetails[i];
        const started = bank.accountName || bank.bankName || bank.branch || bank.accountNumber;
        if (started && !bank.bankName.trim()) {
          toast({
            title: "Validation Error",
            description: `Bank Details ${i + 1}: Bank Name is required`,
            variant: "destructive",
          });
          return false;
        }
      }
    }

    // Validate documents if any are added
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc.document_name.trim()) {
        toast({
          title: "Validation Error",
          description: `Document name is required for document ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }
      
      // For new documents, file is required
      if (!doc.file) {
        toast({
          title: "Validation Error",
          description: `File is required for document ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!companyId) {
      toast({
        title: "Error",
        description: "Company ID is missing. Cannot create customer.",
        variant: "destructive",
      });
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);
    
    // Capture ALL current state values at the time of submission to avoid closure issues
    // Use ref for payment method to ensure we get the most up-to-date value
    const submissionData = {
      currentPaymentMethod: paymentMethodRef.current,
      currentCustomerType: customerType,
      currentName: name,
      currentPhone: phone,
      currentEmail: email,
      currentAddress: address,
      currentCity: city,
      currentCountry: country,
      currentPostalCode: postalCode,
      currentNotes: notes,
      currentBusinessName: businessName,
      currentPinNumber: pinNumber,
      currentContactPersonName: contactPersonName,
      currentContactPersonPhone: contactPersonPhone,
      currentContactPersonEmail: contactPersonEmail,
      currentContactPersonDesignation: contactPersonDesignation,
      currentTradingName: tradingName,
      currentBusinessType: businessType,
      currentRegistrationNumber: registrationNumber,
      currentPpbLicenseNumber: ppbLicenseNumber,
      currentWebsite: website,
      currentTelephone: telephone,
      currentRegion: region,
      currentCounty: county,
      currentAccountsContactName: accountsContactName,
      currentAccountsContactDesignation: accountsContactDesignation,
      currentAccountsContactPhone: accountsContactPhone,
      currentAccountsContactEmail: accountsContactEmail,
    };
    


    try {
      // Prepare customer data based on customer type
      let customerData: any = {
        name: submissionData.currentName.trim(),
        email: submissionData.currentEmail.trim() || null,
        phone: submissionData.currentPhone.trim() || null,
        status: status,
        address: submissionData.currentAddress.trim() || null,
        city: submissionData.currentCity.trim() || null,
        country: submissionData.currentCountry.trim() || null,
        postal_code: submissionData.currentPostalCode.trim() || null,
        region: submissionData.currentRegion || null,
        county: submissionData.currentCounty || null,
        customer_type: submissionData.currentCustomerType || null,
        last_contact_date: null,
        notes: submissionData.currentNotes.trim() || null,
        // Sales Reps never see the Payment Method selector above (it's
        // hidden so selecting "Credit" there can't trigger an immediate
        // CustomerAccount, bypassing the two-stage approval) - but every rep
        // submission IS a credit application via the Credit Appraisal form
        // below, so the stored payment method should say so, not silently
        // stay at the selector's unused "cash" default.
        payment_method: isSalesRep ? "credit" : submissionData.currentPaymentMethod,
      };

      // Business/company detail fields are optional for individuals but still
      // captured when filled in - only "company" customers require them.
      customerData = {
        ...customerData,
        business_name: submissionData.currentBusinessName.trim() || null,
        trading_name: submissionData.currentTradingName.trim() || null,
        business_type: submissionData.currentBusinessType || null,
        registration_number: submissionData.currentRegistrationNumber.trim() || null,
        ppb_license_number: submissionData.currentPpbLicenseNumber.trim() || null,
        website: submissionData.currentWebsite.trim() || null,
        telephone: submissionData.currentTelephone.trim() || null,
        pin_number: submissionData.currentPinNumber.trim() || null,
        contact_person_name: submissionData.currentContactPersonName.trim() || null,
        contact_person_phone: submissionData.currentContactPersonPhone.trim() || null,
        contact_person_email: submissionData.currentContactPersonEmail.trim() || null,
        contact_person_designation: submissionData.currentContactPersonDesignation.trim() || null,
        accounts_contact_name: submissionData.currentAccountsContactName.trim() || null,
        accounts_contact_designation: submissionData.currentAccountsContactDesignation.trim() || null,
        accounts_contact_phone: submissionData.currentAccountsContactPhone.trim() || null,
        accounts_contact_email: submissionData.currentAccountsContactEmail.trim() || null,
      };

      // Only Sales Reps submit the paper "Credit Appraisal Form" data - the
      // backend uses its presence (plus the creating user's role) to route
      // the customer into the two-stage approval workflow.
      if (isSalesRep) {
        customerData.credit_application = {
          annual_turnover: annualTurnover ? parseFloat(annualTurnover) : null,
          credit_required: creditRequired ? parseFloat(creditRequired) : null,
          credit_period_required: creditDays || null,
          credit_period_pd_cheque_days: pdChequeDays ? parseInt(pdChequeDays, 10) : null,
          directors: directorsPayload(),
          suppliers: suppliersPayload(),
          bank_details: bankDetailsPayload(),
        };
      }

      const newCustomer = await createCustomer(customerData);
      
      // Upload documents
      await uploadCustomerDocuments(newCustomer.id);

      // If payment method is credit, create customer account
      if (submissionData.currentPaymentMethod === "credit") {
        await createCustomerAccount(newCustomer.id);
      }

      if (isSalesRep) {
        toast({
          title: "Submitted for Review",
          description: "The credit appraisal application has been submitted and is pending review. The customer will become available once approved.",
        });
      } else {
        toast({
          title: "Success!",
          description: "Customer created successfully",
        });
      }

      resetForm();
      onOpenChange(false);
      onSuccess(newCustomer);
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sections 3-5 feed two different endpoints in the same camelCase-to-
  // snake_case shape, so the mapping lives in one place for both.
  const directorsPayload = () =>
    directors
      .filter(d => d.name.trim() !== "")
      .map(d => ({
        name: d.name,
        id_passport_number: d.idPassportNumber || null,
        pin: d.pin || null,
        phone_number: d.phoneNumber || null,
      }));

  const suppliersPayload = () =>
    suppliers
      .filter(s => s.name.trim() !== "")
      .map(s => ({
        name: s.name,
        contact_person_name: s.contactPersonName || null,
        phone_number: s.phoneNumber || null,
        credit_limit: s.creditLimit || null,
      }));

  const bankDetailsPayload = () =>
    bankDetails
      .filter(b => b.bankName.trim() !== "")
      .map(b => ({
        bank_name: b.bankName,
        account_name: b.accountName || null,
        branch: b.branch || null,
        account_number: b.accountNumber || null,
      }));

  const createCustomerAccount = async (customerId: string) => {
    try {
      // Transform the data to match the API interface
      const accountData = {
        customer_id: customerId,
        annual_turnover: annualTurnover ? parseFloat(annualTurnover) : null,
        credit_required: creditRequired ? parseFloat(creditRequired) : null,
        credit_period_required: creditDays || null,
        credit_days: creditDays ? parseInt(creditDays, 10) : null,
        credit_period_pd_cheque_days: pdChequeDays ? parseInt(pdChequeDays, 10) : null,
        currently_defaulted: false,
        notes: null, // Add notes field as expected by API
        directors: directorsPayload(),
        authorised_purchase_persons: [],
        suppliers: suppliersPayload(),
        bank_details: bankDetailsPayload(),
      };

      // Import and call the actual createCustomerAccount function
      const { createCustomerAccount: apiCreateCustomerAccount } = await import("@/lib/customer-accounts");
      const result = await apiCreateCustomerAccount(accountData);
      
      toast({
        title: "Customer Account Created",
        description: `Credit account created successfully for customer. Account ID: ${result.id}`,
      });
      
      return result;
    } catch (error: any) {
      toast({
        title: "Account Creation Error",
        description: error.message || "Failed to create customer account",
        variant: "destructive",
      });
      
      throw new Error(`Failed to create customer account: ${error.message || "Unknown error"}`);
    }
  };

  const uploadCustomerDocuments = async (customerId: string) => {
    try {
      // Filter documents that have files (new documents)
      const newDocuments = documents.filter(doc => doc.file);
      
      // Upload each new document
      for (const doc of newDocuments) {
        if (doc.file) {
          if (!companyId) {
            throw new Error("Company ID is missing");
          }
          
          await uploadDocument({
            document_image: doc.file,
            documentable_type: "customer",
            documentable_id: customerId,
            company_id: companyId,
            document_name: doc.document_name,
            reference_number: doc.reference_number || undefined,
            expiry_date: doc.expiry_date || undefined,
            regulatory_body: doc.regulatory_body || undefined,
            other_information: doc.other_information || undefined,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Document Upload Error",
        description: error.message || "Failed to upload documents",
        variant: "destructive",
      });
      
      throw new Error(`Failed to upload documents: ${error.message || "Unknown error"}`);
    }
  };

  // Director management functions
  const addDirector = () => {
    setDirectors([...directors, { name: "", idPassportNumber: "", pin: "", phoneNumber: "" }]);
  };

  const removeDirector = (index: number) => {
    if (directors.length > 1) {
      setDirectors(directors.filter((_, i) => i !== index));
    }
  };

  const updateDirector = (index: number, field: string, value: string) => {
    const updatedDirectors = [...directors];
    (updatedDirectors[index] as any)[field] = value;
    setDirectors(updatedDirectors);
  };

  // Supplier management functions
  const addSupplier = () => {
    setSuppliers([...suppliers, { name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }]);
  };

  const removeSupplier = (index: number) => {
    if (suppliers.length > 1) {
      setSuppliers(suppliers.filter((_, i) => i !== index));
    }
  };

  const updateSupplier = (index: number, field: string, value: string) => {
    const updatedSuppliers = [...suppliers];
    (updatedSuppliers[index] as any)[field] = value;
    setSuppliers(updatedSuppliers);
  };

  // Bank details management functions
  const addBankDetail = () => {
    setBankDetails([...bankDetails, { accountName: "", bankName: "", branch: "", accountNumber: "" }]);
  };

  const removeBankDetail = (index: number) => {
    if (bankDetails.length > 1) {
      setBankDetails(bankDetails.filter((_, i) => i !== index));
    }
  };

  const updateBankDetail = (index: number, field: string, value: string) => {
    const updatedBankDetails = [...bankDetails];
    (updatedBankDetails[index] as any)[field] = value;
    setBankDetails(updatedBankDetails);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl flex flex-col h-full">
        <SheetHeader className="border-b border-gray-200 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Add New Customer
          </SheetTitle>
          <SheetDescription>
            Fill in the details below to add a new customer to your system
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {/*
            Sections 1-6 below mirror the printed Credit Appraisal Form
            section-for-section, in its order and under its headings, so a rep
            filling this in on screen can follow the paper copy top to bottom.
            Fields the ERP needs but the paper form has no place for live in
            "Additional Information" at the end.
          */}

          {/* 1. COMPANY DETAILS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-600" />
                1. COMPANY DETAILS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerType">Customer Type *</Label>
                  <Select value={customerType} onValueChange={setCustomerType} disabled={isSubmitting || authLoading}>
                    <SelectTrigger id="customerType">
                      <SelectValue placeholder="Select customer type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus} disabled={isSubmitting || authLoading}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/*
                  Sales Reps don't get this selector - choosing "Credit" here
                  creates a CustomerAccount immediately, which would bypass the
                  two-stage approval their submissions must go through.
                */}
                {!isSalesRep && (
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(value) => {
                        setPaymentMethod(value);
                        paymentMethodRef.current = value;
                      }}
                      disabled={isSubmitting || authLoading}
                    >
                      <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Registered Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Acme Corporation Ltd"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tradingName">Trading Name (if different)</Label>
                  <Input
                    id="tradingName"
                    value={tradingName}
                    onChange={(e) => setTradingName(e.target.value)}
                    placeholder="Acme Pharmacy"
                    disabled={isSubmitting || authLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Type of Business</Label>
                <Select value={businessType || undefined} onValueChange={setBusinessType} disabled={isSubmitting || authLoading}>
                  <SelectTrigger id="businessType">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="hospital_clinic">Hospital / Clinic</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                    <SelectItem value="ngo">NGO</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration/License Number</Label>
                  <Input
                    id="registrationNumber"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="C123456"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ppbLicenseNumber">Pharmacy &amp; Poisons board (PPB) License No.</Label>
                  <Input
                    id="ppbLicenseNumber"
                    value={ppbLicenseNumber}
                    onChange={(e) => setPpbLicenseNumber(e.target.value)}
                    placeholder="PPB/123456"
                    disabled={isSubmitting || authLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pinNumber">KRA PIN{customerType === "company" ? " *" : ""}</Label>
                <Input
                  id="pinNumber"
                  value={pinNumber}
                  onChange={(e) => setPinNumber(e.target.value)}
                  placeholder="P123456789A"
                  disabled={isSubmitting || authLoading}
                  className="w-full md:w-1/2"
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="postalCode">Postal Address</Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="P.O. Box 6577 - 00100"
                  disabled={isSubmitting || authLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Physical Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Kampala Road, Off Enterprise Road"
                  disabled={isSubmitting || authLoading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Town</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Nairobi"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={country || undefined}
                    onValueChange={setCountry}
                    disabled={isSubmitting || authLoading}
                  >
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={region || undefined}
                    onValueChange={(value) => {
                      setRegion(value);
                      setCounty("");
                    }}
                    disabled={isSubmitting || authLoading}
                  >
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {KENYA_REGIONS.map((r) => (
                        <SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="county">County</Label>
                  <Popover open={countyPickerOpen} onOpenChange={setCountyPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countyPickerOpen}
                        className="w-full justify-between font-normal"
                        disabled={isSubmitting || authLoading}
                      >
                        {county || "Select county"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search counties..." />
                        <CommandList>
                          <CommandEmpty>No county found.</CommandEmpty>
                          <CommandGroup>
                            {(region ? getCountiesForRegion(region) : KENYA_COUNTIES).map((c) => (
                              <CommandItem
                                key={c}
                                value={c}
                                onSelect={() => {
                                  setCounty(c);
                                  setCountyPickerOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", county === c ? "opacity-100" : "opacity-0")} />
                                {c}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telephone">Telephone</Label>
                  <Input
                    id="telephone"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+254 20 123 4567"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 700 123 456"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@example.com"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website (if any)</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://www.example.com"
                    disabled={isSubmitting || authLoading}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={customerType === "company" ? "Name this customer is listed under" : "John Doe"}
                  disabled={isSubmitting || authLoading}
                />
                <p className="text-xs text-muted-foreground">
                  How this customer is listed throughout the system.
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
                Attach a copy of COI, KRA, PPB premises, PPB pharmacy license
              </p>
            </CardContent>
          </Card>

          {/* 2. CONTACT PERSONS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-teal-600" />
                2. CONTACT PERSONS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold">
                  Primary Contact (Procurement Officer/ Pharmacist-in-Charge)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPersonName">Name</Label>
                    <Input
                      id="contactPersonName"
                      value={contactPersonName}
                      onChange={(e) => setContactPersonName(e.target.value)}
                      placeholder="Jane Doe"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPersonDesignation">Designation</Label>
                    <Input
                      id="contactPersonDesignation"
                      value={contactPersonDesignation}
                      onChange={(e) => setContactPersonDesignation(e.target.value)}
                      placeholder="Pharmacist-in-Charge"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPersonPhone">Phone</Label>
                    <Input
                      id="contactPersonPhone"
                      value={contactPersonPhone}
                      onChange={(e) => setContactPersonPhone(e.target.value)}
                      placeholder="+254 700 123 456"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPersonEmail">Email</Label>
                    <Input
                      id="contactPersonEmail"
                      type="email"
                      value={contactPersonEmail}
                      onChange={(e) => setContactPersonEmail(e.target.value)}
                      placeholder="jane.doe@example.com"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <p className="text-sm font-semibold">Accounts Contact</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountsContactName">Name</Label>
                    <Input
                      id="accountsContactName"
                      value={accountsContactName}
                      onChange={(e) => setAccountsContactName(e.target.value)}
                      placeholder="John Accountant"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountsContactDesignation">Designation</Label>
                    <Input
                      id="accountsContactDesignation"
                      value={accountsContactDesignation}
                      onChange={(e) => setAccountsContactDesignation(e.target.value)}
                      placeholder="Finance Manager"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountsContactPhone">Phone</Label>
                    <Input
                      id="accountsContactPhone"
                      value={accountsContactPhone}
                      onChange={(e) => setAccountsContactPhone(e.target.value)}
                      placeholder="+254 700 123 456"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountsContactEmail">Email</Label>
                    <Input
                      id="accountsContactEmail"
                      type="email"
                      value={accountsContactEmail}
                      onChange={(e) => setAccountsContactEmail(e.target.value)}
                      placeholder="accounts@example.com"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {isCreditApplication && (
            <>
              {/* 3. BUSINESS OWNERS/DIRECTORS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-rose-600" />
                    3. BUSINESS OWNERS/DIRECTORS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Full Name, ID/Passport No, Phone Number, Pin No
                  </p>

                  {directors.map((director, index) => (
                    <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{index + 1}.</h3>
                        {directors.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeDirector(index)}
                            disabled={isSubmitting || authLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Full Name</Label>
                          <Input
                            value={director.name}
                            onChange={(e) => updateDirector(index, "name", e.target.value)}
                            placeholder="Director name"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>ID / Person No.</Label>
                          <Input
                            value={director.idPassportNumber}
                            onChange={(e) => updateDirector(index, "idPassportNumber", e.target.value)}
                            placeholder="A1234567"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            value={director.phoneNumber}
                            onChange={(e) => updateDirector(index, "phoneNumber", e.target.value)}
                            placeholder="0712345678"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Pin No.</Label>
                          <Input
                            value={director.pin}
                            onChange={(e) => updateDirector(index, "pin", e.target.value)}
                            placeholder="A123456789P"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addDirector}
                    disabled={isSubmitting || authLoading}
                    className="w-full"
                  >
                    Add Director
                  </Button>
                </CardContent>
              </Card>

              {/* 4. TRADE REFERENCES (SUPPLIER REFERENCES) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-rose-600" />
                    4. TRADE REFERENCES (SUPPLIER REFERENCES)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Provide at least <span className="font-semibold">three</span> suppliers you have credit history with:
                    Supplier Name, Contact Person, Credit Limit Ksh.
                  </p>

                  {suppliers.map((supplier, index) => (
                    <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">{index + 1}.</h3>
                        {suppliers.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSupplier(index)}
                            disabled={isSubmitting || authLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Supplier Name</Label>
                          <Input
                            value={supplier.name}
                            onChange={(e) => updateSupplier(index, "name", e.target.value)}
                            placeholder="Supplier name"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Contact Person</Label>
                          <Input
                            value={supplier.contactPersonName}
                            onChange={(e) => updateSupplier(index, "contactPersonName", e.target.value)}
                            placeholder="Contact person name"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            value={supplier.phoneNumber}
                            onChange={(e) => updateSupplier(index, "phoneNumber", e.target.value)}
                            placeholder="0712345678"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Credit Limit (Ksh)</Label>
                          <Input
                            type="number"
                            value={supplier.creditLimit}
                            onChange={(e) => updateSupplier(index, "creditLimit", e.target.value)}
                            placeholder="20000"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSupplier}
                    disabled={isSubmitting || authLoading}
                    className="w-full"
                  >
                    Add Trade Reference
                  </Button>
                </CardContent>
              </Card>

              {/* 5. BANK DETAILS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-rose-600" />
                    5. BANK DETAILS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bankDetails.map((bank, index) => (
                    <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                      {bankDetails.length > 1 && (
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium">Bank Account {index + 1}</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeBankDetail(index)}
                            disabled={isSubmitting || authLoading}
                          >
                            Remove
                          </Button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Bank Name</Label>
                          <Input
                            value={bank.bankName}
                            onChange={(e) => updateBankDetail(index, "bankName", e.target.value)}
                            placeholder="Bank of Africa"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Branch</Label>
                          <Input
                            value={bank.branch}
                            onChange={(e) => updateBankDetail(index, "branch", e.target.value)}
                            placeholder="Westlands"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Account Name</Label>
                          <Input
                            value={bank.accountName}
                            onChange={(e) => updateBankDetail(index, "accountName", e.target.value)}
                            placeholder="Acme Corporation Ltd"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Account Number</Label>
                          <Input
                            value={bank.accountNumber}
                            onChange={(e) => updateBankDetail(index, "accountNumber", e.target.value)}
                            placeholder="1234567890"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addBankDetail}
                    disabled={isSubmitting || authLoading}
                    className="w-full"
                  >
                    Add Bank Account
                  </Button>
                </CardContent>
              </Card>

              {/* 6. CREDIT TERMS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-rose-600" />
                    6. CREDIT TERMS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isSalesRep && (
                    <p className="text-xs text-muted-foreground">
                      This application will be submitted for review before the customer becomes active.
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="annualTurnover">1.) Turnover KES</Label>
                      <Input
                        id="annualTurnover"
                        type="number"
                        value={annualTurnover}
                        onChange={(e) => setAnnualTurnover(e.target.value)}
                        placeholder="1000000"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="creditRequired">2.) Credit Limit (KES)</Label>
                      <Input
                        id="creditRequired"
                        type="number"
                        value={creditRequired}
                        onChange={(e) => setCreditRequired(e.target.value)}
                        placeholder="50000"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>3.) Credit Period (days)</Label>
                    <div className="flex items-center gap-6">
                      {(["30", "45"] as const).map((days) => (
                        <label key={days} className="flex items-center gap-2 text-sm cursor-pointer">
                          {days}
                          <input
                            type="checkbox"
                            checked={creditDays === days}
                            onChange={(e) => setCreditDays(e.target.checked ? days : "")}
                            disabled={isSubmitting || authLoading}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used to auto-calculate invoice due dates for this customer.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>4.) Credit Period (days) on PD Cheques</Label>
                    <div className="flex items-center gap-6">
                      {(["30", "60"] as const).map((days) => (
                        <label key={days} className="flex items-center gap-2 text-sm cursor-pointer">
                          {days}
                          <input
                            type="checkbox"
                            checked={pdChequeDays === days}
                            onChange={(e) => setPdChequeDays(e.target.checked ? days : "")}
                            disabled={isSubmitting || authLoading}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Agreed PD-cheque period cannot exceed 60 days.
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Late Payment:</span> Any payment made beyond the agreed{" "}
                    <span className="font-semibold">credit period</span> shall attract a late payment charge
                    equivalent to three percent (3%) of the outstanding amount.
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Supporting documents - the attachments section 1 asks for */}
          <DocumentForm
            documents={documents}
            onChange={setDocuments}
          />

          {/* Notes are the one free-text field the ERP keeps that the paper
              form has no line for. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this customer..."
                disabled={isSubmitting || authLoading}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        <SheetFooter className="border-t border-gray-200 pt-4">
          <div className="flex justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || authLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || authLoading}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Customer
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
