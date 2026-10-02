'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EmployeesRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/hr/employees');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirecting to HR module...</p>
      </div>
    </div>
  );
}
