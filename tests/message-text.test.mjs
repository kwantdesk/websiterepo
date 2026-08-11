import assert from "node:assert/strict";
import test from "node:test";

import { isSingleEmojiMessage } from "../src/lib/messageText.ts";

test("recognises one standalone emoji", () => {
  assert.equal(isSingleEmojiMessage("🔥"), true);
  assert.equal(isSingleEmojiMessage("  👍🏽  "), true);
  assert.equal(isSingleEmojiMessage("👨‍💻"), true);
  assert.equal(isSingleEmojiMessage("🇦🇺"), true);
});

test("keeps text and multiple emoji in normal message bubbles", () => {
  assert.equal(isSingleEmojiMessage("🔥🔥"), false);
  assert.equal(isSingleEmojiMessage("Nice 🔥"), false);
  assert.equal(isSingleEmojiMessage("hello"), false);
  assert.equal(isSingleEmojiMessage(""), false);
});
