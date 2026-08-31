import assert from "node:assert/strict";
import test from "node:test";

import { DesktopTicketVerificationError } from "../src/desktop-ticket-verifier.mjs";
import {
  desktopGatewayRouteScopes,
  desktopScopeFor,
  GatewayAuthorizer,
} from "../src/gateway-authorizer.mjs";

function request(method = "GET", authorization = "Bearer desktop-ticket") {
  return { method, headers: { authorization } };
}

test("the static gateway token retains privileged access without entering desktop verification", async () => {
  let verifierCalls = 0;
  const authorizer = new GatewayAuthorizer({
    gatewayToken: "static-secret",
    desktopTicketVerifier: {
      async verifyAuthorizationHeader() { verifierCalls += 1; },
    },
  });

  const result = await authorizer.authorize(
    request("POST", "Bearer static-secret"),
    "/v1/rithmic/connect",
  );

  assert.equal(result.allowed, true);
  assert.equal(result.mode, "gateway-static");
  assert.equal(verifierCalls, 0);
});

test("desktop tickets receive the exact scope for every allow-listed read route", async () => {
  const calls = [];
  const principal = { subject: "user-id" };
  const authorizer = new GatewayAuthorizer({
    desktopTicketVerifier: {
      async verifyAuthorizationHeader(header, options) {
        calls.push({ header, options });
        return principal;
      },
    },
  });

  for (const [route, requiredScope] of Object.entries(desktopGatewayRouteScopes)) {
    const separator = route.indexOf(" ");
    const method = route.slice(0, separator);
    const pathname = route.slice(separator + 1);
    const result = await authorizer.authorize(request(method), pathname);
    assert.equal(result.allowed, true, route);
    assert.equal(result.mode, "desktop-ticket", route);
    assert.equal(result.requiredScope, requiredScope, route);
    assert.equal(result.principal, principal, route);
  }

  assert.equal(calls.length, Object.keys(desktopGatewayRouteScopes).length);
  assert.ok(calls.every((call) => call.header === "Bearer desktop-ticket"));
  assert.equal(desktopGatewayRouteScopes["GET /v1/analytics/expected-move"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/analytics/hedge-levels"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/analytics/gex-flow"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/analytics/gex-flow/ratios"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/analytics/gameplan"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/analytics/options-flow"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/analytics/options-flow/market-data"], "options.analytics:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/zyon/messages"], "assistant.zyon:write");
  assert.equal(desktopGatewayRouteScopes["POST /v1/zyon/transcriptions"], "assistant.zyon:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/zyon/journal"], "assistant.zyon:read");
  assert.equal(desktopGatewayRouteScopes["DELETE /v1/zyon/journal"], "assistant.zyon:write");
  assert.equal(desktopGatewayRouteScopes["POST /v1/zyon/gameplan-lock"], "assistant.zyon:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/zyon/gameplan-analyst-archive"], "assistant.zyon:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/zyon/gameplan-analyst-archive"], "assistant.zyon:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/kwantbot/archive"], "assistant.zyon:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/kwantbot/archive"], "assistant.zyon:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/news/calendar"], "news.intelligence:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/news/intelligence"], "news.intelligence:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/news/analyst"], "news.intelligence:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/news/friends"], "news.intelligence:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/news/share"], "news.intelligence:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/state"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/profile"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/follow"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/follow"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/following"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/reaction"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/reaction"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/notifications"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["PATCH /v1/socials/notifications"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/gameplan-execution"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/gameplan-score"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/trade-post"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/object"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["DELETE /v1/socials/object"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/socials/friends"], "socials.account:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/socials/friends"], "socials.account:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/journal/state"], "journal.account:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/journal/state"], "journal.account:write");
  assert.equal(desktopGatewayRouteScopes["DELETE /v1/journal/state"], "journal.account:write");
  assert.equal(desktopGatewayRouteScopes["GET /v1/journal/analysis"], "journal.account:read");
  assert.equal(desktopGatewayRouteScopes["POST /v1/journal/analysis"], "journal.account:write");
});

test("privileged, vendor, raw, mutation, and near-match routes remain static-token-only", async () => {
  let verifierCalls = 0;
  const authorizer = new GatewayAuthorizer({
    gatewayToken: "static-secret",
    desktopTicketVerifier: {
      async verifyAuthorizationHeader() { verifierCalls += 1; },
    },
  });
  const deniedRoutes = [
    ["POST", "/v1/lab/snapshot"],
    ["GET", "/v1/rithmic/systems"],
    ["POST", "/v1/rithmic/connect"],
    ["POST", "/v1/rithmic/subscriptions"],
    ["GET", "/v1/rithmic/events"],
    ["POST", "/v1/bridge/rtrader/snapshot"],
    ["GET", "/v1/vendors/quantdata/options"],
    ["POST", "/v1/market-data/trades"],
    ["GET", "/v1/market-data/trades/"],
    ["GET", "/v1/market-data/history/"],
  ];

  for (const [method, pathname] of deniedRoutes) {
    const result = await authorizer.authorize(request(method), pathname);
    assert.deepEqual(result, { allowed: false, status: 401, code: "unauthorized" });
  }
  assert.equal(verifierCalls, 0);
  assert.equal(desktopScopeFor("get", "/v1/market-data/trades"), "market.trades:read");
  assert.equal(desktopScopeFor("get", "/v1/market-data/history"), "market.trades:read");
});

test("desktop verification failures are generic while insufficient scope and revocation outage stay typed", async () => {
  for (const [error, status, code] of [
    [new DesktopTicketVerificationError("invalid_signature", "detail"), 401, "invalid_desktop_ticket"],
    [new DesktopTicketVerificationError("insufficient_scope", "detail"), 403, "insufficient_scope"],
    [Object.assign(new Error("detail"), { code: "revocation_unavailable" }), 503, "desktop_revocation_unavailable"],
  ]) {
    const authorizer = new GatewayAuthorizer({
      desktopTicketVerifier: {
        async verifyAuthorizationHeader() { throw error; },
      },
    });
    const result = await authorizer.authorize(request(), "/v1/market-data/trades");
    assert.deepEqual(result, { allowed: false, status, code });
    assert.doesNotMatch(JSON.stringify(result), /detail|signature/i);
  }
});

test("an entirely unconfigured authorizer fails closed", async () => {
  const result = await new GatewayAuthorizer().authorize(request(), "/v1/market-data/trades");
  assert.deepEqual(result, {
    allowed: false,
    status: 503,
    code: "authorization_unconfigured",
  });
});
