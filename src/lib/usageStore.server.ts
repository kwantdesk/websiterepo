import { getUsagePlan, type UsageFeatureKey, type UsagePlan, type UsageSnapshot } from "@/lib/usagePlans";

type UsageEventRow = {
  id?: string;
  account_id: string;
  feature: UsageFeatureKey;
  units: number;
  reason: string;
  model_mode?: string | null;
  created_at?: string;
};

const DEFAULT_USAGE_TABLE = "kwantify_usage_events";
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

function isUsageSchemaMissing(message: string) {
  return /PRST205|Could not find the table|schema cache|kwantify_usage_events/i.test(message);
}

function getUsageConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const table = process.env.KWANTIFY_USAGE_TABLE?.trim() || DEFAULT_USAGE_TABLE;

  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey, table };
}

function getMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getNextMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function getFiveHourStart(date: Date) {
  return new Date(date.getTime() - FIVE_HOURS_MS);
}

function getFiveHourReset(date: Date) {
  return new Date(date.getTime() + FIVE_HOURS_MS);
}

function buildUnconfiguredSnapshot(options: {
  feature: UsageFeatureKey;
  plan: UsagePlan;
  now: Date;
}): UsageSnapshot {
  const limits = options.plan.limits[options.feature];
  return {
    feature: options.feature,
    plan: options.plan,
    configured: false,
    windows: {
      fiveHour: {
        used: 0,
        limit: limits.fiveHour,
        remaining: limits.fiveHour,
        resetsAt: getFiveHourReset(options.now).toISOString(),
      },
      monthly: {
        used: 0,
        limit: limits.monthly,
        remaining: limits.monthly,
        resetsAt: getNextMonthStart(options.now).toISOString(),
      },
    },
  };
}

function usageHeaders(config: NonNullable<ReturnType<typeof getUsageConfig>>) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function readUsageTotal(options: {
  accountId: string;
  feature: UsageFeatureKey;
  since: Date;
  config: NonNullable<ReturnType<typeof getUsageConfig>>;
}) {
  const query = new URLSearchParams({
    select: "units",
    account_id: `eq.${options.accountId}`,
    feature: `eq.${options.feature}`,
    created_at: `gte.${options.since.toISOString()}`,
    limit: "10000",
  });

  const response = await fetch(`${options.config.supabaseUrl}/rest/v1/${options.config.table}?${query.toString()}`, {
    headers: usageHeaders(options.config),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Usage read failed: ${text || response.status}`);
  }

  const rows = (await response.json()) as Array<Pick<UsageEventRow, "units">>;
  return rows.reduce((total, row) => total + (Number.isFinite(row.units) ? row.units : 0), 0);
}

async function insertUsageEvent(options: {
  accountId: string;
  feature: UsageFeatureKey;
  units: number;
  reason: string;
  modelMode?: string;
  config: NonNullable<ReturnType<typeof getUsageConfig>>;
}) {
  const row: UsageEventRow = {
    account_id: options.accountId,
    feature: options.feature,
    units: options.units,
    reason: options.reason,
    model_mode: options.modelMode ?? null,
  };

  const response = await fetch(`${options.config.supabaseUrl}/rest/v1/${options.config.table}`, {
    method: "POST",
    headers: {
      ...usageHeaders(options.config),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Usage write failed: ${text || response.status}`);
  }
}

export async function getUsageSnapshot(options: {
  accountId: string;
  feature?: UsageFeatureKey;
  planId?: string | null;
}): Promise<UsageSnapshot> {
  const feature = options.feature ?? "ai_builder";
  const plan = getUsagePlan(options.planId ?? process.env.KWANTIFY_DEFAULT_PLAN);
  const now = new Date();
  const config = getUsageConfig();
  const limits = plan.limits[feature];

  if (!config) return buildUnconfiguredSnapshot({ feature, plan, now });

  let fiveHourUsed = 0;
  let monthlyUsed = 0;
  try {
    [fiveHourUsed, monthlyUsed] = await Promise.all([
      readUsageTotal({ accountId: options.accountId, feature, since: getFiveHourStart(now), config }),
      readUsageTotal({ accountId: options.accountId, feature, since: getMonthStart(now), config }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isUsageSchemaMissing(message)) {
      return buildUnconfiguredSnapshot({ feature, plan, now });
    }
    throw error;
  }

  return {
    feature,
    plan,
    configured: true,
    windows: {
      fiveHour: {
        used: fiveHourUsed,
        limit: limits.fiveHour,
        remaining: Math.max(0, limits.fiveHour - fiveHourUsed),
        resetsAt: getFiveHourReset(now).toISOString(),
      },
      monthly: {
        used: monthlyUsed,
        limit: limits.monthly,
        remaining: Math.max(0, limits.monthly - monthlyUsed),
        resetsAt: getNextMonthStart(now).toISOString(),
      },
    },
  };
}

export async function assertAndRecordUsage(options: {
  accountId: string;
  feature?: UsageFeatureKey;
  planId?: string | null;
  units: number;
  reason: string;
  modelMode?: string;
}) {
  const feature = options.feature ?? "ai_builder";
  const snapshot = await getUsageSnapshot({
    accountId: options.accountId,
    feature,
    planId: options.planId,
  });

  const blockedWindow =
    snapshot.windows.fiveHour.remaining < options.units
      ? "5-hour"
      : snapshot.windows.monthly.remaining < options.units
        ? "monthly"
        : null;

  if (blockedWindow) {
    const error = new Error(`AI usage limit reached for the ${blockedWindow} window.`) as Error & {
      status?: number;
      code?: string;
      usage?: UsageSnapshot;
    };
    error.status = 429;
    error.code = "usage_limit_exceeded";
    error.usage = snapshot;
    throw error;
  }

  const config = getUsageConfig();
  if (config && snapshot.configured) {
    try {
      await insertUsageEvent({
        accountId: options.accountId,
        feature,
        units: options.units,
        reason: options.reason,
        modelMode: options.modelMode,
        config,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isUsageSchemaMissing(message)) return snapshot;
      throw error;
    }
  }

  return getUsageSnapshot({
    accountId: options.accountId,
    feature,
    planId: options.planId,
  });
}

export async function assertUsageAvailable(options: {
  accountId: string;
  feature?: UsageFeatureKey;
  planId?: string | null;
  units: number;
}) {
  const feature = options.feature ?? "ai_builder";
  const snapshot = await getUsageSnapshot({
    accountId: options.accountId,
    feature,
    planId: options.planId,
  });

  const blockedWindow =
    snapshot.windows.fiveHour.remaining < options.units
      ? "5-hour"
      : snapshot.windows.monthly.remaining < options.units
        ? "monthly"
        : null;

  if (blockedWindow) {
    const error = new Error(`AI usage limit reached for the ${blockedWindow} window.`) as Error & {
      status?: number;
      code?: string;
      usage?: UsageSnapshot;
    };
    error.status = 429;
    error.code = "usage_limit_exceeded";
    error.usage = snapshot;
    throw error;
  }

  return snapshot;
}

export async function recordUsage(options: {
  accountId: string;
  feature?: UsageFeatureKey;
  planId?: string | null;
  units: number;
  reason: string;
  modelMode?: string;
  fallback?: boolean;
}) {
  const feature = options.feature ?? "ai_builder";
  const snapshot = await getUsageSnapshot({
    accountId: options.accountId,
    feature,
    planId: options.planId,
  });
  const config = getUsageConfig();
  if (config && snapshot.configured) {
    try {
      await insertUsageEvent({
        accountId: options.accountId,
        feature,
        units: options.units,
        reason: options.fallback ? `${options.reason}_fallback` : options.reason,
        modelMode: options.modelMode,
        config,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isUsageSchemaMissing(message)) return snapshot;
      throw error;
    }
  }

  return getUsageSnapshot({
    accountId: options.accountId,
    feature,
    planId: options.planId,
  });
}

export function getPlanForAccount(_accountId: string): UsagePlan {
  return getUsagePlan(process.env.KWANTIFY_DEFAULT_PLAN);
}
