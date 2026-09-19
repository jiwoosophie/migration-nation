import { NextResponse } from "next/server";
import { fetchAllBirds } from "@/lib/movebank";

export async function GET() {
  try {
    const { individuals, errors } = await fetchAllBirds();
    return NextResponse.json({
      individuals,
      ...(errors.length ? { partialErrors: errors } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}