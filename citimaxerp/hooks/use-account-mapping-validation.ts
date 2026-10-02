import { useCallback, useState } from 'react'
import * as accountMappings from '@/lib/account-mappings'

export interface ValidationStatus {
  is_valid: boolean
  configured_count?: number
  required_count?: number
  missing?: Array<{ key: string; description: string }>
  optional_missing?: Array<{ key: string; description: string }>
}

/**
 * Hook to validate account mappings before transactions
 */
export function useAccountMappingValidation(companyId?: string) {
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validate = useCallback(async () => {
    try {
      setValidating(true)
      setError(null)
      const result = await accountMappings.validateMappings(companyId)
      setValidationResult(result)
      return result
    } catch (err: any) {
      const message = err.message || 'Failed to validate account mappings'
      setError(message)
      return null
    } finally {
      setValidating(false)
    }
  }, [companyId])

  return {
    validate,
    validating,
    validationResult,
    isValid: validationResult?.is_valid ?? false,
    error,
  }
}

/**
 * Standalone function to check if mappings are valid for a company
 */
export async function checkMappingsValid(companyId?: string): Promise<boolean> {
  try {
    const result = await accountMappings.validateMappings(companyId)
    return result?.is_valid ?? false
  } catch (err) {
    console.error('Error checking mappings:', err)
    return false
  }
}

/**
 * Get validation status with details
 */
export async function getValidationStatus(companyId?: string): Promise<ValidationStatus | null> {
  try {
    return await accountMappings.validateMappings(companyId)
  } catch (err) {
    console.error('Error getting validation status:', err)
    return null
  }
}
