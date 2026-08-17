import { NextResponse } from "next/server";

import { gexBoxCatalog } from "@/lib/gex-box/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(gexBoxCatalog(), { headers: { "Cache-Control": "private, max-age=60" } });
}
