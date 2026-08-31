import assert from "node:assert/strict";

import {
  desktopAuthError,
  isSameOriginConsent,
  readDesktopAuthJson,
  requiredStringField,
} from "../src/lib/desktopAuthHttp.server.ts";
import { DesktopAuthorizationRequestError } from "../src/lib/desktopAuthProtocol.server.ts";
import { DesktopAuthServiceError } from "../src/lib/desktopAuthService.server.ts";
import { DesktopAuthStoreError } from "../src/lib/desktopAuthStore.server.ts";

function requestFromChunks(chunks, contentType = "application/json; charset=utf-8") {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("https://www.kwantdesk.com/api/desktop-auth/token", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: stream,
    duplex: "half",
  });
}

const validBytes = new TextEncoder().encode('{"refreshHandle":"secret-value"}');
const parsed = await readDesktopAuthJson(requestFromChunks([validBytes]));
assert.deepEqual(parsed, { refreshHandle: "secret-value" });
assert.ok(validBytes.every((value) => value === 0), "successful request chunks must be cleared");

const invalidBytes = new TextEncoder().encode("not-json-secret");
await assert.rejects(
  readDesktopAuthJson(requestFromChunks([invalidBytes])),
  (error) => error instanceof DesktopAuthorizationRequestError && error.code === "invalid_json",
);
assert.ok(invalidBytes.every((value) => value === 0), "malformed request chunks must be cleared");

const retainedChunk = new TextEncoder().encode('{"refreshHandle":"');
const oversizedChunk = new Uint8Array((8 * 1024) + 1).fill(65);
await assert.rejects(
  readDesktopAuthJson(requestFromChunks([retainedChunk, oversizedChunk])),
  (error) => error instanceof DesktopAuthorizationRequestError && error.code === "request_too_large",
);
assert.ok(retainedChunk.every((value) => value === 0), "retained chunks must clear after an oversized body");
assert.ok(oversizedChunk.every((value) => value === 0), "rejected oversized chunk must be cleared");

await assert.rejects(
  readDesktopAuthJson(new Request("https://www.kwantdesk.com/api/desktop-auth/token", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "{}",
  })),
  (error) => error instanceof DesktopAuthorizationRequestError && error.code === "invalid_content_type",
);

assert.equal(requiredStringField({ state: "exact" }, "state", 5), "exact");
for (const invalid of ["", " padded", "padded ", "too-long"]) {
  assert.throws(
    () => requiredStringField({ state: invalid }, "state", 5),
    DesktopAuthorizationRequestError,
  );
}

const sameOriginRequest = {
  headers: new Headers({ origin: "https://www.kwantdesk.com", "sec-fetch-site": "same-origin" }),
  nextUrl: new URL("https://www.kwantdesk.com/api/desktop-auth/authorize"),
};
assert.equal(isSameOriginConsent(sameOriginRequest), true);
assert.equal(isSameOriginConsent({
  ...sameOriginRequest,
  headers: new Headers({ origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" }),
}), false);

for (const [error, status, code] of [
  [new DesktopAuthServiceError("invalid_grant", 400), 400, "invalid_grant"],
  [new DesktopAuthStoreError("read_entitlement", 502), 503, "authentication_store_unavailable"],
  [new Error("sensitive internal detail"), 503, "authentication_service_unavailable"],
]) {
  const response = desktopAuthError(error);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), { error: code });
}

console.log("desktop auth bounded HTTP contract: pass");
