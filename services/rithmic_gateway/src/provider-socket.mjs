import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import WebSocket from "ws";

const healthyAddresses = new Map();
const retryable = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EPIPE"]);

/** Pre-authentication transport failover only. Never retry a login or weaken TLS. */
export async function openProviderSocket(url, timeoutMs = 15_000, {
  resolveAddresses = (host) => lookup(host, { all: true }),
  createSocket = (target, options) => new WebSocket(target, options),
} = {}) {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const deadline = Date.now() + timeoutMs;
  let dnsTimer;
  let addresses;
  try {
    addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
      : await Promise.race([
        resolveAddresses(hostname),
        new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(Object.assign(new Error("Provider DNS timed out."), { code: "ETIMEDOUT" })), timeoutMs); }),
      ]);
  } finally { clearTimeout(dnsTimer); }
  addresses = [...new Map(addresses.map(row => [row.address, row])).values()];
  const healthy = healthyAddresses.get(hostname);
  addresses.sort((a, b) => Number(b.address === healthy) - Number(a.address === healthy));
  let lastError = new Error("Provider DNS returned no addresses.");
  for (const candidate of addresses.slice(0, 8)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const socket = await new Promise((resolve, reject) => {
        // URL/Host/SNI stay on the configured hostname; only DNS routing varies.
        const socket = createSocket(url, {
          rejectUnauthorized: true,
          handshakeTimeout: Math.min(3_000, remaining),
          lookup: (_host, options, callback) => options?.all
            ? callback(null, [candidate]) : callback(null, candidate.address, candidate.family),
        });
        const timer = setTimeout(() => {
          reject(Object.assign(new Error("Provider socket opening timed out."), { code: "ETIMEDOUT" }));
          socket.terminate();
        }, Math.min(3_000, remaining));
        socket.once("open", () => { clearTimeout(timer); resolve(socket); });
        socket.once("error", error => {
          clearTimeout(timer);
          if (error.message === "Opening handshake has timed out" && !error.code) error.code = "ETIMEDOUT";
          reject(error);
          socket.terminate();
        });
      });
      if (healthyAddresses.size >= 16) healthyAddresses.delete(healthyAddresses.keys().next().value);
      healthyAddresses.set(hostname, candidate.address);
      return socket;
    } catch (error) {
      lastError = error;
      if (!retryable.has(error.code)) throw error;
    }
  }
  throw lastError;
}
