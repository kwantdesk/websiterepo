import { NextRequest, NextResponse } from "next/server";
import {
  listNewsFriends,
  newsSharingProblem,
  shareNewsCalendarEvent,
  type NewsShareRequest,
} from "@/lib/newsSharing.server";
import { getNewsRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAXIMUM_REQUEST_BYTES = 64 * 1024;

export async function GET(request: NextRequest) {
  const actor = await getNewsRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const friends = await listNewsFriends(actor.userId);
    return NextResponse.json({ cloud: true, friends }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const failure = newsSharingProblem(error);
    return NextResponse.json({ code: failure.code, error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getNewsRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAXIMUM_REQUEST_BYTES) {
    return NextResponse.json({ code: "news_share_too_large", error: "The share request is too large." }, { status: 413 });
  }
  let body: NewsShareRequest;
  try {
    const text = await request.text();
    if (!text || Buffer.byteLength(text, "utf8") > MAXIMUM_REQUEST_BYTES) throw new Error("invalid");
    body = JSON.parse(text) as NewsShareRequest;
  } catch {
    return NextResponse.json({ code: "news_share_invalid", error: "The share request is invalid." }, { status: 400 });
  }
  try {
    const receipt = await shareNewsCalendarEvent(actor.userId, body);
    return NextResponse.json(receipt, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const failure = newsSharingProblem(error);
    return NextResponse.json({ code: failure.code, error: failure.message }, { status: failure.status });
  }
}
