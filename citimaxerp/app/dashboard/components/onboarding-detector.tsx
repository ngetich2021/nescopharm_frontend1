"use client"

import { useState, useEffect } from "react"
import { OnboardingCards } from "./onboarding-cards"
import { DashboardContent } from "../dashboard-content"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth-context"
import { getCompany } from "@/lib/company"

export function OnboardingDetector() {
  const { userProfile, isLoading: authLoading } = useAuth()
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && userProfile?.company?.id) {
      fetchCompanyStatus()
    }
  }, [authLoading, userProfile?.company?.id])

  const fetchCompanyStatus = async () => {
    setIsLoading(true)
    try {
      const companyId = userProfile?.company?.id
      if (!companyId) {
        setIsFirstTimeUser(true)
        setIsLoading(false)
        return
      }
      const company = await getCompany(companyId)
      const isFirstTime = company?.is_first_time ?? true
      setIsFirstTimeUser(isFirstTime)
    } catch (error) {
      setIsFirstTimeUser(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (isFirstTimeUser) {
    return <OnboardingCards onGoToDashboard={fetchCompanyStatus} />
  }

  return <DashboardContent />
} 