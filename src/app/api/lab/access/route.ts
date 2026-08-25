import { NextResponse } from "next/server";

import {
  LAB_ACCESS_COOKIE,
  LAB_ACCESS_MAX_AGE_SECONDS,
  createLabAccessToken,
  getLabAccessPasscode,
  isValidLabAccessToken,
} from "@/lib/labAccess";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let passcode = "";
  try {
    const body = await request.json() as { passcode?: unknown };
    passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
  } catch {
    return NextResponse.json({ error: "Enter THE LAB passcode." }, { status: 400 });
  }

  if (!passcode || passcode.length > 64) {
    return NextResponse.json({ error: "Enter THE LAB passcode." }, { status: 400 });
  }

  const submitted = await createLabAccessToken(passcode);
  if (!(await isValidLabAccessToken(submitted))) {
    return NextResponse.json(
      { error: "Access denied." },
      { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LAB_ACCESS_COOKIE, await createLabAccessToken(getLabAccessPasscode()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: LAB_ACCESS_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LAB_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
