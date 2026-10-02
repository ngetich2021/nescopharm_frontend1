import apiCall from "./api"

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  is_active: boolean;
}

interface SubscriptionPlansApiResponse {
  status: string;
  plans: SubscriptionPlan[];
  message?: string;
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const response = await apiCall<SubscriptionPlansApiResponse>('/subscription-plans', "GET", undefined, false);

    if (response.status === "success" && response.plans) {
      return response.plans;
    } else {
      const errorMessage = typeof response.message === 'string' 
        ? response.message 
        : 'Failed to fetch subscription plans';
      throw new Error(errorMessage);
    }
  } catch (error: any) {
    throw new Error(`An unexpected error occurred while fetching subscription plans: ${error.message || "Unknown error"}.`);
  }
}
