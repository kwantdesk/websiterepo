import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { SocialsServiceProxy, socialsServiceProxyContract } from "../src/socials-service-proxy.mjs";

const subject = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const serviceToken = "s".repeat(48);

function request(method = "GET", body = null) {
  const payload = body === null ? [] : [Buffer.from(JSON.stringify(body))];
  const stream = Readable.from(payload);
  stream.method = method;
  stream.headers = {
    authorization: "Bearer public-desktop-ticket",
    ...(body === null ? {} : {
      "content-length": String(payload[0].length),
      "content-type": "application/json; charset=utf-8",
    }),
  };
  return stream;
}

function responseRecorder() {
  return {
    status: null, headers: null, chunks: [], headersSent: false,
    writeHead(status, headers) { this.status = status; this.headers = headers; this.headersSent = true; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); return true; },
    end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); },
    destroy(error) { this.destroyed = true; this.destroyError = error; },
    text() { return Buffer.concat(this.chunks).toString("utf8"); },
  };
}

test("forwards only fixed identity-bound SOCIALS reads and strips the desktop bearer", async () => {
  const captured = [];
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response('{"version":1,"objects":[],"cloud":true,"loadedAt":"2026-08-30T00:00:00Z"}', {
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  for (const path of [
    "/v1/socials/state?mine=1&types=profile%2Cpost",
    "/v1/socials/profile?handle=alex_trader",
    `/v1/socials/follow?targetUserId=${subject}`,
    "/v1/socials/following",
    `/v1/socials/reaction?targetUserId=${subject}&targetObjectId=post%3Aalpha&kind=LIKE`,
    "/v1/socials/notifications?offset=0&limit=30",
  ]) {
    const downstream = responseRecorder();
    await proxy.forward(request(), downstream, new URL(`https://feed.example${path}`), { subject });
    assert.equal(downstream.status, 200);
    assert.equal(downstream.headers["X-KwantDesk-Data-Edge"], "SOCIALS-VPS");
  }

  assert.equal(captured[0].url, "https://socials.internal.example/api/socials-desktop/state?mine=1&types=profile%2Cpost");
  assert.equal(captured[1].url, "https://socials.internal.example/api/socials-desktop/profile?handle=alex_trader");
  assert.equal(captured[2].url, `https://socials.internal.example/api/socials-desktop/follow?targetUserId=${subject}`);
  assert.equal(captured[3].url, "https://socials.internal.example/api/socials-desktop/following");
  assert.equal(captured[4].url, `https://socials.internal.example/api/socials-desktop/reaction?targetUserId=${subject}&targetObjectId=post%3Aalpha&kind=LIKE`);
  assert.equal(captured[5].url, "https://socials.internal.example/api/socials-desktop/notifications?offset=0&limit=30");
  for (const item of captured) {
    assert.equal(item.init.headers[socialsServiceProxyContract.serviceTokenHeader], serviceToken);
    assert.equal(item.init.headers[socialsServiceProxyContract.subjectHeader], subject);
    assert.equal(item.init.headers.Authorization, undefined);
  }
});

test("canonicalizes the fixed bounded SOCIALS reaction mutation", async () => {
  const targetUserId = "11111111-1111-4111-8111-111111111111";
  const idempotencyKey = "22222222-2222-4222-8222-222222222222";
  let captured;
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    },
  });
  const downstream = responseRecorder();
  await proxy.forward(request("POST", {
    idempotencyKey: idempotencyKey.toUpperCase(),
    targetUserId: targetUserId.toUpperCase(),
    targetObjectId: "post:alpha",
    kind: "POLL",
    enabled: true,
    optionIndex: 2,
  }), downstream, new URL("https://feed.example/v1/socials/reaction"), { subject });

  assert.equal(captured.url, "https://socials.internal.example/api/socials-desktop/reaction");
  assert.deepEqual(JSON.parse(captured.init.body.toString("utf8")), {
    idempotencyKey,
    targetUserId,
    targetObjectId: "post:alpha",
    kind: "POLL",
    enabled: true,
    optionIndex: 2,
  });
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.headers[socialsServiceProxyContract.subjectHeader], subject);
});

test("canonicalizes the one fixed bounded SOCIALS follow mutation", async () => {
  const targetUserId = "11111111-1111-4111-8111-111111111111";
  const idempotencyKey = "22222222-2222-4222-8222-222222222222";
  let captured;
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    },
  });
  const downstream = responseRecorder();
  await proxy.forward(request("POST", {
    targetUserId: targetUserId.toUpperCase(),
    action: "notifications",
    enabled: true,
    idempotencyKey: idempotencyKey.toUpperCase(),
  }), downstream, new URL("https://feed.example/v1/socials/follow"), { subject });

  assert.equal(captured.url, "https://socials.internal.example/api/socials-desktop/follow");
  assert.equal(captured.init.method, "POST");
  assert.deepEqual(JSON.parse(captured.init.body.toString("utf8")), {
    idempotencyKey,
    action: "notifications",
    targetUserId,
    enabled: true,
  });
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.headers[socialsServiceProxyContract.subjectHeader], subject);
});

test("forwards bounded Friends reads and exact account mutations through the fixed SOCIALS bridge", async () => {
  const targetUserId = "11111111-1111-4111-8111-111111111111";
  const clientMessageId = "22222222-2222-4222-8222-222222222222";
  const captured = [];
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response(JSON.stringify({ cloud: true, friends: [], groups: [], messages: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await proxy.forward(request(), responseRecorder(),
    new URL(`https://feed.example/v1/socials/friends?friendId=${targetUserId}`), { subject });
  await proxy.forward(request("POST", {
    action: "message",
    targetUserId,
    body: "Retest held.",
    attachments: [],
    clientMessageId,
  }), responseRecorder(), new URL("https://feed.example/v1/socials/friends"), { subject });
  await proxy.forward(request("POST", {
    action: "identity",
    displayName: "Kwant Trader",
    handle: "kwant_trader",
    avatarUrl: "",
  }), responseRecorder(), new URL("https://feed.example/v1/socials/friends"), { subject });

  assert.equal(captured[0].url, `https://socials.internal.example/api/friends?friendId=${targetUserId}`);
  assert.equal(captured[1].url, "https://socials.internal.example/api/friends");
  assert.deepEqual(JSON.parse(captured[1].init.body.toString("utf8")), {
    action: "message", targetUserId, body: "Retest held.", attachments: [], clientMessageId,
  });
  assert.deepEqual(JSON.parse(captured[2].init.body.toString("utf8")), {
    action: "identity", displayName: "Kwant Trader", handle: "kwant_trader", avatarUrl: "",
  });
  assert.ok(captured.every((item) => item.init.headers.Authorization === undefined));
  assert.ok(captured.every((item) => item.init.headers[socialsServiceProxyContract.subjectHeader] === subject));
});

test("relays the bounded Friends realtime SSE edge without exposing either credential", async () => {
  let captured;
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response("event: ready\ndata: {}\n\nevent: invalidated\ndata: {\"table\":\"friend_chat_messages\"}\n\n", {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    },
  });
  const downstream = responseRecorder();
  await proxy.forward(request(), downstream,
    new URL("https://feed.example/v1/socials/friends/events"), { subject });

  assert.equal(captured.url, "https://socials.internal.example/api/socials-desktop/friends-events");
  assert.equal(captured.init.headers.Accept, "text/event-stream");
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.headers[socialsServiceProxyContract.subjectHeader], subject);
  assert.equal(downstream.status, 200);
  assert.match(downstream.headers["Content-Type"], /^text\/event-stream/);
  assert.equal(downstream.headers["X-KwantDesk-Data-Edge"], "SOCIALS-VPS");
  assert.match(downstream.text(), /event: invalidated/);
  assert.match(downstream.text(), /friend_chat_messages/);
});

test("relays only the fixed bounded Friends avatar image route", async () => {
  let captured;
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(image, { headers: { "Content-Type": "image/png" } });
    },
  });
  const downstream = responseRecorder();
  await proxy.forward(request(), downstream,
    new URL(`https://feed.example/v1/socials/friends/avatar?userId=${subject}`), { subject });

  assert.equal(captured.url, `https://socials.internal.example/api/socials-desktop/friend-avatar?userId=${subject}`);
  assert.match(captured.init.headers.Accept, /image\/png/);
  assert.equal(captured.init.headers.Authorization, undefined);
  assert.equal(captured.init.headers[socialsServiceProxyContract.subjectHeader], subject);
  assert.equal(downstream.headers["Content-Type"], "image/png");
  assert.deepEqual(Buffer.concat(downstream.chunks), image);
});

test("canonicalizes fixed SOCIALS notification read mutations", async () => {
  const notificationId = "33333333-3333-4333-8333-333333333333";
  const captured = [];
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response(JSON.stringify({ version: 1, action: "read", updated: 1, appliedAt: "2026-08-30T00:00:00Z" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  await proxy.forward(
    request("PATCH", { action: "read", ids: [notificationId.toUpperCase()] }),
    responseRecorder(),
    new URL("https://feed.example/v1/socials/notifications"),
    { subject },
  );
  await proxy.forward(
    request("PATCH", { action: "read-all" }),
    responseRecorder(),
    new URL("https://feed.example/v1/socials/notifications"),
    { subject },
  );

  assert.equal(captured[0].url, "https://socials.internal.example/api/socials-desktop/notifications");
  assert.equal(captured[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(captured[0].init.body.toString("utf8")), {
    action: "read",
    ids: [notificationId],
  });
  assert.deepEqual(JSON.parse(captured[1].init.body.toString("utf8")), { action: "read-all" });
  assert.ok(captured.every((item) => item.init.headers.Authorization === undefined));
  assert.ok(captured.every((item) => item.init.headers[socialsServiceProxyContract.subjectHeader] === subject));
});

test("canonicalizes the fixed Journal trade-post route without private Journal fields", async () => {
  let captured;
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response('{"cloud":true,"object":{}}', { headers: { "Content-Type": "application/json" } });
    },
  });
  await proxy.forward(request("POST", {
    journalTradeId: "manual:trade-12345678",
    instrument: "NQ",
    side: "LONG",
    entryPrice: 20000,
    exitPrice: 20010,
    openedAt: "2026-08-30T00:00:00Z",
    closedAt: "2026-08-30T00:10:00Z",
    entryTimeKnown: true,
    exitTimeKnown: true,
    netPnl: 380,
    initialRisk: 100,
    rMultiple: 3.8,
    caption: "Patient confirmation.",
    observedAt: "2026-08-30T00:12:00Z",
  }), responseRecorder(), new URL("https://feed.example/v1/socials/trade-post"), { subject });
  assert.equal(captured.url, "https://socials.internal.example/api/socials");
  const forwarded = JSON.parse(captured.init.body.toString("utf8"));
  assert.equal(forwarded.object.objectType, "post");
  assert.equal(forwarded.object.scope, "community");
  assert.equal(forwarded.object.payload.kind, "TRADE");
  assert.equal(forwarded.object.payload.trade.journalTradeId, "manual:trade-12345678");
  assert.equal(forwarded.object.payload.body, "Patient confirmation.");
  assert.equal("notes" in forwarded.object.payload, false);
  assert.equal("evidence" in forwarded.object.payload, false);
  assert.equal(captured.init.headers.Authorization, undefined);
});

test("forwards only bounded post comment and profile object mutations", async () => {
  const captured = [];
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response(init.method === "DELETE"
        ? '{"deleted":"post:client-12345678"}'
        : '{"cloud":true,"object":{}}', { headers: { "Content-Type": "application/json" } });
    },
  });
  const object = {
    id: "post:client-12345678",
    objectType: "post",
    scope: "community",
    deskId: null,
    parentId: null,
    authorLabel: "Karen",
    payload: { kind: "ONE-LINER", body: "Hold the opening range." },
  };

  await proxy.forward(request("POST", { object }), responseRecorder(),
    new URL("https://feed.example/v1/socials/object"), { subject });
  await proxy.forward(request("DELETE", { id: object.id }), responseRecorder(),
    new URL("https://feed.example/v1/socials/object"), { subject });

  assert.equal(captured[0].url, "https://socials.internal.example/api/socials");
  assert.equal(captured[0].init.method, "POST");
  assert.deepEqual(JSON.parse(captured[0].init.body.toString("utf8")), { object });
  assert.equal(captured[1].url, "https://socials.internal.example/api/socials");
  assert.equal(captured[1].init.method, "DELETE");
  assert.deepEqual(JSON.parse(captured[1].init.body.toString("utf8")), { id: object.id });
  assert.ok(captured.every((item) => item.init.headers.Authorization === undefined));
  assert.ok(captured.every((item) => item.init.headers[socialsServiceProxyContract.subjectHeader] === subject));

  for (const invalid of [
    { object: { ...object, objectType: "precord" } },
    { object: { ...object, id: "server-makes-random-id" } },
    { object: { ...object, payload: { body: "x".repeat(8_001) } } },
    { object: { ...object, secret: "open proxy" } },
  ]) {
    await assert.rejects(
      proxy.forward(request("POST", invalid), responseRecorder(),
        new URL("https://feed.example/v1/socials/object"), { subject }),
      (error) => error.code === "socials_invalid_request" && error.status === 400,
    );
  }
});

test("GAMEPLAN execution and score mutations are fixed, bounded and stripped of the desktop bearer", async () => {
  const captured = [];
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async (url, init) => {
      captured.push({ url: String(url), init });
      return new Response('{"object":{"id":"receipt:precord:plan-12345678"}}', { headers: { "Content-Type": "application/json" } });
    },
  });
  const entry = {
    action: "record-entry",
    planId: "precord:plan-12345678",
    actualDirection: "LONG",
    fills: [{ price: 24120.25, size: 2, time: "2026-08-30T01:02:03.000Z" }],
    actualStop: 24090,
    maximumActualRisk: 500,
  };
  await proxy.forward(request("POST", entry), responseRecorder(), new URL("https://feed.example/v1/socials/gameplan-execution"), { subject });
  await proxy.forward(request("POST", { planId: entry.planId }), responseRecorder(), new URL("https://feed.example/v1/socials/gameplan-score"), { subject });

  assert.equal(captured[0].url, "https://socials.internal.example/api/socials/gameplan-execution");
  assert.equal(captured[1].url, "https://socials.internal.example/api/socials-desktop/gameplan-score");
  assert.deepEqual(JSON.parse(captured[0].init.body.toString("utf8")), entry);
  assert.deepEqual(JSON.parse(captured[1].init.body.toString("utf8")), { planId: entry.planId });
  assert.ok(captured.every((item) => item.init.headers.Authorization === undefined));
  assert.ok(captured.every((item) => item.init.headers[socialsServiceProxyContract.subjectHeader] === subject));

  for (const [path, invalid] of [
    ["gameplan-score", { planId: entry.planId, payload: {} }],
    ["gameplan-execution", { ...entry, fills: [{ price: -1, size: 2, time: entry.fills[0].time }] }],
    ["gameplan-execution", { ...entry, action: "delete-plan" }],
  ]) {
    await assert.rejects(
      proxy.forward(request("POST", invalid), responseRecorder(), new URL(`https://feed.example/v1/socials/${path}`), { subject }),
      (error) => error.code === "socials_invalid_request" && error.status === 400,
    );
  }
});

test("rejects open-proxy paths, unverified identities, and malformed SOCIALS filters", async () => {
  let calls = 0;
  const proxy = new SocialsServiceProxy({
    origin: "https://socials.internal.example",
    serviceToken,
    fetchImpl: async () => { calls += 1; return new Response("{}", { headers: { "Content-Type": "application/json" } }); },
  });
  assert.equal(proxy.canHandle("GET", "/v1/socials/state"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/follow"), true);
  assert.equal(proxy.canHandle("POST", "/v1/socials/follow"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/following"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/reaction"), true);
  assert.equal(proxy.canHandle("POST", "/v1/socials/reaction"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/notifications"), true);
  assert.equal(proxy.canHandle("PATCH", "/v1/socials/notifications"), true);
  assert.equal(proxy.canHandle("POST", "/v1/socials/trade-post"), true);
  assert.equal(proxy.canHandle("POST", "/v1/socials/object"), true);
  assert.equal(proxy.canHandle("DELETE", "/v1/socials/object"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/friends"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/friends/events"), true);
  assert.equal(proxy.canHandle("GET", "/v1/socials/friends/avatar"), true);
  assert.equal(proxy.canHandle("POST", "/v1/socials/friends"), true);
  assert.equal(proxy.canHandle("POST", "/v1/socials/state"), false);
  assert.equal(proxy.canHandle("GET", "/v1/socials/state/"), false);
  await assert.rejects(
    proxy.forward(request(), responseRecorder(), new URL("https://feed.example/v1/socials/state"), null),
    (error) => error.code === "socials_desktop_identity_required" && error.status === 401,
  );
  for (const path of [
    "/v1/socials/state?mine=0", "/v1/socials/state?types=profile%2Cevil",
    "/v1/socials/state?target=https%3A%2F%2Fevil.example", "/v1/socials/profile",
    "/v1/socials/profile?handle=12", "/v1/socials/profile?handle=ab1",
    "/v1/socials/follow", "/v1/socials/follow?targetUserId=bad",
    "/v1/socials/following?targetUserId=bad",
    `/v1/socials/reaction?targetUserId=${subject}&targetObjectId=bad%20id&kind=LIKE`,
    `/v1/socials/reaction?targetUserId=${subject}&targetObjectId=post%3Aalpha&kind=EVIL`,
    "/v1/socials/notifications", "/v1/socials/notifications?offset=-1&limit=30",
    "/v1/socials/notifications?offset=0&limit=101",
    "/v1/socials/friends?friendId=bad%20id", `/v1/socials/friends?friendId=${subject}&groupId=${subject}`,
    "/v1/socials/friends/events?target=anything",
    "/v1/socials/friends/avatar", "/v1/socials/friends/avatar?userId=bad",
  ]) {
    await assert.rejects(
      proxy.forward(request(), responseRecorder(), new URL(`https://feed.example${path}`), { subject }),
      (error) => error.code === "socials_invalid_query" && error.status === 400,
    );
  }
  await assert.rejects(
    proxy.forward(request("POST", {
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      action: "follow",
      targetUserId: "11111111-1111-4111-8111-111111111111",
      arbitraryPath: "/api/admin",
    }), responseRecorder(), new URL("https://feed.example/v1/socials/follow"), { subject }),
    (error) => error.code === "socials_invalid_request" && error.status === 400,
  );
  await assert.rejects(
    proxy.forward(request("PATCH", {
      action: "read",
      ids: ["not-a-notification"],
    }), responseRecorder(), new URL("https://feed.example/v1/socials/notifications"), { subject }),
    (error) => error.code === "socials_invalid_request" && error.status === 400,
  );
  await assert.rejects(
    proxy.forward(request("POST", {
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      targetUserId: "11111111-1111-4111-8111-111111111111",
      targetObjectId: "post:alpha",
      kind: "LIKE",
      enabled: true,
      optionIndex: 1,
    }), responseRecorder(), new URL("https://feed.example/v1/socials/reaction"), { subject }),
    (error) => error.code === "socials_invalid_request" && error.status === 400,
  );
  await assert.rejects(
    proxy.forward(request("POST", {
      journalTradeId: "manual:trade-12345678", instrument: "NQ", side: "LONG",
      entryPrice: 20000, exitPrice: 20010, openedAt: "2026-08-30T00:00:00Z", closedAt: "2026-08-30T00:10:00Z",
      entryTimeKnown: true, exitTimeKnown: true, netPnl: 380, initialRisk: 100, rMultiple: 3.8,
      caption: "public", observedAt: "2026-08-30T00:12:00Z", notes: "private leak",
    }), responseRecorder(), new URL("https://feed.example/v1/socials/trade-post"), { subject }),
    (error) => error.code === "socials_invalid_request" && error.status === 400,
  );
  assert.equal(calls, 0);
});

test("keeps SOCIALS configuration and response size bounded", () => {
  assert.throws(() => new SocialsServiceProxy({ origin: "https://socials.internal.example" }), /configured together/);
  assert.throws(
    () => new SocialsServiceProxy({ origin: "https://socials.internal.example/path", serviceToken }),
    /must not contain/,
  );
  assert.equal(socialsServiceProxyContract.maximumResponseBytes, 32 * 1024 * 1024);
  assert.equal(socialsServiceProxyContract.maximumRequestBytes, 16 * 1024);
  assert.equal(socialsServiceProxyContract.maximumFollowResponseBytes, 32 * 1024);
  assert.equal(socialsServiceProxyContract.maximumReactionResponseBytes, 64 * 1024);
  assert.equal(socialsServiceProxyContract.maximumNotificationsResponseBytes, 512 * 1024);
  assert.equal(socialsServiceProxyContract.maximumGameplanResponseBytes, 512 * 1024);
  assert.equal(socialsServiceProxyContract.maximumFriendsRequestBytes, 4 * 1024 * 1024);
  assert.equal(socialsServiceProxyContract.maximumFriendsResponseBytes, 8 * 1024 * 1024);
  assert.equal(socialsServiceProxyContract.maximumFriendsEventBytes, 64 * 1024);
  assert.equal(socialsServiceProxyContract.maximumFriendAvatarBytes, 2 * 1024 * 1024);
});
