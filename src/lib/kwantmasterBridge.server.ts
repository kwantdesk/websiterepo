import { existsSync, readFileSync } from "node:fs";

export type KwantmasterForwardSnapshot = {
  generated_at: string;
  poll_seconds: number;
  kill_switch_armed: boolean;
  mode: string;
  health_rules?: {
    poll_seconds?: number;
    journal_watch_seconds?: number;
    worker_stale_seconds?: number;
    bridge_stale_seconds?: number;
    producer_stale_seconds?: number;
    runner_stale_seconds?: number;
    bar_stale_seconds?: number;
    bridge_heartbeat_seconds?: number | null;
  };
  strategy_families: Array<{
    id: string;
    label: string;
    version: string;
    enabled: boolean;
    live: boolean;
  }>;
  active_strategy_id: string;
  stats: {
    trade_count: number;
    day_pnl: number;
    win_rate: number;
    profit_factor: number;
    net_profit: number;
  };
  active_position: null | {
    side?: string;
    symbol?: string;
    state?: string;
    entry?: string;
    stop?: string;
    target?: string;
    size?: string;
  };
  last_closed_execution: null | {
    symbol?: string;
    exit_pnl?: number;
    exit_price?: number;
    closed_at?: string;
  };
  mailbox?: {
    available?: boolean;
    pending_count?: number;
    claimed_count?: number;
    worker_status?: string | null;
    worker_health_state?: string | null;
    worker_id?: string | null;
    worker_last_heartbeat_at?: string | null;
  };
  health: Array<{
    label: string;
    value: string;
    status: string;
  }>;
  equity_curve: Array<{
    timestamp: string;
    cumulative_pnl: number;
  }>;
  execution_logs: string[];
  telegram_logs: string[];
};

export async function loadKwantmasterForwardSnapshot(): Promise<{
  snapshot: KwantmasterForwardSnapshot | null;
  source: string;
}> {
  const remoteUrl = process.env.KWANTMASTER_FORWARD_SNAPSHOT_URL;
  const localPath =
    process.env.KWANTMASTER_FORWARD_SNAPSHOT_PATH ||
    "C:\\Users\\Karen\\Desktop\\KWANTMASTER\\public\\forward-test.json";

  if (remoteUrl) {
    try {
      const response = await fetch(remoteUrl, { cache: "no-store" });
      if (response.ok) {
        return {
          snapshot: (await response.json()) as KwantmasterForwardSnapshot,
          source: remoteUrl,
        };
      }
    } catch {
      // fall through
    }
  }

  if (existsSync(localPath)) {
    try {
      return {
        snapshot: JSON.parse(readFileSync(localPath, "utf-8")) as KwantmasterForwardSnapshot,
        source: localPath,
      };
    } catch {
      return { snapshot: null, source: localPath };
    }
  }

  return { snapshot: null, source: remoteUrl || localPath };
}
