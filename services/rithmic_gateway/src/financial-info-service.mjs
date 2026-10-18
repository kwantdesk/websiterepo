import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ACTOR = 'akash9078~financialjuice-scraper';
const ORIGIN = 'https://api.apify.com';
const MAX_BYTES = 1_000_000;
const MAX_ITEMS = 500;
const text = (value, limit = 2000) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit) : '';
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export function normalizeFinancialHeadlines(input, now = Date.now()) {
  if (!Array.isArray(input) || input.length > MAX_ITEMS) throw Error('INVALID_DATASET');
  const items = new Map();
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const title = text(row.title);
    // Actor timestamp is the scrape time, NOT the story publication time.
    const publishedAt = iso(row.isoDate) || iso(row.pubDate);
    if (!title || !publishedAt || Date.parse(publishedAt) > now + 300_000) continue;
    let url;
    try {
      url = new URL(row.link);
      if (url.href.length > 2000 || url.protocol !== 'https:' || !['financialjuice.com', 'www.financialjuice.com'].includes(url.hostname) || url.username || url.password || url.port) continue;
      url.hash = ''; url.search = '';
    } catch { continue; }
    const sourceId = text(row.guid, 500) || `${url.href}|${publishedAt}`.slice(0, 500);
    const id = createHash('sha256').update(sourceId).digest('hex').slice(0, 24);
    const categories = Array.isArray(row.categories) ? [...new Set(row.categories.map(value => text(value, 60)).filter(Boolean))].slice(0, 10) : [];
    items.set(id, { id, guid: sourceId, title, publishedAt, url: url.href, categories });
  }
  if (input.length && !items.size) throw Error('INVALID_DATASET');
  return [...items.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
}

/** One shared read-only Apify subscriber. NEVER starts, schedules or resurrects paid runs. */
export class FinancialInfoService {
  constructor({ token = '', enabled = false, directory = '', fetchImpl = fetch, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    this.token = token; this.enabled = enabled && Boolean(token); this.directory = directory;
    this.fetch = fetchImpl; this.now = now; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.items = []; this.collectedAt = null; this.checkedAt = null; this.runId = null;
    this.error = null; this.pending = null; this.timer = null; this.stopped = true; this.failures = 0;
  }
  snapshot() {
    const stale = !this.collectedAt || this.now() - Date.parse(this.collectedAt) > 300_000;
    return { source: 'FinancialJuice RSS', mode: 'scheduled-rss', configured: this.enabled,
      status: !this.enabled ? 'not_configured' : this.error ? 'unavailable' : !this.collectedAt ? 'waiting' : stale ? 'stale' : 'connected',
      items: this.items, collectedAt: this.collectedAt, checkedAt: this.checkedAt,
      stale, refreshAfterMs: this.enabled ? 60_000 : 900_000,
      note: !this.enabled ? 'Financial Info is not connected yet.' : this.error ? 'News collection is unavailable; retaining the last received headlines.' : stale ? 'Waiting for a recent scheduled scrape. Retained headlines may be old.' : 'Automatically checking the scheduled RSS feed. Source publication and scraping delays apply.' };
  }
  async start() {
    if (!this.stopped) return;
    this.stopped = false;
    if (this.directory) {
      try {
        const file = join(this.directory, 'financial-info.json');
        if ((await stat(file)).size > 4_000_000) throw Error('INVALID_ARCHIVE');
        const raw = await readFile(file, 'utf8');
        if (Buffer.byteLength(raw) > 4_000_000) throw Error('INVALID_ARCHIVE');
        const saved = JSON.parse(raw);
        this.items = normalizeFinancialHeadlines(saved.items, this.now());
        this.collectedAt = iso(saved.collectedAt); this.runId = text(saved.runId, 100) || null;
      } catch { /* No verified local snapshot yet. */ }
    }
    if (this.enabled && !this.stopped) void this.tick();
  }
  async request(path) {
    const controller = new AbortController();
    this.controller = controller;
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await this.fetch(`${ORIGIN}${path}`, { method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw Error(`UPSTREAM_${response.status}`);
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('INVALID_DATASET');
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('DATASET_TOO_LARGE');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_BYTES) { controller.abort(); throw Error('DATASET_TOO_LARGE'); }
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { clearTimeout(timer); if (this.controller === controller) this.controller = null; }
  }
  async refresh() {
    if (!this.enabled || this.stopped) return;
    if (this.pending) return this.pending;
    this.pending = this.collect().catch(() => { this.error = 'COLLECTION_UNAVAILABLE'; this.failures = Math.min(5, this.failures + 1); }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async collect() {
    const result = await this.request(`/v2/actors/${ACTOR}/runs?status=SUCCEEDED&desc=true&limit=1`);
    const run = result?.data?.items?.[0];
    this.checkedAt = new Date(this.now()).toISOString();
    if (!run) { this.error = null; this.failures = 0; return; }
    if (!/^[a-zA-Z0-9]{1,100}$/.test(run.id) || !/^[a-zA-Z0-9]{1,100}$/.test(run.defaultDatasetId) || run.status !== 'SUCCEEDED' || !iso(run.finishedAt) || Date.parse(run.finishedAt) > this.now() + 300_000) throw Error('INVALID_RUN');
    if (run.id !== this.runId) {
      const raw = await this.request(`/v2/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=${MAX_ITEMS}`);
      const fresh = normalizeFinancialHeadlines(raw, this.now());
      const merged = new Map(this.items.map(item => [item.id, item]));
      for (const item of fresh) merged.set(item.id, item);
      const items = [...merged.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)).slice(0, MAX_ITEMS);
      const collectedAt = iso(run.finishedAt);
      if (this.directory) {
        await mkdir(this.directory, { recursive: true });
        const path = join(this.directory, 'financial-info.json');
        // Store original input-compatible rows, never provider HTML.
        await writeFile(path + '.tmp', JSON.stringify({ runId: run.id, collectedAt, items: items.map(item => ({ guid: item.guid, title: item.title, isoDate: item.publishedAt, link: item.url, categories: item.categories })) }));
        await rename(path + '.tmp', path);
      }
      this.items = items; this.collectedAt = collectedAt; this.runId = run.id;
    }
    this.error = null; this.failures = 0;
  }
  async tick() {
    await this.refresh();
    if (!this.stopped) this.timer = this.setTimer(() => { this.timer = null; void this.tick(); }, Math.min(600_000, 60_000 * 2 ** this.failures));
    this.timer?.unref?.();
  }
  stop() { this.stopped = true; if (this.timer) this.clearTimer(this.timer); this.timer = null; this.controller?.abort(); }
}
