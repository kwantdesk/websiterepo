import { NextResponse } from "next/server";
import { getDatabentoOptions } from "@/lib/databento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!process.env.DATABENTO_API_KEY) {
    return NextResponse.json({ error: "Databento is not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json(
      { instruments: await getDatabentoOptions(), source: "Databento", dataset: "GLBX.MDP3" },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Databento option definitions." },
      { status: 502 },
    );
  }
}
