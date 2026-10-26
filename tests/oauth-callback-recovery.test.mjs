import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { safeAuthReturn, OAUTH_RETURN_COOKIE } from "../src/lib/authRedirect.ts";
const require = createRequire(import.meta.url);
const { NextResponse, NextRequest } = require("next/server.js");
function compile(path, modules) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8"), exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, console: { warn() {} }, process: { env: {} }, require: name => {
    if (name === "next/server") return { NextResponse };
    if (name === "@/lib/authRedirect") return { safeAuthReturn, OAUTH_RETURN_COOKIE };
    if (name in modules) return modules[name];
    throw Error(name);
  } });
  return exports;
}
test("Site URL fallback carries the one-time code to callback before session routing can discard it", async () => {
  let authCalls = 0;
  const { middleware } = compile("../middleware.ts", {
    "@supabase/ssr": { createServerClient: () => { authCalls++; throw Error("must not refresh before callback"); } },
    "@/lib/siteAccess": { isSiteAccessConfigured: () => false },
  });
  for (const path of ["/?code=one-time-code", "/login?code=one-time-code"]) {
    const response = await middleware(new NextRequest("https://www.kwantdesk.com" + path));
    const target = new URL(response.headers.get("location"));
    assert.equal(target.pathname, "/auth/callback");
    assert.equal(target.searchParams.get("code"), "one-time-code");
    assert.equal(response.status, 303);
  }
  const failure = await middleware(new NextRequest("https://www.kwantdesk.com/?error=access_denied"));
  assert.equal(new URL(failure.headers.get("location")).pathname, "/auth/callback");
  assert.equal(authCalls, 0);
});
test("callback attaches new session cookies to its actual redirect and restores the stored destination", async () => {
  let exchanged;
  const { GET } = compile("../src/app/auth/callback/route.ts", {
    "@/lib/access": { isAllowedEmail: email => email === "test@example.invalid" },
    "@/lib/supabase/server": { createClient: async ({ cookieResponse }) => ({ auth: {
      exchangeCodeForSession: async code => {
        exchanged = code;
        cookieResponse.cookies.set("test-session", "test-only-session", { path: "/", httpOnly: true });
        return { error: null };
      },
      getUser: async () => ({ data: { user: { email: "test@example.invalid" } } }),
    } }) },
  });
  const response = await GET(new NextRequest("https://www.kwantdesk.com/auth/callback?code=one-time-code", {
    headers: { cookie: `${OAUTH_RETURN_COOKIE}=%2Fcharts` },
  }));
  assert.equal(exchanged, "one-time-code");
  assert.equal(new URL(response.headers.get("location")).pathname, "/charts");
  assert.equal(response.cookies.get("test-session").value, "test-only-session");
  assert.equal(response.cookies.get(OAUTH_RETURN_COOKIE).value, "");
});
test("missing codes, failed exchanges and callback exceptions stop at a visible error", async () => {
  for (const mode of ["missing", "exchange", "throw"]) {
    const { GET } = compile("../src/app/auth/callback/route.ts", {
      "@/lib/access": { isAllowedEmail: () => true },
      "@/lib/supabase/server": { createClient: async () => {
        if (mode === "throw") throw Error("network failure");
        return { auth: { exchangeCodeForSession: async () => ({ error: { code: "bad_code_verifier", status: 400 } }) } };
      } },
    });
    const response = await GET(new NextRequest("https://www.kwantdesk.com/auth/callback" + (mode === "missing" ? "" : "?code=one-time-code")));
    const target = new URL(response.headers.get("location"));
    assert.equal(target.pathname, "/login");
    assert.equal(target.searchParams.get("error"), "auth");
  }
});
