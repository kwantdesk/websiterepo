import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("desktop machine protocol bypasses browser auth without bypassing consent", async () => {
  const middleware = await readFile(new URL("middleware.ts", root), "utf8");
  const protocolPaths = [
    "/api/desktop-auth/jwks",
    "/api/desktop-auth/refresh",
    "/api/desktop-auth/revoke",
    "/api/desktop-auth/revocations",
    "/api/desktop-auth/token",
  ];

  for (const pathname of protocolPaths) {
    assert.match(middleware, new RegExp(`"${pathname}"`));
  }

  const allowIndex = middleware.indexOf("if (isDesktopProtocolRequest(pathname)) return response;");
  const siteAccessIndex = middleware.indexOf("const siteAccessConfigured = isSiteAccessConfigured();");
  assert.ok(allowIndex >= 0 && allowIndex < siteAccessIndex);

  const listStart = middleware.indexOf("const DESKTOP_PROTOCOL_PATHS");
  const listEnd = middleware.indexOf("] as const;", listStart);
  const allowList = middleware.slice(listStart, listEnd);
  assert.doesNotMatch(allowList, /\/api\/desktop-auth\/authorize/);
});
