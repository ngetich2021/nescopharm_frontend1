import { NextResponse } from "next/server"
import { createProduct } from "@/app/inventory/actions"

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const result = await createProduct(data)
    if (result && result.success) {
      return NextResponse.json({ status: "success", product: result.data })
    } else {
      return NextResponse.json({ status: "error", message: result?.message || "Failed to import product" }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message || "Unknown error" }, { status: 500 })
  }
} 