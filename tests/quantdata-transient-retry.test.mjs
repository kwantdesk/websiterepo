import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");

test("QuantData retries transient VPS failures as well as rate limits", () => {
  assert.match(source, /const QD_TRANSIENT_RETRIES = 1/);
  assert.match(source, /\[502, 503, 504\]\.includes\(response\.status\)/);
  assert.match(source, /error\.name === "AbortError"[\s\S]*?attempt < QD_TRANSIENT_RETRIES[\s\S]*?continue/);
  assert.match(source, /if \(attempt < QD_TRANSIENT_RETRIES\)[\s\S]*?KwantData is temporarily unavailable/);
});
