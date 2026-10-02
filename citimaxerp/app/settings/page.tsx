"use client"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { UserProfile } from "@/app/profile/components/user-profile"
// import { PaymentSettings } from "@/app/profile/components/payment-settings";
// import { ChatSettings } from "@/app/profile/components/chat-settings";
// import { DataExport } from "@/app/profile/components/data-export";
// import { DeleteAccount } from "@/app/profile/components/delete-account";
import { SubscriptionSettings } from "@/app/settings/components/subscription-settings"
import { CompanySettings } from "@/app/settings/components/company-settings"
import UserManagementPage from "@/app/settings/user-management/page" // Import the new page
import ApproversManagementPage from "@/app/settings/approvers/page" // Import approvers page
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react" // Import Users icon
import { usePermissions } from "@/hooks/use-permissions"
import ChatSetup from "./components/chat-setup";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PermissionGuard } from "@/components/PermissionGuard";
import EtimsSettingsPage from "@/app/settings/etims/page";

type ActiveSection =
  | "profile"
  | "company"
  | "subscriptions"
  | "payments"
  | "chats"
  | "chat-setup"
  | "data-export"
  | "delete-account"
  | "user-management"
  | "approvers"
  | "etims"

export default function SettingsPage() {
  // Renamed from ProfilePage to SettingsPage for clarity
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<ActiveSection>("profile")
  const { userProfile, isLoading: authLoading } = useAuth()
  const { hasPermission } = usePermissions()
  const [user, setUser] = useState({
    firstName: "",
    lastName: "",
    title: "",
    location: "",
    email: "",
    phone: "",
    bio: "",
    country: "",
    cityState: "",
    postalCode: "",
    taxId: "",
    avatar: "/placeholder.svg?height=80&width=80",
  })

  function mapApiUserToUserProfileProps(apiUser: any) {
    return {
      firstName: apiUser.first_name || "",
      lastName: apiUser.last_name || "",
      title: apiUser.title || "",
      location: apiUser.location || "",
      email: apiUser.email || "",
      phone: apiUser.phone || "",
      bio: apiUser.bio || "",
      country: apiUser.country || "",
      cityState: apiUser.city_state || "",
      postalCode: apiUser.postal_code || "",
      taxId: apiUser.tax_id || "",
      avatar: apiUser.avatar_url || "/placeholder.svg?height=80&width=80",
    };
  }

  useEffect(() => {
    if (userProfile) {
      setUser(mapApiUserToUserProfileProps(userProfile));
    }
  }, [userProfile]);

  const handleEditProfile = () => {
    // Implement your edit logic here
  }

  const handleEditPersonalInfo = () => {
    // Implement your edit logic here
  }

  const handleEditAddress = () => {
    // Implement your edit logic here
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <UserProfile
            user={user}
            onEditProfile={handleEditProfile}
            onEditPersonalInfo={handleEditPersonalInfo}
            onEditAddress={handleEditAddress}
          />
        )
      case "company":
        return <CompanySettings />
      case "subscriptions":
        return <SubscriptionSettings />
      case "user-management": // New case for user management
        return <UserManagementPage />
      case "approvers": // New case for approvers management
        return <ApproversManagementPage />
      case "etims":
        return <EtimsSettingsPage />
      case "payments":
      //     return <PaymentSettings />;
      // case 'chats':
      //     return <ChatSettings />;
      case "chat-setup":
        return <ChatSetup />;
      // case 'data-export':
      //     return <DataExport />;
      // case 'delete-account':
      //     return <DeleteAccount />;
      default:
        return (
          <UserProfile
            user={user}
            onEditProfile={handleEditProfile}
            onEditPersonalInfo={handleEditPersonalInfo}
            onEditAddress={handleEditAddress}
          />
        )
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <PermissionGuard permissions={["can_view_settings_menu", "can_manage_system", "can_manage_company"]}>
      <div className="w-full py-8 min-h-screen bg-gray-50">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Settings</h2>
        </div>
        <Tabs
          value={activeSection}
          onValueChange={setActiveSection as any}
          className="w-full"
        >
          <TabsList className="grid w-fit grid-cols-10 bg-gray-100 rounded-lg p-1 mb-8">
            <TabsTrigger value="profile" className="text-sm">My Profile</TabsTrigger>
            <TabsTrigger value="company" className="text-sm">Company</TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-sm">Subscriptions</TabsTrigger>
            <PermissionGuard permissions={["can_manage_users_and_roles", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <TabsTrigger value="user-management" className="text-sm">User Management</TabsTrigger>
            </PermissionGuard>
            <PermissionGuard permissions={["can_manage_dispatch_settings", "can_manage_system", "can_manage_company"]} hideOnDenied>
              <TabsTrigger value="approvers" className="text-sm">Approvers</TabsTrigger>
            </PermissionGuard>
            <TabsTrigger value="payments" className="text-sm">Payments</TabsTrigger>
            <TabsTrigger value="chat-setup" className="text-sm">Chat Setup</TabsTrigger>
            <PermissionGuard permissions={["can_manage_system", "can_manage_company"]} hideOnDenied>
              <TabsTrigger value="etims" className="text-sm">eTIMS</TabsTrigger>
            </PermissionGuard>
            <TabsTrigger value="data-export" className="text-sm">Data Export</TabsTrigger>
            <TabsTrigger value="delete-account" className="text-sm">Delete Account</TabsTrigger>
          </TabsList>
          <div className="w-full">
            <TabsContent value="profile">{activeSection === "profile" && renderActiveSection()}</TabsContent>
            <TabsContent value="company">{activeSection === "company" && renderActiveSection()}</TabsContent>
            <TabsContent value="subscriptions">{activeSection === "subscriptions" && renderActiveSection()}</TabsContent>
            <TabsContent value="user-management">{activeSection === "user-management" && renderActiveSection()}</TabsContent>
            <TabsContent value="approvers">{activeSection === "approvers" && renderActiveSection()}</TabsContent>
            <TabsContent value="payments">{activeSection === "payments" && renderActiveSection()}</TabsContent>
            <TabsContent value="chat-setup">{activeSection === "chat-setup" && renderActiveSection()}</TabsContent>
            <TabsContent value="etims">{activeSection === "etims" && renderActiveSection()}</TabsContent>
            <TabsContent value="data-export">{activeSection === "data-export" && renderActiveSection()}</TabsContent>
            <TabsContent value="delete-account">{activeSection === "delete-account" && renderActiveSection()}</TabsContent>
          </div>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
