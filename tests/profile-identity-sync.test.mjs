import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function tab(bus = new Set(), blocked = false) {
  const exports = {}, storage = new Map(), events = new Map();
  const window = {
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    addEventListener: (type, fn) => { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(fn); },
    removeEventListener: (type, fn) => events.get(type)?.delete(fn),
    dispatchEvent: event => { for (const fn of events.get(event.type) ?? []) fn(event); },
  };
  class BroadcastChannel {
    constructor(name) { if (blocked) throw Error("Blocked"); this.name = name; bus.add(this); }
    postMessage(data) { for (const channel of [...bus]) if (channel !== this && channel.name === this.name) channel.onmessage?.({ data: structuredClone(data) }); }
    close() { bus.delete(this); }
  }
  vm.runInNewContext(compile(read("../src/lib/profileIdentityCache.ts")), { exports, window, BroadcastChannel,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }, Map, Set, Date, Number, JSON });
  return exports;
}
test("one saved rename updates all account subscribers and preserves avatar/handle", () => {
  const cache = tab(), seen = [];
  cache.cacheProfileIdentity("u1", { displayName: "Old", handle: "trader", avatarUrl: "https://example.com/a.webp" });
  const stop = cache.subscribeProfileIdentity("u1", identity => seen.push(identity));
  const previous = cache.readProfileIdentityCache("u1");
  cache.cacheProfileIdentity("u1", { displayName: "New" }, true);
  assert.equal(seen.at(-1).displayName, "New"); assert.equal(seen.at(-1).handle, "trader");
  assert.equal(seen.at(-1).avatarUrl, "https://example.com/a.webp");
  assert.notEqual(cache.readProfileIdentityCache("u1"), previous, "pending old reads can detect identity changes by snapshot");
  const current = cache.readProfileIdentityCache("u1"), count = seen.length;
  assert.equal(cache.cacheProfileIdentity("u1", { displayName: "New" }), current); assert.equal(seen.length, count);
  stop(); cache.cacheProfileIdentity("u1", { displayName: "Third" }); assert.equal(seen.length, count);
});
test("renames synchronize across tabs without mixing accounts or rebroadcast loops", () => {
  const bus = new Set(), first = tab(bus), second = tab(bus), seen = [], other = [];
  const stopFirst = first.subscribeProfileIdentity("u1", () => {});
  const stopSecond = second.subscribeProfileIdentity("u1", identity => seen.push(identity));
  const stopOther = second.subscribeProfileIdentity("u2", identity => other.push(identity));
  first.cacheProfileIdentity("u1", { displayName: "Fresh", handle: "same_handle", avatarUrl: "" }, true);
  assert.equal(seen.length, 1); assert.equal(seen[0].displayName, "Fresh"); assert.equal(other.length, 0);
  for (const channel of [...bus]) channel.onmessage?.({ data: { userId: "u1", identity: { displayName: "Stale", handle: "old", avatarUrl: "", updatedAt: 1 } } });
  assert.equal(second.readProfileIdentityCache("u1").displayName, "Fresh");
  stopFirst(); stopSecond(); stopOther(); assert.equal(bus.size, 0);
});
test("blocked cross-tab transport cannot break a successful local identity save", () => {
  const cache = tab(new Set(), true), seen = [];
  const stop = cache.subscribeProfileIdentity("u1", identity => seen.push(identity.displayName));
  assert.doesNotThrow(() => cache.cacheProfileIdentity("u1", { displayName: "Works" }, true));
  assert.deepEqual(seen, ["Works"]); stop();
});

function authorLogic() { const exports = {}; vm.runInNewContext(compile(read("../src/lib/socialAuthorIdentity.ts")), { exports, Map }); return exports; }
test("current author names project by account ID without rewriting locked records or user text", () => {
  const { projectSocialAuthorIdentity, applySocialIdentityUpdate } = authorLogic();
  const payload = Object.freeze({ lockedAt: "fixed", contentHash: "hash", reasoningScore: 90, marketContext: "Written by Old" });
  const record = Object.freeze({ id: "plan", userId: "u1", objectType: "precord", authorLabel: "Old", payload });
  const other = Object.freeze({ ...record, id: "other", userId: "u2" });
  const profile = { id: "profile", userId: "u1", objectType: "profile", authorLabel: "Old", payload: { displayName: "Old", handle: "trader", bio: "Keep" } };
  const updated = applySocialIdentityUpdate([profile, record, other], "u1", { displayName: "New", handle: "trader", avatarUrl: "" });
  assert.equal(updated[0].payload.bio, "Keep"); assert.equal(updated[1], record); assert.equal(updated[2], other);
  const displayed = projectSocialAuthorIdentity(updated);
  assert.equal(displayed[1].authorLabel, "New"); assert.equal(displayed[2].authorLabel, "Old");
  assert.equal(displayed[1].payload, payload); assert.equal(record.authorLabel, "Old");
  assert.equal(displayed[1].payload.marketContext, "Written by Old"); assert.equal(displayed[1].payload.contentHash, "hash");
});

test("actual workspace profile-save handler applies names, handles and avatars and rejects another account", () => {
  const source = read("../src/components/KwantifyWorkspace.tsx"), ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let snippet;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "handleProfileUpdated") snippet = node.getText(ast); ts.forEachChild(node, visit); }; visit(ast);
  const state = { name: "Old", handle: "old", avatar: "keep" }, context = {
    preferenceUserId: "u1", setCurrentDisplayName: value => state.name = value, setCurrentUsername: value => state.handle = value,
    setCurrentAvatarUrl: value => state.avatar = value, cacheProfileIdentity: () => {},
  };
  const handler = vm.runInNewContext(compile(`const ${snippet}; handleProfileUpdated`), context);
  handler({ detail: { userId: "u1", displayName: "New", handle: "new_handle", avatarUrl: "new.webp" } });
  assert.deepEqual(state, { name: "New", handle: "new_handle", avatar: "new.webp" });
  handler({ detail: { userId: "u2", displayName: "Wrong", avatarUrl: "wrong" } }); assert.equal(state.name, "New");
  handler({ detail: { userId: "u1", displayName: "Latest" } }); assert.equal(state.avatar, "new.webp");
});

test("every identity save publishes shared updates and route-based views use canonical names", () => {
  const workspace = read("../src/components/KwantifyWorkspace.tsx"), settings = read("../src/components/KwantifySettingsWorkspace.tsx"), social = read("../src/components/socials/SocialsWorkspace.tsx");
  assert.match(settings, /savedViewer\?\.displayName \|\| displayName,[\s\S]*?\}, true\)/);
  assert.match(social, /cacheProfileIdentity\(resolvedAccountKey,[\s\S]*?\}, true\)/);
  assert.match(social, /projectSocialAuthorIdentity\(state.objects\)/);
  assert.doesNotMatch(social, /\[resolvedAccountKey, resolvedLabel\]/, "renaming must not tear down Socials");
  assert.match(workspace, /readProfileIdentityCache\(preferenceUserId\) === identityAtRequest/);
  assert.match(workspace, /accountLabel=\{currentDisplayName \|\| currentUsername/);
  assert.match(read("../src/components/WorkspaceHome.tsx"), /subscribeProfileIdentity\(userId, setIdentity\)/);
  assert.match(read("../src/app/api/socials/route.ts"), /objects: await currentAuthorObjects\(rows, supabase\)/);
});

test("filtered Gameplan/history API results batch current author lookups instead of trusting saved labels", async () => {
  const source = read("../src/app/api/socials/route.ts"), ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
  const snippets = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["currentAuthorObjects", "fromRow"].includes(node.name?.text)).map(node => node.getText(ast)).join("\n");
  const rows = [1, 2].map(id => ({ user_id: "u1", id: "plan-" + id, object_type: "precord", author_label: "Old", scope: "private", payload: { lockedAt: "fixed", contentHash: "hash" } }));
  const calls = [], selects = [], supabase = { from: () => { const query = { select: fields => { selects.push(fields); return query; }, eq: () => query, in: async (field, ids) => {
    calls.push({ field, ids }); return { data: [{ user_id: "u1", display_name: "Latest" }], error: null };
  } }; return query; } };
  const fn = vm.runInNewContext(compile(snippets) + ";currentAuthorObjects", { ...authorLogic(), Set, Date });
  const result = await fn(rows, supabase);
  assert.equal(calls.length, 1); assert.equal(calls[0].ids.length, 1);
  assert.deepEqual(selects, ["user_id,display_name:payload->>displayName"], "identity lookups never transfer avatar/profile blobs");
  assert.ok(result.every(item => item.authorLabel === "Latest"));
  assert.equal(rows[0].author_label, "Old"); assert.equal(result[0].payload, rows[0].payload);
  const inlineProfile = { user_id: "u1", id: "profile", object_type: "profile", payload: { displayName: "Inline current" } };
  calls.length = 0; const inline = await fn([...rows, inlineProfile], supabase);
  assert.equal(calls.length, 0); assert.equal(inline[0].authorLabel, "Inline current");
});

test("saving a renamed identity preserves existing profile privacy and writes its canonical label", async () => {
  const source = read("../src/app/api/friends/route.ts"), ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
  const snippet = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "upsertProfile").getText(ast);
  let saved;
  const existing = { scope: "private", payload: { displayName: "Old", handle: "trader", bio: "Private bio", avatarUrl: "old.webp" } };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: existing }), upsert: async row => { saved = row; return { error: null }; } };
  const context = { cleanText: value => typeof value === "string" ? value.trim() : "", cleanAvatarUrl: value => value || "",
    normalizeHandle: value => value || "", isValidProfileHandle: value => Boolean(value), authorLabel: () => "Old auth name", Date };
  const fn = vm.runInNewContext(compile(snippet) + ";upsertProfile", context);
  await fn({ from: () => query }, { userId: "u1", label: "old@example.com" }, { displayName: "New" });
  assert.equal(saved.scope, "private"); assert.equal(saved.author_label, "New");
  assert.equal(saved.payload.displayName, "New"); assert.equal(saved.payload.bio, "Private bio"); assert.equal(saved.payload.handle, "trader");
});
