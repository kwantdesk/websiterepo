import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import sharp from "sharp";

function load(relative) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, Intl, Date, console });
  return exports;
}
const { SOCIAL_AVATAR_PRESETS: presets } = load("../src/lib/socialAvatarPresets.ts");

test("thirty distinct shipped console avatars are small 500-square self-hosted WebP files", async () => {
  assert.equal(presets.length, 30);
  assert.equal(new Set(presets.map(p => p.id)).size, 30);
  const hashes = new Set(); let total = 0;
  for (const preset of presets) {
    assert.match(preset.path, /^\/images\/avatars\/console-v1\/[a-z0-9-]+\.webp$/);
    assert.equal(preset.url, `https://kwantdesk.com${preset.path}`);
    const path = new URL(`../public${preset.path}`, import.meta.url);
    const bytes = readFileSync(path);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 500); assert.equal(metadata.height, 500); assert.equal(metadata.format, "webp");
    assert.ok(statSync(path).size < 100_000);
    hashes.add(createHash("sha256").update(bytes).digest("hex")); total += bytes.length;
  }
  assert.equal(hashes.size, 30, "no duplicate file disguised as a new choice");
  assert.ok(total < 1_000_000, "entire library is bounded below one MB");
});

test("preset URLs survive profile normalization and the shared friends/avatar display path", () => {
  const { normalizeSocialProfile } = load("../src/lib/socials.ts");
  for (const preset of presets) assert.equal(normalizeSocialProfile({ displayName: "Trader", avatarUrl: preset.url }).avatarUrl, preset.url);
  assert.equal(normalizeSocialProfile({ avatarUrl: "data:image/webp;base64,photo" }).avatarUrl, "data:image/webp;base64,photo");
  const avatar = readFileSync(new URL("../src/components/socials/UserAvatar.tsx", import.meta.url), "utf8");
  const friend = readFileSync(new URL("../src/app/api/friends/route.ts", import.meta.url), "utf8");
  assert.ok(avatar.includes('if (/^https:\\/\\//i.test(value)) return value;'));
  assert.match(avatar, /key=\{source\}/);
  assert.ok(friend.includes('if (/^https:\\/\\//i.test(value)) return value.slice(0, 2_000);'));
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.ok(middleware.includes("|images/|"), "static avatar delivery avoids thirty middleware/auth checks");
});
