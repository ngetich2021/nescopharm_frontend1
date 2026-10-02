import { NextResponse } from "next/server"
import { uploadMedia } from "@/lib/uploadMedia"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const result = await uploadMedia(file);

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: `Upload error: ${error.message}` }, { status: 500 })
  }
}
