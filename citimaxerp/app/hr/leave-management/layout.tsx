import { ReactNode } from "react";

export default function LeaveManagementLayout({ children }: { children: ReactNode }) {
  return <div className="container mx-auto py-6">{children}</div>;
}