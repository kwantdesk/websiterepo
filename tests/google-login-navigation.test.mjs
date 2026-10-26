import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { safeAuthReturn, OAUTH_RETURN_COOKIE } from "../src/lib/authRedirect.ts";

const require = createRequire(import.meta.url);
const { NextResponse } = require("next/server.js");
const { createServerClient } = require("@supabase/ssr");
const routeSource = readFileSync(new URL("../src/app/auth/signin/route.ts", import.meta.url), "utf8");
const code = ts.transpileModule(routeSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;

function route(createClient) {
  const exports = {};
  vm.runInNewContext(code, { exports, URL, Error, require: name => {
    if (name === "next/server") return { NextResponse };
    if (name === "@/lib/authRedirect") return { safeAuthReturn, OAUTH_RETURN_COOKIE };
    if (name === "@/lib/supabase/server") return { createClient };
    throw Error(name);
  } });
  return exports.GET;
}

test("server initiation generates a real PKCE redirect and verifier cookie without a browser", async () => {
  const writes = [];
  const client = createServerClient("https://test.supabase.co", "public-test-key", {
    cookies: { getAll: () => [], setAll: values => writes.push(...values) },
  });
  const response = await route(async () => client)(new Request("https://www.kwantdesk.com/auth/signin?returnTo=%2Fcharts%3Fworkspace%3Dtest"));
  assert.equal(response.status, 303);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.origin, "https://test.supabase.co");
  assert.equal(target.searchParams.get("provider"), "google");
  assert.ok(target.searchParams.get("code_challenge"));
  const callback = new URL(target.searchParams.get("redirect_to"));
  assert.equal(callback.origin, "https://www.kwantdesk.com");
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.search, "", "the allowlisted provider callback must remain exact");
  assert.equal(response.cookies.get(OAUTH_RETURN_COOKIE).value, "/charts?workspace=test");
  assert.equal(response.cookies.get(OAUTH_RETURN_COOKIE).httpOnly, true);
  assert.ok(writes.some(c => c.name.includes("code-verifier") && c.value.length > 20));
});

test("OAuth failures return to a visible retry screen rather than leaving a dead button", async () => {
  for (const create of [
    async () => { throw Error("configuration failure"); },
    async () => ({ auth: { signInWithOAuth: async () => ({ data: {}, error: Error("provider refused") }) } }),
    async () => ({ auth: { signInWithOAuth: async () => ({ data: {}, error: null }) } }),
  ]) {
    const response = await route(create)(new Request("https://www.kwantdesk.com/auth/signin?returnTo=%2Fcharts"));
    const target = new URL(response.headers.get("location"));
    assert.equal(target.origin, "https://www.kwantdesk.com");
    assert.equal(target.pathname, "/login");
    assert.equal(target.searchParams.get("error"), "auth");
    assert.equal(target.searchParams.get("returnTo"), "/charts");
  }
});

test("return destination rejects external/protocol-relative/backslash/control-character paths", () => {
  for (const bad of [undefined, "https://elsewhere.test", "//elsewhere.test", "/\\elsewhere.test", "/\n/elsewhere.test", "/\u0000bad", "/".repeat(2001)]) {
    assert.equal(safeAuthReturn(bad), "/");
  }
  assert.equal(safeAuthReturn("/charts?workspace=one"), "/charts?workspace=one");
});

test("Google button is a real server-rendered link that does not wait for hydration", () => {
  const source = readFileSync(new URL("../src/components/GoogleLoginButton.tsx", import.meta.url), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, { exports, URLSearchParams, require: name => name === "@/lib/authRedirect" ? { safeAuthReturn } : require(name) });
  const html = require("react-dom/server").renderToStaticMarkup(exports.default({ returnTo: "/charts" }));
  assert.match(html, /<a[^>]+href="\/auth\/signin\?returnTo=%2Fcharts"/);
  assert.doesNotMatch(source, /use client|onClick|useState|disabled=/);
});

test("new OAuth starts ignore old session cookies while normal server clients retain them", async () => {
  const source = readFileSync(new URL("../src/lib/supabase/server.ts", import.meta.url), "utf8");
  const exports = {}, settings = [];
  const oldCookies = [{ name: "sb-test-auth-token", value: "old-session" }];
  const writes = [];
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(compiled, { exports,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key" } },
    require: name => {
      if (name === "next/headers") return { cookies: async () => ({ getAll: () => oldCookies, set: (...args) => writes.push(args) }) };
      if (name === "@supabase/ssr") return { createServerClient: (_url, _key, options) => { settings.push(options); return {}; } };
      throw Error(name);
    },
  });
  await exports.createClient();
  await exports.createClient({ freshOAuth: true });
  assert.equal(settings[0].cookies.getAll(), oldCookies);
  assert.equal(settings[1].cookies.getAll().length, 0);
  settings[1].cookies.setAll([{ name: "pkce", value: "new-verifier", options: { path: "/" } }]);
  assert.equal(writes[0][0], "pkce");
  const finalResponse = NextResponse.redirect("https://www.kwantdesk.com/charts");
  await exports.createClient({ cookieResponse: finalResponse });
  settings[2].cookies.setAll([{ name: "test-session", value: "test-only", options: { path: "/", httpOnly: true } }]);
  assert.equal(finalResponse.cookies.get("test-session").value, "test-only");
  assert.equal(finalResponse.cookies.get("test-session").httpOnly, true);
  let received;
  await route(async options => {
    received = options;
    return { auth: { signInWithOAuth: async () => ({ data: { url: "https://test.supabase.co/auth/v1/authorize" }, error: null }) } };
  })(new Request("https://www.kwantdesk.com/auth/signin"));
  assert.equal(received.freshOAuth, true);
});

test("normal login and explicit errors are stable retry screens with no automatic OAuth loop", async () => {
  const source = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, { exports, URLSearchParams, require: name => {
    if (name === "@/components/GoogleLoginButton") return { default: () => null };
    if (name === "@/lib/authRedirect") return { safeAuthReturn };
    if (name === "next/navigation") return { redirect: to => { throw Object.assign(Error("redirect"), { to }); } };
    return require(name);
  } });
  for (const returnTo of [undefined, "/charts", "//elsewhere.test"]) {
    assert.ok(await exports.default({ searchParams: Promise.resolve({ returnTo }) }));
  }
  for (const error of ["auth", "configuration", "restricted"]) {
    const result = await exports.default({ searchParams: Promise.resolve({ error, returnTo: "/charts" }) });
    assert.ok(result, "an error must render a retry page, not start a redirect loop");
  }
});
