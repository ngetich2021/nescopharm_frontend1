import { NextRequest, NextResponse } from "next/server"
import apiCall from "@/lib/api"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await apiCall(`/products/${params.id}`, "GET")
    return NextResponse.json(product)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch product" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productData = await request.json()
    const response = await apiCall(`/products/${params.id}`, "PUT", productData)
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await apiCall(`/products/${params.id}`, "DELETE")
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete product" },
      { status: 500 }
    )
  }
}
