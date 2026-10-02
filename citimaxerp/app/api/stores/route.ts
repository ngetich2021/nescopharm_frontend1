import { NextRequest, NextResponse } from "next/server"
import apiCall from "@/lib/api"

export async function GET(request: NextRequest) {
  try {
    const stores = await apiCall("/stores", "GET")
    return NextResponse.json({ stores })
  } catch (error: any) {
    console.error("Error fetching stores:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch stores" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const storeData = await request.json()
    const store = await apiCall("/stores", "POST", storeData)
    return NextResponse.json({ store })
  } catch (error: any) {
    console.error("Error creating store:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create store" },
      { status: 500 }
    )
  }
} 