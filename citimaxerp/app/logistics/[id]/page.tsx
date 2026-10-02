import { notFound } from "next/navigation";
import apiCall from "@/lib/api";

interface LogisticsData {
  id: string;
  order_id: string;
  status: string;
  tracking_number: string;
  carrier: string;
  estimated_delivery: string;
  actual_delivery: string;
  created_at: string;
  updated_at: string;
}

export default async function LogisticsPage({ params }: { params: { id: string } }) {
  try {
    const logisticsData = await apiCall<LogisticsData>(`/logistics/${params.id}`, "GET");
    
    if (!logisticsData) {
      notFound();
    }

    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Logistics Details</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Tracking Information</h2>
              <p><strong>Tracking Number:</strong> {logisticsData.tracking_number}</p>
              <p><strong>Carrier:</strong> {logisticsData.carrier}</p>
              <p><strong>Status:</strong> {logisticsData.status}</p>
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2">Delivery Information</h2>
              <p><strong>Estimated Delivery:</strong> {logisticsData.estimated_delivery}</p>
              <p><strong>Actual Delivery:</strong> {logisticsData.actual_delivery || "Not delivered yet"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error fetching logistics data:", error);
    notFound();
  }
}
