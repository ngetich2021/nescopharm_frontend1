import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { validateMappings } from '@/lib/account-mappings'

interface AccountMappingStatusProps {
  companyId?: string
  minimal?: boolean
}

export function AccountMappingStatusWidget({ companyId, minimal = false }: AccountMappingStatusProps) {
  const [loading, setLoading] = useState(true)
  const [validation, setValidation] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await validateMappings(companyId)
        setValidation(result)
      } catch (err: any) {
        setError(err.message)
        console.error('Failed to validate mappings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [companyId])

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const isValid = validation?.is_valid ?? false

  if (minimal) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded text-sm ${isValid ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
        {isValid ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        <span>{validation?.configured_count || 0}/{validation?.required_count || 0} mappings</span>
      </div>
    )
  }

  return (
    <Card className={isValid ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          )}
          Account Mappings
        </CardTitle>
        <CardDescription>
          {isValid ? 'Setup complete' : 'Setup incomplete'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-sm font-medium">
            {validation?.configured_count || 0} of {validation?.required_count || 0} configured
          </div>
          {!isValid && validation?.missing?.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              Missing: {validation.missing.map((m: any) => m.key).join(', ')}
            </div>
          )}
        </div>
        <Link href="/finance/account-mappings">
          <Button size="sm" variant={isValid ? 'outline' : 'default'} className="w-full">
            {isValid ? 'View Mappings' : 'Complete Setup'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
