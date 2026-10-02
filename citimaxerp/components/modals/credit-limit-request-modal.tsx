"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { X, Upload, FileText } from "lucide-react"
import { requestCreditLimitUpdate, type CreditLimitUpdateRequest } from "@/lib/customer-accounts"

interface CreditLimitRequestModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  customerAccountId: string
  currentCreditLimit: number
  currentCreditDays?: number | null
}

interface FormData {
  requested_credit_limit: string
  requested_credit_days: string
  reason: string
}

interface ValidationErrors {
  requested_credit_limit?: string
  requested_credit_days?: string
  reason?: string
}

export const CreditLimitRequestModal: React.FC<CreditLimitRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerAccountId,
  currentCreditLimit,
  currentCreditDays
}) => {
  const [formData, setFormData] = useState<FormData>({
    requested_credit_limit: '',
    requested_credit_days: '',
    reason: ''
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [supportingFiles, setSupportingFiles] = useState<File[]>([])
  const { toast } = useToast()

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.requested_credit_limit.trim() && !formData.requested_credit_days.trim()) {
      newErrors.requested_credit_limit = "Provide a new credit limit and/or a new credit period"
    }
    if (formData.requested_credit_limit.trim()) {
      const amount = parseFloat(formData.requested_credit_limit)
      if (isNaN(amount) || amount <= 0) {
        newErrors.requested_credit_limit = "Please enter a valid positive amount"
      }
    }
    if (formData.requested_credit_days.trim()) {
      const days = parseInt(formData.requested_credit_days, 10)
      if (isNaN(days) || days < 0) {
        newErrors.requested_credit_days = "Please enter a valid number of days"
      }
    }

    if (!formData.reason.trim()) {
      newErrors.reason = "Reason is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSupportingFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSupportingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const requestData: CreditLimitUpdateRequest = {
        requested_credit_limit: formData.requested_credit_limit.trim() ? parseFloat(formData.requested_credit_limit) : undefined,
        requested_credit_days: formData.requested_credit_days.trim() ? parseInt(formData.requested_credit_days, 10) : undefined,
        reason: formData.reason,
        justification: formData.reason, // Use reason as justification
        supporting_documents: supportingFiles.map(file => file.name)
      }

      await requestCreditLimitUpdate(customerAccountId, requestData)

      toast({
        title: "Success",
        description: "Credit terms update request submitted successfully. Awaiting GM approval.",
      })

      // Reset form
      setFormData({
        requested_credit_limit: '',
        requested_credit_days: '',
        reason: ''
      })
      setSupportingFiles([])
      setErrors({})

      onSuccess?.()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit credit limit request",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      requested_credit_limit: '',
      requested_credit_days: '',
      reason: ''
    })
    setSupportingFiles([])
    setErrors({})
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Request Credit Terms Update</h2>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Credit Terms Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Current Credit Limit</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-green-600">
                  Ksh {currentCreditLimit.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Current Credit Period</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold text-green-600">
                  {currentCreditDays != null ? `${currentCreditDays} days` : "Not set"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Requested Credit Limit / Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requested_credit_limit">Requested Credit Limit (Ksh)</Label>
              <Input
                id="requested_credit_limit"
                type="number"
                step="0.01"
                min="0"
                value={formData.requested_credit_limit}
                onChange={(e) => handleInputChange('requested_credit_limit', e.target.value)}
                placeholder="Leave blank to keep current"
                className={errors.requested_credit_limit ? "border-red-500" : ""}
              />
              {errors.requested_credit_limit && (
                <p className="text-sm text-red-500">{errors.requested_credit_limit}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="requested_credit_days">Requested Credit Period (Days)</Label>
              <Input
                id="requested_credit_days"
                type="number"
                min="0"
                value={formData.requested_credit_days}
                onChange={(e) => handleInputChange('requested_credit_days', e.target.value)}
                placeholder="e.g. 60"
                className={errors.requested_credit_days ? "border-red-500" : ""}
              />
              {errors.requested_credit_days && (
                <p className="text-sm text-red-500">{errors.requested_credit_days}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Provide either or both. Changes only take effect once a GM approves this request.
          </p>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Request <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              rows={4}
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              placeholder="Provide detailed reason for the credit limit update including business growth, cash flow improvements, new contracts, etc."
              className={errors.reason ? "border-red-500" : ""}
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason}</p>
            )}
          </div>

          {/* Supporting Documents */}
          <div className="space-y-2">
            <Label>Supporting Documents</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <Label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  Select Files
                </Label>
              </div>
              
              {supportingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Selected files:</p>
                  {supportingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                Upload financial statements, cash flow projections, contracts, or other supporting documents
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}