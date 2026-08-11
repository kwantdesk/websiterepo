import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/socials/SocialsWorkspace.tsx", import.meta.url);

test("recommended traders can be followed optimistically and concurrently", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /const \[followActionUserIds, setFollowActionUserIds\] = useState<Set<string>>/);
  assert.match(source, /if \(followActionUserIds\.has\(targetUserId\)\) return/);
  assert.match(source, /setFollowingUsers\(\(current\)[\s\S]*?targetUserId/);
  assert.doesNotMatch(source, /await loadFollowingUsers\(true\)/);
  assert.match(source, /window\.setTimeout\([\s\S]*?loadFollowingUsers\(true\)[\s\S]*?350/);
  assert.match(source, /disabled=\{followActionUserIds\.has\(recommendation\.userId\)\}/);
  assert.doesNotMatch(source, /disabled=\{Boolean\(followActionUserId\)\}/);
});
