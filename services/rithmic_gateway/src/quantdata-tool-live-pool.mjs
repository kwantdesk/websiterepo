import { createHash } from 'node:crypto';
import { canonicalQuantDataRequest } from './quantdata-request-budget.mjs';

const issue = (code, message) => Object.assign(new Error(message), { code });

/** Demand-only snapshot acquisition. This is NOT an upstream streaming feed.
 * The supplied loader must use the existing account-wide provider budget and
 * archive writer. One channel owns each exact selection regardless of viewers.
 * No idle acquisition, invented revisions, or per-viewer upstream timer.
 */
export class QuantDataToolLivePool {
  constructor({ load, now = Date.now, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout,
    minStartSpacingMs = 1000, maxConcurrent = 2, maxChannels = 32, maxSubscribers = 128,
    maxResponseBytes = 12_000_000, maxRetainedBytes = 32_000_000 } = {}) {
    if (typeof load !== 'function') throw new TypeError('A budgeted snapshot loader is required.');
    this.load = load; this.now = now; this.setTimer = setTimeoutImpl; this.clearTimer = clearTimeoutImpl;
    this.spacing = Math.max(1000, Number(minStartSpacingMs) || 1000);
    this.maxConcurrent = Math.max(1, Math.min(2, maxConcurrent));
    this.maxChannels = maxChannels; this.maxSubscribers = maxSubscribers;
    this.maxResponseBytes = maxResponseBytes; this.maxRetainedBytes = maxRetainedBytes;
    this.channels = new Map(); this.subscribers = 0; this.retainedBytes = 0;
    this.running = 0; this.nextStartAt = 0; this.timer = null; this.disposed = false; this.sequence = 0;
  }

  subscribe({ path, body, pollMs = 2000, once = false }, receive, onError = () => {}, onVerified = () => {}) {
    if (this.disposed) throw issue('closed', 'The live snapshot pool is closed.');
    if (typeof receive !== 'function') throw new TypeError('A frame listener is required.');
    const request = canonicalQuantDataRequest(path, body);
    if (this.subscribers >= this.maxSubscribers) throw issue('capacity', 'Live snapshot subscriber capacity reached.');
    let channel = this.channels.get(request.key);
    if (!channel) {
      if (this.channels.size >= this.maxChannels) throw issue('capacity', 'Live snapshot selection capacity reached.');
      channel = { request, listeners: new Set(), frame: null, bytes: 0, controller: null,
        due: this.now(), order: this.sequence++, failures: 0, disposed: false };
      this.channels.set(request.key, channel);
    }
    const listener = { receive, onError, onVerified, pollMs: Math.max(2000, Number(pollMs) || 2000), once: once === true };
    channel.listeners.add(listener); this.subscribers++;
    if (!channel.controller && !listener.once) channel.due = Math.min(channel.due,
      Math.max(this.now(), (channel.frame?.retrievedAt ?? this.now()) + listener.pollMs));
    // The retained retrieval time is preserved. Reconnection cannot turn an
    // old cached payload into a newly acquired or provider-timestamped frame.
    if (channel.frame) this.deliver(listener, channel.frame);
    this.arm();
    let stopped = false;
    return () => {
      if (stopped) return; stopped = true;
      if (channel.listeners.delete(listener)) this.subscribers--;
      if (!channel.listeners.size) {
        channel.disposed = true; channel.controller?.abort();
        this.channels.delete(request.key); this.retainedBytes -= channel.bytes;
      }
      this.arm();
    };
  }

  deliver(listener, frame) {
    try { listener.receive(frame); } catch { /* A failed viewer never breaks acquisition or other viewers. */ }
  }

  interval(channel) {
    const live = [...channel.listeners].filter(listener => !listener.once);
    return live.length ? Math.min(...live.map(listener => listener.pollMs)) : channel.frame ? Infinity : 2000;
  }

  arm() {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
    if (this.disposed || this.running >= this.maxConcurrent) return;
    const candidates = [...this.channels.values()].filter(channel => !channel.controller && Number.isFinite(channel.due));
    if (!candidates.length) return;
    const due = Math.max(this.nextStartAt, Math.min(...candidates.map(channel => channel.due)));
    this.timer = this.setTimer(() => { this.timer = null; this.pump(); }, Math.max(0, due - this.now()));
    this.timer?.unref?.();
  }

  pump() {
    if (this.disposed || this.running >= this.maxConcurrent) return;
    const now = this.now();
    if (now < this.nextStartAt) { this.arm(); return; }
    const channel = [...this.channels.values()].filter(candidate => !candidate.controller && candidate.due <= now)
      .sort((a, b) => a.due - b.due || a.order - b.order)[0];
    if (!channel) { this.arm(); return; }
    const controller = new AbortController(); channel.controller = controller;
    const startedAt = now; this.nextStartAt = now + this.spacing; this.running++;
    void this.acquire(channel, controller, startedAt);
    this.arm();
  }

  async acquire(channel, controller, startedAt) {
    try {
      const result = await this.load({ ...channel.request, signal: controller.signal });
      if (this.disposed || channel.disposed || channel.controller !== controller || controller.signal.aborted) return;
      const text = typeof result?.text === 'string' ? result.text : null;
      if (text === null || !Number.isFinite(result.retrievedAt)) throw issue('invalid_response', 'Snapshot retrieval metadata is unavailable.');
      const bytes = Buffer.byteLength(text);
      if (bytes > this.maxResponseBytes) throw issue('response_too_large', 'Choose a narrower data selection.');
      const payload = JSON.parse(text);
      if (!payload || typeof payload !== 'object') throw issue('invalid_response', 'Snapshot payload must be structured data.');
      const revision = createHash('sha256').update(text).digest('hex');
      // A slower/older cache response must not rewind the published selection.
      if (channel.frame && result.retrievedAt < channel.frame.retrievedAt) return;
      channel.failures = 0;
      for (const listener of channel.listeners) { try { listener.onVerified(result.retrievedAt); } catch { /* Viewer isolation. */ } }
      if (channel.frame?.revision !== revision) {
        if (this.retainedBytes - channel.bytes + bytes > this.maxRetainedBytes) throw issue('memory_capacity', 'Live snapshot memory capacity reached.');
        this.retainedBytes += bytes - channel.bytes; channel.bytes = bytes;
        channel.frame = Object.freeze({ revision, retrievedAt: result.retrievedAt,
          // Retrieval time is deliberately NOT called an exchange/source time.
          sourceTimestamp: result.sourceTimestamp ?? null, payload });
        for (const listener of channel.listeners) this.deliver(listener, channel.frame);
      }
    } catch (error) {
      if (!this.disposed && !channel.disposed && !controller.signal.aborted) {
        channel.failures++;
        const retryAfterMs = Math.max(0, Number(error?.retryAfterMs) || 0);
        channel.retryAt = this.now() + Math.max(retryAfterMs, Math.min(60_000, 2000 * 2 ** Math.min(channel.failures - 1, 5)));
        for (const listener of channel.listeners) { try { listener.onError(error); } catch { /* Viewer isolation. */ } }
      }
    } finally {
      this.running--; channel.controller = null;
      if (!channel.disposed && !this.disposed) {
        const interval = this.interval(channel);
        channel.due = Number.isFinite(interval) ? Math.max(startedAt + interval, channel.retryAt ?? 0, this.now()) : Infinity;
        channel.retryAt = undefined; channel.order = this.sequence++;
      }
      this.arm();
    }
  }

  health() {
    return { channels: this.channels.size, subscribers: this.subscribers, running: this.running,
      retainedBytes: this.retainedBytes, minStartSpacingMs: this.spacing, upstreamTransport: 'budgeted-rest-snapshots' };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    for (const channel of this.channels.values()) { channel.disposed = true; channel.controller?.abort(); }
    this.channels.clear(); this.subscribers = 0; this.retainedBytes = 0;
  }
}
