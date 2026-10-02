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
  Mail, 
  Phone, 
  MapPin, 
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
import { KENYA_REGIONS, KENYA_COUNTIES, getCountiesForRegion } from "@/lib/kenya-locations";

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
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [postalCode, setPostalCode] = useState("");
  const [customerType, setCustomerType] = useState("individual");
  const [status, setStatus] = useState("active");
  const [preferredCommunication, setPreferredCommunication] = useState("phone");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  
  // Company-specific fields
  const [businessName, setBusinessName] = useState("");
  const [natureOfBusiness, setNatureOfBusiness] = useState("");
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

  // Credit Appraisal application (Sales Rep only) - maps to the backend's
  // nested `credit_application` object accepted on customer creation
  const [caAnnualTurnover, setCaAnnualTurnover] = useState("");
  const [caCreditRequired, setCaCreditRequired] = useState("");
  const [caCreditPeriodRequired, setCaCreditPeriodRequired] = useState("");
  const [caCreditPeriodPdChequeDays, setCaCreditPeriodPdChequeDays] = useState("");
  const [caDirectors, setCaDirectors] = useState([{ name: "", idPassportNumber: "", pin: "", phoneNumber: "" }]);
  const [caSuppliers, setCaSuppliers] = useState([{ name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }]);
  const [caBankDetails, setCaBankDetails] = useState([{ accountName: "", bankName: "", branch: "", accountNumber: "" }]);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const paymentMethodRef = useRef("cash");
  
  // Credit account fields (only shown if payment method is credit)
  const [creditRequired, setCreditRequired] = useState("");
  const [creditDays, setCreditDays] = useState("");
  const [certificateOfIncorporationNumber, setCertificateOfIncorporationNumber] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [currentlyDefaulted, setCurrentlyDefaulted] = useState(false);
  const [creditTerms, setCreditTerms] = useState("");
  const [directors, setDirectors] = useState([{ name: "", idPassportNumber: "", pin: "", phoneNumber: "" }]);
  const [authorisedPurchasePersons, setAuthorisedPurchasePersons] = useState([{ name: "", phoneNumber: "" }]);
  const [suppliers, setSuppliers] = useState([{ name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }]);
  const [bankDetails, setBankDetails] = useState([{ bankName: "", branch: "", accountNumber: "" }]);
  
  // Documents state
  const [documents, setDocuments] = useState<DocumentData[]>([]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setAddress("");
    setCity("");
    setCountry("Kenya");
    setPostalCode("");
    setCustomerType("individual");
    setStatus("active");
    setPreferredCommunication("phone");
    setNotes("");
    setTags("");
    
    // Reset company-specific fields
    setBusinessName("");
    setNatureOfBusiness("");
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

    // Reset Credit Appraisal application
    setCaAnnualTurnover("");
    setCaCreditRequired("");
    setCaCreditPeriodRequired("");
    setCaCreditPeriodPdChequeDays("");
    setCaDirectors([{ name: "", idPassportNumber: "", pin: "", phoneNumber: "" }]);
    setCaSuppliers([{ name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }]);
    setCaBankDetails([{ accountName: "", bankName: "", branch: "", accountNumber: "" }]);

    // Reset payment method
    setPaymentMethod("cash");
    paymentMethodRef.current = "cash";
    
    // Remove documents reset
    // Reset credit account fields
    setCreditRequired("");
    setCreditDays("");
    setCertificateOfIncorporationNumber("");
    setCompanyType("");
    setAnnualTurnover("");
    setCurrentlyDefaulted(false);
    setCreditTerms("");
    setDirectors([{ name: "", idPassportNumber: "", pin: "", phoneNumber: "" }]);
    setAuthorisedPurchasePersons([{ name: "", phoneNumber: "" }]);
    setSuppliers([{ name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }]);
    setBankDetails([{ bankName: "", branch: "", accountNumber: "" }]);
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

    // If payment method is credit, validate credit account fields
    if (paymentMethodRef.current === "credit") {
      // Validate directors if any are provided
      const hasDirectors = directors.some(d => d.name || d.idPassportNumber || d.pin || d.phoneNumber);
      if (hasDirectors) {
        for (let i = 0; i < directors.length; i++) {
          const director = directors[i];
          // If any field is filled, name and idPassportNumber are required
          if (director.name || director.idPassportNumber || director.pin || director.phoneNumber) {
            if (!director.name.trim()) {
              toast({
                title: "Validation Error",
                description: `Director ${i + 1}: Name is required`,
                variant: "destructive",
              });
              return false;
            }
            if (!director.idPassportNumber.trim()) {
              toast({
                title: "Validation Error",
                description: `Director ${i + 1}: ID/Passport number is required`,
                variant: "destructive",
              });
              return false;
            }
          }
        }
      }

      // Validate authorised purchase persons if any are provided
      const hasAuthorisedPersons = authorisedPurchasePersons.some(p => p.name || p.phoneNumber);
      if (hasAuthorisedPersons) {
        for (let i = 0; i < authorisedPurchasePersons.length; i++) {
          const person = authorisedPurchasePersons[i];
          // If any field is filled, name is required
          if (person.name || person.phoneNumber) {
            if (!person.name.trim()) {
              toast({
                title: "Validation Error",
                description: `Authorised Person ${i + 1}: Name is required`,
                variant: "destructive",
              });
              return false;
            }
          }
        }
      }

      // Validate suppliers if any are provided
      const hasSuppliers = suppliers.some(s => s.name || s.contactPersonName || s.phoneNumber || s.creditLimit);
      if (hasSuppliers) {
        for (let i = 0; i < suppliers.length; i++) {
          const supplier = suppliers[i];
          // If any field is filled, name is required
          if (supplier.name || supplier.contactPersonName || supplier.phoneNumber || supplier.creditLimit) {
            if (!supplier.name.trim()) {
              toast({
                title: "Validation Error",
                description: `Supplier ${i + 1}: Name is required`,
                variant: "destructive",
              });
              return false;
            }
          }
        }
      }

      // Validate bank details if any are provided
      const hasBankDetails = bankDetails.some(b => b.bankName || b.branch || b.accountNumber);
      if (hasBankDetails) {
        for (let i = 0; i < bankDetails.length; i++) {
          const bank = bankDetails[i];
          // If any field is filled, bankName is required
          if (bank.bankName || bank.branch || bank.accountNumber) {
            if (!bank.bankName.trim()) {
              toast({
                title: "Validation Error",
                description: `Bank Detail ${i + 1}: Bank name is required`,
                variant: "destructive",
              });
              return false;
            }
          }
        }
      }
    }

    // Validate Credit Appraisal application fields (Sales Rep only)
    if (isSalesRep) {
      const hasCaDirectors = caDirectors.some(d => d.name || d.idPassportNumber || d.pin || d.phoneNumber);
      if (hasCaDirectors) {
        for (let i = 0; i < caDirectors.length; i++) {
          const director = caDirectors[i];
          if ((director.name || director.idPassportNumber || director.pin || director.phoneNumber) && !director.name.trim()) {
            toast({
              title: "Validation Error",
              description: `Director ${i + 1}: Name is required`,
              variant: "destructive",
            });
            return false;
          }
        }
      }

      const hasCaSuppliers = caSuppliers.some(s => s.name || s.contactPersonName || s.phoneNumber || s.creditLimit);
      if (hasCaSuppliers) {
        for (let i = 0; i < caSuppliers.length; i++) {
          const supplier = caSuppliers[i];
          if ((supplier.name || supplier.contactPersonName || supplier.phoneNumber || supplier.creditLimit) && !supplier.name.trim()) {
            toast({
              title: "Validation Error",
              description: `Trade Reference ${i + 1}: Name is required`,
              variant: "destructive",
            });
            return false;
          }
        }
      }

      const hasCaBankDetails = caBankDetails.some(b => b.accountName || b.bankName || b.branch || b.accountNumber);
      if (hasCaBankDetails) {
        for (let i = 0; i < caBankDetails.length; i++) {
          const bank = caBankDetails[i];
          if ((bank.accountName || bank.bankName || bank.branch || bank.accountNumber) && !bank.bankName.trim()) {
            toast({
              title: "Validation Error",
              description: `Bank Detail ${i + 1}: Bank name is required`,
              variant: "destructive",
            });
            return false;
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
      currentPreferredCommunication: preferredCommunication,
      currentNotes: notes,
      currentTags: tags,
      currentBusinessName: businessName,
      currentNatureOfBusiness: natureOfBusiness,
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
      // Convert tags string to array
      const tagsArray = submissionData.currentTags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag !== "");

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
        preferred_communication_channel: submissionData.currentPreferredCommunication || null,
        last_contact_date: null,
        notes: submissionData.currentNotes.trim() || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
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
        nature_of_business: submissionData.currentNatureOfBusiness.trim() || null,
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
          annual_turnover: caAnnualTurnover ? parseFloat(caAnnualTurnover) : null,
          credit_required: caCreditRequired ? parseFloat(caCreditRequired) : null,
          credit_period_required: caCreditPeriodRequired.trim() || null,
          credit_period_pd_cheque_days: caCreditPeriodPdChequeDays ? parseInt(caCreditPeriodPdChequeDays, 10) : null,
          directors: caDirectors
            .filter(d => d.name.trim() !== "")
            .map(d => ({
              name: d.name,
              id_passport_number: d.idPassportNumber || null,
              pin: d.pin || null,
              phone_number: d.phoneNumber || null,
            })),
          suppliers: caSuppliers
            .filter(s => s.name.trim() !== "")
            .map(s => ({
              name: s.name,
              contact_person_name: s.contactPersonName || null,
              phone_number: s.phoneNumber || null,
              credit_limit: s.creditLimit || null,
            })),
          bank_details: caBankDetails
            .filter(b => b.bankName.trim() !== "")
            .map(b => ({
              account_name: b.accountName || null,
              bank_name: b.bankName,
              branch: b.branch || null,
              account_number: b.accountNumber || null,
            })),
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

  const createCustomerAccount = async (customerId: string) => {
    try {
      // Transform the data to match the API interface
      const accountData = {
        customer_id: customerId,
        certificate_of_incorporation_number: certificateOfIncorporationNumber || null,
        company_type: companyType || null,
        annual_turnover: annualTurnover ? parseFloat(annualTurnover) : null,
        credit_required: creditRequired ? parseFloat(creditRequired) : null,
        credit_days: creditDays ? parseInt(creditDays, 10) : null,
        currently_defaulted: currentlyDefaulted,
        credit_terms: creditTerms || null,
        notes: null, // Add notes field as expected by API
        directors: directors
          .filter(d => d.name.trim() !== "")
          .map(d => ({
            name: d.name,
            id_passport_number: d.idPassportNumber, // Transform field name
            pin: d.pin || null,
            phone_number: d.phoneNumber || null, // Transform field name
          })),
        authorised_purchase_persons: authorisedPurchasePersons
          .filter(p => p.name.trim() !== "")
          .map(p => ({
            name: p.name,
            phone_number: p.phoneNumber || null, // Transform field name
          })),
        suppliers: suppliers
          .filter(s => s.name.trim() !== "")
          .map(s => ({
            name: s.name,
            contact_person_name: s.contactPersonName || null, // Transform field name
            phone_number: s.phoneNumber || null, // Transform field name
            credit_limit: s.creditLimit || null, // Transform field name
          })),
        bank_details: bankDetails
          .filter(b => b.bankName.trim() !== "")
          .map(b => ({
            bank_name: b.bankName, // Transform field name
            branch: b.branch || null,
            account_number: b.accountNumber || null, // Transform field name
          })),
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

  // Authorised purchase person management functions
  const addAuthorisedPurchasePerson = () => {
    setAuthorisedPurchasePersons([...authorisedPurchasePersons, { name: "", phoneNumber: "" }]);
  };

  const removeAuthorisedPurchasePerson = (index: number) => {
    if (authorisedPurchasePersons.length > 1) {
      setAuthorisedPurchasePersons(authorisedPurchasePersons.filter((_, i) => i !== index));
    }
  };

  const updateAuthorisedPurchasePerson = (index: number, field: string, value: string) => {
    const updatedPersons = [...authorisedPurchasePersons];
    (updatedPersons[index] as any)[field] = value;
    setAuthorisedPurchasePersons(updatedPersons);
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
    setBankDetails([...bankDetails, { bankName: "", branch: "", accountNumber: "" }]);
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

  // Credit Appraisal - Director management functions
  const addCaDirector = () => {
    setCaDirectors([...caDirectors, { name: "", idPassportNumber: "", pin: "", phoneNumber: "" }]);
  };

  const removeCaDirector = (index: number) => {
    if (caDirectors.length > 1) {
      setCaDirectors(caDirectors.filter((_, i) => i !== index));
    }
  };

  const updateCaDirector = (index: number, field: string, value: string) => {
    const updated = [...caDirectors];
    (updated[index] as any)[field] = value;
    setCaDirectors(updated);
  };

  // Credit Appraisal - Trade Reference/Supplier management functions
  const addCaSupplier = () => {
    setCaSuppliers([...caSuppliers, { name: "", contactPersonName: "", phoneNumber: "", creditLimit: "" }]);
  };

  const removeCaSupplier = (index: number) => {
    if (caSuppliers.length > 1) {
      setCaSuppliers(caSuppliers.filter((_, i) => i !== index));
    }
  };

  const updateCaSupplier = (index: number, field: string, value: string) => {
    const updated = [...caSuppliers];
    (updated[index] as any)[field] = value;
    setCaSuppliers(updated);
  };

  // Credit Appraisal - Bank Detail management functions
  const addCaBankDetail = () => {
    setCaBankDetails([...caBankDetails, { accountName: "", bankName: "", branch: "", accountNumber: "" }]);
  };

  const removeCaBankDetail = (index: number) => {
    if (caBankDetails.length > 1) {
      setCaBankDetails(caBankDetails.filter((_, i) => i !== index));
    }
  };

  const updateCaBankDetail = (index: number, field: string, value: string) => {
    const updated = [...caBankDetails];
    (updated[index] as any)[field] = value;
    setCaBankDetails(updated);
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
          {/* Customer Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type *</Label>
                <Select value={customerType} onValueChange={setCustomerType} disabled={isSubmitting || authLoading}>
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-green-600" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {customerType === "company" ? "Contact Person Name *" : "Customer Name *"}
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={customerType === "company" ? "Contact person name" : "John Doe"}
                    disabled={isSubmitting || authLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 700 123 456"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@example.com"
                    disabled={isSubmitting || authLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredCommunication">Preferred Communication</Label>
                  <Select value={preferredCommunication} onValueChange={setPreferredCommunication} disabled={isSubmitting || authLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select preferred communication method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Business Details{customerType !== "company" ? " (optional)" : ""}
                </p>
              </div>

              <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Acme Corporation"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tradingName">Trading Name</Label>
                      <Input
                        id="tradingName"
                        value={tradingName}
                        onChange={(e) => setTradingName(e.target.value)}
                        placeholder="Acme Pharmacy"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type</Label>
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

                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        value={registrationNumber}
                        onChange={(e) => setRegistrationNumber(e.target.value)}
                        placeholder="C123456"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ppbLicenseNumber">PPB License Number</Label>
                      <Input
                        id="ppbLicenseNumber"
                        value={ppbLicenseNumber}
                        onChange={(e) => setPpbLicenseNumber(e.target.value)}
                        placeholder="PPB/123456"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pinNumber">KRA PIN{customerType === "company" ? " *" : ""}</Label>
                      <Input
                        id="pinNumber"
                        value={pinNumber}
                        onChange={(e) => setPinNumber(e.target.value)}
                        placeholder="P123456"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                  </div>
              </>
            </CardContent>
          </Card>

          {/* Address Information - comes right after Company Details to match
              the reference Credit Appraisal Form's Postal/Physical Address
              placement (between KRA PIN and Telephone). */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-600" />
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Address (P.O. Box)</Label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="00100"
                  disabled={isSubmitting || authLoading}
                  className="w-full md:w-1/3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Physical Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street"
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
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Kenya"
                    disabled={isSubmitting || authLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </CardContent>
          </Card>

          {/* Telephone / Website / Nature of Business */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-teal-600" />
                  Contact Details{customerType !== "company" ? " (optional)" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-2">
                  <Label htmlFor="natureOfBusiness">Nature of Business</Label>
                  <Input
                    id="natureOfBusiness"
                    value={natureOfBusiness}
                    onChange={(e) => setNatureOfBusiness(e.target.value)}
                    placeholder="Retail, Manufacturing, etc."
                    disabled={isSubmitting || authLoading}
                  />
                </div>
              </CardContent>
            </Card>

          {/* Primary Contact */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  Primary Contact (Procurement Officer/Pharmacist-in-Charge){customerType !== "company" ? " (optional)" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPersonName">Contact Person Name</Label>
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
                    <Label htmlFor="contactPersonPhone">Contact Person Phone</Label>
                    <Input
                      id="contactPersonPhone"
                      value={contactPersonPhone}
                      onChange={(e) => setContactPersonPhone(e.target.value)}
                      placeholder="+254 700 123 456"
                      disabled={isSubmitting || authLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPersonEmail">Contact Person Email</Label>
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
              </CardContent>
            </Card>

          {/* Accounts Contact - a separate contact block from Primary Contact above */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-teal-600" />
                  Accounts Contact{customerType !== "company" ? " (optional)" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

          {/*
            Payment Method / immediate credit-account setup - Sales Reps must
            go through the two-stage Credit Appraisal application below
            instead (selecting "Credit" here would create a CustomerAccount
            immediately, bypassing that gate entirely). Staff creating a
            customer directly keep this unchanged.
          */}
          {!isSalesRep && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-600" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {paymentMethod === "credit" && (
                <div className="space-y-4 mt-4 p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium">Credit Account Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="creditRequired">Credit Required (KES)</Label>
                      <Input
                        id="creditRequired"
                        type="number"
                        value={creditRequired}
                        onChange={(e) => setCreditRequired(e.target.value)}
                        placeholder="50000"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="creditDays">Credit Period (Days)</Label>
                      <Input
                        id="creditDays"
                        type="number"
                        min="0"
                        value={creditDays}
                        onChange={(e) => setCreditDays(e.target.value)}
                        placeholder="e.g. 60"
                        disabled={isSubmitting || authLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        Used to auto-calculate invoice due dates for this customer.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="certificateOfIncorporationNumber">Certificate of Incorporation Number</Label>
                      <Input
                        id="certificateOfIncorporationNumber"
                        value={certificateOfIncorporationNumber}
                        onChange={(e) => setCertificateOfIncorporationNumber(e.target.value)}
                        placeholder="C123456"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="companyType">Company Type</Label>
                      <Input
                        id="companyType"
                        value={companyType}
                        onChange={(e) => setCompanyType(e.target.value)}
                        placeholder="Limited, PLC, etc."
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="annualTurnover">Annual Turnover (KES)</Label>
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
                    <Label htmlFor="creditTerms">Credit Terms</Label>
                    <Input
                      id="creditTerms"
                      value={creditTerms}
                      onChange={(e) => setCreditTerms(e.target.value)}
                      placeholder="Net 30, etc."
                      disabled={isSubmitting || authLoading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={currentlyDefaulted}
                        onChange={(e) => setCurrentlyDefaulted(e.target.checked)}
                        disabled={isSubmitting || authLoading}
                        className="mr-2"
                      />
                      Currently Defaulted
                    </Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Credit Appraisal - Sales Rep submission (paper "Credit Appraisal Form") */}
          {isSalesRep && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-rose-600" />
                    Credit Appraisal - Credit Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    This application will be submitted for review before the customer becomes active.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="caAnnualTurnover">Annual Turnover (KES)</Label>
                      <Input
                        id="caAnnualTurnover"
                        type="number"
                        value={caAnnualTurnover}
                        onChange={(e) => setCaAnnualTurnover(e.target.value)}
                        placeholder="1000000"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="caCreditRequired">Credit Required (KES)</Label>
                      <Input
                        id="caCreditRequired"
                        type="number"
                        value={caCreditRequired}
                        onChange={(e) => setCaCreditRequired(e.target.value)}
                        placeholder="50000"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="caCreditPeriodRequired">Credit Period Required</Label>
                      <Input
                        id="caCreditPeriodRequired"
                        value={caCreditPeriodRequired}
                        onChange={(e) => setCaCreditPeriodRequired(e.target.value)}
                        placeholder="30 days"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="caCreditPeriodPdChequeDays">Post-Dated Cheque Period (Days)</Label>
                      <Input
                        id="caCreditPeriodPdChequeDays"
                        type="number"
                        min="0"
                        max="365"
                        value={caCreditPeriodPdChequeDays}
                        onChange={(e) => setCaCreditPeriodPdChequeDays(e.target.value)}
                        placeholder="e.g. 30"
                        disabled={isSubmitting || authLoading}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-rose-600" />
                    Credit Appraisal - Business Owners / Directors
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {caDirectors.map((director, index) => (
                    <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Director {index + 1}</h3>
                        {caDirectors.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCaDirector(index)}
                            disabled={isSubmitting || authLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input
                            value={director.name}
                            onChange={(e) => updateCaDirector(index, "name", e.target.value)}
                            placeholder="Director name"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>ID/Passport Number</Label>
                          <Input
                            value={director.idPassportNumber}
                            onChange={(e) => updateCaDirector(index, "idPassportNumber", e.target.value)}
                            placeholder="A1234567"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>PIN</Label>
                          <Input
                            value={director.pin}
                            onChange={(e) => updateCaDirector(index, "pin", e.target.value)}
                            placeholder="D123456"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            value={director.phoneNumber}
                            onChange={(e) => updateCaDirector(index, "phoneNumber", e.target.value)}
                            placeholder="0712345678"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCaDirector}
                    disabled={isSubmitting || authLoading}
                    className="w-full"
                  >
                    Add Director
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-rose-600" />
                    Credit Appraisal - Trade References / Suppliers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {caSuppliers.map((supplier, index) => (
                    <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Trade Reference {index + 1}</h3>
                        {caSuppliers.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCaSupplier(index)}
                            disabled={isSubmitting || authLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input
                            value={supplier.name}
                            onChange={(e) => updateCaSupplier(index, "name", e.target.value)}
                            placeholder="Supplier name"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Contact Person Name</Label>
                          <Input
                            value={supplier.contactPersonName}
                            onChange={(e) => updateCaSupplier(index, "contactPersonName", e.target.value)}
                            placeholder="Contact person name"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Phone Number</Label>
                          <Input
                            value={supplier.phoneNumber}
                            onChange={(e) => updateCaSupplier(index, "phoneNumber", e.target.value)}
                            placeholder="0712345678"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Credit Limit (KES)</Label>
                          <Input
                            type="number"
                            value={supplier.creditLimit}
                            onChange={(e) => updateCaSupplier(index, "creditLimit", e.target.value)}
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
                    onClick={addCaSupplier}
                    disabled={isSubmitting || authLoading}
                    className="w-full"
                  >
                    Add Trade Reference
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-rose-600" />
                    Credit Appraisal - Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {caBankDetails.map((bank, index) => (
                    <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Bank Account {index + 1}</h3>
                        {caBankDetails.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCaBankDetail(index)}
                            disabled={isSubmitting || authLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Account Name</Label>
                          <Input
                            value={bank.accountName}
                            onChange={(e) => updateCaBankDetail(index, "accountName", e.target.value)}
                            placeholder="Acme Corporation Ltd"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Bank Name *</Label>
                          <Input
                            value={bank.bankName}
                            onChange={(e) => updateCaBankDetail(index, "bankName", e.target.value)}
                            placeholder="Bank of Africa"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Branch</Label>
                          <Input
                            value={bank.branch}
                            onChange={(e) => updateCaBankDetail(index, "branch", e.target.value)}
                            placeholder="Westlands"
                            disabled={isSubmitting || authLoading}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Account Number</Label>
                          <Input
                            value={bank.accountNumber}
                            onChange={(e) => updateCaBankDetail(index, "accountNumber", e.target.value)}
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
                    onClick={addCaBankDetail}
                    disabled={isSubmitting || authLoading}
                    className="w-full"
                  >
                    Add Bank Account
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Directors Information (for credit accounts) */}
          {paymentMethod === "credit" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-600" />
                  Directors Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {directors.map((director, index) => (
                  <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Director {index + 1}</h3>
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
                        <Label>Name *</Label>
                        <Input
                          value={director.name}
                          onChange={(e) => updateDirector(index, "name", e.target.value)}
                          placeholder="Director name"
                          disabled={isSubmitting || authLoading}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>ID/Passport Number *</Label>
                        <Input
                          value={director.idPassportNumber}
                          onChange={(e) => updateDirector(index, "idPassportNumber", e.target.value)}
                          placeholder="A1234567"
                          disabled={isSubmitting || authLoading}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>PIN</Label>
                        <Input
                          value={director.pin}
                          onChange={(e) => updateDirector(index, "pin", e.target.value)}
                          placeholder="D123456"
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
          )}

          {/* Authorised Purchase Persons (for credit accounts) */}
          {paymentMethod === "credit" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-green-600" />
                  Authorised Purchase Persons
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {authorisedPurchasePersons.map((person, index) => (
                  <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Authorised Person {index + 1}</h3>
                      {authorisedPurchasePersons.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeAuthorisedPurchasePerson(index)}
                          disabled={isSubmitting || authLoading}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={person.name}
                          onChange={(e) => updateAuthorisedPurchasePerson(index, "name", e.target.value)}
                          placeholder="Authorised person name"
                          disabled={isSubmitting || authLoading}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={person.phoneNumber}
                          onChange={(e) => updateAuthorisedPurchasePerson(index, "phoneNumber", e.target.value)}
                          placeholder="0712345678"
                          disabled={isSubmitting || authLoading}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAuthorisedPurchasePerson}
                  disabled={isSubmitting || authLoading}
                  className="w-full"
                >
                  Add Authorised Person
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Suppliers Information (for credit accounts) */}
          {paymentMethod === "credit" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-purple-600" />
                  Current Suppliers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {suppliers.map((supplier, index) => (
                  <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Supplier {index + 1}</h3>
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
                        <Label>Name *</Label>
                        <Input
                          value={supplier.name}
                          onChange={(e) => updateSupplier(index, "name", e.target.value)}
                          placeholder="Supplier name"
                          disabled={isSubmitting || authLoading}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Contact Person Name</Label>
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
                        <Label>Credit Limit (KES)</Label>
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
                  Add Supplier
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Bank Details (for credit accounts) */}
          {paymentMethod === "credit" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-indigo-600" />
                  Bank Account Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankDetails.map((bank, index) => (
                  <div key={index} className="space-y-4 p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium">Bank Account {index + 1}</h3>
                      {bankDetails.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeBankDetail(index)}
                          disabled={isSubmitting || authLoading}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Bank Name *</Label>
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
          )}

          {/* Documents Section */}
          <DocumentForm 
            documents={documents} 
            onChange={setDocuments} 
          />

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="VIP, Regular Customer, Wholesale"
                  disabled={isSubmitting || authLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about this customer..."
                  disabled={isSubmitting || authLoading}
                  rows={4}
                />
              </div>
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
