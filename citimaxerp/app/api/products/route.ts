import { NextRequest, NextResponse } from "next/server"
import apiCall from "@/lib/api"

export async function GET(request: NextRequest) {
  try {
    const products = await apiCall("/products", "GET")
    return NextResponse.json({ products })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const productData = await request.json()
    const product = await apiCall("/products", "POST", productData)
    return NextResponse.json({ product })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    )
  }
} 