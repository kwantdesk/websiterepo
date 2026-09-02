const DEFAULT_SAMPLE_MS = 1_000;
const DEFAULT_OVERLOAD_LAG_MS = 500;
const DEFAULT_RECOVERY_MS = 30_000;

const DEFERRABLE_PATHS = new Set([
  "/v1/market-data/order-flow-levels",
  "/v1/market-data/volume-profile",
  "/v1/market-data/cash-index-history",
  "/v1/heatmap/replay",
  "/v1/heatmap/replay/chunk",
]);

export function isDeferrableDuringOverload(pathname) {
  return DEFERRABLE_PATHS.has(String(pathname || ""));
}

/**
 * Detects a blocked gateway event loop and temporarily rejects archive/history
 * work so queued requests cannot prolong an incident after the loop recovers.
 * Live streams, snapshots and /health are never shed.
 */
export class EventLoopLoadGuard {
  constructor(options = {}) {
    this.sampleMs = Number(options.sampleMs) || DEFAULT_SAMPLE_MS;
    this.overloadLagMs = Number(options.overloadLagMs) || DEFAULT_OVERLOAD_LAG_MS;
    this.recoveryMs = Number(options.recoveryMs) || DEFAULT_RECOVERY_MS;
    this.now = options.now || Date.now;
    this.timer = null;
    this.expectedAt = 0;
    this.lastLagMs = 0;
    this.maxLagMs = 0;
    this.overloadedUntil = 0;
    this.tripCount = 0;
  }

  observe(observedAt = this.now()) {
    if (!this.expectedAt) {
      this.expectedAt = observedAt + this.sampleMs;
      return 0;
    }
    const lagMs = Math.max(0, observedAt - this.expectedAt);
    this.expectedAt = observedAt + this.sampleMs;
    this.lastLagMs = lagMs;
    this.maxLagMs = Math.max(this.maxLagMs, lagMs);
    if (lagMs >= this.overloadLagMs) {
      this.overloadedUntil = observedAt + this.recoveryMs;
      this.tripCount += 1;
    }
    return lagMs;
  }

  start() {
    if (this.timer) return;
    this.expectedAt = this.now() + this.sampleMs;
    this.timer = setInterval(() => this.observe(), this.sampleMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isOverloaded(at = this.now()) {
    return this.overloadedUntil > at;
  }

  status(at = this.now()) {
    return {
      overloaded: this.isOverloaded(at),
      lastLagMs: this.lastLagMs,
      maxLagMs: this.maxLagMs,
      tripCount: this.tripCount,
      recoveryMsRemaining: Math.max(0, this.overloadedUntil - at),
    };
  }
}
