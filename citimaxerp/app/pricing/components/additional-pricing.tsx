export default function AdditionalPricing() {
  const services = [
    {
      title: "Message Packs",
      description: "Need more messages? Add extra capacity to any plan:",
      items: [
        { name: "1,000 additional messages", price: 2250, frequency: "month" },
        { name: "5,000 additional messages", price: 9000, frequency: "month" },
        {
          name: "10,000 additional messages",
          price: 15000,
          frequency: "month",
        },
      ],
    },
    {
      title: "Payment Options",
      description: "Additional payment integrations:",
      items: [
        {
          name: "Additional M-Pesa till numbers",
          price: 1500,
          frequency: "each/month",
        },
        { name: "M-Pesa B2B integration", price: 6750, frequency: "month" },
        { name: "Other payment gateways", price: "Contact sales" },
      ],
    },
    {
      title: "Professional Services",
      description: "Get expert help setting up your system:",
      items: [
        {
          name: "Initial setup & training",
          price: 75000,
          frequency: "one-time",
        },
        {
          name: "Product catalog setup (up to 100 products)",
          price: 30000,
          frequency: "one-time",
        },
        {
          name: "Custom payment workflow development",
          price: 60000,
          frequency: "one-time",
        },
      ],
    },
  ];

  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Additional Services
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Enhance your experience with these optional add-ons
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-100 rounded-lg mr-4">
                  <svg
                    className="w-6 h-6 text-[#ff3366]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {service.title}
                </h3>
              </div>

              <p className="text-gray-600 mb-6">{service.description}</p>

              <ul className="space-y-4">
                {service.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-gray-700 font-medium">
                        {item.name}
                      </span>
                      <div className="text-right">
                        {typeof item.price === "string" ? (
                          <span className="text-sm font-medium text-gray-500">
                            {item.price}
                          </span>
                        ) : (
                          <>
                            <span className="block text-[#ff3366] font-bold">
                              KSh {item.price.toLocaleString()}
                            </span>
                            <span className="block text-xs text-gray-500">
                              {item.frequency}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
