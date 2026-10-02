"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export default function FixCompanyStatusPage() {
  const { userProfile, updateFirstTimeStatus } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFixCompanyStatus = async () => {
    try {
      setUpdating(true);
      await updateFirstTimeStatus(false);
      setSuccess(true);
    } catch (error) {
      console.error('Error updating company status:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (!userProfile) {
    return <div className="p-8">No user profile loaded</div>;
  }

  const isFirstTime = userProfile.company?.is_first_time;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">🔧 Fix Company Status</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Current Status</h2>
          <p><strong>Company:</strong> {userProfile.company?.name}</p>
          <p><strong>Is First Time:</strong> {isFirstTime ? '🔴 TRUE (Restricting access)' : '✅ FALSE'}</p>
        </div>

        {isFirstTime ? (
          <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
            <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Issue Detected</h3>
            <p className="text-yellow-700 mb-4">
              Your company is marked as "first time" which restricts access to only the dashboard. 
              This is why you're being redirected from other pages.
            </p>
            
            {success ? (
              <div className="bg-green-100 p-3 rounded border-l-4 border-green-500">
                <p className="text-green-700 font-medium">✅ Fixed! Please refresh the page and try accessing other menu items.</p>
              </div>
            ) : (
              <Button 
                onClick={handleFixCompanyStatus}
                disabled={updating}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {updating ? 'Fixing...' : '🔧 Fix Company Status'}
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
            <h3 className="font-semibold text-green-800 mb-2">✅ Status OK</h3>
            <p className="text-green-700">
              Your company status is correct. The redirect issue might be caused by something else.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}