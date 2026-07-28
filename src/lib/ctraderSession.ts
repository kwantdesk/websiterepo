import type { NextRequest } from "next/server";

export type CTraderTokenSet = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  issuedAt?: number;
  expiresAt?: number;
};

export const CTRADER_SESSION_COOKIE = "kwantify-ctrader-session";
export const CTRADER_OAUTH_STATE_COOKIE = "kwantify-ctrader-oauth-state";
export const CTRADER_OAUTH_RETURN_TO_COOKIE = "kwantify-ctrader-oauth-return-to";

export function readCTraderSessionFromRequest(req: NextRequest) {
  const raw = req.cookies.get(CTRADER_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CTraderTokenSet>;
    if (!parsed.accessToken || typeof parsed.accessToken !== "string") return null;

    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
      tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : undefined,
      expiresIn: typeof parsed.expiresIn === "number" ? parsed.expiresIn : undefined,
      issuedAt: typeof parsed.issuedAt === "number" ? parsed.issuedAt : undefined,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
    } satisfies CTraderTokenSet;
  } catch {
    return null;
  }
}
