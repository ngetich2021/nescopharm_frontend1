import { fetchSubscriptionPlans } from "@/lib/subscriptions";
import PlanCard from "./plan-card";

export default async function PricingCards() {
  try {
    const subscriptionPlans = await fetchSubscriptionPlans();

    return (
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {subscriptionPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return <div>Error loading pricing plans. Please try again later.</div>;
  }
}
