import { timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export type RouteActor = {
  userId: string;
  label: string;
  mode: "supabase" | "local-dev" | "desktop-gateway";
  createdAt?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

const ZYON_GATEWAY_TOKEN_HEADER = "x-kwantdesk-internal-zyon-token";
const ZYON_GATEWAY_SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const NEWS_GATEWAY_TOKEN_HEADER = "x-kwantdesk-internal-news-token";
const NEWS_GATEWAY_SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const SOCIALS_GATEWAY_TOKEN_HEADER = "x-kwantdesk-internal-socials-token";
const SOCIALS_GATEWAY_SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const JOURNAL_GATEWAY_TOKEN_HEADER = "x-kwantdesk-internal-journal-token";
const JOURNAL_GATEWAY_SUBJECT_HEADER = "x-kwantdesk-desktop-subject";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ZYON's VPS-only service boundary. The public desktop ticket is verified by
 * the market-data gateway; only that gateway may exchange its verified `sub`
 * claim for this internal actor. The internal service credential is never
 * returned to, accepted from, or persisted by the native application.
 */
export async function getZyonRouteActor(request: NextRequest): Promise<RouteActor | null> {
  const desktop = internalDesktopActor(
    request,
    ZYON_GATEWAY_TOKEN_HEADER,
    ZYON_GATEWAY_SUBJECT_HEADER,
    process.env.KWANTDESK_ZYON_SERVICE_TOKEN,
  );
  if (desktop) return desktop;
  return getRouteActor(request);
}

/**
 * NEWS uses a separate fixed VPS bridge and credential from ZYON. The gateway
 * supplies the verified desktop-ticket subject; the public bearer and internal
 * service credential never cross the same trust boundary.
 */
export async function getNewsRouteActor(request: NextRequest): Promise<RouteActor | null> {
  const desktop = internalDesktopActor(
    request,
    NEWS_GATEWAY_TOKEN_HEADER,
    NEWS_GATEWAY_SUBJECT_HEADER,
    process.env.KWANTDESK_NEWS_SERVICE_TOKEN,
  );
  if (desktop) return desktop;
  return getRouteActor(request);
}

/**
 * SOCIALS is identity-bound independently from the market-data and NEWS
 * services. The gateway verifies the short-lived desktop ticket and forwards
 * only its UUID subject; the service-role credential remains server-side and
 * the SOCIALS reader reapplies viewer privacy before returning any object.
 */
export async function getSocialsRouteActor(request: NextRequest): Promise<RouteActor | null> {
  const desktop = internalDesktopActor(
    request,
    SOCIALS_GATEWAY_TOKEN_HEADER,
    SOCIALS_GATEWAY_SUBJECT_HEADER,
    process.env.KWANTDESK_SOCIALS_SERVICE_TOKEN,
  );
  if (desktop) return desktop;
  return getRouteActor(request);
}

/** Identity-bound desktop Journal bridge. Cloud database credentials never
 * leave the browser service and the desktop public ticket never reaches it. */
export async function getJournalRouteActor(request: NextRequest): Promise<RouteActor | null> {
  const desktop = internalDesktopActor(
    request,
    JOURNAL_GATEWAY_TOKEN_HEADER,
    JOURNAL_GATEWAY_SUBJECT_HEADER,
    process.env.KWANTDESK_JOURNAL_SERVICE_TOKEN,
  );
  if (desktop) return desktop;
  return getRouteActor(request);
}

export async function getRouteActor(request?: NextRequest): Promise<RouteActor | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      userId: "local-dev",
      label: "local-dev",
      mode: "local-dev",
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Route handlers in this helper only need read access for connector authorization.
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  let user = data.user;

  if ((!user || error) && request) {
    const authorization = request.headers.get("authorization")?.trim() ?? "";
    if (authorization.toLowerCase().startsWith("bearer ")) {
      const accessToken = authorization.slice(7).trim();
      if (accessToken) {
        const tokenResult = await supabase.auth.getUser(accessToken);
        if (!tokenResult.error && tokenResult.data.user) {
          user = tokenResult.data.user;
        }
      }
    }
  }

  if (!user) return null;

  const email = user.email?.trim();
  const username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username.trim()
      : "";
  const displayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
      : "";
  const avatarUrl =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url.trim()
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture.trim()
        : "";

  return {
    userId: user.id,
    label: email || username || displayName || user.id,
    mode: "supabase",
    createdAt: user.created_at,
    displayName,
    username,
    avatarUrl,
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const supplied = Buffer.from(left, "utf8");
  const expected = Buffer.from(right, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function internalDesktopActor(
  request: NextRequest,
  tokenHeader: string,
  subjectHeader: string,
  expectedToken: string | undefined,
): RouteActor | null {
  const expected = String(expectedToken || "").trim();
  const supplied = request.headers.get(tokenHeader)?.trim() ?? "";
  const subject = request.headers.get(subjectHeader)?.trim() ?? "";
  if (!expected || !supplied || !UUID.test(subject) || !constantTimeEqual(supplied, expected)) {
    return null;
  }
  return {
    userId: subject,
    label: `desktop:${subject}`,
    mode: "desktop-gateway",
  };
}
