import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const library = {};
vm.runInNewContext(compile(read("../src/lib/socials.ts")), { exports: library, Date, Math, Set });
const catalog = library.CALLING_CARD_CATALOG;
function declaration(path, name, variable = false) {
  const source = read(path), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  const visit = node => {
    if (variable ? ts.isVariableDeclaration(node) && node.name.getText(ast) === name : ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(found); return found.replace(/^export /, "");
}
function server({ signedIn = true, earned = false, loadError = false, saveError = false, missing = false } = {}) {
  const writes = [], filters = [];
  const profile = { id: "profile", user_id: "owner", object_type: "profile", author_label: "New name", scope: "friends", payload: {
    displayName: "New name", bio: "Keep", avatarUrl: "avatar", avatarAppearance: { version: 1 }, presenceStatus: "dnd", callingCardCode: "origin-signal", custom: "untouched",
  } };
  const supabase = { from: () => {
    const conditions = []; let patch;
    const run = () => {
      filters.push(conditions);
      if (patch) { writes.push(patch); return { data: saveError ? null : { ...profile, ...patch }, error: saveError ? {} : null }; }
      if (conditions.some(([k, v]) => k === "object_type" && v === "card")) return { data: earned ? { id: "earned" } : null, error: null };
      return { data: missing ? null : profile, error: loadError ? {} : null };
    };
    const chain = { select: () => chain, eq: (k, v) => { conditions.push([k, v]); return chain; }, limit: () => chain,
      update: value => { patch = value; return chain; }, maybeSingle: async () => run(), single: async () => run() };
    return chain;
  } };
  const post = vm.runInNewContext(compile(declaration("../src/app/api/friends/route.ts", "POST")) + ";POST", {
    CALLING_CARD_CATALOG: catalog, socialClient: async () => ({ actor: signedIn ? { userId: "owner" } : null, supabase }),
    cleanIdentifier: value => typeof value === "string" ? value : "", Date,
    NextResponse: { json: (body, opts) => ({ body, status: opts?.status ?? 200 }) },
  });
  return { writes, filters, profile, post: code => post({ json: async () => ({ action: "calling-card", code, userId: "other" }) }) };
}
test("starter activates without an award and preserves the complete profile and audience", async () => {
  const h = server(), result = await h.post("origin-signal");
  assert.equal(result.status, 200); assert.equal(result.body.object.scope, "friends");
  assert.equal(result.body.object.userId, "owner");
  assert.deepEqual(Object.keys(h.writes[0]).sort(), ["payload", "updated_at"]);
  assert.equal(h.writes[0].payload.bio, "Keep"); assert.equal(h.writes[0].payload.avatarUrl, "avatar");
  assert.equal(h.writes[0].payload.avatarAppearance.version, 1); assert.equal(h.writes[0].payload.custom, "untouched");
  assert.equal(h.writes[0].payload.presenceStatus, "dnd");
  assert.ok(h.filters.every(f => f.some(([k, v]) => k === "user_id" && v === "owner")));
});
test("earned cards are account-scoped; locked and unknown cards cannot be equipped", async () => {
  const h = server({ earned: true });
  assert.equal((await h.post("first-on-record")).status, 200);
  assert.equal(h.writes[0].payload.callingCardCode, "first-on-record");
  assert.ok(h.filters[0].some(([k, v]) => k === "payload->>code" && v === "first-on-record"));
  const locked = server(); assert.equal((await locked.post("first-on-record")).status, 403); assert.equal(locked.writes.length, 0);
  assert.equal((await server().post("fake")).status, 400);
});
test("authentication, missing profiles and storage failures never return success", async () => {
  for (const [options, expected] of [[{ signedIn: false }, 401], [{ missing: true }, 409], [{ loadError: true }, 502], [{ saveError: true }, 502]]) {
    const result = await server(options).post("origin-signal"); assert.equal(result.status, expected); assert.equal(result.body.object, undefined);
  }
});
function renderPicker(props = {}) {
  const exports = {};
  vm.runInNewContext(compile(read("../src/components/socials/ProfileCallingCardPicker.tsx")), { exports, require: name => {
    if (name === "react/jsx-runtime") return jsx;
    if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (name === "@/lib/socials") return library;
    return { default: ({ definition }) => React.createElement("div", null, definition.name) };
  } });
  return renderToStaticMarkup(React.createElement(exports.default, { userId: "owner", ownerName: "Trader", cards: [], activeCode: "origin-signal", savingCode: null, error: "", onEquip: async () => {}, ...props }));
}
test("profile picker shows starter and only this account's unlocked cards, with active and busy states", () => {
  const cards = [{ userId: "owner", objectType: "card", payload: { code: "first-on-record" } },
    { userId: "other", objectType: "card", payload: { code: catalog[2].code } }];
  const html = renderPicker({ cards });
  assert.match(html, /Change calling card/); assert.match(html, /Activate calling card: First on Record/);
  assert.doesNotMatch(html, new RegExp(`Activate calling card: ${catalog[2].name}`));
  assert.match(html, /aria-pressed="true"/); assert.match(html, /<details/);
  const busy = renderPicker({ cards, savingCode: "first-on-record", error: "Retry save" });
  assert.match(busy, /aria-busy="true"/); assert.match(busy, /Saving…/); assert.match(busy, /role="alert"/);
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 2);
});
function client({ failed = false, delayed = false } = {}) {
  const h = { updates: [], drafts: [], notice: "", error: "", pending: null, calls: 0, guard: { current: false } };
  let finish;
  const wait = delayed ? new Promise(resolve => { finish = resolve; }) : Promise.resolve();
  const fn = vm.runInNewContext(compile("const " + declaration("../src/components/socials/SocialsWorkspace.tsx", "equipCallingCard", true)) + ";equipCallingCard", {
    callingCardSaveRef: h.guard, currentProfile: { callingCardCode: "origin-signal" }, cards: [{ userId: "owner", payload: { code: "first-on-record" } }],
    resolvedAccountKey: "owner", typedPayload: o => o.payload, setCallingCardSavingCode: value => h.pending = value, setCallingCardError: value => h.error = value,
    setNotice: value => h.notice = value, upsertObject: value => h.updates.push(value), setProfileDraft: fn => h.drafts.push(fn({ bio: "Keep" })), Error,
    fetch: async (_, opts) => { h.calls++; assert.equal(JSON.parse(opts.body).action, "calling-card"); await wait; return { ok: !failed, json: async () => failed ? { error: "Save failed" } : { object: { userId: "owner", objectType: "profile", payload: { callingCardCode: "first-on-record" } } } }; },
  });
  return { ...h, h, fn, finish };
}
test("activation waits for persistence and ignores duplicate clicks", async () => {
  const { h, fn, finish } = client({ delayed: true });
  const first = fn(catalog[1]); await fn(catalog[1]); assert.equal(h.calls, 1); assert.equal(h.updates.length, 0);
  finish(); await first; assert.equal(h.updates.length, 1); assert.equal(h.pending, null); assert.equal(h.guard.current, false);
  assert.equal(h.drafts[0].bio, "Keep"); assert.equal(h.drafts[0].callingCardCode, "first-on-record");
});
test("failed activation retains the previous banner and can be retried", async () => {
  const { h, fn } = client({ failed: true }); await fn(catalog[1]);
  assert.equal(h.updates.length, 0); assert.equal(h.drafts.length, 0); assert.equal(h.error, "Save failed");
  assert.equal(h.pending, null); await fn(catalog[1]); assert.equal(h.calls, 2);
});
test("picker is own-profile only and shares activation with the full calling-card collection", () => {
  const view = read("../src/components/socials/SocialProfileView.tsx"), workspace = read("../src/components/socials/SocialsWorkspace.tsx");
  assert.match(view, /isOwnProfile \? <ProfileCallingCardPicker/);
  assert.match(workspace, /onEquipCallingCard=\{equipCallingCard\}/);
  assert.match(workspace, /onClick=\{\(\) => void equipCallingCard\(definition\)\}/);
});
