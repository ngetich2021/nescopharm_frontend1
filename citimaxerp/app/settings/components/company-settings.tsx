"use client"

import { useState, useEffect } from "react"
import apiCall from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Building2, Save, Upload } from "lucide-react"

interface Company {
  id: string
  name: string
  description: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  website: string | null
  logo_url: string | null
  letterhead_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export function CompanySettings() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<Company>>({})
  const { toast } = useToast()
  const { userProfile, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (userProfile?.company?.id) {
      fetchCompany()
    } else if (!authLoading) {
      // If userProfile is loaded but no company_id, set form to empty
      setFormData({
        name: "",
        description: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
        website: "",
        logo_url: "",
        letterhead_url: "",
        is_active: true,
      })
      setLoading(false)
    }
  }, [userProfile?.company?.id, authLoading])

  const fetchCompany = async () => {
    if (!userProfile?.company?.id) {
      setLoading(false)
      return // No company ID available for the user
    }

    try {
      setLoading(true)
      const data = await apiCall<Company>(`/companies/${userProfile.company.id}`, "GET")

      if (data) {
        setCompany(data)
        setFormData(data)
      } else {
        // No company found for this user, initialize with empty form
        setFormData({
          name: "",
          description: "",
          email: "",
          phone: "",
          address: "",
          city: "",
          state: "",
          country: "",
          postal_code: "",
          website: "",
          logo_url: "",
          letterhead_url: "",
          is_active: true,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load company information.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof Company, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      if (!formData.name?.trim()) {
        toast({
          title: "Validation Error",
          description: "Company name is required.",
          variant: "destructive",
        })
        return
      }

      if (company?.id) {
        // Update existing company
        const data = await apiCall<Company>(`/companies/${company.id}`, "PUT", {
          ...formData,
          updated_at: new Date().toISOString(),
        })
        setCompany(data)
      } else {
        // Create new company
        const data = await apiCall<Company>("/companies", "POST", formData)
        setCompany(data)
      }

      toast({
        title: "Success",
        description: company?.id ? "Company information updated successfully." : "Company created successfully.",
      })

      // Refresh data
      await fetchCompany()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save company information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Company Settings</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your company information and settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>Update your company details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter company name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="company@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ""}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website || ""}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://www.company.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Brief description of your company"
              rows={3}
            />
          </div>

          <Separator />

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">Address Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address || ""}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ""}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={formData.state || ""}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    placeholder="NY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code || ""}
                    onChange={(e) => handleInputChange("postal_code", e.target.value)}
                    placeholder="10001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country || ""}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  placeholder="United States"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Logo and Status */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  value={formData.logo_url || ""}
                  onChange={(e) => handleInputChange("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="letterhead_url">Letterhead URL</Label>
              <div className="flex gap-2">
                <Input
                  id="letterhead_url"
                  value={formData.letterhead_url || ""}
                  onChange={(e) => handleInputChange("letterhead_url", e.target.value)}
                  placeholder="https://example.com/letterhead.png"
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Full-width banner shown at the top of downloadable invoices and quotes.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active || false}
                onCheckedChange={(checked) => handleInputChange("is_active", checked)}
              />
              <Label htmlFor="is_active">Company is active</Label>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {company && (
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Company information and timestamps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-gray-500">Company ID</Label>
                <p className="font-mono text-xs">{company.id}</p>
              </div>
              <div>
                <Label className="text-gray-500">Status</Label>
                <p className={company.is_active ? "text-green-600" : "text-red-600"}>
                  {company.is_active ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <Label className="text-gray-500">Created</Label>
                <p>{new Date(company.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-gray-500">Last Updated</Label>
                <p>{new Date(company.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
