import type { EconomicCurrency, EconomicImpact } from "@/lib/economicCalendar";

export type MacroTopic =
  | "CENTRAL BANK"
  | "INFLATION"
  | "LABOUR"
  | "GROWTH"
  | "FISCAL"
  | "ENERGY"
  | "TRADE"
  | "GEOPOLITICS"
  | "LIQUIDITY"
  | "OTHER";

export type MacroDirection = "UP" | "DOWN" | "MIXED" | "NEUTRAL";

export type MacroSource = {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  official: boolean;
};

export type MacroScenario = {
  label: "HOT / HAWKISH" | "IN LINE" | "COOL / DOVISH" | "ESCALATION" | "DE-ESCALATION";
  condition: string;
  transmission: string;
  likelyReaction: string;
  confirmation: string[];
  invalidation: string;
};

export type MacroEventBrief = {
  id: string;
  name: string;
  date: string;
  currency: EconomicCurrency;
  impact: EconomicImpact;
  topic: MacroTopic;
  status: "UPCOMING" | "RELEASED";
  forecast: string;
  previous: string;
  actual: string;
  plainEnglish: string;
  whyMarketsCare: string;
  causalChain: string[];
  assets: string[];
  scenarios: MacroScenario[];
  source: MacroSource | null;
};

export type MacroObservedMove = {
  symbol: "NQ" | "ES" | "ZN" | "CL";
  points: number;
  percent: number;
  direction: MacroDirection;
};

export type MacroEventReceipt = {
  id: string;
  eventId: string;
  eventName: string;
  releasedAt: string;
  surprise: string;
  scenarioObserved: string;
  marketResponse: string;
  observedMoves: MacroObservedMove[];
  gotRight: string[];
  missed: string[];
  reasoningScore: number | null;
  scoreExplanation: string;
  evidenceStatus: "VERIFIED" | "AWAITING MARKET DATA" | "INSUFFICIENT RELEASE DATA";
};

export type MacroDevelopment = {
  id: string;
  title: string;
  topic: MacroTopic;
  urgency: "CRITICAL" | "HIGH" | "WATCH";
  status: "DEVELOPING" | "CONFIRMED" | "MONITORING";
  publishedAt: string;
  summary: string;
  event: string;
  economicChannel: string;
  assetsAffected: string[];
  potentialReaction: string;
  confirmation: string[];
  invalidation: string;
  sources: MacroSource[];
};

export type MacroPulse = {
  label: "Inflation" | "Growth" | "Labour" | "Policy" | "Liquidity";
  state: string;
  direction: MacroDirection;
  explanation: string;
  evidenceCount: number;
};

export type MacroIntelligencePayload = {
  generatedAt: string;
  status: "LIVE" | "LAST GOOD";
  sourceCount: number;
  officialSourceCount: number;
  note: string;
  pulse: MacroPulse[];
  upcoming: MacroEventBrief[];
  receipts: MacroEventReceipt[];
  developments: MacroDevelopment[];
  sources: MacroSource[];
};

export type MacroChatSource = {
  title: string;
  url: string;
};

export type MacroChatResponse = {
  answer: string;
  sources: MacroChatSource[];
  researchedAt: string;
};
