import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/socials/DeskWorkspace.tsx", import.meta.url);
const routePath = new URL("../src/app/api/socials/desks/route.ts", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202608020002_create_desk_channel_categories.sql", import.meta.url);

test("category save closes immediately and restores the editor with an inline error only on failure", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /const \[categorySaveError, setCategorySaveError\]/);
  assert.match(source, /const saveCategory = async \(\) => \{[\s\S]*?setShowCategory\(false\);[\s\S]*?setCategorySaveError\(message\);[\s\S]*?setShowCategory\(true\);/);
  assert.match(source, /role="alert"[\s\S]*?\{categorySaveError\}/);
});

test("missing category storage names the exact migration instead of looking like a hung save", async () => {
  const [workspace, route, migration] = await Promise.all([
    readFile(workspacePath, "utf8"),
    readFile(routePath, "utf8"),
    readFile(migrationPath, "utf8"),
  ]);

  for (const source of [workspace, route]) {
    assert.match(source, /202608020002_create_desk_channel_categories\.sql/);
  }
  assert.match(workspace, /Database setup required/);
  assert.match(migration, /create table if not exists public\.desk_channel_categories/);
  assert.match(migration, /add column if not exists category_id/);
});
