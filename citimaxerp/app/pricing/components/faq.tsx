"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md"
      onClick={() => setIsOpen(!isOpen)}
    >
      <button
        className="w-full px-6 py-4 text-left focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{question}</h3>
          <span className="ml-4 text-[#ff3366]">
            {isOpen ? (
              <Minus className="h-5 w-5 transition-transform duration-300" />
            ) : (
              <Plus className="h-5 w-5 transition-transform duration-300" />
            )}
          </span>
        </div>
      </button>
      <div
        className={`px-6 pb-4 transition-all duration-300 ease-in-out ${
          isOpen
            ? "opacity-100 max-h-[500px]"
            : "opacity-0 max-h-0 overflow-hidden"
        }`}
      >
        <p className="text-gray-600">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const faqs = [
    {
      question: "How does Cherry's M-Pesa integration work?",
      answer:
        "Cherry connects with M-Pesa's API to process payments seamlessly. When customers browse your product catalog on WhatsApp, they can select items and pay directly through M-Pesa. You'll receive real-time notifications and payment confirmations, and all transactions are automatically reconciled in your Cherry dashboard.",
    },
    {
      question: "How do I create and manage my product catalog?",
      answer:
        "Cherry provides an easy-to-use dashboard where you can upload products with images, descriptions, prices, and categories. You can organize items into collections, set availability, and track inventory. Products can be updated in real-time, and changes will immediately reflect in your WhatsApp catalog.",
    },
    {
      question: "What happens if a payment fails?",
      answer:
        "Cherry has built-in payment retry functionality. If a customer's payment fails, they'll receive a notification with options to try again or choose a different payment method. You'll have visibility of pending and failed transactions in your dashboard, and the system can be configured to automatically follow up with customers about incomplete purchases.",
    },
    {
      question: "Is there a limit to how many products I can list?",
      answer:
        "Product limits depend on your plan. The Starter plan allows up to 50 products, Professional up to 500 products, and Enterprise offers unlimited products. Each product can have multiple variants (like sizes or colors) and detailed attributes to help customers make informed decisions.",
    },
    {
      question: "Can I use Cherry with other payment methods besides M-Pesa?",
      answer:
        "Yes! While M-Pesa is our primary integration, Enterprise customers can also connect with other payment gateways. Our team can help integrate alternate payment methods to suit your business requirements and customer preferences. Contact our sales team for custom payment solutions.",
    },
  ];

  return (
    <div className="py-16 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600">
            Find answers to common questions about Cherry
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </div>
  );
}
