import { Worker } from "node:worker_threads";

const WORKER_URL = new URL("./archive-fold-worker.mjs", import.meta.url);
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

let queue = Promise.resolve();

function execute(job, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, { workerData: job });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      callback(value);
    };
    const timeout = setTimeout(() => {
      finish(reject, new Error(`Archive fold worker exceeded ${timeoutMs}ms.`));
    }, timeoutMs);
    if (typeof timeout.unref === "function") timeout.unref();

    worker.once("message", (message) => {
      if (message?.ok) finish(resolve, message.value);
      else finish(reject, new Error(String(message?.error || "Archive fold worker failed.")));
    });
    worker.once("error", (error) => finish(reject, error));
    worker.once("exit", (code) => {
      if (code !== 0) finish(reject, new Error(`Archive fold worker exited with code ${code}.`));
    });
  });
}

/**
 * Run one archive fold at a time, outside the gateway's event loop.
 *
 * Both flow and profile warmers share this queue. That prevents two large
 * sessions competing for disk/CPU while keeping HTTP, SSE and Rithmic packet
 * handling on the main thread responsive.
 */
export function runArchiveFold(job, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const scheduled = queue.then(() => execute(job, timeoutMs));
  queue = scheduled.catch(() => undefined);
  return scheduled;
}
