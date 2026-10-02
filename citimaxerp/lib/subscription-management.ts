import apiCall from "@/lib/api"

// Define types for subscription-related data
interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  interval: string
  features: string[]
  is_active: boolean
  created_at: string
}

interface Subscription {
  id: string
  company_id: string
  plan_id: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

interface SubscriptionPayment {
  id: string
  subscription_id: string
  amount: number
  payment_method: string
  status: string
  transaction_id: string
  created_at: string
}

/**
 * Fetches all active subscription plans.
 */
export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const data = await apiCall<SubscriptionPlan[]>("/subscription-plans?is_active=true", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches all subscription plans (admin access).
 */
export async function getAllSubscriptionPlansAdmin(): Promise<SubscriptionPlan[]> {
  try {
    const data = await apiCall<SubscriptionPlan[]>("/admin/subscription-plans", "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches a single subscription plan by ID.
 */
export async function fetchSubscriptionPlanById(planId: string): Promise<SubscriptionPlan | null> {
  try {
    const data = await apiCall<SubscriptionPlan>(`/subscription-plans/${planId}`, "GET")
    return data
  } catch (error) {
    return null
  }
}

/**
 * Creates a new subscription plan.
 * This function uses admin API access.
 */
export async function createSubscriptionPlanAdmin(
  planData: Partial<SubscriptionPlan>,
): Promise<SubscriptionPlan | null> {
  try {
    const data = await apiCall<SubscriptionPlan>("/admin/subscription-plans", "POST", planData)
    return data
  } catch (error) {
    throw new Error("Failed to create subscription plan.")
  }
}

/**
 * Updates an existing subscription plan.
 * This function uses admin API access.
 */
export async function updateSubscriptionPlanAdmin(
  planId: string,
  planData: Partial<SubscriptionPlan>,
): Promise<SubscriptionPlan | null> {
  try {
    const data = await apiCall<SubscriptionPlan>(`/admin/subscription-plans/${planId}`, "PUT", planData)
    return data
  } catch (error) {
    throw new Error("Failed to update subscription plan.")
  }
}

/**
 * Deletes a subscription plan.
 * This function uses admin API access.
 */
export async function deleteSubscriptionPlanAdmin(planId: string): Promise<void> {
  try {
    await apiCall(`/admin/subscription-plans/${planId}`, "DELETE")
  } catch (error) {
    throw new Error("Failed to delete subscription plan.")
  }
}

/**
 * Fetches the active subscription for a given company.
 */
export async function getActiveSubscriptionForCompany(companyId: string): Promise<Subscription | null> {
  try {
    const data = await apiCall<Subscription>(`/subscriptions/company/${companyId}/active`, "GET")
    return data
  } catch (error) {
    return null
  }
}

/**
 * Fetches all subscriptions for a given company.
 */
export async function getSubscriptionsForCompany(companyId: string): Promise<Subscription[]> {
  try {
    const data = await apiCall<Subscription[]>(`/subscriptions/company/${companyId}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Fetches payment history for a subscription.
 */
export async function getSubscriptionPayments(subscriptionId: string): Promise<SubscriptionPayment[]> {
  try {
    const data = await apiCall<SubscriptionPayment[]>(`/subscription-payments/${subscriptionId}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Creates a new subscription payment record (typically called by the Mpesa callback).
 * This function uses admin API access.
 */
export async function createSubscriptionPaymentRecord(
  paymentData: Partial<SubscriptionPayment>,
): Promise<SubscriptionPayment | null> {
  try {
    const data = await apiCall<SubscriptionPayment>("/admin/subscription-payments", "POST", paymentData)
    return data
  } catch (error) {
    throw new Error("Failed to create subscription payment record.")
  }
}

/**
 * Fetches payment history for a subscription.
 */
export async function getSubscriptionPaymentHistory(subscriptionId: string): Promise<SubscriptionPayment[]> {
  try {
    const data = await apiCall<SubscriptionPayment[]>(`/subscription-payments/${subscriptionId}`, "GET")
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

/**
 * Updates a subscription status.
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: string,
  currentPeriodEnd?: string,
): Promise<Subscription | null> {
  try {
    const updateData: Partial<Subscription> = { status }
    if (currentPeriodEnd) {
      updateData.current_period_end = currentPeriodEnd
    }

    const data = await apiCall<Subscription>(`/admin/subscriptions/${subscriptionId}`, "PUT", updateData)
    return data
  } catch (error) {
    throw new Error("Failed to update subscription.")
  }
}
