import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failureReason(status: number) {
  if (status === 401) return "invalid_api_key";
  if (status === 402) return "payment_required";
  if (status === 403) return "insufficient_permissions";
  if (status === 404) return "dataset_unavailable";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  return "request_rejected";
}

export async function GET() {
  const key = process.env.DATABENTO_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        configured: false,
        keyFormatValid: false,
        historical: { ok: false, reason: "missing_api_key" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const keyFormatValid = /^db-[A-Za-z0-9_-]{20,}$/.test(key);
  try {
    const response = await fetch(
      "https://hist.databento.com/v0/metadata.get_dataset_range?dataset=GLBX.MDP3",
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    return NextResponse.json(
      {
        configured: true,
        keyFormatValid,
        historical: {
          ok: response.ok,
          status: response.status,
          reason: response.ok ? null : failureReason(response.status),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        configured: true,
        keyFormatValid,
        historical: { ok: false, reason: "connection_failed" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
