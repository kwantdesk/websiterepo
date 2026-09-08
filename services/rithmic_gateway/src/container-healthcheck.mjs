import { readFile, unlink, writeFile } from "node:fs/promises";

const url = process.env.RITHMIC_HEALTHCHECK_URL || "http://127.0.0.1:8793/health";
const stateFile = process.env.RITHMIC_HEALTHCHECK_STATE || "/tmp/kwantdesk-disconnected-checks";
const timeoutMs = Math.max(1_000, Number(process.env.RITHMIC_HEALTHCHECK_TIMEOUT_MS) || 5_000);
const disconnectGraceChecks = Math.max(
  0,
  Number(process.env.RITHMIC_HEALTHCHECK_DISCONNECT_GRACE_CHECKS) || 17,
);

async function clearDisconnectState() {
  await unlink(stateFile).catch(() => undefined);
}

async function nextDisconnectCount() {
  const previous = Number(await readFile(stateFile, "utf8").catch(() => "0")) || 0;
  const next = previous + 1;
  await writeFile(stateFile, String(next), "utf8");
  return next;
}

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`health returned ${response.status}`);
  const health = await response.json();
  if (health.connected && health.authenticated) {
    await clearDisconnectState();
    process.exit(0);
  }

  // A responsive process gets the same roughly ten-minute reconnect window
  // as before. A wedged event loop never reaches this branch and fails fast.
  const disconnectedChecks = await nextDisconnectCount();
  process.exit(disconnectedChecks > disconnectGraceChecks ? 1 : 0);
} catch {
  process.exit(1);
}
