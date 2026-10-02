"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { X, CheckCircle, XCircle } from "lucide-react"
import { approveCreditLimitUpdate, type CreditLimitApprovalRequest } from "@/lib/customer-accounts"

interface CreditLimitApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  customerAccountId: string
  approvalId: string
  action: "approved" | "rejected"
  currentCreditLimit: number
  requestedCreditLimit: number
  currentCreditDays?: number | null
  requestedCreditDays?: number | null
  requestReason?: string
}

interface FormData {
  notes: string
}

interface ValidationErrors {
  notes?: string
}

export const CreditLimitApprovalModal: React.FC<CreditLimitApprovalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customerAccountId,
  approvalId,
  action,
  currentCreditLimit,
  requestedCreditLimit,
  currentCreditDays,
  requestedCreditDays,
  requestReason
}) => {
  const [formData, setFormData] = useState<FormData>({
    notes: ''
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.notes.trim()) {
      newErrors.notes = "Approval notes are required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, notes: value }))
    if (errors.notes) {
      setErrors(prev => ({ ...prev, notes: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const approvalData: CreditLimitApprovalRequest = {
        status: action,
        approval_type: "credit_limit_update",
        approval_id: approvalId,
        notes: formData.notes
      }

      await approveCreditLimitUpdate(customerAccountId, approvalData)

      toast({
        title: "Success",
        description: `Credit limit update ${action} successfully.`,
      })

      // Reset form
      setFormData({ notes: '' })
      setErrors({})

      onSuccess?.()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} credit limit update`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({ notes: '' })
    setErrors({})
    onClose()
  }

  if (!isOpen) return null

  const isApproval = action === "approved"
  const actionText = isApproval ? "Approve" : "Reject"
  const actionColor = isApproval ? "text-green-600" : "text-red-600"
  const buttonColor = isApproval ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className={`text-xl font-semibold ${actionColor}`}>
            {actionText} Credit Terms Update
          </h2>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Credit Limit Changes Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Current Credit Limit</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xl font-bold text-gray-800">
                  Ksh {currentCreditLimit.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Requested Credit Limit</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xl font-bold text-blue-600">
                  Ksh {requestedCreditLimit.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Change: Ksh {(requestedCreditLimit - currentCreditLimit).toLocaleString()}
                  {requestedCreditLimit > currentCreditLimit ? " (Increase)" : " (Decrease)"}
                </p>
              </CardContent>
            </Card>
          </div>

          {(currentCreditDays != null || requestedCreditDays != null) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Current Credit Period</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xl font-bold text-gray-800">
                    {currentCreditDays != null ? `${currentCreditDays} days` : "Not set"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Requested Credit Period</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xl font-bold text-blue-600">
                    {requestedCreditDays != null ? `${requestedCreditDays} days` : "Unchanged"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Request Reason Display */}
          {requestReason && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Request Reason</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-700">{requestReason}</p>
              </CardContent>
            </Card>
          )}

          {/* Approval Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              {actionText} Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              rows={4}
              value={formData.notes}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                isApproval
                  ? "Provide notes for approving this credit limit update (e.g., risk assessment results, financial review comments, conditions)"
                  : "Provide reasons for rejecting this credit limit update (e.g., insufficient documentation, financial concerns, required improvements)"
              }
              className={errors.notes ? "border-red-500" : ""}
            />
            {errors.notes && (
              <p className="text-sm text-red-500">{errors.notes}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className={`text-white ${buttonColor}`}>
              {isLoading ? (
                <>
                  {isApproval ? <CheckCircle className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4 animate-spin" />}
                  {isApproval ? "Approving..." : "Rejecting..."}
                </>
              ) : (
                <>
                  {isApproval ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                  {actionText} Request
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}