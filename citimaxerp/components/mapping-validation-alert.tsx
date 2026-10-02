import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { validateMappings } from '@/lib/account-mappings'

interface MappingValidationAlertProps {
  companyId?: string
  showIfValid?: boolean
  onValidationChange?: (isValid: boolean) => void
}

/**
 * Alert component that displays if account mappings are incomplete
 * Callers decide whether incomplete mappings should block submission.
 */
export function MappingValidationAlert({ companyId, showIfValid = false, onValidationChange }: MappingValidationAlertProps) {
  const [validation, setValidation] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkValidation = async () => {
      try {
        setLoading(true)
        const result = await validateMappings(companyId)
        setValidation(result)
        onValidationChange?.(result?.is_valid ?? false)
      } catch (err: any) {
        console.error('Error checking validation:', err)
        const validationResult = err?.apiResponse
        if (validationResult && typeof validationResult.is_valid === 'boolean') {
          setValidation(validationResult)
          onValidationChange?.(validationResult.is_valid)
        } else {
          setValidation({
            is_valid: false,
            message: 'Account mappings could not be validated. You may continue, but accounting entries could fail.',
          })
          onValidationChange?.(false)
        }
      } finally {
        setLoading(false)
      }
    }

    checkValidation()
  }, [companyId, onValidationChange])

  if (loading || !validation) return null

  const isValid = validation?.is_valid ?? false
  const missing = validation?.missing_mappings ?? validation?.missing ?? []

  // Only show if invalid, or if explicitly requested to show valid state
  if (isValid && !showIfValid) return null

  if (isValid) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
        <span>✓ Account mappings configured</span>
      </div>
    )
  }

  return (
    <Alert className="border-yellow-200 bg-yellow-50 mb-4">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription>
        <div className="text-sm text-yellow-800">
          <strong>Account Mapping Required:</strong> {missing.length > 0 ? (
            <>
              {missing.length} accounts still need to be configured. Please{' '}
              <a href="/finance/account-mappings" className="underline font-semibold">
                complete setup
              </a>
              . You can continue creating the invoice, but its accounting entries may fail until setup is complete.
            </>
          ) : (
            validation?.message || 'Account mappings are incomplete. Please complete setup before submitting.'
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Hook-based validation check - returns true if mappings are valid
 */
export async function validateBeforeTransaction(companyId?: string): Promise<boolean> {
  try {
    const result = await validateMappings(companyId)
    if (!result?.is_valid) {
      throw new Error(`Account mappings incomplete. Missing ${result?.missing?.length || 'required'} accounts.`)
    }
    return true
  } catch (err: any) {
    throw err
  }
}
