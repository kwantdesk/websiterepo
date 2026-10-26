import { readFile, writeFile, mkdir, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { loadConfig } from "../src/config.mjs";
import { RithmicHistoryPlantClient } from "../src/history-plant-client.mjs";
import { chicagoTradingDate, cmeSessionBounds } from "../src/trading-session.mjs";

export function completedSessions(now = Date.now(), count = 5) {
  const days = [];
  const anchor = chicagoTradingDate(now);
  for (let offset = 0; offset < 20 && days.length < count; offset++) {
    const date = new Date(`${anchor}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - offset);
    // The session-start convention is Sunday through Thursday.
    if ([5, 6].includes(date.getUTCDay())) continue;
    const day = date.toISOString().slice(0, 10);
    if (cmeSessionBounds(day).endMs <= now) days.push(day);
  }
  return days.sort();
}

export function validatedMinute(row) {
  const bar = [Number(row.marker) * 1000 - 60000, Number(row.openPrice),
    Number(row.highPrice), Number(row.lowPrice), Number(row.closePrice), Number(row.volume || 0)];
  if (!bar.every(Number.isFinite) || bar[0] <= 0 || !bar.slice(1, 5).every(p => p > 0)
      || bar[5] < 0 || bar[2] < Math.max(bar[1], bar[4]) || bar[3] > Math.min(bar[1], bar[4]) || bar[3] > bar[2]) {
    throw Error("Invalid provider minute; refusing to publish a partial session");
  }
  return bar;
}

export async function reconcileRecentHistory({ dir = "/recordings", now = Date.now(), apply = false } = {}) {
  const days = completedSessions(now);
  const instruments = new Map();
  // Include the current session's active contracts and the five closed ones.
  for (const day of [...days, chicagoTradingDate(now)]) {
    for (const name of await readdir(join(dir, "bars", day)).catch(() => [])) {
      const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+[FGHJKMNQUVXZ]\d{1,2})\.json$/);
      if (match) instruments.set(name, { exchange: match[1], symbol: match[2] });
    }
  }
  if (instruments.size > 40) throw Error("Unexpected contract count; refusing an unbounded replay");
  const client = new RithmicHistoryPlantClient(loadConfig(), { requestTimeoutMs: 120000 });
  const run = new Date(now).toISOString().replaceAll(/[:.]/g, "-");
  const receipt = { run, bytes: 0, sessions: [], failed: [] };
  const backup = join(dir, "history-repairs", run);
  try {
    for (const [name, instrument] of instruments) {
      const needed = [];
      for (const day of days) {
        const existing = await readFile(join(dir, "bars", day, name), "utf8").then(JSON.parse).catch(() => null);
        if (existing?.completedSession === true && existing.markerConvention === "bar-open"
            && existing.source === "Rithmic History Plant minute bars") continue;
        if (existing?.source === "Rithmic History Plant individual trades" && existing.markerConvention === "bar-open") continue;
        needed.push(day);
      }
      if (!needed.length) continue;
      if (receipt.bytes >= 32 * 1024 ** 2) throw Error("32MiB replay safety budget reached; remaining contracts deferred");
      const bounds = { startMs: cmeSessionBounds(needed[0]).startMs, endMs: cmeSessionBounds(needed.at(-1)).endMs };
      const byDay = new Map();
      const beforeBytes = client.bytesReceived;
      try {
        const transfer = await client.replayMinuteBars({ ...instrument,
          startSec: bounds.startMs / 1000, finishSec: bounds.endMs / 1000 - 1,
          onBar: row => {
            const bar = validatedMinute(row), day = chicagoTradingDate(bar[0]);
            if (!needed.includes(day)) return;
            if (!byDay.has(day)) byDay.set(day, new Map());
            byDay.get(day).set(bar[0], bar);
          },
        });
        receipt.bytes += transfer.bytesReceived;
        for (const day of needed) {
          const bars = [...(byDay.get(day)?.values() ?? [])].sort((a, b) => a[0] - b[0]);
          // A holiday/unsupported empty replay must not erase existing data.
          if (!bars.length) continue;
          const value = { tradingDate: day, ...instrument, source: "Rithmic History Plant minute bars",
            markerConvention: "bar-open", completedSession: true, reconciledAt: new Date(now).toISOString(), bars };
          const text = JSON.stringify(value), file = join(dir, "bars", day, name);
          if (apply) {
            await mkdir(join(backup, day), { recursive: true });
            const previous = await readFile(file).catch(() => null);
            if (previous) await writeFile(join(backup, day, name), previous);
            await mkdir(join(dir, "bars", day), { recursive: true });
            await writeFile(`${file}.repair.tmp`, text);
            await rename(`${file}.repair.tmp`, file);
          }
          receipt.sessions.push({ ...instrument, day, rows: bars.length,
            sha256: createHash("sha256").update(text).digest("hex"), applied: apply });
        }
      } catch (error) {
        receipt.bytes += Math.max(0, client.bytesReceived - beforeBytes);
        receipt.failed.push({ ...instrument, error: error.message });
        client.close();
        if (/login.*rejected|permission denied/i.test(error.message)) break;
      }
    }
  } finally { client.close(); }
  if (apply) {
    await mkdir(backup, { recursive: true });
    await writeFile(join(backup, "receipt.json"), JSON.stringify(receipt, null, 2));
  }
  return receipt;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await reconcileRecentHistory({ dir: process.env.RITHMIC_RECORD_DIR || "/recordings", apply: process.argv.includes("--apply") });
  console.log(JSON.stringify(result));
  if (result.failed.length) process.exitCode = 1;
}
