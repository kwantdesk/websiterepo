import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspacePath = new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url);
const friendsPanelPath = new URL("../src/components/friends/FriendsPanel.tsx", import.meta.url);

test("global right rail exposes Messages directly below Friends", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /type RightPanel =[^;]*"friends" \| "messages";/);
  assert.match(source, /id: "friends"[\s\S]*?id: "messages"/);
  assert.match(source, /id: "messages" as const, title: "Messages", icon: MessageCircle/);
  assert.match(source, /item\.id === "messages" && friendMessageUnreadCount > 0/);
});

test("Messages reuses account-backed friend chats, attachments, and read receipts", async () => {
  const source = await readFile(friendsPanelPath, "utf8");

  assert.match(source, /mode\?: "friends" \| "messages"/);
  assert.match(source, /onMessageUnreadCountChange\?\.\(messageUnreadTotal\)/);
  assert.match(source, /runAction\("mark-read", \{ targetUserId: activeFriendId \}, true\)/);
  assert.match(source, /MAX_CHAT_IMAGES/);
  assert.match(source, /attachments/);
  assert.match(source, /mode === "messages" \? "Messages" : "Friends"/);
});

test("incoming direct messages create a clickable sender preview toast", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /rowPayload\.kind === "friend-message"/);
  assert.match(source, /rowPayload\.recipientUserId === viewerId/);
  assert.match(source, /setFriendMessageToast\(/);
  assert.match(source, /Sent you a photo/);
  assert.match(source, /setFriendsInitialFriendId\(friendMessageToast\.senderUserId\)/);
  assert.match(source, /setRightPanel\("messages"\)/);
  assert.match(source, /6_500/);
});
