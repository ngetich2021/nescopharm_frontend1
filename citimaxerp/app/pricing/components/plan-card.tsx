import { SubscriptionPlan } from "@/lib/subscriptions";

interface Feature {
    name: string;
    included: boolean;
}

interface PlanProps {
    plan: SubscriptionPlan;
}

export default function PlanCard({plan}: PlanProps) {
    const features: Feature[] = plan.features.map(f => ({ name: f, included: true }));

    return (
        <div
            className={`bg-white rounded-xl shadow-md p-8 relative transition-all duration-300 hover:scale-[1.02] hover:shadow-lg border border-gray-200`}
        >
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>

                <div className="mb-6">
          <span
              className={`text-4xl font-extrabold text-gray-900`}
          >
            Ksh {plan.price.toLocaleString()}
          </span>
                    <span className="text-gray-600 text-lg ml-1">/month</span>
                </div>

                <p className="text-gray-500 text-sm mb-8">Billed monthly</p>

                <ul className="space-y-3">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                            <svg
                                className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                            <span
                                className={`text-base text-gray-700`}
                            >
                {feature.name}
              </span>
                        </li>
                    ))}
                </ul>
            </div>

            <a
                href="#"
                className={`block w-full text-center py-3 rounded-lg font-bold text-lg transition-all duration-300 bg-[#1E2764] text-white hover:bg-blue-700`}
            >
                Select Plan
            </a>
        </div>
    );
}
