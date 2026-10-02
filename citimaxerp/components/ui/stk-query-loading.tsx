"use client"

import { useEffect, useState } from "react"

interface STKPushQueryLoadingProps {
  number: string
}

export function StkQueryLoading({
  // Changed to named export StkQueryLoading
  number,
}: STKPushQueryLoadingProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."))
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4 space-y-6 text-center">
        <div className="space-y-4">
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>

          <h2 className="text-2xl font-bold text-gray-800">Processing Payment{dots}</h2>

          <div className="space-y-2 text-gray-600">
            <p>
              STK push sent to <span className="font-medium">{number}</span>
            </p>
            <p>Please check your phone and enter your M-Pesa PIN</p>
          </div>
        </div>
      </div>
    </div>
  )
}
