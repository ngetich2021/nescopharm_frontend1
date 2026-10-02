import type React from "react"
import { Metadata } from "next";
import { AppLayout } from "@/components/layouts/app-layout"

export const metadata: Metadata = {
  title: "Inventory Management | Citimax",
  description: "Manage your products, batches, and stock counts",
};

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}