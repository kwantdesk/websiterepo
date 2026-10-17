import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function library(path) { const exports = {}; vm.runInNewContext(compile(read(path)), { exports, Date, Set, Math, Error }); return exports; }
const logic = library("../src/lib/socialProfileManagement.ts"), socials = library("../src/lib/socials.ts");
const item = (objectType = "post", scope = "friends", userId = "owner", id = "item-1", payload = {}) => ({ id, userId, objectType, scope, deskId: null, parentId: null, authorLabel: "Trader", payload, createdAt: "2026-10-01", updatedAt: "2026-10-01" });

test("archive/restore is lossless and private across posts, locked plans, likes and bookmarks", () => {
  for (const type of ["post", "precord", "reaction"]) for (const scope of ["community", "friends", "private"]) {
    const original = item(type, scope, "owner", "item", { kind: "SAVED", body: "Text", lockedAt: "fixed", contentHash: "hash", reasoningScore: 88 });
    const archived = { ...original, ...logic.profileItemPatch(original, "archive") };
    assert.equal(archived.scope, "private"); assert.ok(logic.isProfileArchived(archived));
    const repeat = { ...archived, ...logic.profileItemPatch(archived, "archive") };
    assert.equal(repeat.payload.profileArchiveScope, scope);
    const restored = logic.profileItemPatch(repeat, "restore");
    assert.equal(restored.scope, scope); assert.deepEqual(JSON.parse(JSON.stringify(restored.payload)), original.payload);
    const changed = { ...archived, ...logic.profileItemPatch(archived, "visibility", "friends") };
    assert.equal(changed.scope, "private"); assert.equal(logic.profileItemPatch(changed, "restore").scope, "friends");
  }
});
test("collection management resolves the viewer's reaction, never another author's source", () => {
  const source = item("post", "community", "other", "source"), ownLike = { ...item("reaction", "private", "owner", "like", { kind: "LIKE" }), parentId: "source" };
  const otherSave = { ...item("reaction", "community", "other", "save", { kind: "SAVED" }), parentId: "source" };
  assert.equal(logic.resolveProfileManagedItem(source, "liked", "owner", [ownLike, otherSave]), ownLike);
  assert.equal(logic.resolveProfileManagedItem(source, "saved", "owner", [ownLike, otherSave]), undefined);
  assert.equal(logic.resolveProfileManagedItem(source, "posts", "owner", [ownLike]), undefined);
  assert.throws(() => logic.profileItemPatch(item("profile"), "archive"));
  assert.throws(() => logic.profileItemPatch(item("reaction", "private", "owner", "poll", { kind: "POLL" }), "archive"));
  assert.throws(() => logic.profileItemPatch(source, "visibility", "everyone"));
});

const routeText = read("../src/app/api/socials/route.ts"), ast = ts.createSourceFile("route.ts", routeText, ts.ScriptTarget.Latest, true);
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["PATCH", "fromRow", "cleanIdentifier"].includes(node.name?.text)).map(node => node.getText(ast).replace(/^export /, "")).join("\n");
const toRow = object => ({ user_id: object.userId, id: object.id, object_type: object.objectType, author_label: object.authorLabel, scope: object.scope, desk_id: object.deskId, parent_id: object.parentId, payload: object.payload, created_at: object.createdAt, updated_at: object.updatedAt });
function server(objects, { signedIn = true, failWrite = false } = {}) {
  const rows = objects.map(toRow), writes = [];
  const supabase = { from: () => {
    const filters = []; let update, deleting = false;
    const value = (row, key) => key.startsWith("payload->>") ? row.payload[key.slice(10)] ?? null : row[key];
    const run = single => {
      const matches = rows.filter(row => filters.every(([key, expected]) => String(value(row, key)) === String(expected)));
      if ((update || deleting) && failWrite) return { data: null, error: { message: "write failed" } };
      if (deleting) { for (const row of matches) rows.splice(rows.indexOf(row), 1); writes.push("delete"); }
      else if (update) { for (const row of matches) Object.assign(row, update); writes.push(update); }
      return { data: single ? matches[0] ?? null : matches, error: null };
    };
    const chain = { select: () => chain, eq: (key, expected) => { filters.push([key, expected]); return chain; }, is: (key, expected) => { filters.push([key, expected]); return chain; },
      update: patch => { update = patch; return chain; }, delete: () => { deleting = true; return chain; },
      single: async () => run(true), maybeSingle: async () => run(true), then: (resolve, reject) => Promise.resolve(run(false)).then(resolve, reject),
    }; return chain;
  } };
  const context = { ...logic, normalizeSocialProfile: socials.normalizeSocialProfile, socialClient: async () => ({ actor: signedIn ? { userId: "owner" } : null, supabase }),
    Date, String, Error, NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
  };
  const patch = vm.runInNewContext(compile(functions) + ";PATCH", context);
  return { rows, writes, patch: body => patch({ json: async () => body }) };
}
test("actual API enforces owner identity and never changes locked prices, timestamps or scores", async () => {
  const plan = item("precord", "community", "owner", "plan", { lockedAt: "fixed", contentHash: "hash", plannedEntryLow: 100, reasoningScore: 88 });
  const h = server([plan, item("post", "community", "other", "foreign")]);
  assert.equal((await h.patch({ id: "foreign", action: "delete" })).status, 404);
  assert.equal((await server([plan], { signedIn: false }).patch({ id: "plan", action: "delete" })).status, 401);
  const result = await h.patch({ id: "plan", action: "edit", caption: "New profile note", payload: { plannedEntryLow: 1 } });
  assert.equal(result.status, 200); assert.equal(result.body.object.payload.plannedEntryLow, 100);
  assert.equal(result.body.object.payload.lockedAt, "fixed"); assert.equal(result.body.object.payload.contentHash, "hash");
  assert.equal(result.body.object.payload.reasoningScore, 88); assert.equal(result.body.object.payload.profileCaption, "New profile note");
  assert.equal((await h.patch({ id: "plan", action: "archive" })).body.object.scope, "private");
  assert.equal((await h.patch({ id: "plan", action: "restore" })).body.object.scope, "community");
});
test("deleting unlike/unsave only deletes the owned reaction; failures are explicit", async () => {
  const source = item("post", "community", "other", "source"), reaction = { ...item("reaction", "private", "owner", "bookmark", { kind: "SAVED" }), parentId: "source" };
  const h = server([source, reaction]); assert.equal((await h.patch({ id: "bookmark", action: "delete" })).status, 200);
  assert.deepEqual(h.rows.map(row => row.id), ["source"]);
  assert.equal((await server([source, reaction], { failWrite: true }).patch({ id: "bookmark", action: "delete" })).status, 502);
  assert.equal((await server([source, reaction]).patch({ id: "bookmark", action: "edit", caption: "bad" })).status, 400);
  assert.equal((await server([source, reaction]).patch({ id: "bookmark", action: "visibility", scope: "fake" })).status, 400);
});
test("collection privacy updates only selected active owned items and persists Friends default", async () => {
  const profile = item("profile", "community", "owner", "profile", { displayName: "Trader", handle: "trader", bio: "Keep" });
  const saved = item("reaction", "private", "owner", "saved", { kind: "SAVED" }), liked = item("reaction", "community", "owner", "liked", { kind: "LIKE" });
  const archived = item("reaction", "private", "owner", "archived", { kind: "SAVED", profileArchivedAt: "2026-10-17", profileArchiveScope: "community" });
  const other = item("reaction", "community", "other", "foreign", { kind: "SAVED" });
  const h = server([profile, saved, liked, archived, other]); const result = await h.patch({ collection: "saves", scope: "friends" });
  assert.equal(result.status, 200); assert.equal(h.rows.find(row => row.id === "saved").scope, "friends");
  assert.equal(h.rows.find(row => row.id === "liked").scope, "community"); assert.equal(h.rows.find(row => row.id === "archived").scope, "private");
  assert.equal(h.rows.find(row => row.id === "foreign").scope, "community"); assert.equal(h.rows.find(row => row.id === "profile").payload.bio, "Keep");
  assert.equal(socials.normalizeSocialProfile(h.rows.find(row => row.id === "profile").payload).visibility.saves, "friends");
});

test("menus expose context-specific actions, archive restore and audience controls", () => {
  const exports = {}, source = read("../src/components/socials/ProfileItemMenu.tsx");
  vm.runInNewContext(compile(source), { exports, require: name => name === "react" ? React : name === "react/jsx-runtime" ? requireJsx :
    name === "lucide-react" ? { MoreHorizontal: () => null } : name.includes("KwantSelect") ? { default: props => React.createElement("select", props) } : logic });
  const Menu = exports.default;
  for (const [collection, label] of [["posts", "Delete post"], ["gameplans", "Delete Socials record"], ["liked", "Unlike"], ["saved", "Unsave"], ["reposts", "Undo repost"]]) {
    const object = item(collection === "gameplans" ? "precord" : "post");
    const html = renderToStaticMarkup(React.createElement(Menu, { object, managedObject: object, collection, archived: false, onManage: async () => {}, onEditPost: () => {} }));
    assert.ok(html.includes(label)); assert.ok(html.includes("Friends only")); assert.ok(html.includes("Only me (private)")); assert.ok(html.includes("Archive"));
    if (collection === "liked" || collection === "saved") assert.ok(!html.includes("Edit post"));
    const archived = renderToStaticMarkup(React.createElement(Menu, { object, managedObject: object, collection, archived: true, onManage: async () => {}, onEditPost: () => {} }));
    assert.ok(archived.includes("Restore from archive"));
  }
});
import * as requireJsx from "react/jsx-runtime";

test("migration preserves trading-field immutability and archived rows stay private", () => {
  const sql = read("../supabase/migrations/202610170001_social_profile_management.sql");
  assert.match(sql, /new.payload - 'profileArchivedAt' - 'profileArchiveScope' - 'profileCaption'/);
  assert.match(sql, /old.payload - 'profileArchivedAt' - 'profileArchiveScope' - 'profileCaption'/);
  assert.match(sql, /new.scope <> 'private'/); assert.doesNotMatch(sql, /drop table|disable trigger|grant all/i);
  const view = read("../src/components/socials/SocialProfileView.tsx"), workspace = read("../src/components/socials/SocialsWorkspace.tsx");
  assert.match(view, /isOwnProfile \? getManagedItem/); assert.match(view, /showArchived/);
  assert.match(workspace, /filter\(object => !isProfileArchived\(object\)\)/);
});
