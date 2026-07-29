import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  SITE_ACCESS_MAX_AGE_SECONDS,
  createSiteAccessToken,
  getSiteAccessPassword,
  isValidSiteAccessToken,
} from "@/lib/siteAccess";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let password = "";
  try {
    const body = await request.json() as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Enter the access code." }, { status: 400 });
  }

  const configuredPassword = getSiteAccessPassword();
  if (!configuredPassword) {
    return NextResponse.json(
      { error: "Private access is not active yet." },
      { status: 503 },
    );
  }
  if (!password || password.length > 256) {
    return NextResponse.json({ error: "Enter the access code." }, { status: 400 });
  }

  const submittedToken = await createSiteAccessToken(password);
  if (!(await isValidSiteAccessToken(submittedToken))) {
    return NextResponse.json({ error: "Access denied." }, { status: 401 });
  }

  const expectedToken = await createSiteAccessToken(configuredPassword);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SITE_ACCESS_COOKIE, expectedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_ACCESS_MAX_AGE_SECONDS,
  });
  return response;
}
