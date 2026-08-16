import "server-only";

import { createHash } from "node:crypto";
import { getMacroIntelligence, getZyonOvernightMacroBrief } from "@/lib/macroIntelligence.server";
import type { MacroTopic } from "@/lib/macroIntelligence";
import type { KwantBotMarketRoot } from "@/lib/kwantBotInterpreter";

type MacroMemoryConfig = {
  url: string;
  serviceRoleKey: string;
};

type MacroMemoryEventRow = {
  event_key: string;
  record_type: "CALENDAR" | "DEVELOPMENT" | "RECEIPT";
  title: string;
  summary: string;
  topic: MacroTopic;
  status: string;
  impact: string;
  currency: string;
  occurred_at: string;
  source_url: string;
  source_title: string;
  publisher: string;
  official: boolean;
  symbols: string[];
  attributes: Record<string, unknown>;
  last_seen_at: string;
};

type StoredMacroEvent = MacroMemoryEventRow & {
  relevance?: number;
};

export type MacroMemoryEvidence = {
  configured: boolean;
  retrievedAt: string;
  query: string;
  windowFrom: string;
  windowTo: string;
  root: KwantBotMarketRoot;
  events: StoredMacroEvent[];
  reactions: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  dailyBrief: Record<string, unknown> | null;
  evidenceNote: string;
};

const memoryGlobal = globalThis as typeof globalThis & {
  __kwantdeskMacroIngest?: { completedAt: number; promise: Promise<MacroMemoryIngestResult> | null };
};

export type MacroMemoryIngestResult = {
  configured: boolean;
  skipped?: boolean;
  ingestedAt: string;
  events: number;
  sources: number;
  reactions: number;
  receipts: number;
  briefs: number;
  error?: string;
};

function config(): MacroMemoryConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

function headers(value: MacroMemoryConfig, prefer?: string) {
  return {
    apikey: value.serviceRoleKey,
    Authorization: `Bearer ${value.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}

function validIso(value: string, fallback = new Date().toISOString()) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function symbols(values: string[], fallback: KwantBotMarketRoot | null = null) {
  const joined = values.join(" ").toUpperCase();
  const result = new Set<string>();
  if (/\b(NQ|MNQ|NASDAQ|QQQ|NDX|TECHNOLOGY)\b/.test(joined)) result.add("NQ");
  if (/\b(ES|MES|S&P|SPX|SPXW|SPY|EQUITIES)\b/.test(joined)) result.add("ES");
  if (/\b(ZN|TREASUR|BOND|YIELD|RATES?)\b/.test(joined)) result.add("ZN");
  if (/\b(CL|CRUDE|OIL|ENERGY)\b/.test(joined)) result.add("CL");
  if (/\b(VIX|VXN|VOLATILITY)\b/.test(joined)) result.add("VIX");
  if (fallback) result.add(fallback);
  if (!result.size) {
    result.add("NQ");
    result.add("ES");
  }
  return [...result];
}

async function restUpsert(
  value: MacroMemoryConfig,
  table: string,
  rows: Array<Record<string, unknown>>,
  conflict: string,
) {
  if (!rows.length) return;
  for (let start = 0; start < rows.length; start += 100) {
    const response = await fetch(
      `${value.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`,
      {
        method: "POST",
        headers: headers(value, "resolution=merge-duplicates,return=minimal"),
        body: JSON.stringify(rows.slice(start, start + 100)),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`${table} upsert failed (${response.status}): ${detail.slice(0, 400)}`);
    }
  }
}

function dateInNewYork(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

async function performIngest(): Promise<MacroMemoryIngestResult> {
  const database = config();
  const ingestedAt = new Date().toISOString();
  if (!database) {
    return { configured: false, ingestedAt, events: 0, sources: 0, reactions: 0, receipts: 0, briefs: 0, error: "Supabase service role is not configured." };
  }

  const [intelligence, overnight] = await Promise.all([
    getMacroIntelligence(true),
    getZyonOvernightMacroBrief(),
  ]);
  const events = new Map<string, MacroMemoryEventRow>();
  const sourceRows = new Map<string, Record<string, unknown>>();

  for (const event of intelligence.upcoming) {
    const eventKey = `calendar:${event.id}`;
    events.set(eventKey, {
      event_key: eventKey,
      record_type: "CALENDAR",
      title: event.name,
      summary: event.whyMarketsCare || event.plainEnglish,
      topic: event.topic,
      status: event.status,
      impact: event.impact,
      currency: event.currency,
      occurred_at: validIso(event.date),
      source_url: event.source?.url ?? "",
      source_title: event.source?.title ?? "",
      publisher: event.source?.publisher ?? "Economic calendar",
      official: Boolean(event.source?.official),
      symbols: symbols(event.assets),
      attributes: { forecast: event.forecast, previous: event.previous, actual: event.actual, causalChain: event.causalChain, scenarios: event.scenarios },
      last_seen_at: ingestedAt,
    });
  }

  for (const event of overnight.releasedUsdEvents) {
    const eventKey = `released:${digest(`${event.name}|${event.releasedAt}`)}`;
    events.set(eventKey, {
      event_key: eventKey,
      record_type: "CALENDAR",
      title: event.name,
      summary: `${event.name}: actual ${event.actual || "not reported"}, forecast ${event.forecast || "not reported"}, previous ${event.previous || "not reported"}.`,
      topic: event.topic,
      status: "RELEASED",
      impact: event.impact,
      currency: "USD",
      occurred_at: validIso(event.releasedAt),
      source_url: event.sourceUrl,
      source_title: event.name,
      publisher: event.source,
      official: /\.gov\b|federal reserve|bureau/i.test(`${event.sourceUrl} ${event.source}`),
      symbols: symbols([event.name, event.topic]),
      attributes: { actual: event.actual, forecast: event.forecast, previous: event.previous },
      last_seen_at: ingestedAt,
    });
  }

  for (const development of intelligence.developments) {
    const eventKey = `development:${development.id}`;
    const primary = development.sources[0];
    events.set(eventKey, {
      event_key: eventKey,
      record_type: "DEVELOPMENT",
      title: development.title,
      summary: development.summary,
      topic: development.topic,
      status: development.status,
      impact: development.urgency,
      currency: "USD",
      occurred_at: validIso(development.publishedAt),
      source_url: primary?.url ?? "",
      source_title: primary?.title ?? development.title,
      publisher: primary?.publisher ?? "Macro intelligence",
      official: Boolean(primary?.official),
      symbols: symbols(development.assetsAffected),
      attributes: {
        event: development.event,
        economicChannel: development.economicChannel,
        potentialReaction: development.potentialReaction,
        confirmation: development.confirmation,
        invalidation: development.invalidation,
      },
      last_seen_at: ingestedAt,
    });
    for (const source of development.sources) {
      const sourceKey = digest(source.url || `${source.title}|${source.publishedAt}`);
      sourceRows.set(sourceKey, {
        source_key: sourceKey,
        event_key: eventKey,
        title: source.title,
        summary: development.summary,
        url: source.url,
        publisher: source.publisher,
        published_at: validIso(source.publishedAt),
        official: source.official,
        attributes: { topic: development.topic },
        last_seen_at: ingestedAt,
      });
    }
  }

  for (const receipt of intelligence.receipts) {
    const eventKey = `receipt:${receipt.eventId}`;
    events.set(eventKey, {
      event_key: eventKey,
      record_type: "RECEIPT",
      title: receipt.eventName,
      summary: `${receipt.surprise} ${receipt.marketResponse}`.trim(),
      topic: "OTHER",
      status: receipt.evidenceStatus,
      impact: "",
      currency: "USD",
      occurred_at: validIso(receipt.releasedAt),
      source_url: "",
      source_title: "",
      publisher: "Kwant Desk reaction engine",
      official: false,
      symbols: symbols(receipt.observedMoves.map((move) => move.symbol)),
      attributes: { surprise: receipt.surprise },
      last_seen_at: ingestedAt,
    });
  }

  for (const source of intelligence.sources) {
    const sourceKey = digest(source.url || `${source.title}|${source.publishedAt}`);
    if (!sourceRows.has(sourceKey)) {
      sourceRows.set(sourceKey, {
        source_key: sourceKey,
        event_key: null,
        title: source.title,
        summary: source.title,
        url: source.url,
        publisher: source.publisher,
        published_at: validIso(source.publishedAt),
        official: source.official,
        attributes: {},
        last_seen_at: ingestedAt,
      });
    }
  }

  await restUpsert(database, "macro_memory_events", [...events.values()], "event_key");
  await restUpsert(database, "macro_memory_sources", [...sourceRows.values()], "source_key");

  const reactionRows = intelligence.receipts.flatMap((receipt) => receipt.observedMoves.map((move) => ({
    reaction_key: `${receipt.id}:${move.symbol}:30m`,
    event_key: `receipt:${receipt.eventId}`,
    symbol: move.symbol,
    horizon_minutes: 30,
    points: move.points,
    percent: move.percent,
    direction: move.direction,
    measured_at: validIso(receipt.releasedAt),
    attributes: { eventName: receipt.eventName },
    updated_at: ingestedAt,
  })));
  const receiptRows = intelligence.receipts.map((receipt) => ({
    receipt_key: receipt.id,
    event_key: `receipt:${receipt.eventId}`,
    scenario_observed: receipt.scenarioObserved,
    market_response: receipt.marketResponse,
    got_right: receipt.gotRight,
    missed: receipt.missed,
    reasoning_score: receipt.reasoningScore,
    score_explanation: receipt.scoreExplanation,
    evidence_status: receipt.evidenceStatus,
    attributes: { surprise: receipt.surprise },
    updated_at: ingestedAt,
  }));
  await restUpsert(database, "macro_market_reactions", reactionRows, "reaction_key");
  await restUpsert(database, "macro_reasoning_receipts", receiptRows, "receipt_key");

  const briefingDate = dateInNewYork(ingestedAt);
  const briefRows = [{
    brief_key: `${briefingDate}:GLOBAL`,
    briefing_date: briefingDate,
    scope: "GLOBAL",
    generated_at: ingestedAt,
    summary: overnight.developments.slice(0, 6).map((item) => item.title).join(" · ") || "No verified overnight macro development was found.",
    payload: { overnight, pulse: intelligence.pulse, upcoming: intelligence.upcoming.slice(0, 8), status: intelligence.status },
    updated_at: ingestedAt,
  }];
  await restUpsert(database, "macro_daily_briefs", briefRows, "brief_key");

  return {
    configured: true,
    ingestedAt,
    events: events.size,
    sources: sourceRows.size,
    reactions: reactionRows.length,
    receipts: receiptRows.length,
    briefs: briefRows.length,
  };
}

async function claimIngest(value: MacroMemoryConfig, force: boolean) {
  const response = await fetch(`${value.url}/rest/v1/rpc/claim_macro_ingestion`, {
    method: "POST",
    headers: headers(value),
    body: JSON.stringify({ minimum_interval_seconds: force ? 30 : 240 }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Macro ingestion lease failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return Boolean(await response.json());
}

async function finishIngest(value: MacroMemoryConfig, result: MacroMemoryIngestResult, status: "COMPLETE" | "FAILED") {
  await restUpsert(value, "macro_ingestion_state", [{
    id: "global",
    last_completed_at: new Date().toISOString(),
    last_status: status,
    details: result,
  }], "id");
}

export async function ingestMacroMemory(force = false): Promise<MacroMemoryIngestResult> {
  const state = memoryGlobal.__kwantdeskMacroIngest ?? { completedAt: 0, promise: null };
  memoryGlobal.__kwantdeskMacroIngest = state;
  if (!force && Date.now() - state.completedAt < 4 * 60_000) {
    return { configured: Boolean(config()), skipped: true, ingestedAt: new Date(state.completedAt).toISOString(), events: 0, sources: 0, reactions: 0, receipts: 0, briefs: 0 };
  }
  if (state.promise) return state.promise;
  state.promise = (async () => {
    const database = config();
    if (!database) return performIngest();
    const claimed = await claimIngest(database, force);
    if (!claimed) {
      return { configured: true, skipped: true, ingestedAt: new Date().toISOString(), events: 0, sources: 0, reactions: 0, receipts: 0, briefs: 0 };
    }
    try {
      const result = await performIngest();
      state.completedAt = Date.now();
      await finishIngest(database, result, "COMPLETE");
      return result;
    } catch (error) {
      const result: MacroMemoryIngestResult = {
        configured: true,
        ingestedAt: new Date().toISOString(),
        events: 0,
        sources: 0,
        reactions: 0,
        receipts: 0,
        briefs: 0,
        error: error instanceof Error ? error.message : String(error),
      };
      try {
        await finishIngest(database, result, "FAILED");
      } catch {
        // Preserve the original ingestion error.
      }
      throw error;
    }
  })()
    .finally(() => {
      state.promise = null;
    });
  return state.promise;
}

function retrievalWindow(query: string) {
  const lower = query.toLowerCase();
  const now = Date.now();
  const duration = /last week|past week|this week/.test(lower)
    ? 8 * 86_400_000
    : /yesterday|overnight/.test(lower)
      ? 3 * 86_400_000
      : /today|now|current|morning|session/.test(lower)
        ? 36 * 60 * 60_000
        : 14 * 86_400_000;
  return { from: new Date(now - duration).toISOString(), to: new Date(now + 24 * 60 * 60_000).toISOString() };
}

function searchTerms(query: string) {
  const stop = new Set(["what", "when", "where", "which", "with", "from", "that", "this", "there", "about", "market", "markets", "price", "today", "now", "current", "happened", "happening", "tell", "please", "could", "would", "does", "looking", "likely"]);
  return [...new Set(query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [])]
    .filter((word) => !stop.has(word))
    .slice(0, 8)
    .join(" OR ");
}

async function restJson(value: MacroMemoryConfig, path: string, init?: RequestInit) {
  const response = await fetch(`${value.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(value), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Macro memory read failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<unknown>;
}

export async function searchMacroMemory(args: {
  query: string;
  root: KwantBotMarketRoot;
  limit?: number;
}): Promise<MacroMemoryEvidence | null> {
  const database = config();
  if (!database) return null;
  const { from, to } = retrievalWindow(args.query);
  const limit = Math.max(4, Math.min(args.limit ?? 14, 24));
  try {
    const terms = searchTerms(args.query);
    const [rankedRaw, recentRaw, briefRaw] = await Promise.all([
      restJson(database, "rpc/search_macro_memory", {
        method: "POST",
        body: JSON.stringify({ search_text: terms, from_time: from, to_time: to, requested_symbol: args.root, result_limit: limit }),
      }),
      restJson(database, `macro_memory_events?select=event_key,record_type,title,summary,topic,status,impact,currency,occurred_at,source_url,source_title,publisher,official,symbols,attributes,last_seen_at&occurred_at=gte.${encodeURIComponent(from)}&occurred_at=lte.${encodeURIComponent(to)}&order=occurred_at.desc&limit=${limit}`),
      restJson(database, `macro_daily_briefs?select=brief_key,briefing_date,scope,generated_at,summary,payload&briefing_date=gte.${from.slice(0, 10)}&order=briefing_date.desc&limit=1`),
    ]);
    const merged = new Map<string, StoredMacroEvent>();
    for (const row of [...(Array.isArray(rankedRaw) ? rankedRaw : []), ...(Array.isArray(recentRaw) ? recentRaw : [])] as StoredMacroEvent[]) {
      if (!merged.has(row.event_key)) merged.set(row.event_key, row);
    }
    const events = [...merged.values()].slice(0, limit);
    const eventKeys = new Set(events.map((event) => event.event_key));
    const [reactionRaw, sourceRaw] = await Promise.all([
      restJson(database, `macro_market_reactions?select=event_key,symbol,horizon_minutes,points,percent,direction,measured_at,attributes&measured_at=gte.${encodeURIComponent(from)}&order=measured_at.desc&limit=80`),
      restJson(database, `macro_memory_sources?select=event_key,title,summary,url,publisher,published_at,official&published_at=gte.${encodeURIComponent(from)}&order=published_at.desc&limit=80`),
    ]);
    const reactions = (Array.isArray(reactionRaw) ? reactionRaw : [])
      .filter((row) => eventKeys.has(String((row as Record<string, unknown>).event_key ?? "")))
      .slice(0, 24) as Array<Record<string, unknown>>;
    const linkedSources = (Array.isArray(sourceRaw) ? sourceRaw : [])
      .filter((row) => {
        const eventKey = String((row as Record<string, unknown>).event_key ?? "");
        return !eventKey || eventKeys.has(eventKey);
      })
      .slice(0, 24) as Array<Record<string, unknown>>;
    return {
      configured: true,
      retrievedAt: new Date().toISOString(),
      query: args.query,
      windowFrom: from,
      windowTo: to,
      root: args.root,
      events,
      reactions,
      sources: linkedSources,
      dailyBrief: Array.isArray(briefRaw) ? (briefRaw[0] as Record<string, unknown> | undefined) ?? null : null,
      evidenceNote: "Persistent macro memory is ranked by exact time, selected market, full-text relevance, source authority and recency. Fresh web research may supplement gaps but cannot overwrite timestamped evidence.",
    };
  } catch (error) {
    console.error("Macro memory retrieval unavailable", error);
    return null;
  }
}
