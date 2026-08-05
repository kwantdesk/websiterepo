import { after, NextRequest, NextResponse } from "next/server";
import {
  ANTHROPIC_VERSION,
  getClaudeApiKey,
  runClaudeMessage,
} from "@/lib/claude.server";
import type { MacroChatResponse } from "@/lib/macroIntelligence";
import { getMacroIntelligence } from "@/lib/macroIntelligence.server";
import { ingestMacroMemory } from "@/lib/macroMemory.server";
import { getRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
export const preferredRegion = "iad1";

function clean(value: unknown, max = 8_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  if (!(await getRouteActor(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  after(async () => {
    try {
      await ingestMacroMemory(false);
    } catch (error) {
      console.error("Macro dashboard memory refresh failed", error);
    }
  });
  try {
    const payload = await getMacroIntelligence(request.nextUrl.searchParams.get("refresh") === "1");
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Macro intelligence could not be loaded." },
      { status: 502 },
    );
  }
}

type ClaudeTextBlock = {
  type?: string;
  text?: string;
  citations?: Array<{ url?: string; title?: string }>;
};

type ClaudePayload = {
  content?: Array<ClaudeTextBlock | Record<string, unknown>>;
  stop_reason?: string;
};

function responseText(payload: ClaudePayload) {
  return (payload.content ?? [])
    .filter((block): block is ClaudeTextBlock => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

function responseSources(payload: ClaudePayload) {
  const sources = (payload.content ?? []).flatMap((block) => {
    if (block.type !== "text" || !("citations" in block) || !Array.isArray(block.citations)) return [];
    return block.citations.flatMap((citation) => citation.url ? [{
      title: clean(citation.title, 300) || citation.url,
      url: citation.url,
    }] : []);
  });
  return sources.filter((source, index, rows) => index === rows.findIndex((item) => item.url === source.url));
}

async function researchedMacroAnswer(
  apiKey: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  system: string,
) {
  const model = process.env.ANTHROPIC_MACRO_MODEL?.trim()
    || process.env.ANTHROPIC_MODEL?.trim()
    || "claude-sonnet-4-6";
  const tools = [{
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 4,
  }];
  let conversation: Array<{ role: "user" | "assistant"; content: unknown }> = messages;
  let payload: ClaudePayload | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        system,
        max_tokens: 2_200,
        tools,
        messages: conversation,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(detail || `Macro analyst failed (${response.status}).`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    payload = await response.json() as ClaudePayload;
    if (payload.stop_reason !== "pause_turn") break;
    conversation = [
      ...conversation,
      { role: "assistant", content: payload.content ?? [] },
    ];
  }
  if (!payload) throw new Error("The macro analyst returned no response.");
  return payload;
}

export async function POST(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const apiKey = getClaudeApiKey();
  if (!apiKey) return NextResponse.json({ error: "The macro analyst is waiting for its Anthropic API key." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as {
    message?: string;
    instrument?: string;
    history?: Array<{ role?: string; content?: string }>;
  };
  const message = clean(body.message, 5_000);
  if (!message) return NextResponse.json({ error: "Ask the macro analyst a question." }, { status: 400 });
  const instrument = clean(body.instrument, 20).toUpperCase() || "NQ";
  const history = Array.isArray(body.history) ? body.history.slice(-8).flatMap((entry) => {
    const content = clean(entry.content, 4_000);
    if (!content) return [];
    return [{ role: entry.role === "assistant" ? "assistant" as const : "user" as const, content }];
  }) : [];

  const dashboard = await getMacroIntelligence().catch(() => null);
  const dashboardContext = dashboard ? JSON.stringify({
    generatedAt: dashboard.generatedAt,
    pulse: dashboard.pulse,
    upcoming: dashboard.upcoming.slice(0, 6).map((event) => ({
      name: event.name,
      date: event.date,
      forecast: event.forecast,
      previous: event.previous,
      topic: event.topic,
    })),
    liveDevelopments: dashboard.developments.slice(0, 8).map((item) => ({
      title: item.title,
      topic: item.topic,
      publishedAt: item.publishedAt,
      source: item.sources[0],
    })),
  }) : "Dashboard context unavailable.";
  const system = [
    "You are the dedicated Kwant Desk macroeconomic analyst.",
    "You only answer macroeconomics, geopolitics, cross-asset transmission and trading-context questions.",
    "Research current claims with web search. Prefer primary sources: central banks, statistics agencies, governments, exchanges and direct official statements. Use reputable reporting only to establish fast-developing facts that primary sources have not yet published.",
    "Never turn a headline into certainty. Separate verified fact, inference and scenario. Never invent quotes, numbers, sources or market prices.",
    `The user's focus instrument is ${instrument}. Translate the issue through: event -> economic channel -> assets affected -> potential reaction -> confirmation -> invalidation.`,
    "Explain in direct plain English first, then provide the professional causal detail. State what yields, USD, oil or the directly affected asset must do to confirm the equity interpretation.",
    "Do not give personalised financial advice or order instructions. This is research and decision support.",
    `Current Kwant Desk evidence snapshot: ${dashboardContext}`,
  ].join("\n");

  try {
    let researched: ClaudePayload;
    try {
      researched = await researchedMacroAnswer(apiKey, [...history, { role: "user", content: message }], system);
    } catch (researchError) {
      const status = (researchError as Error & { status?: number }).status;
      if (status !== 400 && status !== 404) throw researchError;
      const answer = await runClaudeMessage({
        apiKey,
        model: process.env.ANTHROPIC_MACRO_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
        system: `${system}\nWeb search is temporarily unavailable. Be explicit that any current fact not present in the supplied dashboard evidence still needs verification.`,
        maxTokens: 1_800,
        messages: [...history, { role: "user", content: message }],
      });
      const fallback: MacroChatResponse = { answer, sources: [], researchedAt: new Date().toISOString() };
      return NextResponse.json(fallback);
    }
    const answer = responseText(researched);
    if (!answer) throw new Error("The macro analyst returned an empty response.");
    const payload: MacroChatResponse = {
      answer,
      sources: responseSources(researched),
      researchedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    return NextResponse.json(
      { error: status === 429 ? "The macro analyst is rate-limited. Retry shortly." : "The macro analyst could not complete this research request." },
      { status: status === 429 ? 429 : 502 },
    );
  }
}
