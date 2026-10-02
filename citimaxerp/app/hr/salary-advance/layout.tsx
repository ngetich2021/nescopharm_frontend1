import { ReactNode } from "react";

export default function SalaryAdvanceLayout({ children }: { children: ReactNode }) {
  return <div className="container mx-auto py-6">{children}</div>;
}