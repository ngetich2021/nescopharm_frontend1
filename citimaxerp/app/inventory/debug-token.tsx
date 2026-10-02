"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { debugToken } from "./actions"
import { useAuth } from "@/lib/auth-context"

export function DebugToken() {
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()

  const handleDebug = async () => {
    setIsLoading(true)
    try {
      const debugResult = await debugToken()
      setResult(debugResult)
    } catch (error) {
      setResult({ success: false, message: error })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Token Debug</h3>
      <div className="space-y-2 mb-4">
        <p><strong>User:</strong> {user ? "Logged in" : "Not logged in"}</p>
        <p><strong>User ID:</strong> {user?.id || "N/A"}</p>
        <p><strong>LocalStorage Token:</strong> {typeof window !== "undefined" && localStorage.getItem("token") ? "Found" : "Not found"}</p>
      </div>
      
      <Button onClick={handleDebug} disabled={isLoading}>
        {isLoading ? "Testing..." : "Test Token Retrieval"}
      </Button>
      
      {result && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <h4 className="font-semibold">Server Action Result:</h4>
          <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
} 