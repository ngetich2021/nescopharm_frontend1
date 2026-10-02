"use client";

import { useState } from "react";

export default function PricingHeader() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(
    "monthly"
  );

  return (
    <div className="py-12 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
          Choose the Perfect Plan for Your Business
        </h1>
        <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
          From mama mboga to enterprises, Cherry helps businesses share product
          catalogs and receive M-Pesa payments through WhatsApp.
        </p>
        <div className="mt-8 inline-flex items-center justify-center p-1 bg-gray-100 rounded-lg">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              billingCycle === "monthly"
                ? "cherry-red-bg text-white"
                : "text-gray-700 hover:text-gray-900"
            } rounded-md`}
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              billingCycle === "annual"
                ? "cherry-red-bg text-white"
                : "text-gray-700 hover:text-gray-900"
            } rounded-md`}
            onClick={() => setBillingCycle("annual")}
          >
            Annual (20% off)
          </button>
        </div>
      </div>
    </div>
  );
}
