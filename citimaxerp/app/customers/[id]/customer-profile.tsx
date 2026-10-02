"use client"

import { DialogTrigger } from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CustomerOrders } from "./customer-orders"
import { CustomerPayments } from "./customer-payments"
import { CustomerCredit } from "./customer-credit"
import { CustomerCheques } from "./customer-cheques"
import { fetchCheques, Cheque } from "@/lib/cheques"
import { ApplicationStatusSection } from "./application-status-section"
import {
  X,
  Mail,
  Phone,
  Edit,
  Building,
  MapPin,
  Check,
  MoreHorizontal,
  PhoneCall,
  Users,
  ListTodo,
  DollarSign,
  User,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Send,
  MessageSquare,
  FileText,
  Calendar,
  ShoppingCart,
  CreditCard,
  History,
  Landmark,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  type Customer as BaseCustomer,
  type CustomerNote,
  type CustomerActivity,
  type Order,
  type Payment,
  getCustomerProfile,
  updateCustomer,
} from "@/lib/customers"

// Define local Order interface that extends the imported Order type
interface ExtendedOrder extends Order {
  tracking_number?: string | null;
  final_amount?: number;
  order_items?: any[];
}

// Extend the Customer type to match the actual API response structure
type Customer = Omit<BaseCustomer, 'notes'> & {
  notes?: CustomerNote[];
  activities?: CustomerActivity[];
  orders?: ExtendedOrder[];
  payments?: Payment[];
  avatar_url?: string;
}

interface CustomerProfileProps {
  customerId: string
  isOpen: boolean
  onClose: () => void
}

// ChatMessage interface remains as it's not part of the profile API response
interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_type: "customer" | "agent"
  message: string
  message_type: "text" | "image" | "file" | "location"
  media_url?: string
  created_at: string
  read: boolean
}

export function CustomerProfile({ customerId, isOpen, onClose }: CustomerProfileProps) {
  const [activeTab, setActiveTab] = useState("chat")
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editableName, setEditableName] = useState("")
  const [editableEmail, setEditableEmail] = useState("")
  const [editablePhone, setEditablePhone] = useState("")
  const [editableAddress, setEditableAddress] = useState("")
  const [editableCity, setEditableCity] = useState("")
  const [editableCountry, setEditableCountry] = useState("")
  const [editablePostalCode, setEditablePostalCode] = useState("")
  const [editableTags, setEditableTags] = useState("")
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [callDate, setCallDate] = useState("")
  const [callTime, setCallTime] = useState("")
  const [callDescription, setCallDescription] = useState("")
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)
  const [meetingDate, setMeetingDate] = useState("")
  const [meetingStartTime, setMeetingStartTime] = useState("")
  const [meetingEndTime, setMeetingEndTime] = useState("")
  const [meetingDescription, setMeetingDescription] = useState("")
  // const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([])
  // const [customerActivities, setCustomerActivities] = useState<CustomerActivity[]>([])
  const [customerOrders, setCustomerOrders] = useState<ExtendedOrder[]>([]) // New state for orders with extended type
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]) // New state for payments
  const [customerCheques, setCustomerCheques] = useState<Cheque[]>([]) // PD cheques received - tab only shows when non-empty
  const [taskDescription, setTaskDescription] = useState("")
  const [taskDueDate, setTaskDueDate] = useState("")
  const [checklistItems, setChecklistItems] = useState<string[]>([""])
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([])
  const [customerActivities, setCustomerActivities] = useState<CustomerActivity[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [currentNotePage, setCurrentNotePage] = useState(1)
  const [currentActivityPage, setCurrentActivityPage] = useState(1)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoadingChat, setIsLoadingChat] = useState(false)
  const notesPerPage = 4
  const activitiesPerPage = 3
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerData()
      setChatMessages([])
      setVisibleMessages([])
      setHasMoreMessages(false)
      setIsLoadingChat(false)
    }
  }, [customerId, isOpen])

  useEffect(() => {
    if (!isOpen || !customerId) return
    let cancelled = false
    fetchCheques({ customer_id: customerId, direction: "received" })
      .then((data) => {
        if (!cancelled) setCustomerCheques(data)
      })
      .catch(() => {
        if (!cancelled) setCustomerCheques([])
      })
    return () => {
      cancelled = true
    }
  }, [customerId, isOpen])

  async function fetchCustomerData() {
    setIsLoading(true)
    try {
      console.log(`Fetching customer profile data from /api/customers/${customerId}/profile`)
      const customerData = await getCustomerProfile(customerId)

      if (!customerData) {
        console.error("Customer profile not found with ID:", customerId)
        setCustomer(null)
        return
      }

      // Transform the API data to match our Customer type
      const transformedCustomer: Customer = {
        ...customerData,
        notes: Array.isArray(customerData.notes) ? customerData.notes : undefined,
        activities: Array.isArray(customerData.activities) ? customerData.activities : undefined,
        orders: Array.isArray(customerData.orders) ? customerData.orders : undefined,
        payments: Array.isArray(customerData.payments) ? customerData.payments : undefined,
      }
      
      setCustomer(transformedCustomer)
      setEditableName(customerData.name)
      setEditableEmail(customerData.email || "")
      setEditablePhone(customerData.phone || "")
      setEditableAddress(customerData.address || "")
      setEditableCity(customerData.city || "")
      setEditableCountry(customerData.country || "")
      setEditablePostalCode(customerData.postal_code || "")
      // Set tags from customer data if available
      setEditableTags(customerData.tags ? 
        (Array.isArray(customerData.tags) ? customerData.tags.join(", ") : customerData.tags) : "")
      
      // Populate notes, activities, orders, and payments from the fetched profile data
      setCustomerNotes(Array.isArray(customerData.notes) ? customerData.notes : [])
      setCustomerActivities(Array.isArray(customerData.activities) ? customerData.activities : [])
      
      // Transform orders to include required properties for ExtendedOrder
      setCustomerOrders(
        (customerData.orders || []).map(order => ({
          ...order,
          tracking_number: (order as any).tracking_number || null,
          final_amount: (order as any).final_amount || (order as any).amount || 0,
          order_items: (order as any).order_items || []
        }))
      )
      
      setCustomerPayments(customerData.payments || []) // Set payments from profile data

      console.log("Customer profile data fetched successfully:", customerData)
    } catch (error) {
      console.error("Error fetching customer data:", error)
      setCustomer(null)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMoreMessages = () => {
    // This function will not work until chat API is implemented
    console.log("Load more messages functionality needs API endpoint.")
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return

    // TODO: Implement API call to send a message
    console.log("Send message functionality needs API endpoint:", newMessage)
    setNewMessage("")
    toast({
      title: "Info",
      description: "Message sending is not yet implemented via API.",
      variant: "default",
    })
  }

  const handleUpdate = async () => {
    if (!customer) return

    try {
      const updates: Partial<Omit<import("@/lib/customers").Customer, "id" | "created_at" | "updated_at">> = {
        name: editableName,
        email: editableEmail,
        phone: editablePhone,
        address: editableAddress,
        city: editableCity,
        country: editableCountry,
        postal_code: editablePostalCode,
        tags: editableTags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ""),
      }

      const updatedCustomer = await updateCustomer(customer.id, updates)

      if (updatedCustomer) {
        // Merge the updated customer with existing customer data to maintain the correct type
        setCustomer(prevCustomer => {
          if (!prevCustomer) return null;
          return {
            ...prevCustomer,
            ...updatedCustomer,
            // Preserve the existing array properties to maintain type compatibility
            notes: prevCustomer.notes,
            activities: prevCustomer.activities,
            orders: prevCustomer.orders,
            payments: prevCustomer.payments
          };
        });
        setIsEditing(false)
        toast({
          title: "Customer updated",
          description: "Customer information has been updated successfully.",
        })
      } else {
        toast({
          title: "Update failed",
          description: "There was an error updating the customer information.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error updating customer:", error)
      toast({
        title: "Update failed",
        description: error.message || "An unexpected error occurred while updating the customer.",
        variant: "destructive",
      })
    }
  }

  const addNote = async () => {
    if (!newNote.trim()) return

    // TODO: Replace with API call to add a customer note
    // Example placeholder:
    // const response = await apiCall('/customer-notes', 'POST', {
    //   customer_id: customerId,
    //   note_content: newNote.trim(),
    //   created_by: "current-user-id", // Replace with actual user ID
    // }, true);
    // if (response.status === 'success') {
    //   setNewNote("");
    //   setIsAddNoteModalOpen(false);
    //   // Re-fetch notes or update state directly
    //   // fetchCustomerNotes();
    //   toast({ title: "Note Added", description: "Your note has been added successfully." });
    // } else {
    //   toast({ title: "Error", description: "Failed to add note. Please try again.", variant: "destructive" });
    // }

    console.log("Add note functionality needs API endpoint:", newNote)
    setNewNote("")
    setIsAddNoteModalOpen(false)
    toast({
      title: "Info",
      description: "Note adding is not yet implemented via API.",
      variant: "default",
    })
  }

  const getTagColor = (tag: string) => {
    let hash = 0
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = hash % 360
    return `hsl(${hue}, 70%, 80%)`
  }

  const scheduleCall = async () => {
    // TODO: Replace with API call to schedule a call
    // Example placeholder:
    // const response = await apiCall('/customer-activities', 'POST', {
    //   customer_id: customerId,
    //   activity_type: "call",
    //   title: "Scheduled Call",
    //   description: callDescription.trim(),
    //   start_time: `${callDate}T${callTime}:00`,
    //   status: "scheduled",
    // }, true);
    // if (response.status === 'success') {
    //   toast({ title: "Call Scheduled", description: "The call has been successfully scheduled." });
    //   setIsCallModalOpen(false);
    //   setCallDate(""); setCallTime(""); setCallDescription("");
    //   // fetchCustomerActivities();
    //   setActiveTab("activities");
    // } else {
    //   toast({ title: "Error", description: "Failed to schedule call. Please try again.", variant: "destructive" });
    // }

    console.log("Schedule call functionality needs API endpoint:", { callDate, callTime, callDescription })
    setIsCallModalOpen(false)
    toast({
      title: "Info",
      description: "Call scheduling is not yet implemented via API.",
      variant: "default",
    })
  }

  // const handleScheduleMeeting = async () => {
  //   // TODO: Replace with API call to schedule a meeting
  //   console.log("Schedule meeting functionality needs API endpoint:", {
  //     meetingDate,
  //     meetingStartTime,
  //     meetingEndTime,
  //     meetingDescription,
  //     meetingLocation,
  //     meetingEmails,
  //   })
  //   setIsMeetingModalOpen(false)
  //   toast({
  //     title: "Info",
  //     description: "Meeting scheduling is not yet implemented via API.",
  //     variant: "default",
  //   })
  // }

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, ""])
  }

  const updateChecklistItem = (index: number, value: string) => {
    const updatedItems = [...checklistItems]
    updatedItems[index] = value
    setChecklistItems(updatedItems)
  }

  const removeChecklistItem = (index: number) => {
    const updatedItems = checklistItems.filter((_, i) => i !== index)
    setChecklistItems(updatedItems)
  }

  // const handleCreateTask = async () => {
  //   // TODO: Replace with API call to create a task
  //   console.log("Create task functionality needs API endpoint:", {
  //     taskTitle,
  //     taskDescription,
  //     taskDueDate,
  //     checklistItems,
  //   })
  //   setIsTaskModalOpen(false)
  //   toast({
  //     title: "Info",
  //     description: "Task creation is not yet implemented via API.",
  //     variant: "default",
  //   })
  // }

  const getActivityTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "call":
        return <PhoneCall className="h-4 w-4 text-blue-600" />
      case "meeting":
        return <Users className="h-4 w-4 text-green-600" />
      case "email":
        return <Mail className="h-4 w-4 text-purple-600" />
      case "task":
        return <ListTodo className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getActivityTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "call":
        return "bg-blue-100"
      case "meeting":
        return "bg-green-100"
      case "email":
        return "bg-purple-100"
      case "task":
        return "bg-orange-100"
      default:
        return "bg-gray-100"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-50 text-green-700"
      case "scheduled":
        return "bg-blue-50 text-blue-700"
      case "pending":
        return "bg-yellow-50 text-yellow-700"
      case "cancelled":
        return "bg-red-50 text-red-700"
      case "in progress":
        return "bg-purple-50 text-purple-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return "N/A"
    const date = new Date(dateTimeString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else if (diffDays < 7 && diffDays > 0) {
      return `${diffDays} days ago, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    } else {
      return date.toLocaleDateString() + ", " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  }

  const formatChatTime = (dateTimeString: string) => {
    if (!dateTimeString) return ""
    const date = new Date(dateTimeString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else {
      return (
        date.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      )
    }
  }

  if (!isOpen) return null

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/20">
        <div className="absolute right-0 top-0 h-full w-[600px] bg-white shadow-xl">
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">Loading customer data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="fixed inset-0 z-50 bg-black/20">
        <div className="absolute right-0 top-0 h-full w-[600px] bg-white shadow-xl">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="rounded-full bg-red-100 p-3 mb-4">
              <User className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium">Customer not found</h3>
            <p className="text-sm text-muted-foreground mt-1">The requested customer could not be found.</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-[600px] bg-white shadow-xl animate-in slide-in-from-right duration-300 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Customer Details</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={async () => {
                if (isEditing) {
                  await handleUpdate()
                } else {
                  setIsEditing(true)
                }
              }}
              className="gap-1"
            >
              {isEditing ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save</span>
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  <span>Edit</span>
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Customer Header */}
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex items-start gap-5">
              <Avatar className="h-20 w-20 border-4 border-white shadow-md">
                <AvatarImage src={customer.avatar_url || ""} alt={customer.business_name || customer.name} />
                <AvatarFallback className="bg-primary text-white text-2xl">
                  {getInitials(customer.business_name || customer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  {isEditing ? (
                    <div className="w-full">
                      <Label htmlFor="customer-name" className="text-sm text-gray-600 mb-1 block">
                        {customer.business_name ? "Contact/Customer Name" : "Customer Name"}
                      </Label>
                      <Input
                        id="customer-name"
                        value={editableName}
                        onChange={(e) => setEditableName(e.target.value)}
                        className="text-xl font-bold h-10"
                      />
                    </div>
                  ) : (
                    <h3 className="text-3xl font-bold text-gray-900">
                      {/* Show a captured business name whenever it exists,
                          not just for customer_type === "company". */}
                      {customer.business_name || customer.name}
                    </h3>
                  )}
                  <Badge
                    variant={customer.status === "active" ? "default" : "secondary"}
                    className={
                      customer.status === "active"
                        ? "bg-green-100 text-green-800 hover:bg-green-200 text-sm px-3 py-1"
                        : "bg-gray-100 text-gray-800 text-sm px-3 py-1"
                    }
                  >
                    {customer.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-gray-600 mb-3">
                  {isEditing ? (
                    <div className="w-full space-y-2">
                      <div>
                        <Label htmlFor="customer-email" className="text-sm text-gray-600 mb-1 block">
                          Email Address
                        </Label>
                        <Input
                          id="customer-email"
                          value={editableEmail}
                          onChange={(e) => setEditableEmail(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer-phone" className="text-sm text-gray-600 mb-1 block">
                          Phone Number
                        </Label>
                        <Input
                          id="customer-phone"
                          value={editablePhone}
                          onChange={(e) => setEditablePhone(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{customer.email}</span>
                      </div>
                      {customer.phone && (
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                          <Phone className="h-4 w-4 text-primary" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </>
                  )}
                  {!isEditing && customer.company && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm">
                      <Building className="h-4 w-4 text-primary" />
                      <span>{customer.company}</span>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="w-full space-y-2 mt-2">
                    <div>
                      <Label htmlFor="customer-address" className="text-sm text-gray-600 mb-1 block">
                        Address
                      </Label>
                      <Input
                        id="customer-address"
                        value={editableAddress}
                        onChange={(e) => setEditableAddress(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="customer-city" className="text-sm text-gray-600 mb-1 block">
                          City
                        </Label>
                        <Input
                          id="customer-city"
                          value={editableCity}
                          onChange={(e) => setEditableCity(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customer-postal-code" className="text-sm text-gray-600 mb-1 block">
                          Postal Code
                        </Label>
                        <Input
                          id="customer-postal-code"
                          value={editablePostalCode}
                          onChange={(e) => setEditablePostalCode(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="customer-country" className="text-sm text-gray-600 mb-1 block">
                        Country
                      </Label>
                      <Input
                        id="customer-country"
                        value={editableCountry}
                        onChange={(e) => setEditableCountry(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                ) : (
                  (customer.address || customer.city || customer.state || customer.country) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-2 mb-3 bg-white px-3 py-1.5 rounded-full shadow-sm">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>
                        {[customer.address, customer.city, customer.state, customer.country, customer.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )
                )}
                <div className="mt-3">
                  {isEditing ? (
                    <div className="w-full">
                      <Label htmlFor="customer-tags" className="text-sm text-gray-600 mb-1 block">
                        Tags (comma separated)
                      </Label>
                      <Textarea
                        id="customer-tags"
                        value={editableTags}
                        onChange={(e) => setEditableTags(e.target.value)}
                        placeholder="Enter tags separated by commas"
                        className="h-20 text-sm"
                      />
                    </div>
                  ) : customer.tags && customer.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(customer.tags) ? customer.tags : [customer.tags]).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          style={{
                            backgroundColor: getTagColor(tag),
                            color: "black",
                            borderColor: "transparent",
                          }}
                          className="px-3 py-1 text-sm"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No tags</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Application Status (credit-approval workflow for rep-submitted customers) */}
          <div className="px-6 pt-6">
            <ApplicationStatusSection
              customerId={customerId}
              approvalStatus={customer.approval_status}
              customer={customer}
              onRefresh={fetchCustomerData}
            />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 p-5 border-b border-gray-200 bg-white">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 shadow-sm border border-blue-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-blue-700">Orders</h4>
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <ListTodo className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-900">{customer.total_orders}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 shadow-sm border border-green-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-green-700">Total Spent</h4>
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-green-900">
                Ksh. {Number.parseFloat(customer.total_spend).toFixed(2)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 shadow-sm border border-purple-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-purple-700">Avg. Order</h4>
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-900">
                Ksh.{" "}
                {customer.total_orders > 0
                  ? (Number.parseFloat(customer.total_spend) / customer.total_orders).toFixed(2)
                  : "0.00"}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          {/* <div className="p-5 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold mb-4 text-gray-700">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-12 shadow hover:shadow-md bg-white border-gray-200"
                  >
                    <PhoneCall className="h-5 w-5 text-primary" />
                    <span className="font-medium">Schedule Call</span>
                  </Button>
                </DialogTrigger>
              </Dialog>
              <Dialog open={isMeetingModalOpen} onOpenChange={setIsMeetingModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-12 shadow hover:shadow-md bg-white border-gray-200"
                  >
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-medium">Schedule Meeting</span>
                  </Button>
                </DialogTrigger>
              </Dialog>
              <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-12 shadow hover:shadow-md bg-white border-gray-200"
                  >
                    <ListTodo className="h-5 w-5 text-primary" />
                    <span className="font-medium">Create Task</span>
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div> */}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-16">
            <div className="border-b border-gray-200">
              <div className="px-4 overflow-x-auto">
                <TabsList className="h-14 bg-transparent p-0 w-full justify-start gap-8">
                  <TabsTrigger
                    value="chat"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span>Chat</span>
                  </TabsTrigger>
                  {/* <TabsTrigger
                    value="notes"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                  >
                    <FileText className="h-5 w-5" />
                    <span>Notes</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="activities"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                  >
                    <Calendar className="h-5 w-5" />
                    <span>Activities</span>
                  </TabsTrigger> */}
                  <TabsTrigger
                    value="orders"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>Orders</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="payments"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>Payments</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="credit"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                  >
                    <History className="h-5 w-5" />
                    <span>Credit</span>
                  </TabsTrigger>
                  {customerCheques.length > 0 && (
                    <TabsTrigger
                      value="cheques"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none px-2 py-4 h-full bg-transparent flex items-center gap-2 transition-all font-medium"
                    >
                      <Landmark className="h-5 w-5" />
                      <span>PD Cheques</span>
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>
            </div>

            <TabsContent value="chat" className="p-0 m-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">
                {isLoadingChat ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                      <p className="text-sm text-muted-foreground">Loading conversation...</p>
                    </div>
                  </div>
                ) : visibleMessages.length > 0 ? (
                  <>
                    {hasMoreMessages && (
                      <div className="flex justify-center mb-4">
                        <Button variant="outline" size="sm" onClick={loadMoreMessages} className="text-xs">
                          Load more messages
                        </Button>
                      </div>
                    )}
                    {visibleMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.sender_type === "agent" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.sender_type === "agent"
                              ? "bg-primary text-white rounded-tr-none shadow-md"
                              : "bg-gray-100 text-gray-800 rounded-tl-none shadow-sm"
                          }`}
                        >
                          <div className="text-sm">{message.message}</div>
                          <div
                            className={`text-xs mt-1 ${message.sender_type === "agent" ? "text-pink-100" : "text-gray-500"}`}
                          >
                            {formatChatTime(message.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                      <MessageSquare className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No messages yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Start a conversation with this customer</p>
                  </div>
                )}
              </div>

              {/* Fixed message input */}
              <div className="p-4 pt-5 pb-6 border-t border-gray-200 bg-white sticky bottom-0 left-0 right-0 shadow-xl z-10">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    className="flex-1 border-2 border-gray-300 focus:border-primary h-12"
                  />
                  <Button onClick={sendMessage} size="lg" className="bg-primary hover:bg-primary/90 h-12 px-5">
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="p-0 m-0">
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Customer Notes</h3>
                    <Dialog open={isAddNoteModalOpen} onOpenChange={setIsAddNoteModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          Add Note
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Add New Note</DialogTitle>
                          <DialogDescription>Create a new note for this customer.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="note" className="text-right">
                              Note
                            </Label>
                            <Textarea
                              id="note"
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              className="col-span-3"
                              placeholder="Enter your note here..."
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" onClick={addNote}>
                            Save Note
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    Important information and observations about this customer
                  </div>
                  {customerNotes.length > 0 ? (
                    <div className="space-y-3">
                      {customerNotes
                        .slice((currentNotePage - 1) * notesPerPage, currentNotePage * notesPerPage)
                        .map((note) => (
                          <div key={note.id} className="rounded-lg border border-gray-200 p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm text-gray-900 mb-2">{note.note_content}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  {/* Assuming created_by is not directly in the API response for notes,
                                      so I'll remove it or add a placeholder */}
                                  <span>Added on {formatDate(note.created_at)}</span>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      {customerNotes.length > notesPerPage && (
                        <div className="flex justify-between items-center mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentNotePage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentNotePage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentNotePage} of {Math.ceil(customerNotes.length / notesPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentNotePage((prev) =>
                                Math.min(prev + 1, Math.ceil(customerNotes.length / notesPerPage)),
                              )
                            }
                            disabled={currentNotePage === Math.ceil(customerNotes.length / notesPerPage)}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                        <ListTodo className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No notes yet</h3>
                      <p className="text-sm text-gray-500 mb-4">Add your first note about this customer</p>
                      <Button variant="outline" onClick={() => setIsAddNoteModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* <TabsContent value="activities" className="p-0 m-0">
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Customer Activities</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsCallModalOpen(true)}>
                        <PhoneCall className="h-4 w-4 mr-1" />
                        Call
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setIsMeetingModalOpen(true)}>
                        <Users className="h-4 w-4 mr-1" />
                        Meeting
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setIsTaskModalOpen(true)}>
                        <ListTodo className="h-4 w-4 mr-1" />
                        Task
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-4">Recent interactions and scheduled activities</div>
                  {customerActivities.length > 0 ? (
                    <div className="space-y-3">
                      {customerActivities
                        .slice((currentActivityPage - 1) * activitiesPerPage, currentActivityPage * activitiesPerPage)
                        .map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3">
                            <div
                              className={`w-8 h-8 rounded-full ${getActivityTypeColor(
                                activity.activity_type,
                              )} flex items-center justify-center flex-shrink-0`}
                            >
                              {getActivityTypeIcon(activity.activity_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                                <span className="text-xs text-gray-500">{formatDateTime(activity.start_time)}</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={`text-xs ${getStatusBadgeColor(activity.status)}`}>
                                  {activity.status}
                                </Badge>
                                {activity.location && (
                                  <Badge variant="outline" className="text-xs">
                                    {activity.location}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      {customerActivities.length > activitiesPerPage && (
                        <div className="flex justify-between items-center mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentActivityPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentActivityPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentActivityPage} of {Math.ceil(customerActivities.length / activitiesPerPage)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentActivityPage((prev) =>
                                Math.min(prev + 1, Math.ceil(customerActivities.length / activitiesPerPage)),
                              )
                            }
                            disabled={currentActivityPage === Math.ceil(customerActivities.length / activitiesPerPage)}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                        <Clock className="h-6 w-6 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No activities yet</h3>
                      <p className="text-sm text-gray-500 mb-4">Schedule your first activity with this customer</p>
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline" onClick={() => setIsCallModalOpen(true)}>
                          <PhoneCall className="h-4 w-4 mr-2" />
                          Schedule Call
                        </Button>
                        <Button variant="outline" onClick={() => setIsTaskModalOpen(true)}>
                          <ListTodo className="h-4 w-4 mr-2" />
                          Create Task
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent> */}

            <TabsContent value="orders" className="p-0 m-0">
              <div className="p-4">
                {/* Pass customerOrders directly to CustomerOrders component */}
                <CustomerOrders customerId={customerId} initialOrders={customerOrders} />
              </div>
            </TabsContent>

            <TabsContent value="payments" className="p-0 m-0">
              <div className="p-4">
                {/* Pass customerPayments directly to CustomerPayments component */}
                <CustomerPayments customerId={customerId} initialPayments={customerPayments} />
              </div>
            </TabsContent>

            <TabsContent value="credit" className="p-0 m-0">
              <CustomerCredit customerId={customerId} />
            </TabsContent>

            {customerCheques.length > 0 && (
              <TabsContent value="cheques" className="p-4 m-0">
                <CustomerCheques customerId={customerId} initialCheques={customerCheques} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Schedule a Call</DialogTitle>
            <DialogDescription>Set up a call with the customer. Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="call-date" className="text-right">
                Date
              </Label>
              <Input
                id="call-date"
                type="date"
                className="col-span-3"
                value={callDate}
                onChange={(e) => setCallDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="call-time" className="text-right">
                Time
              </Label>
              <Input
                id="call-time"
                type="time"
                className="col-span-3"
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="call-description" className="text-right">
                Description
              </Label>
              <Input
                id="call-description"
                placeholder="Brief description of the call"
                className="col-span-3"
                value={callDescription}
                onChange={(e) => setCallDescription(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={scheduleCall}>
              Schedule Call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* <Dialog open={isMeetingModalOpen} onOpenChange={setIsMeetingModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Schedule a Meeting</DialogTitle>
            <DialogDescription>Set up a meeting with the customer. Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-date" className="text-right">
                Date
              </Label>
              <Input
                id="meeting-date"
                type="date"
                className="col-span-3"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-start-time" className="text-right">
                Start Time
              </Label>
              <Input
                id="meeting-start-time"
                type="time"
                className="col-span-3"
                value={meetingStartTime}
                onChange={(e) => setMeetingStartTime(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-end-time" className="text-right">
                End Time
              </Label>
              <Input
                id="meeting-end-time"
                type="time"
                className="col-span-3"
                value={meetingEndTime}
                onChange={(e) => setMeetingEndTime(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-location" className="text-right">
                Location
              </Label>
              <Input
                id="meeting-location"
                className="col-span-3"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="Enter meeting location"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-description" className="text-right">
                Description
              </Label>
              <Input
                id="meeting-description"
                className="col-span-3"
                value={meetingDescription}
                onChange={(e) => setMeetingDescription(e.target.value)}
                placeholder="Brief description of the meeting"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="meeting-emails" className="text-right">
                Emails
              </Label>
              <Input
                id="meeting-emails"
                className="col-span-3"
                value={meetingEmails}
                onChange={(e) => setMeetingEmails(e.target.value)}
                placeholder="Optional: Comma-separated email addresses"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleScheduleMeeting}>
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}

      {/* <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create a Task</DialogTitle>
            <DialogDescription>Create a new task with a checklist. Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-title" className="text-right">
                Title
              </Label>
              <Input
                id="task-title"
                className="col-span-3"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-description" className="text-right">
                Description
              </Label>
              <Textarea
                id="task-description"
                className="col-span-3"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-due-date" className="text-right">
                Due Date
              </Label>
              <Input
                id="task-due-date"
                type="date"
                className="col-span-3"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Checklist</Label>
              <div className="col-span-3 space-y-2">
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox id={`checklist-item-${index}`} />
                    <Input
                      value={item}
                      onChange={(e) => updateChecklistItem(index, e.target.value)}
                      placeholder="Checklist item"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeChecklistItem(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
                  Add Checklist Item
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateTask}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> */}
    </>
  )
}
