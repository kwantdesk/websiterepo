export type UsagePlanId = "free" | "starter" | "pro" | "premium";
export type UsageWindowKey = "fiveHour" | "monthly";
export type UsageFeatureKey = "ai_builder";
export type UsageMode = "fast" | "pro" | "research";

export type UsagePlan = {
  id: UsagePlanId;
  name: string;
  description: string;
  limits: Record<
    UsageFeatureKey,
    {
      fiveHour: number;
      monthly: number;
    }
  >;
};

export type UsageSnapshot = {
  feature: UsageFeatureKey;
  plan: UsagePlan;
  configured: boolean;
  windows: Record<
    UsageWindowKey,
    {
      used: number;
      limit: number;
      remaining: number;
      resetsAt: string;
    }
  >;
};

export const usagePlans: Record<UsagePlanId, UsagePlan> = {
  free: {
    id: "free",
    name: "Free",
    description: "Trial usage for testing the builder.",
    limits: {
      ai_builder: {
        fiveHour: 100,
        monthly: 1000,
      },
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "Light strategy research and backtest iteration.",
    limits: {
      ai_builder: {
        fiveHour: 300,
        monthly: 5000,
      },
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Regular AI strategy building and improvement loops.",
    limits: {
      ai_builder: {
        fiveHour: 900,
        monthly: 20000,
      },
    },
  },
  premium: {
    id: "premium",
    name: "Premium",
    description: "Heavy research usage for serious strategy development.",
    limits: {
      ai_builder: {
        fiveHour: 2500,
        monthly: 75000,
      },
    },
  },
};

export const usageModeCosts: Record<UsageMode, number> = {
  fast: 1,
  pro: 1,
  research: 1,
};

export function getUsagePlan(planId?: string | null) {
  const normalized = (planId ?? "").trim().toLowerCase() as UsagePlanId;
  return usagePlans[normalized] ?? usagePlans.free;
}

export function getUsageModeCost(mode?: string | null) {
  const normalized = (mode ?? "fast").trim().toLowerCase() as UsageMode;
  return usageModeCosts[normalized] ?? usageModeCosts.fast;
}
