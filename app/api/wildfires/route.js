import { NextResponse } from "next/server";
import { fetchFires } from "@/lib/nifc";

export async function GET() {
  try {
    const data = await fetchFires();
    return NextResponse.json({
      success: true,
      count: data.features ? data.features.length : 0,
      fires: data.features || [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}