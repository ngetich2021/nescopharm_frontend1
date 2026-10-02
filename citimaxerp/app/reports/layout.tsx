import type React from "react"
import { Metadata } from "next";
import { AppLayout } from "@/components/layouts/app-layout"

export const metadata: Metadata = {
  title: "Reports | Citimax",
  description: "Business intelligence and reporting",
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
