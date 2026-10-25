import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("Levelz is not an active route, launch card, navigation item or persistent workspace", () => {
  assert.equal(existsSync(new URL("../src/app/(workspace)/levelz/page.tsx", import.meta.url)), false);
  for (const file of ["../src/app/(workspace)/layout.tsx", "../src/components/AppSidebar.tsx", "../src/components/WorkspaceHome.tsx", "../src/components/KwantifyWorkspace.tsx"]) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), /levelz/i, file);
  }
});

test("retiring the page preserves stored preferences and reusable implementation", () => {
  assert.match(readFileSync(new URL("../src/lib/userPreferences.ts", import.meta.url), "utf8"), /kwantdesk:levelz-workspaces:v1/);
  assert.equal(existsSync(new URL("../src/components/levelz/LevelzWorkspace.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../src/lib/levelzWorkspaceLayout.ts", import.meta.url)), true);
});
