import type { ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Compass,
  Cpu,
  Database,
  Gauge,
  LayoutGrid,
  ListTree,
  Network,
  Radio,
  Rows3,
  Shield,
  Signal,
  SlidersHorizontal,
  Wallet,
  Waves,
} from "lucide-react";

export const automationMetrics = [
  { label: "Active Bots", value: "3", detail: "2 armed, 1 paused" },
  { label: "Connected Venues", value: "3", detail: "OANDA, Tradovate, demo" },
  { label: "Live Positions", value: "2", detail: "Chart-synced and bracketed" },
  { label: "Signal to Route", value: "18ms", detail: "Current median dispatch latency" },
  { label: "Today P&L", value: "+$160.20", detail: "Net across active runtimes" },
];

export const automations = [
  {
    name: "MNQ Open Drive V8",
    market: "MNQ SEP26",
    broker: "Tradovate Sim",
    mode: "Paper",
    state: "Armed",
    stateTone: "text-primary",
    latency: "18ms",
    lastEvent: "Bracket refreshed 12s ago",
  },
  {
    name: "NAS100 EMA Cross",
    market: "NAS100",
    broker: "OANDA",
    mode: "Live",
    state: "Watching",
    stateTone: "text-foreground",
    latency: "26ms",
    lastEvent: "Flat, waiting for crossover",
  },
  {
    name: "London Breakout",
    market: "GER40",
    broker: "Demo Router",
    mode: "Standby",
    state: "Paused",
    stateTone: "text-muted",
    latency: "--",
    lastEvent: "Session locked until 07:00 UTC",
  },
];

export const brokerFeeds = [
  { name: "OANDA", status: "Connected", detail: "Streaming CFDs / FX", tone: "text-primary" },
  { name: "Tradovate", status: "Ready", detail: "Futures routing online", tone: "text-foreground" },
  { name: "Demo Router", status: "Ready", detail: "Paper fills + replay", tone: "text-foreground" },
  { name: "CME Data", status: "Planned", detail: "Direct market data expansion", tone: "text-muted" },
];

export const positions = [
  { symbol: "MNQ SEP26", side: "Long", size: "1", entry: "19820.00", stop: "19800.00", target: "19860.00", pnl: "+$126.00", tone: "text-primary" },
  { symbol: "NAS100", side: "Short", size: "0.40", entry: "29482.3", stop: "29518.0", target: "29394.0", pnl: "+$34.20", tone: "text-primary" },
];

export const workingOrders = [
  { venue: "Tradovate Sim", symbol: "MNQ SEP26", type: "Protective OCO", status: "Working", detail: "Stop 19800 / Target 19860" },
  { venue: "OANDA", symbol: "NAS100", type: "Sell Stop Entry", status: "Watching", detail: "Waiting above 29494.8 regime filter" },
];

export const runtimeLog = [
  "[09:45:00] MNQ_OPEN_DRIVE_V8 :: probability 0.67 > 0.62 threshold",
  "[09:45:00] RISK_ENGINE :: daily guard passed / 1 position slot available",
  "[09:45:00] EXECUTOR :: order intent dispatched to Tradovate Sim",
  "[09:45:01] EXECUTOR :: fill received / bracket attached / chart overlay synced",
  "[09:46:12] AUTOMATION_HUB :: broker heartbeat healthy / live chart rendering stable",
];

export const guardrails: Array<{
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Daily Loss Lock", detail: "Enabled", icon: Shield },
  { label: "Duplicate Signal Block", detail: "Active", icon: CheckCircle },
  { label: "Kill Switch", detail: "Ready", icon: AlertTriangle },
  { label: "Chart Sync", detail: "Orders visible", icon: Radio },
];

export const infrastructurePanels: Array<{
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Runtime kernel", detail: "Forward models loaded / 3 active runners", icon: Cpu },
  { label: "Event journal", detail: "Structured execution + alert stream ready", icon: ListTree },
  { label: "Market data cache", detail: "Nasdaq CFD + futures bridge planned", icon: Database },
  { label: "Latency monitor", detail: "Dispatch med 18ms / feed drift 4ms", icon: Gauge },
];

export const ribbonItems: Array<{
  label: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "New", detail: "bot / alert / workspace", icon: LayoutGrid },
  { label: "Tools", detail: "DOM / ladder / chart trader", icon: SlidersHorizontal },
  { label: "Workspaces", detail: "layouts / desks / playbooks", icon: LayoutGrid },
  { label: "Connections", detail: "brokers / data / prop", icon: Network },
  { label: "Accounts", detail: "live / paper / demo", icon: Wallet },
  { label: "Replay", detail: "session playback / drills", icon: Waves },
];

export const operatorPanels: Array<{
  title: string;
  detail: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { title: "Chart Trader", detail: "One-click bracket routing", value: "Ready", icon: Compass },
  { title: "SuperDOM", detail: "Depth + ladder surface", value: "Planned", icon: Rows3 },
  { title: "Strategy Monitor", detail: "Bots, health, and drift", value: "Online", icon: Cpu },
  { title: "Connection Center", detail: "Venue + data supervision", value: "Healthy", icon: Signal },
];

export const scannerRows = [
  { symbol: "MNQ SEP26", venue: "CME", regime: "Trend", score: "0.67", alert: "Watch long continuation" },
  { symbol: "NAS100", venue: "OANDA", regime: "Momentum", score: "0.61", alert: "EMA cross watch" },
  { symbol: "GER40", venue: "OANDA", regime: "Range", score: "0.44", alert: "No edge / avoid" },
  { symbol: "XAUUSD", venue: "OANDA", regime: "Expansion", score: "0.58", alert: "Breakout prep" },
];

export const replaySessions = [
  { name: "NY Open Drive Review", market: "MNQ SEP26", mode: "Playback", detail: "09:30 to 11:00 ET / 14 signals" },
  { name: "London Breakout Drill", market: "GER40", mode: "Session Replay", detail: "07:00 to 09:00 UTC / bot diagnostics" },
  { name: "Failure Analysis", market: "NAS100", mode: "Execution Review", detail: "Rejected fills and stale feed handling" },
];

export const journalRows = [
  { time: "09:45:01", bot: "MNQ Open Drive V8", action: "Long filled", reason: "Probability 0.67 / threshold 0.62" },
  { time: "09:46:12", bot: "MNQ Open Drive V8", action: "Bracket synced", reason: "Target + stop now visible on chart" },
  { time: "10:03:09", bot: "NAS100 EMA Cross", action: "Signal skipped", reason: "Session rule blocked duplicate entry" },
  { time: "10:11:44", bot: "London Breakout", action: "Paused", reason: "Session lock until London open" },
];
