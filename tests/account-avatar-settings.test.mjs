import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const library = {};
vm.runInNewContext(transpile(read("../src/lib/socials.ts")), { exports: library, Math, Date, Set });
const { normalizeSocialProfile } = library;
function declaration(path, name) {
  const source = read(path), ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast); ts.forEachChild(node, visit); }
  visit(ast); assert.ok(result); return result.replace(/^export /, "");
}

function serverHarness({ missing = false, loadFailure = false, saveFailure = false, signedIn = true } = {}) {
  const calls = [];
  const row = { id: "profile", user_id: "user-1", object_type: "profile", scope: "private", author_label: "Trader", payload: {
    displayName: "Trader", handle: "trader", bio: "Keep me", presenceStatus: "dnd", visibility: { profile: "private" },
    extraField: "preserve unknown fields", avatarUrl: "old", avatarAppearance: { version: 1, presetId: "fox", colors: ["#000000", "#FFFFFF"] },
  } };
  const supabase = { from: table => {
    calls.push(["from", table]); let write;
    const chain = {
      select: () => chain, eq: (key, value) => { calls.push(["eq", key, value]); return chain; },
      maybeSingle: async () => ({ data: missing ? null : row, error: loadFailure ? {} : null }),
      update: value => { write = value; calls.push(["update", value]); return chain; },
      single: async () => ({ data: saveFailure ? null : { ...row, ...write }, error: saveFailure ? {} : null }),
    }; return chain;
  } };
  const context = { normalizeSocialProfile, socialClient: async () => ({ actor: signedIn ? { userId: "user-1" } : null, supabase }),
    cleanIdentifier: value => typeof value === "string" ? value : "", Date,
    NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
  };
  const post = vm.runInNewContext(transpile(declaration("../src/app/api/friends/route.ts", "POST")) + ";POST", context);
  return { calls, row, post: body => post({ json: async () => ({ action: "avatar", ...body }) }) };
}

test("avatar-only save is account scoped and preserves Socials profile, presence and privacy", async () => {
  const h = serverHarness();
  const appearance = { version: 1, presetId: "robot", colors: ["#123456", "#ABCDEF"] };
  const result = await h.post({ avatarUrl: "data:image/webp;base64,new", avatarAppearance: appearance });
  assert.equal(result.status, 200); assert.equal(result.body.object.userId, "user-1");
  assert.equal(result.body.object.scope, "private");
  const update = h.calls.find(call => call[0] === "update")[1];
  assert.equal(Object.keys(update).sort().join(","), "payload,updated_at");
  assert.equal(update.payload.bio, h.row.payload.bio); assert.equal(update.payload.extraField, "preserve unknown fields");
  assert.equal(update.payload.presenceStatus, "dnd"); assert.equal(update.payload.visibility.profile, "private");
  assert.equal(update.payload.avatarAppearance.presetId, "robot");
  assert.equal(h.calls.filter(call => call[0] === "eq" && call[1] === "user_id" && call[2] === "user-1").length, 2);
});

test("uploaded photo clears old editable palette; invalid and failed writes never report success", async () => {
  const h = serverHarness(), result = await h.post({ avatarUrl: "data:image/webp;base64,photo" });
  assert.equal(result.body.object.payload.avatarAppearance, null);
  for (const settings of [{ missing: true }, { loadFailure: true }, { saveFailure: true }, { signedIn: false }]) {
    const result = await serverHarness(settings).post({ avatarUrl: "https://kwantdesk.com/images/avatars/console-v1/robot.webp" });
    assert.ok(result.status >= 400); assert.equal(result.body.object, undefined);
  }
  for (const input of [{ avatarUrl: "javascript:bad" }, { avatarUrl: "https://example.com/p.webp", avatarAppearance: { version: 3 } }]) {
    const invalid = serverHarness(), result = await invalid.post(input); assert.equal(result.status, 400); assert.equal(invalid.calls.length, 0);
  }
});

function settingsHarness() {
  const state = { notice: "", phase: "ready", calls: [], events: [], cache: [], lifecycle: { current: 1 }, sequence: { current: 0 } };
  const appearance = { version: 1, presetId: "robot", colors: ["#123456", "#ABCDEF"] };
  const context = { state: "ready", savingRef: { current: false }, lifecycle: state.lifecycle, avatarLoadSequenceRef: state.sequence,
    userId: "user-1", profileDraft: normalizeSocialProfile({ displayName: "Trader", handle: "trader", avatarUrl: "old" }),
    avatarPaletteEditorRef: { current: { prepare: async () => ({ avatarUrl: "data:image/webp;base64,latest", avatarAppearance: appearance }) } },
    setState: value => state.phase = value, setNotice: value => state.notice = value, setProfileDraft: value => state.profile = value,
    cacheProfileIdentity: (...args) => state.cache.push(args), normalizeSocialProfile,
    window: { dispatchEvent: event => state.events.push(event) }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    fetch: async (url, options) => { state.calls.push([url, JSON.parse(options.body)]); return { ok: true, json: async () => ({ object: {
      id: "profile", userId: "user-1", objectType: "profile", authorLabel: "Trader", payload: { displayName: "Trader", handle: "trader", ...JSON.parse(options.body) },
    } }) }; }, Error,
  };
  const save = vm.runInNewContext(transpile(declaration("../src/components/socials/AccountAvatarSettings.tsx", "savePicture")) + ";savePicture", context);
  return { state, context, save };
}

test("Settings prepares latest colours then publishes the same account object and shared identity event", async () => {
  const h = settingsHarness(); await h.save();
  assert.equal(h.state.calls[0][0], "/api/friends"); assert.equal(h.state.calls[0][1].action, "avatar");
  assert.equal(h.state.calls[0][1].avatarAppearance.colors[0], "#123456");
  assert.equal(h.state.cache[0][0], "user-1"); assert.equal(h.state.events[0].detail.profileObject.userId, "user-1");
  assert.match(h.state.notice, /saved across your account/); assert.equal(h.state.phase, "ready");
});

test("Settings ignores stale preparations, prevents double submits and retains draft on failures", async () => {
  const h = settingsHarness(); let finish;
  h.context.avatarPaletteEditorRef.current.prepare = () => new Promise(resolve => { finish = resolve; });
  const pending = h.save(); await h.save(); h.state.sequence.current++;
  finish({ avatarUrl: "data:image/webp;base64,stale" }); await pending;
  assert.equal(h.state.calls.length, 0);
  h.context.avatarPaletteEditorRef.current.prepare = async () => { throw Error("Colours unavailable"); };
  await h.save(); assert.equal(h.state.notice, "Colours unavailable"); assert.equal(h.state.events.length, 0);
  h.context.avatarPaletteEditorRef.current = null;
  h.context.fetch = async () => ({ ok: false, json: async () => ({ error: "Storage unavailable" }) });
  await h.save(); assert.equal(h.state.notice, "Storage unavailable"); assert.equal(h.state.cache.length, 0);
});

test("normal Settings and Socials use one picker/crop implementation and receive linked updates", () => {
  const settings = read("../src/components/KwantifySettingsWorkspace.tsx"), socials = read("../src/components/socials/SocialsWorkspace.tsx");
  assert.match(settings, /<AccountAvatarSettings key=\{preferenceUserId\}/);
  assert.match(settings, /Change profile picture/); assert.doesNotMatch(settings, /Crop and save your account photo from your Socials/);
  assert.match(socials, /useProfileAvatarEditor\(/); assert.match(socials, /detail\?\.userId !== resolvedAccountKey/);
  assert.match(socials, /upsertObject\(object\)/);
});
