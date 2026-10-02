"use client";

import { Button } from "@/components/ui/button";

interface PaymentSuccessProps {
  onClose: () => void;
}

export default function PaymentSuccess({ onClose }: PaymentSuccessProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4 space-y-6 text-center">
        <div className="space-y-2">
          <svg
            className="w-16 h-16 mx-auto text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800">
            Payment Successful!
          </h2>
          <p className="text-gray-600">
            Thank you for your payment. Your transaction has been processed
            successfully.
          </p>
        </div>

        <div className="pt-4">
          <Button
            onClick={onClose}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
