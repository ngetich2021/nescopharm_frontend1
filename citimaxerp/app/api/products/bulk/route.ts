import { NextRequest, NextResponse } from "next/server"
import apiCall from "@/lib/api"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Forward the products array to the backend bulk endpoint
    const response = await apiCall("/products/bulk", "POST", body)
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error.message || "Bulk import failed" },
      { status: 500 }
    )
  }
} 