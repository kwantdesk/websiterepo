import "server-only";

// The real orderflow archive. The 60s flow poller persists every raw provider
// frame it accepts, and the terminal serves orderflow history from these rows
// — replacing the disabled provider archive. Nothing in here fabricates a
// frame: an empty or unconfigured archive reads back as exactly that.

type ArchiveConfig = { url: string; serviceRoleKey: string };

const TABLE = "gexbot_orderflow_frames";
const MAX_SESSION_FRAMES = 600;

function config(): ArchiveConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

function restHeaders(value: ArchiveConfig, prefer?: string) {
  return {
    apikey: value.serviceRoleKey,
    Authorization: `Bearer ${value.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export function isOrderflowArchiveConfigured() {
  return config() !== null;
}

export async function persistOrderflowFrame(args: {
  ticker: string;
  sessionKey: string;
  frameTimestamp: number;
  payload: Record<string, unknown>;
}): Promise<void> {
  const value = config();
  if (!value) return;
  if (!Number.isFinite(args.frameTimestamp) || args.frameTimestamp <= 0) return;
  const response = await fetch(
    `${value.url}/rest/v1/${TABLE}?on_conflict=ticker,frame_timestamp`,
    {
      method: "POST",
      headers: restHeaders(value, "resolution=ignore-duplicates,return=minimal"),
      body: JSON.stringify([{
        ticker: args.ticker,
        session_key: args.sessionKey,
        frame_timestamp: Math.round(args.frameTimestamp),
        payload: args.payload,
      }]),
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Orderflow archive write failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function latestArchivedSessionKey(ticker: string): Promise<string | null> {
  const value = config();
  if (!value) return null;
  const query = new URLSearchParams({
    select: "session_key",
    ticker: `eq.${ticker}`,
    order: "session_key.desc",
    limit: "1",
  });
  const response = await fetch(`${value.url}/rest/v1/${TABLE}?${query.toString()}`, {
    headers: restHeaders(value),
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) {
    throw new Error(`Orderflow archive session lookup failed (${response.status}).`);
  }
  const rows = await response.json() as Array<{ session_key?: unknown }>;
  const key = rows?.[0]?.session_key;
  return typeof key === "string" && key ? key : null;
}

export async function readArchivedSessionFrames(args: {
  ticker: string;
  sessionKey: string;
}): Promise<Array<Record<string, unknown>>> {
  const value = config();
  if (!value) return [];
  const query = new URLSearchParams({
    select: "payload",
    ticker: `eq.${args.ticker}`,
    session_key: `eq.${args.sessionKey}`,
    order: "frame_timestamp.asc",
    limit: String(MAX_SESSION_FRAMES),
  });
  const response = await fetch(`${value.url}/rest/v1/${TABLE}?${query.toString()}`, {
    headers: restHeaders(value),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Orderflow archive read failed (${response.status}).`);
  }
  const rows = await response.json() as Array<{ payload?: unknown }>;
  return rows.flatMap((row) => (
    row?.payload && typeof row.payload === "object" ? [row.payload as Record<string, unknown>] : []
  ));
}
