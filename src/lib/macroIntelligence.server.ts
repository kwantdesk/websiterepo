import { createHash } from "node:crypto";
import { getDatabentoBars, type DatabentoBar } from "@/lib/databento";
import type { EconomicCalendarEvent } from "@/lib/economicCalendar";
import { getEconomicCalendar } from "@/lib/economicCalendar.server";
import type {
  MacroDevelopment,
  MacroDirection,
  MacroEventBrief,
  MacroEventReceipt,
  MacroIntelligencePayload,
  MacroObservedMove,
  MacroPulse,
  MacroScenario,
  MacroSource,
  MacroTopic,
} from "@/lib/macroIntelligence";

type CollectedSource = MacroSource & { summary: string };

const OFFICIAL_FEEDS = [
  { publisher: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_monetary.xml" },
  { publisher: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/speeches_and_testimony.xml" },
  { publisher: "Bureau of Labor Statistics", url: "https://www.bls.gov/feed/bls_latest.rss" },
  { publisher: "Bureau of Economic Analysis", url: "https://apps.bea.gov/rss/rss.xml" },
] as const;

const CACHE_MS = 5 * 60_000;
const macroGlobal = globalThis as typeof globalThis & {
  __kwantdeskMacroCache?: { payload: MacroIntelligencePayload; storedAt: number };
  __kwantdeskMacroRequest?: Promise<MacroIntelligencePayload>;
};

function dateOffset(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function hash(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 18);
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseRss(xml: string, publisher: string): CollectedSource[] {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].flatMap((match) => {
    const item = match[1];
    const title = xmlTag(item, "title");
    const url = xmlTag(item, "link") || xmlTag(item, "guid");
    const published = xmlTag(item, "pubDate") || xmlTag(item, "dc:date");
    const parsed = new Date(published);
    if (!title || !url) return [];
    return [{
      title,
      url,
      publisher,
      publishedAt: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
      official: true,
      summary: xmlTag(item, "description") || title,
    }];
  });
}

async function fetchOfficialFeed(feed: (typeof OFFICIAL_FEEDS)[number]) {
  try {
    const response = await fetch(feed.url, {
      headers: { "User-Agent": "KwantDesk-Macro/1.0 contact@kwantdesk.com" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return [];
    return parseRss(await response.text(), feed.publisher);
  } catch {
    return [];
  }
}

async function fetchLiveNews() {
  const query = '("Strait of Hormuz" OR tariff OR sanctions OR ceasefire OR "government shutdown" OR "debt ceiling" OR "Treasury funding" OR "energy infrastructure" OR "central bank") sourcelang:english';
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "30");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", "72h");
  try {
    const response = await fetch(url, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(14_000),
    });
    if (!response.ok) return [];
    const payload = await response.json() as {
      articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }>;
    };
    return (payload.articles ?? []).flatMap((article): CollectedSource[] => {
      const title = String(article.title ?? "").trim();
      const articleUrl = String(article.url ?? "").trim();
      if (!title || !articleUrl) return [];
      const parsed = new Date(String(article.seendate ?? "").replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
        "$1-$2-$3T$4:$5:$6Z",
      ));
      return [{
        title,
        url: articleUrl,
        publisher: String(article.domain ?? "Global news evidence"),
        publishedAt: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(),
        official: false,
        summary: title,
      }];
    });
  } catch {
    return [];
  }
}

export function macroTopic(value: string): MacroTopic {
  const text = value.toLowerCase();
  if (/fomc|federal reserve|central bank|interest rate|powell|ecb|boe|boj|monetary policy/.test(text)) return "CENTRAL BANK";
  if (/cpi|pce|ppi|inflation|prices|deflator/.test(text)) return "INFLATION";
  if (/payroll|employment|unemployment|jobless|labour|labor|wage|earnings/.test(text)) return "LABOUR";
  if (/gdp|retail sales|industrial production|pmi|ism|durable|consumer confidence|growth/.test(text)) return "GROWTH";
  if (/treasury funding|debt ceiling|government shutdown|budget|fiscal|auction/.test(text)) return "FISCAL";
  if (/oil|gas|opec|energy|hormuz|pipeline|shipping/.test(text)) return "ENERGY";
  if (/tariff|trade policy|trade war|import|export|customs/.test(text)) return "TRADE";
  if (/war|ceasefire|sanction|attack|missile|conflict|invasion/.test(text)) return "GEOPOLITICS";
  if (/liquidity|repo|balance sheet|reserves|credit|funding/.test(text)) return "LIQUIDITY";
  return "OTHER";
}

function topicCopy(topic: MacroTopic) {
  switch (topic) {
    case "INFLATION": return {
      plain: "This measures whether price pressure is cooling or re-accelerating.",
      why: "Inflation changes the expected path of interest rates. That moves Treasury prices, the US dollar and the discount rate applied to long-duration technology earnings.",
      channel: "Inflation evidence -> expected policy path -> Treasury yields and USD -> equity valuation",
      assets: ["NQ", "ES", "ZN", "USD", "Gold"],
    };
    case "LABOUR": return {
      plain: "This shows whether demand for workers and wage pressure remain firm or are weakening.",
      why: "A resilient labour market can keep rates higher for longer; a rapid deterioration can bring cuts forward but also raise growth concerns.",
      channel: "Labour surprise -> growth and wage outlook -> expected policy path -> yields, USD and index futures",
      assets: ["NQ", "ES", "ZN", "USD"],
    };
    case "GROWTH": return {
      plain: "This measures the pace of real economic demand and business activity.",
      why: "Growth affects earnings expectations and rates simultaneously. Strong data can support profits while also lifting yields, so confirmation matters.",
      channel: "Growth evidence -> earnings and policy expectations -> yields -> equity risk appetite",
      assets: ["ES", "NQ", "ZN", "USD", "Copper"],
    };
    case "CENTRAL BANK": return {
      plain: "This changes the market's expected path for policy rates and liquidity.",
      why: "The decision is only one input. Guidance, projections and the press conference can change where traders expect rates to be months from now.",
      channel: "Policy decision and guidance -> rate-path repricing -> front-end yields and USD -> equity valuation",
      assets: ["NQ", "ES", "ZN", "USD", "Gold"],
    };
    case "FISCAL": return {
      plain: "This changes government borrowing, spending or funding risk.",
      why: "Treasury supply and fiscal uncertainty can move yields, liquidity and risk appetite even when scheduled economic data is quiet.",
      channel: "Fiscal development -> Treasury supply or funding risk -> yields and liquidity -> index futures",
      assets: ["ZN", "NQ", "ES", "USD"],
    };
    case "ENERGY": return {
      plain: "This can change the availability and transport cost of global energy.",
      why: "Oil is both a growth input and an inflation input. A sustained energy shock can lift inflation expectations while compressing consumer and corporate demand.",
      channel: "Energy disruption -> oil and shipping costs -> inflation expectations -> yields and equity margins",
      assets: ["Crude Oil", "ZN", "USD", "ES", "NQ"],
    };
    case "TRADE": return {
      plain: "This changes the cost and availability of cross-border goods and supply chains.",
      why: "Tariffs can lift input costs, alter earnings expectations and trigger retaliation. The market response depends on scope, timing and exemptions.",
      channel: "Trade policy -> input costs and volumes -> inflation and earnings -> yields, FX and equities",
      assets: ["ES", "NQ", "USD", "Copper", "Crude Oil"],
    };
    case "GEOPOLITICS": return {
      plain: "This can change commodity supply, trade routes and the demand for safety.",
      why: "Markets care when the event changes cash flows, physical supply or policy—not simply because the headline is dramatic.",
      channel: "Geopolitical event -> physical or policy transmission -> commodities and safe havens -> yields and equities",
      assets: ["Crude Oil", "Gold", "ZN", "USD", "ES", "NQ"],
    };
    case "LIQUIDITY": return {
      plain: "This changes the amount or price of funding available to financial markets.",
      why: "Tighter funding can amplify otherwise ordinary moves; easier funding can support risk-taking and reduce forced selling.",
      channel: "Funding conditions -> dealer and investor balance sheets -> market liquidity -> volatility and risk assets",
      assets: ["NQ", "ES", "ZN", "USD"],
    };
    default: return {
      plain: "This release may alter expectations, but its market channel must be confirmed rather than assumed.",
      why: "The headline matters only if it changes growth, inflation, policy, liquidity or cash-flow expectations.",
      channel: "New information -> expectations -> cross-asset confirmation -> tradable response",
      assets: ["NQ", "ES", "ZN", "USD"],
    };
  }
}

function scenarios(topic: MacroTopic, name: string): MacroScenario[] {
  const copy = topicCopy(topic);
  if (["ENERGY", "TRADE", "GEOPOLITICS", "FISCAL"].includes(topic)) {
    return [
      {
        label: "ESCALATION",
        condition: `${name} produces a verified expansion in scope, duration or economic cost.`,
        transmission: copy.channel,
        likelyReaction: topic === "ENERGY" ? "Oil and inflation expectations firm; bonds and rate-sensitive equities can come under pressure." : "Risk premium rises; watch whether yields, USD and equities confirm the same transmission.",
        confirmation: ["The directly affected asset breaks and holds", "Yields and USD confirm rather than diverge", "Equity index futures accept outside the first headline range"],
        invalidation: "Official clarification narrows the event or the directly affected market fails to confirm it.",
      },
      {
        label: "DE-ESCALATION",
        condition: "Verified policy action, exemption, ceasefire or restored physical flow reduces the economic channel.",
        transmission: "Risk premium compresses and the market unwinds the previously priced transmission.",
        likelyReaction: "The directly affected asset retraces while bonds, USD and equities reveal whether broader risk appetite is recovering.",
        confirmation: ["Primary source confirms the change", "The directly affected asset retraces", "Cross-asset confirmation persists beyond the first reaction"],
        invalidation: "Implementation fails, the change is temporary, or price refuses to unwind the prior risk premium.",
      },
    ];
  }
  return [
    {
      label: "HOT / HAWKISH",
      condition: "The release is materially stronger, hotter or more hawkish than the priced expectation.",
      transmission: copy.channel,
      likelyReaction: topic === "GROWTH" ? "Yields may rise while equities split between stronger earnings and tighter financial conditions." : "Yields and USD can rise while long-duration technology faces valuation pressure.",
      confirmation: ["Treasury prices and rate expectations confirm", "USD confirms the direction", "NQ and ES accept beyond the first reaction range"],
      invalidation: "Rates do not confirm or the first move fully reverses after the release details are read.",
    },
    {
      label: "IN LINE",
      condition: "The result is close to consensus and revisions do not materially change the message.",
      transmission: "Limited macro repricing; positioning and liquidity can dominate the first move.",
      likelyReaction: "Expect two-way price discovery unless guidance, revisions or internals contain a genuine surprise.",
      confirmation: ["Initial range remains contained", "Yields and USD stay near pre-event levels", "Options and futures flow—not the headline—take control"],
      invalidation: "A material revision or internal component changes the economic message.",
    },
    {
      label: "COOL / DOVISH",
      condition: "The release is materially softer, cooler or more dovish than the priced expectation.",
      transmission: copy.channel,
      likelyReaction: topic === "LABOUR" ? "Bonds can rally; equities need to distinguish welcome disinflation from genuine growth deterioration." : "Yields and USD can fall while long-duration technology receives valuation support.",
      confirmation: ["Treasury prices rally and yields fall", "USD weakens", "NQ and ES hold the favourable reaction after the first liquidity sweep"],
      invalidation: "Growth fear dominates, rates fail to confirm, or price re-enters the pre-release range.",
    },
  ];
}

function eventSource(event: EconomicCalendarEvent): MacroSource | null {
  if (!event.sourceUrl) return null;
  return {
    title: event.name,
    url: event.sourceUrl,
    publisher: event.source || "Official release source",
    publishedAt: event.date,
    official: /\.gov\b|centralbank|ecb\.europa/i.test(event.sourceUrl),
  };
}

function eventBrief(event: EconomicCalendarEvent): MacroEventBrief {
  const topic = macroTopic(`${event.name} ${event.category}`);
  const copy = topicCopy(topic);
  return {
    id: event.id,
    name: event.name,
    date: event.date,
    currency: event.currency,
    impact: event.impact,
    topic,
    status: event.status === "released" ? "RELEASED" : "UPCOMING",
    forecast: event.forecast,
    previous: event.revised || event.previous,
    actual: event.actual,
    plainEnglish: copy.plain,
    whyMarketsCare: copy.why,
    causalChain: copy.channel.split(" -> "),
    assets: copy.assets,
    scenarios: scenarios(topic, event.name),
    source: eventSource(event),
  };
}

function numeric(value: string) {
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function releaseSignal(event: EconomicCalendarEvent) {
  const actual = numeric(event.actual);
  const forecast = numeric(event.forecast);
  if (actual === null || forecast === null) return null;
  let surprise = actual - forecast;
  const name = event.name.toLowerCase();
  if (/unemployment|jobless claim|continuing claim/.test(name)) surprise *= -1;
  const scale = Math.max(Math.abs(forecast), Math.abs(numeric(event.previous) ?? 0), 1);
  const normalized = surprise / scale;
  return { actual, forecast, surprise, normalized };
}

function pulseFor(label: MacroPulse["label"], events: EconomicCalendarEvent[]): MacroPulse {
  const relevant = events.filter((event) => {
    const topic = macroTopic(`${event.name} ${event.category}`);
    if (label === "Inflation") return topic === "INFLATION";
    if (label === "Growth") return topic === "GROWTH";
    if (label === "Labour") return topic === "LABOUR";
    if (label === "Policy") return topic === "CENTRAL BANK";
    return topic === "LIQUIDITY" || topic === "FISCAL";
  }).map(releaseSignal).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const average = relevant.length
    ? relevant.reduce((sum, value) => sum + Math.max(-1, Math.min(1, value.normalized * 5)), 0) / relevant.length
    : 0;
  const direction: MacroDirection = !relevant.length ? "NEUTRAL" : average > 0.08 ? "UP" : average < -0.08 ? "DOWN" : "MIXED";
  const state = !relevant.length ? "Awaiting evidence" : direction === "UP" ? "Firming" : direction === "DOWN" ? "Cooling" : "Balanced";
  return {
    label,
    state,
    direction,
    explanation: relevant.length
      ? `${relevant.length} verified release surprise${relevant.length === 1 ? "" : "s"} in the current evidence window point to ${state.toLowerCase()} conditions.`
      : "No comparable actual-versus-forecast release is available in the current evidence window.",
    evidenceCount: relevant.length,
  };
}

function movement(bars: DatabentoBar[], eventTime: number, symbol: MacroObservedMove["symbol"]): MacroObservedMove | null {
  const before = [...bars].reverse().find((bar) => bar.timestamp <= eventTime - 60_000);
  const after = [...bars].reverse().find((bar) => bar.timestamp <= eventTime + 30 * 60_000 && bar.timestamp >= eventTime + 20 * 60_000);
  if (!before || !after || before.close <= 0) return null;
  const points = after.close - before.close;
  const percent = points / before.close * 100;
  return {
    symbol,
    points: Number(points.toFixed(symbol === "ZN" ? 3 : 2)),
    percent: Number(percent.toFixed(3)),
    direction: Math.abs(percent) < 0.015 ? "NEUTRAL" : points > 0 ? "UP" : "DOWN",
  };
}

function expectedDirection(topic: MacroTopic, event: EconomicCalendarEvent, signal: NonNullable<ReturnType<typeof releaseSignal>>) {
  const strong = signal.normalized > 0;
  if (topic === "INFLATION" || topic === "CENTRAL BANK") return strong ? "DOWN" : "UP";
  if (topic === "LABOUR") return strong ? "DOWN" : "UP";
  if (topic === "GROWTH") return "MIXED";
  return "MIXED";
}

function receiptFor(event: EconomicCalendarEvent, bars: Record<string, DatabentoBar[]>): MacroEventReceipt {
  const topic = macroTopic(`${event.name} ${event.category}`);
  const signal = releaseSignal(event);
  const eventTime = new Date(event.date).getTime();
  const observedMoves = (["NQ", "ES", "ZN", "CL"] as const).flatMap((symbol) => {
    const move = movement(bars[symbol] ?? [], eventTime, symbol);
    return move ? [move] : [];
  });
  if (!signal) {
    return {
      id: `receipt-${event.id}`,
      eventId: event.id,
      eventName: event.name,
      releasedAt: event.date,
      surprise: "The release does not contain comparable actual and forecast values.",
      scenarioObserved: "Qualitative release",
      marketResponse: observedMoves.length ? "Market movement is recorded, but no numeric surprise can be assigned honestly." : "Awaiting verified market-response data.",
      observedMoves,
      gotRight: [],
      missed: [],
      reasoningScore: null,
      scoreExplanation: "No score is issued without both a measurable release surprise and a verified market response.",
      evidenceStatus: "INSUFFICIENT RELEASE DATA",
    };
  }
  const expected = expectedDirection(topic, event, signal);
  const nq = observedMoves.find((move) => move.symbol === "NQ");
  const scenarioObserved = signal.normalized > 0.015 ? "HOT / HAWKISH" : signal.normalized < -0.015 ? "COOL / DOVISH" : "IN LINE";
  const surprise = `${event.actual} actual versus ${event.forecast} forecast: ${scenarioObserved.toLowerCase()} relative to consensus.`;
  if (!observedMoves.length) {
    return {
      id: `receipt-${event.id}`,
      eventId: event.id,
      eventName: event.name,
      releasedAt: event.date,
      surprise,
      scenarioObserved,
      marketResponse: "The release has printed, but the 30-minute futures response is not yet available.",
      observedMoves,
      gotRight: [],
      missed: [],
      reasoningScore: null,
      scoreExplanation: "Scoring waits for market evidence; it is never inferred from the headline alone.",
      evidenceStatus: "AWAITING MARKET DATA",
    };
  }
  const rate = observedMoves.find((move) => move.symbol === "ZN");
  const comparable = [nq, rate].filter((move): move is MacroObservedMove => Boolean(move));
  const matches = expected === "MIXED"
    ? comparable.filter((move) => move.direction !== "NEUTRAL").length
    : comparable.filter((move) => move.direction === expected).length;
  const score = expected === "MIXED"
    ? 70
    : comparable.length ? Math.round(25 + matches / comparable.length * 75) : null;
  const gotRight = expected === "MIXED"
    ? ["The framework required cross-asset confirmation instead of forcing a single equity direction."]
    : comparable.filter((move) => move.direction === expected).map((move) => `${move.symbol} confirmed the mapped ${expected.toLowerCase()} reaction.`);
  const missed = expected === "MIXED"
    ? []
    : comparable.filter((move) => move.direction !== expected).map((move) => `${move.symbol} did not confirm the mapped ${expected.toLowerCase()} reaction.`);
  return {
    id: `receipt-${event.id}`,
    eventId: event.id,
    eventName: event.name,
    releasedAt: event.date,
    surprise,
    scenarioObserved,
    marketResponse: observedMoves.map((move) => `${move.symbol} ${move.points >= 0 ? "+" : ""}${move.points} (${move.percent >= 0 ? "+" : ""}${move.percent}%)`).join("; "),
    observedMoves,
    gotRight,
    missed,
    reasoningScore: score,
    scoreExplanation: score === null ? "Insufficient comparable market evidence." : "Score compares the pre-defined conditional reaction map with the verified 30-minute NQ and Treasury response.",
    evidenceStatus: "VERIFIED",
  };
}

function development(source: CollectedSource): MacroDevelopment {
  const topic = macroTopic(`${source.title} ${source.summary}`);
  const copy = topicCopy(topic);
  const shock = ["ENERGY", "TRADE", "GEOPOLITICS", "FISCAL"].includes(topic);
  return {
    id: `macro-${hash(source.url || source.title)}`,
    title: source.title,
    topic,
    urgency: shock ? "HIGH" : topic === "CENTRAL BANK" ? "HIGH" : "WATCH",
    status: source.official ? "CONFIRMED" : "DEVELOPING",
    publishedAt: source.publishedAt,
    summary: source.summary || copy.plain,
    event: source.title,
    economicChannel: copy.channel,
    assetsAffected: copy.assets,
    potentialReaction: shock
      ? scenarios(topic, source.title)[0].likelyReaction
      : "The market impact depends on whether rates, USD and the directly affected asset confirm a change in expectations.",
    confirmation: shock
      ? scenarios(topic, source.title)[0].confirmation
      : ["Primary-source detail changes expectations", "The directly affected asset confirms", "Cross-asset confirmation persists"],
    invalidation: shock
      ? scenarios(topic, source.title)[0].invalidation
      : "The release contains no new economic information or the first market reaction fully reverses.",
    sources: [{
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      publishedAt: source.publishedAt,
      official: source.official,
    }],
  };
}

async function buildMacroPayload(): Promise<MacroIntelligencePayload> {
  const calendar = await getEconomicCalendar(dateOffset(-35), dateOffset(21));
  const now = Date.now();
  const events = calendar.events.filter((event) => event.currency === "USD");
  const upcoming = events
    .filter((event) => new Date(event.date).getTime() >= now - 5 * 60_000)
    .filter((event) => event.impact === "High" || event.impact === "Medium")
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(0, 12)
    .map(eventBrief);
  const released = events
    .filter((event) => event.status === "released" && new Date(event.date).getTime() >= now - 7 * 86_400_000)
    .filter((event) => event.impact === "High" || event.impact === "Medium")
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 10);

  const bars: Record<string, DatabentoBar[]> = {};
  if (released.length && process.env.DATABENTO_API_KEY) {
    const start = new Date(Math.min(...released.map((event) => new Date(event.date).getTime())) - 30 * 60_000).toISOString();
    const end = new Date().toISOString();
    const symbols = { NQ: "NQ.v.0", ES: "ES.v.0", ZN: "ZN.v.0", CL: "CL.v.0" } as const;
    const rows = await Promise.all(Object.entries(symbols).map(async ([label, symbol]) => {
      try {
        return [label, await getDatabentoBars(symbol, "1m", start, end)] as const;
      } catch {
        return [label, [] as DatabentoBar[]] as const;
      }
    }));
    for (const [label, values] of rows) bars[label] = values;
  }

  const official = (await Promise.all(OFFICIAL_FEEDS.map(fetchOfficialFeed))).flat();
  const globalNews = await fetchLiveNews();
  const allSources = [...official, ...globalNews]
    .filter((source) => new Date(source.publishedAt).getTime() >= now - 14 * 86_400_000)
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
    .filter((source, index, rows) => index === rows.findIndex((item) => item.url === source.url))
    .slice(0, 60);
  const developments = allSources
    .map(development)
    .filter((item) => item.topic !== "OTHER")
    .slice(0, 24);
  const recentReleased = events.filter((event) => event.status === "released" && new Date(event.date).getTime() >= now - 35 * 86_400_000);
  const pulse: MacroPulse[] = (["Inflation", "Growth", "Labour", "Policy", "Liquidity"] as const)
    .map((label) => pulseFor(label, recentReleased));
  const sources = allSources.map(({ summary: _summary, ...source }) => source);
  return {
    generatedAt: new Date().toISOString(),
    status: "LIVE",
    sourceCount: sources.length + events.length,
    officialSourceCount: sources.filter((source) => source.official).length + events.filter((event) => Boolean(event.sourceUrl)).length,
    note: "Official releases establish facts. Global reporting identifies developing risks. Every market conclusion remains conditional on cross-asset price confirmation.",
    pulse,
    upcoming,
    receipts: released.map((event) => receiptFor(event, bars)),
    developments,
    sources,
  };
}

export async function getMacroIntelligence(force = false) {
  if (!force && macroGlobal.__kwantdeskMacroCache && Date.now() - macroGlobal.__kwantdeskMacroCache.storedAt < CACHE_MS) {
    return macroGlobal.__kwantdeskMacroCache.payload;
  }
  if (!force && macroGlobal.__kwantdeskMacroRequest) return macroGlobal.__kwantdeskMacroRequest;
  const request = buildMacroPayload()
    .then((payload) => {
      macroGlobal.__kwantdeskMacroCache = { payload, storedAt: Date.now() };
      return payload;
    })
    .catch((error) => {
      if (macroGlobal.__kwantdeskMacroCache) {
        return { ...macroGlobal.__kwantdeskMacroCache.payload, status: "LAST GOOD" as const };
      }
      throw error;
    })
    .finally(() => {
      macroGlobal.__kwantdeskMacroRequest = undefined;
    });
  macroGlobal.__kwantdeskMacroRequest = request;
  return request;
}
