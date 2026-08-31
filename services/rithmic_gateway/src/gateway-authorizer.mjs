import { timingSafeEqual } from "node:crypto";

import { DesktopTicketVerificationError } from "./desktop-ticket-verifier.mjs";

const DESKTOP_ROUTE_SCOPES = new Map([
  ["GET /v1/lab/snapshot", "lab.snapshot:read"],
  ["GET /v1/analytics/bounce-levels", "options.analytics:read"],
  ["GET /v1/analytics/classic-gex-profile", "options.analytics:read"],
  ["GET /v1/analytics/dark-pool-map", "options.analytics:read"],
  ["GET /v1/analytics/implied-volatility-rank", "options.analytics:read"],
  ["GET /v1/analytics/gamma-environment", "options.analytics:read"],
  ["GET /v1/analytics/chart-gamma-levels", "options.analytics:read"],
  ["GET /v1/analytics/expected-move", "options.analytics:read"],
  ["GET /v1/analytics/hedge-levels", "options.analytics:read"],
  ["GET /v1/analytics/vix-environment", "options.analytics:read"],
  ["GET /v1/analytics/zero-gamma-line", "options.analytics:read"],
  ["GET /v1/analytics/options-delta", "options.analytics:read"],
  ["GET /v1/analytics/zero-gamma-bars", "options.analytics:read"],
  ["GET /v1/analytics/gamma-heatmap", "options.analytics:read"],
  ["GET /v1/analytics/net-gamma-exposure-by-strike", "options.analytics:read"],
  ["GET /v1/analytics/gex-interval-map", "options.analytics:read"],
  ["GET /v1/analytics/gex-map", "options.analytics:read"],
  ["GET /v1/analytics/gex-flow", "options.analytics:read"],
  ["POST /v1/analytics/gex-flow/ratios", "options.analytics:read"],
  ["GET /v1/analytics/gameplan", "options.analytics:read"],
  ["GET /v1/analytics/options-flow", "options.analytics:read"],
  ["GET /v1/analytics/options-flow/market-data", "options.analytics:read"],
  ["GET /v1/market-data/history", "market.trades:read"],
  ["GET /v1/market-data/trades", "market.trades:read"],
  ["GET /v1/market-data/options", "market.trades:read"],
  ["GET /v1/market-data/index-stream", "market.indices:read"],
  ["GET /v1/market-data/index-snapshot", "market.indices:read"],
  ["GET /v1/market-data/index-history", "market.indices:read"],
  ["GET /v1/market-data/cash-index-history", "market.indices:read"],
  ["GET /v1/heatmap/stream", "market.depth:read"],
  ["GET /v1/heatmap/snapshot", "market.depth:read"],
  ["GET /v1/heatmap/replay", "market.replay:read"],
  ["GET /v1/heatmap/replay/chunk", "market.replay:read"],
  ["POST /v1/zyon/messages", "assistant.zyon:write"],
  ["POST /v1/zyon/transcriptions", "assistant.zyon:write"],
  ["GET /v1/zyon/journal", "assistant.zyon:read"],
  ["POST /v1/zyon/journal", "assistant.zyon:write"],
  ["DELETE /v1/zyon/journal", "assistant.zyon:write"],
  ["GET /v1/zyon/gameplan-draft", "assistant.zyon:read"],
  ["PUT /v1/zyon/gameplan-draft", "assistant.zyon:write"],
  ["POST /v1/zyon/gameplan-lock", "assistant.zyon:write"],
  ["GET /v1/zyon/health", "assistant.zyon:read"],
  ["GET /v1/zyon/gameplan-analyst-archive", "assistant.zyon:read"],
  ["POST /v1/zyon/gameplan-analyst-archive", "assistant.zyon:write"],
  ["GET /v1/kwantbot/archive", "assistant.zyon:read"],
  ["POST /v1/kwantbot/archive", "assistant.zyon:write"],
  ["GET /v1/news/calendar", "news.intelligence:read"],
  ["GET /v1/news/intelligence", "news.intelligence:read"],
  ["POST /v1/news/analyst", "news.intelligence:write"],
  ["GET /v1/news/friends", "news.intelligence:read"],
  ["POST /v1/news/share", "news.intelligence:write"],
  ["GET /v1/socials/state", "socials.account:read"],
  ["GET /v1/socials/profile", "socials.account:read"],
  ["GET /v1/socials/follow", "socials.account:read"],
  ["POST /v1/socials/follow", "socials.account:write"],
  ["GET /v1/socials/following", "socials.account:read"],
  ["GET /v1/socials/reaction", "socials.account:read"],
  ["POST /v1/socials/reaction", "socials.account:write"],
  ["GET /v1/socials/notifications", "socials.account:read"],
  ["PATCH /v1/socials/notifications", "socials.account:write"],
  ["POST /v1/socials/gameplan-execution", "socials.account:write"],
  ["POST /v1/socials/gameplan-score", "socials.account:write"],
  ["POST /v1/socials/trade-post", "socials.account:write"],
  ["POST /v1/socials/object", "socials.account:write"],
  ["DELETE /v1/socials/object", "socials.account:write"],
  ["GET /v1/socials/friends", "socials.account:read"],
  ["GET /v1/socials/friends/events", "socials.account:read"],
  ["GET /v1/socials/friends/avatar", "socials.account:read"],
  ["POST /v1/socials/friends", "socials.account:write"],
  ["GET /v1/journal/state", "journal.account:read"],
  ["POST /v1/journal/state", "journal.account:write"],
  ["DELETE /v1/journal/state", "journal.account:write"],
  ["GET /v1/journal/analysis", "journal.account:read"],
  ["POST /v1/journal/analysis", "journal.account:write"],
]);

export class GatewayAuthorizer {
  constructor({ gatewayToken = "", desktopTicketVerifier = null } = {}) {
    this.gatewayToken = String(gatewayToken || "").trim();
    this.desktopTicketVerifier = desktopTicketVerifier;
  }

  get configured() {
    return Boolean(this.gatewayToken || this.desktopTicketVerifier);
  }

  async authorize(request, pathname) {
    const authorization = String(request?.headers?.authorization || "");
    if (this.gatewayToken && matchesStaticToken(authorization, this.gatewayToken)) {
      return Object.freeze({ allowed: true, mode: "gateway-static", principal: null });
    }

    const requiredScope = desktopScopeFor(request?.method, pathname);
    if (!requiredScope || !this.desktopTicketVerifier) {
      return denial(this.configured ? 401 : 503, this.configured ? "unauthorized" : "authorization_unconfigured");
    }

    try {
      const principal = await this.desktopTicketVerifier.verifyAuthorizationHeader(authorization, {
        requiredScope,
      });
      return Object.freeze({
        allowed: true,
        mode: "desktop-ticket",
        requiredScope,
        principal,
      });
    } catch (error) {
      if (error?.code === "revocation_unavailable") {
        return denial(503, "desktop_revocation_unavailable");
      }
      if (error instanceof DesktopTicketVerificationError && error.code === "insufficient_scope") {
        return denial(403, "insufficient_scope");
      }
      return denial(401, "invalid_desktop_ticket");
    }
  }
}

export function desktopScopeFor(method, pathname) {
  return DESKTOP_ROUTE_SCOPES.get(`${String(method || "").toUpperCase()} ${String(pathname || "")}`) ?? null;
}

function matchesStaticToken(authorization, expectedToken) {
  if (!authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7).trim(), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function denial(status, code) {
  return Object.freeze({ allowed: false, status, code });
}

export const desktopGatewayRouteScopes = Object.freeze(
  Object.fromEntries(DESKTOP_ROUTE_SCOPES),
);
