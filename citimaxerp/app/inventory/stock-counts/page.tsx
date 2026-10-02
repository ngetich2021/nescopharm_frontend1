import { StockCountsTab } from "../stock-counts-tab";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Stock Counts | Citimax",
    description: "Manage and track inventory stock counts",
  };
}

export default function StockCountsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Stock Counts</h1>
        <p className="text-sm text-gray-600">
          Manage and track inventory stock counts
        </p>
      </div>
      
      <StockCountsTab />
    </div>
  );
}