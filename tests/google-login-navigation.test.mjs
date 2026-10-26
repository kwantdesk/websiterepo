import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { safeAuthReturn } from "../src/lib/authRedirect.ts";

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
    if (name === "@/lib/authRedirect") return { safeAuthReturn };
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
  assert.equal(callback.searchParams.get("returnTo"), "/charts?workspace=test");
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
