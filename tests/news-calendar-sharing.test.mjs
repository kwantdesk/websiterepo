import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/news/NewsWorkspace.tsx", import.meta.url);

test("economic calendar events can be sent to account-backed friend chats", async () => {
  const source = await readFile(workspacePath, "utf8");
  assert.match(source, /Alert · Send/);
  assert.match(source, /aria-label=\{`Send \$\{event\.name\} to friends`\}/);
  assert.match(source, /fetch\("\/api\/friends", \{ cache: "no-store" \}\)/);
  assert.match(source, /action: "message",[\s\S]*?targetUserId,[\s\S]*?clientMessageId/);
  assert.match(source, /Promise\.allSettled\(shareFriendIds\.map/);
  assert.match(source, /Send calendar event/);
});
