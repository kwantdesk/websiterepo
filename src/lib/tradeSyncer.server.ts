import type {
  TradeSyncerAccountRecord,
  TradeSyncerAuditEntry,
  TradeSyncerDispatchDryRunResult,
  TradeSyncerDispatchExecutionScenario,
  TradeSyncerDispatchExecutionSimulationResult,
  TradeSyncerDispatchPreview,
  TradeSyncerDispatchStageResult,
  TradeSyncerFollowerDispatchIntent,
  TradeSyncerFollowerDispatchDryRun,
  TradeSyncerFollowerDispatchExecutionSimulationResult,
  TradeSyncerFollowerDispatchStageResult,
  TradeSyncerFollowerTradovateLiveBridgeResult,
  TradeSyncerFollowerVenueDispatchResult,
  TradeSyncerFollowerPositionSnapshot,
  TradeSyncerFollowerProtectionSnapshot,
  TradeSyncerFollowerRepairAction,
  TradeSyncerFollowerRecord,
  TradeSyncerFollowerRepairEvent,
  TradeSyncerGroupStatus,
  TradeSyncerLogEntry,
  TradeSyncerMasterTradeEvent,
  TradeSyncerRepairAction,
  TradeSyncerStore,
  TradeSyncerSyncGroupRecord,
  TradeSyncerTemplateRecord,
  TradeSyncerTradovateLiveBridgeResult,
  TradeSyncerVenueDispatchResult,
} from "@/lib/tradeSyncer";
import {
  FUTURES_CONNECTOR_SCHEMA_VERSION,
  type FuturesAccountRecord,
  type FuturesConnectorSignalIntent,
  type FuturesRoutingProfile,
  type RithmicGatewayScenario,
} from "@/lib/futuresConnectors";
import { getTradeSyncerStoreDescriptor, getTradeSyncerStoreSnapshot, writeTradeSyncerStoreSnapshot } from "@/lib/tradeSyncerStore";
import {
  getFuturesManagedProfileSnapshot,
  ingestFuturesConnectorSignal,
  previewRithmicOrder,
  previewTradovateOrder,
  runRithmicProtocolServiceAttempt,
  stageRithmicDispatchAttempt,
  stageRithmicTransportAttempt,
  submitTradovateOrder,
  submitRithmicAttempt,
} from "@/lib/futuresConnectors.server";

export type TradeSyncerOverviewMetric = {
  label: string;
  value: string;
  detail: string;
};

export type TradeSyncerOverview = {
  descriptor: ReturnType<typeof getTradeSyncerStoreDescriptor>;
  updatedAt: string;
  accounts: TradeSyncerAccountRecord[];
  templates: TradeSyncerTemplateRecord[];
  syncGroups: TradeSyncerSyncGroupRecord[];
  logs: TradeSyncerLogEntry[];
  auditTrail: TradeSyncerAuditEntry[];
  dashboardMetrics: TradeSyncerOverviewMetric[];
  accountMetrics: TradeSyncerOverviewMetric[];
  copierMetrics: TradeSyncerOverviewMetric[];
  followerRepairView: TradeSyncerFollowerRepairView[];
  managedFuturesAccounts: FuturesAccountRecord[];
  managedFuturesRoutingProfiles: FuturesRoutingProfile[];
  notes: string[];
};

export type TradeSyncerFollowerRepairView = {
  groupId: string;
  groupLabel: string;
  followerId: string;
  accountId: string;
  accountLabel: string;
  healthState: TradeSyncerFollowerRecord["healthState"];
  currentDrift: string | null;
  lastDriftAt: string | null;
  positionState: TradeSyncerFollowerRecord["positionSnapshot"]["state"];
  positionQuantity: number;
  positionSide: TradeSyncerFollowerRecord["positionSnapshot"]["side"];
  protectionState: TradeSyncerFollowerRecord["protectionSnapshot"]["state"];
  protectionLegCount: number;
  latestRepairAction: string | null;
  latestRepairOutcome: TradeSyncerFollowerRepairEvent["outcome"] | null;
  latestRepairDetail: string | null;
  latestRepairAt: string | null;
};

type BindManagedFuturesAccountPayload = {
  accountId: string;
  managedFuturesAccountId: string | null;
};

type AddAccountPayload = {
  label: string;
  brokerAccountRef: string;
  venue: TradeSyncerAccountRecord["venue"];
  environment: TradeSyncerAccountRecord["environment"];
  balance?: number;
  equity?: number;
  timezone?: string;
  enabledSymbols?: string[];
  connectionState?: TradeSyncerAccountRecord["connectionState"];
  syncStatus?: TradeSyncerAccountRecord["syncStatus"];
  healthNote?: string;
};

type AddTemplatePayload = {
  label: string;
  riskType: string;
  riskSetting: string;
  status?: TradeSyncerTemplateRecord["status"];
};

type AddSyncGroupPayload = {
  label: string;
  leadAccountId: string;
  executionModeId: string;
  status?: TradeSyncerGroupStatus;
  followerRecords?: Array<{
    accountId: string;
    riskType: string;
    riskSetting: string;
    templateId?: string | null;
    status?: TradeSyncerGroupStatus;
  }>;
};

type AddFollowerPayload = {
  groupId: string;
  accountId: string;
  riskType: string;
  riskSetting: string;
  templateId?: string | null;
  status?: TradeSyncerGroupStatus;
};

type UpdateFollowerOverridePayload = {
  groupId: string;
  followerId: string;
  riskType: string;
  riskSetting: string;
  copyStopLoss?: boolean;
  copyTakeProfit?: boolean;
  copyPendingOrders?: boolean;
  delayMode?: TradeSyncerFollowerRecord["override"] extends infer T
    ? T extends { delayMode?: infer D }
      ? D
      : never
    : never;
};

type UpdateSymbolMappingsPayload = {
  groupId: string;
  leaderSymbol: string;
  followerSymbol: string;
};

type TradeSyncerSimulationScenario = "fanout_success" | "drift_detected" | "flatten_followers";

function createAuditEntry(
  kind: TradeSyncerAuditEntry["kind"],
  detail: string
): TradeSyncerAuditEntry {
  return {
    id: `ts_audit_${crypto.randomUUID()}`,
    kind,
    detail,
    occurredAt: new Date().toISOString(),
  };
}

function createLogEntry(
  entry: Omit<TradeSyncerLogEntry, "id" | "occurredAt"> & { occurredAt?: string }
): TradeSyncerLogEntry {
  return {
    id: `ts_log_${crypto.randomUUID()}`,
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
    ...entry,
  };
}

function createFollowerRepairEvent(
  entry: Omit<TradeSyncerFollowerRepairEvent, "id" | "occurredAt"> & { occurredAt?: string }
): TradeSyncerFollowerRepairEvent {
  return {
    id: `ts_follower_repair_${crypto.randomUUID()}`,
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
    ...entry,
  };
}

function createDefaultPositionSnapshot(symbol = "MNQ"): TradeSyncerFollowerPositionSnapshot {
  return {
    symbol,
    side: "flat",
    quantity: 0,
    avgEntryPrice: null,
    state: "flat",
    updatedAt: null,
  };
}

function createDefaultProtectionSnapshot(): TradeSyncerFollowerProtectionSnapshot {
  return {
    stopLossState: "not_needed",
    takeProfitState: "not_needed",
    workingLegCount: 0,
    lastRestagedAt: null,
    state: "none",
  };
}

function describeFollowerSnapshot(follower: TradeSyncerFollowerRecord) {
  const position =
    follower.positionSnapshot.side === "flat"
      ? `${follower.positionSnapshot.symbol} flat`
      : `${follower.positionSnapshot.symbol} ${follower.positionSnapshot.side} ${follower.positionSnapshot.quantity} @ ${follower.positionSnapshot.avgEntryPrice ?? "n/a"}`;

  return `${position}; state=${follower.positionSnapshot.state}; protection=${follower.protectionSnapshot.state}; stop=${follower.protectionSnapshot.stopLossState}; target=${follower.protectionSnapshot.takeProfitState}; legs=${follower.protectionSnapshot.workingLegCount}; restaged=${follower.protectionSnapshot.lastRestagedAt ?? "none"}`;
}

function buildFollowerSnapshotTransitionEntries(params: {
  previousGroup: TradeSyncerSyncGroupRecord;
  nextGroup: TradeSyncerSyncGroupRecord;
  accountMap: Map<string, TradeSyncerAccountRecord>;
  titlePrefix: string;
}): Array<Omit<TradeSyncerLogEntry, "id" | "occurredAt">> {
  const previousFollowerMap = new Map(
    params.previousGroup.followerRecords.map((follower) => [follower.id, follower])
  );

  return params.nextGroup.followerRecords.flatMap((follower) => {
    const previousFollower = previousFollowerMap.get(follower.id);
    if (!previousFollower) {
      return [];
    }

    const previousSummary = describeFollowerSnapshot(previousFollower);
    const nextSummary = describeFollowerSnapshot(follower);

    if (previousSummary === nextSummary) {
      return [];
    }

    const accountLabel = params.accountMap.get(follower.accountId)?.label ?? follower.accountId;

    return [
      {
        groupId: params.nextGroup.id,
        accountId: follower.accountId,
        severity: "info" as const,
        title: `${params.titlePrefix} snapshot updated`,
        detail: `${accountLabel}: ${previousSummary} -> ${nextSummary}`,
        status: "follower_snapshot_updated",
      },
    ];
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function countFollowers(syncGroups: TradeSyncerSyncGroupRecord[]) {
  return syncGroups.reduce((total, group) => total + group.followerRecords.length, 0);
}

function countOpenPositions(syncGroups: TradeSyncerSyncGroupRecord[]) {
  return syncGroups.reduce((total, group) => total + group.openPositions, 0);
}

function computeMedianLag(syncGroups: TradeSyncerSyncGroupRecord[]) {
  if (!syncGroups.length) {
    return 0;
  }
  const total = syncGroups.reduce((sum, group) => sum + group.medianCopyLagMs, 0);
  return Math.round(total / syncGroups.length);
}

function computeFollowerMatchRate(syncGroups: TradeSyncerSyncGroupRecord[]) {
  if (!syncGroups.length) {
    return "0.0%";
  }
  const healthyFollowers = syncGroups.reduce((total, group) => {
    const healthyGroupFollowers = group.followerRecords.filter(
      (follower) => follower.status === "enabled" || follower.status === "monitor_existing"
    ).length;
    return total + healthyGroupFollowers;
  }, 0);
  const totalFollowers = countFollowers(syncGroups);
  if (!totalFollowers) {
    return "0.0%";
  }
  return `${((healthyFollowers / totalFollowers) * 100).toFixed(1)}%`;
}

function parseNumericSetting(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeContracts(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

function resolveFollowerProtectionPolicy(args: {
  template: TradeSyncerTemplateRecord | null;
  follower: TradeSyncerFollowerRecord;
}) {
  const template = args.template;
  const override = args.follower.override;

  return {
    copyStopLoss: override?.copyStopLoss ?? template?.copyStopLoss ?? true,
    copyTakeProfit: override?.copyTakeProfit ?? template?.copyTakeProfit ?? true,
    copyPendingOrders: override?.copyPendingOrders ?? template?.copyPendingOrders ?? false,
  };
}

function deriveFollowerQuantity(args: {
  leaderQuantity: number;
  follower: TradeSyncerFollowerRecord;
}) {
  const riskType = args.follower.riskType.trim().toLowerCase();
  const numericSetting = parseNumericSetting(args.follower.riskSetting);

  if (riskType === "fixed lot" || riskType === "fixed lots" || riskType === "fixed contract" || riskType === "fixed contracts") {
    return {
      requestedQuantity: numericSetting != null ? normalizeContracts(numericSetting) : null,
      quantityDetail: `Fixed quantity from follower setting ${args.follower.riskSetting}.`,
      blocked: numericSetting == null,
    };
  }

  if (riskType === "lot multiplier") {
    return {
      requestedQuantity: numericSetting != null ? normalizeContracts(args.leaderQuantity * numericSetting) : null,
      quantityDetail: `Leader quantity ${args.leaderQuantity} scaled by lot multiplier ${args.follower.riskSetting}.`,
      blocked: numericSetting == null,
    };
  }

  if (riskType === "balance multiplier" || riskType === "fixed balance multiplier") {
    return {
      requestedQuantity: numericSetting != null ? normalizeContracts(Math.max(1, args.leaderQuantity * numericSetting)) : null,
      quantityDetail: `Approximate futures-contract preview calculated from ${args.follower.riskType} ${args.follower.riskSetting}. Live sizing needs broker-aware balance math.`,
      blocked: numericSetting == null,
      review: true,
    };
  }

  if (riskType === "fixed % risk (beta)") {
    return {
      requestedQuantity: numericSetting != null ? normalizeContracts(Math.max(1, args.leaderQuantity)) : normalizeContracts(Math.max(1, args.leaderQuantity)),
      quantityDetail:
        "Preview uses the leader contract count as a placeholder. Real percent-risk futures sizing needs stop distance plus live follower balance.",
      blocked: false,
      review: true,
    };
  }

  return {
    requestedQuantity: normalizeContracts(args.leaderQuantity),
    quantityDetail: `Fallback contract preview based on leader quantity ${args.leaderQuantity}.`,
    blocked: false,
    review: true,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildTradeSyncerDryRunSignal(args: {
  preview: TradeSyncerDispatchPreview;
  intent: TradeSyncerFollowerDispatchIntent;
}): FuturesConnectorSignalIntent | null {
  if (
    !args.intent.dispatchPayload ||
    !args.intent.managedAccountId ||
    !args.intent.followerSymbol ||
    !args.intent.requestedQuantity
  ) {
    return null;
  }

  if (args.intent.dispatchPayload.venue !== "tradovate" && args.intent.dispatchPayload.venue !== "rithmic") {
    return null;
  }

  return {
    schemaVersion: FUTURES_CONNECTOR_SCHEMA_VERSION,
    signalId: `ts_dryrun_${args.preview.groupId}_${args.intent.followerId}_${crypto.randomUUID()}`,
    strategyId: `trade_syncer_${args.preview.groupId}`,
    versionId: "dry_run_v1",
    venue: args.intent.dispatchPayload.venue,
    accountId: args.intent.managedAccountId,
    symbol: args.intent.followerSymbol,
    side: args.intent.dispatchPayload.side,
    quantityMode: args.intent.dispatchPayload.quantityMode,
    quantity: args.intent.requestedQuantity,
    orderType: args.intent.dispatchPayload.orderType,
    limitPrice: args.intent.dispatchPayload.limitPrice,
    stopPrice: args.intent.dispatchPayload.stopPrice,
    tif: args.intent.dispatchPayload.tif,
    stopLoss: {
      mode: args.intent.dispatchPayload.stopLossTicks != null ? "ticks" : "none",
      value: args.intent.dispatchPayload.stopLossTicks,
    },
    takeProfit: {
      mode: args.intent.dispatchPayload.takeProfitTicks != null ? "ticks" : "none",
      value: args.intent.dispatchPayload.takeProfitTicks,
    },
    timestamp: args.preview.sourceEvent.triggeredAt,
    comment: `KWANTIFY-TS-DRYRUN:${args.preview.groupId}:${args.intent.followerId}`,
  };
}

function updateFollowersForScenario(
  followerRecords: TradeSyncerFollowerRecord[],
  scenario: TradeSyncerSimulationScenario
): TradeSyncerFollowerRecord[] {
  const now = new Date().toISOString();

  if (scenario === "fanout_success") {
    return followerRecords.map((follower) => ({
      ...follower,
      healthState: "healthy" as const,
      currentDrift: null,
      lastDriftAt: follower.lastDriftAt,
      positionSnapshot: {
        ...follower.positionSnapshot,
        side: "long",
        quantity: Math.max(follower.positionSnapshot.quantity, 1),
        avgEntryPrice: follower.positionSnapshot.avgEntryPrice ?? 18452.5,
        state: "open",
        updatedAt: now,
      },
      protectionSnapshot: {
        ...follower.protectionSnapshot,
        stopLossState: "working",
        takeProfitState: "working",
        workingLegCount: 2,
        state: "protected",
      },
      repairHistory: [
        createFollowerRepairEvent({
          action: "fanout_success",
          outcome: "resolved",
          detail: "Follower matched the latest master fill and remains aligned with the group.",
          occurredAt: now,
        }),
        ...follower.repairHistory,
      ].slice(0, 8),
    }));
  }

  if (scenario === "flatten_followers") {
    return followerRecords.map((follower) => ({
      ...follower,
      healthState: "flattened" as const,
      currentDrift: null,
      lastDriftAt: follower.lastDriftAt,
      positionSnapshot: {
        ...follower.positionSnapshot,
        side: "flat",
        quantity: 0,
        avgEntryPrice: null,
        state: "flat",
        updatedAt: now,
      },
      protectionSnapshot: {
        ...follower.protectionSnapshot,
        stopLossState: "not_needed",
        takeProfitState: "not_needed",
        workingLegCount: 0,
        state: "none",
      },
      repairHistory: [
        createFollowerRepairEvent({
          action: "flatten_followers",
          outcome: "resolved",
          detail: "Follower exposure was flattened and held after the simulation requested a safety exit.",
          occurredAt: now,
        }),
        ...follower.repairHistory,
      ].slice(0, 8),
    }));
  }

  return followerRecords.map((follower, index) =>
    index === 0
      ? {
          ...follower,
          healthState: "drift_detected" as const,
          currentDrift: "Follower position/protection state diverged from the master and needs operator review.",
          lastDriftAt: now,
          positionSnapshot: {
            ...follower.positionSnapshot,
            state: follower.positionSnapshot.quantity > 0 ? "partial_exit" : "entry_working",
            updatedAt: now,
          },
          protectionSnapshot: {
            ...follower.protectionSnapshot,
            stopLossState: "missing",
            state: "missing",
          },
          repairHistory: [
            createFollowerRepairEvent({
              action: "drift_detected",
              outcome: "logged",
              detail: "Detected follower drift during fanout validation. Manual review or repair is now required.",
              occurredAt: now,
            }),
            ...follower.repairHistory,
          ].slice(0, 8),
        }
      : {
          ...follower,
          healthState: "monitoring" as const,
          positionSnapshot: {
            ...follower.positionSnapshot,
            updatedAt: now,
          },
          repairHistory: follower.repairHistory,
        }
  );
}

function updateFollowersForRepairAction(
  followerRecords: TradeSyncerFollowerRecord[],
  action: TradeSyncerRepairAction
): TradeSyncerFollowerRecord[] {
  const now = new Date().toISOString();

  return followerRecords.map((follower) => {
    if (action === "pause_group") {
      const nextHealthState: TradeSyncerFollowerRecord["healthState"] =
        follower.healthState === "healthy" ? "monitoring" : "repairing";
      return {
        ...follower,
        healthState: nextHealthState,
        positionSnapshot: {
          ...follower.positionSnapshot,
          state:
            follower.positionSnapshot.quantity > 0
              ? "open"
              : follower.positionSnapshot.state === "entry_working"
                ? "entry_working"
                : "flat",
          updatedAt: now,
        },
        repairHistory: [
          createFollowerRepairEvent({
            action: "pause_group",
            outcome: "in_progress",
            detail: "Follower has been placed under repair review while the group is paused.",
            occurredAt: now,
          }),
          ...follower.repairHistory,
        ].slice(0, 8),
      };
    }

    if (action === "restage_protection") {
      return {
        ...follower,
        healthState: "monitoring" as const,
        currentDrift: null,
        protectionSnapshot: {
          ...follower.protectionSnapshot,
          stopLossState: follower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
          takeProfitState: follower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
          workingLegCount: follower.positionSnapshot.quantity > 0 ? 2 : 0,
          lastRestagedAt: now,
          state: follower.positionSnapshot.quantity > 0 ? "restaging" : "none",
        },
        repairHistory: [
          createFollowerRepairEvent({
            action: "restage_protection",
            outcome: "resolved",
            detail: "Protection legs were restaged and follower monitoring has resumed.",
            occurredAt: now,
          }),
          ...follower.repairHistory,
        ].slice(0, 8),
      };
    }

    if (action === "flatten_followers") {
      return {
        ...follower,
        healthState: "flattened" as const,
        currentDrift: null,
        positionSnapshot: {
          ...follower.positionSnapshot,
          side: "flat",
          quantity: 0,
          avgEntryPrice: null,
          state: "flattening",
          updatedAt: now,
        },
        protectionSnapshot: {
          ...follower.protectionSnapshot,
          stopLossState: "not_needed",
          takeProfitState: "not_needed",
          workingLegCount: 0,
          state: "none",
        },
        repairHistory: [
          createFollowerRepairEvent({
            action: "flatten_followers",
            outcome: "resolved",
            detail: "Follower was flattened as part of the group-level drift safety action.",
            occurredAt: now,
          }),
          ...follower.repairHistory,
        ].slice(0, 8),
      };
    }

    return {
      ...follower,
      healthState: "healthy" as const,
      currentDrift: null,
      positionSnapshot: {
        ...follower.positionSnapshot,
        state: follower.positionSnapshot.quantity > 0 ? "open" : "flat",
        updatedAt: now,
      },
      protectionSnapshot: {
        ...follower.protectionSnapshot,
        stopLossState: follower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
        takeProfitState: follower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
        workingLegCount: follower.positionSnapshot.quantity > 0 ? 2 : 0,
        state: follower.positionSnapshot.quantity > 0 ? "protected" : "none",
      },
      repairHistory: [
        createFollowerRepairEvent({
          action: "mark_healthy",
          outcome: "resolved",
          detail: "Follower was revalidated and marked healthy after the repair cycle.",
          occurredAt: now,
        }),
        ...follower.repairHistory,
      ].slice(0, 8),
    };
  });
}

function deriveGroupRepairStateFromFollowers(
  followerRecords: TradeSyncerFollowerRecord[]
): TradeSyncerSyncGroupRecord["repairState"] {
  return followerRecords.some(
    (follower) => follower.healthState === "drift_detected" || follower.healthState === "repairing"
  )
    ? "manual_review"
    : "healthy";
}

function buildDashboardMetrics(snapshot: TradeSyncerStore): TradeSyncerOverviewMetric[] {
  return [
    {
      label: "Portfolio value",
      value: formatCurrency(snapshot.accounts.reduce((sum, account) => sum + account.equity, 0)),
      detail: "Combined equity across connected trade-sync accounts",
    },
    {
      label: "Masters",
      value: String(snapshot.syncGroups.length),
      detail: `${snapshot.syncGroups.filter((group) => group.status === "enabled").length} live lead account${snapshot.syncGroups.filter((group) => group.status === "enabled").length === 1 ? "" : "s"}`,
    },
    {
      label: "Slaves",
      value: String(countFollowers(snapshot.syncGroups)),
      detail: `${snapshot.syncGroups.filter((group) => group.status === "enabled").length} active sync group${snapshot.syncGroups.filter((group) => group.status === "enabled").length === 1 ? "" : "s"}`,
    },
    {
      label: "Open positions",
      value: String(countOpenPositions(snapshot.syncGroups)),
      detail: `${snapshot.syncGroups.filter((group) => group.openPositions > 0).length} group${snapshot.syncGroups.filter((group) => group.openPositions > 0).length === 1 ? "" : "s"} currently copying`,
    },
  ];
}

function buildAccountMetrics(snapshot: TradeSyncerStore): TradeSyncerOverviewMetric[] {
  const healthy = snapshot.accounts.filter((account) => account.connectionState === "connected").length;
  const review = snapshot.accounts.filter((account) => account.connectionState !== "connected").length;
  const symbolCount = snapshot.accounts.reduce((total, account) => total + account.enabledSymbols.length, 0);

  return [
    {
      label: "Connected accounts",
      value: String(snapshot.accounts.length),
      detail: `${snapshot.accounts.filter((account) => account.venue === "tradovate").length} Tradovate, ${snapshot.accounts.filter((account) => account.venue === "rithmic").length} Rithmic`,
    },
    {
      label: "Healthy",
      value: String(healthy),
      detail: review ? `${review} need review or re-auth` : "All linked accounts are healthy",
    },
    {
      label: "Enabled symbols",
      value: String(symbolCount),
      detail: "Across all active accounts",
    },
    {
      label: "Protection rules",
      value: String(snapshot.templates.filter((template) => template.copyStopLoss || template.copyTakeProfit).length),
      detail: "Template profiles carrying protection logic",
    },
  ];
}

function buildCopierMetrics(snapshot: TradeSyncerStore): TradeSyncerOverviewMetric[] {
  return [
    { label: "Copier Health", value: snapshot.syncGroups.some((group) => group.repairState === "manual_review") ? "REVIEW" : "UP", detail: "Calculated from group repair state" },
    { label: "Trades Copied Today", value: String(snapshot.logs.filter((log) => log.severity === "success").length), detail: "Successful copy events in the current journal" },
    { label: "Follower Match Rate", value: computeFollowerMatchRate(snapshot.syncGroups), detail: "Healthy or monitored followers versus total attached followers" },
    { label: "Median Copy Lag", value: `${computeMedianLag(snapshot.syncGroups)}ms`, detail: "Average across live sync groups" },
  ];
}

function cloneFollowerRecords(
  followerRecords: AddSyncGroupPayload["followerRecords"]
): TradeSyncerFollowerRecord[] {
  return (followerRecords ?? []).map((follower) => ({
    id: `ts_follower_${crypto.randomUUID()}`,
    accountId: follower.accountId,
    riskType: follower.riskType,
    riskSetting: follower.riskSetting,
    templateId: follower.templateId ?? null,
    status: follower.status ?? "enabled",
    healthState: "monitoring" as const,
    currentDrift: null,
    lastDriftAt: null,
    positionSnapshot: createDefaultPositionSnapshot(),
    protectionSnapshot: createDefaultProtectionSnapshot(),
    override: null,
    repairHistory: [],
  }));
}

export async function getTradeSyncerOverview(): Promise<TradeSyncerOverview> {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const futuresProfiles = await getFuturesManagedProfileSnapshot();
  const accountMap = new Map(snapshot.accounts.map((account) => [account.id, account.label]));
  const followerRepairView: TradeSyncerFollowerRepairView[] = snapshot.syncGroups.flatMap((group) =>
    group.followerRecords.map((follower) => {
      const latestRepair = follower.repairHistory[0] ?? null;
      return {
        groupId: group.id,
        groupLabel: group.label,
        followerId: follower.id,
        accountId: follower.accountId,
        accountLabel: accountMap.get(follower.accountId) ?? follower.accountId,
        healthState: follower.healthState,
        currentDrift: follower.currentDrift,
        lastDriftAt: follower.lastDriftAt,
        positionState: follower.positionSnapshot.state,
        positionQuantity: follower.positionSnapshot.quantity,
        positionSide: follower.positionSnapshot.side,
        protectionState: follower.protectionSnapshot.state,
        protectionLegCount: follower.protectionSnapshot.workingLegCount,
        latestRepairAction: latestRepair?.action ?? null,
        latestRepairOutcome: latestRepair?.outcome ?? null,
        latestRepairDetail: latestRepair?.detail ?? null,
        latestRepairAt: latestRepair?.occurredAt ?? null,
      };
    })
  );

  return {
    descriptor: getTradeSyncerStoreDescriptor(),
    updatedAt: snapshot.updatedAt,
    accounts: snapshot.accounts,
    templates: snapshot.templates,
    syncGroups: snapshot.syncGroups,
    logs: snapshot.logs,
    auditTrail: snapshot.auditTrail,
    dashboardMetrics: buildDashboardMetrics(snapshot),
    accountMetrics: buildAccountMetrics(snapshot),
    copierMetrics: buildCopierMetrics(snapshot),
    followerRepairView,
    managedFuturesAccounts: futuresProfiles.accounts,
    managedFuturesRoutingProfiles: futuresProfiles.routingProfiles,
    notes: [
      "Trade Syncer now has a persisted local store for accounts, templates, sync groups, and logs.",
      "This is still a product-foundation backend: enough to drive UI and simulate state, but not yet a live broker-copy execution engine.",
    ],
  };
}

export async function appendTradeSyncerLog(
  entry: Omit<TradeSyncerLogEntry, "id" | "occurredAt"> & { occurredAt?: string }
) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    logs: [createLogEntry(entry), ...snapshot.logs].slice(0, 120),
    auditTrail: [
      createAuditEntry("log_recorded", `Trade Syncer log recorded for ${entry.groupId ?? "no group"}: ${entry.title}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  return nextSnapshot.logs[0] ?? null;
}

export async function addTradeSyncerAccount(payload: AddAccountPayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();

  const nextAccount: TradeSyncerAccountRecord = {
    id: `ts_account_${crypto.randomUUID()}`,
    label: payload.label,
    brokerAccountRef: payload.brokerAccountRef,
    venue: payload.venue,
    environment: payload.environment,
    managedFuturesAccountId: null,
    connectionState: payload.connectionState ?? "draft",
    syncStatus: payload.syncStatus ?? "review",
    balance: payload.balance ?? 0,
    equity: payload.equity ?? payload.balance ?? 0,
    timezone: payload.timezone ?? "Broker local",
    enabledSymbols: payload.enabledSymbols ?? [],
    healthNote: payload.healthNote ?? "Newly linked account awaiting deeper health checks.",
    lastHeartbeatAt: null,
  };

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    accounts: [nextAccount, ...snapshot.accounts],
    auditTrail: [
      createAuditEntry("account_added", `Trade Syncer account ${payload.label} was added for ${payload.venue}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  await appendTradeSyncerLog({
    groupId: null,
    accountId: nextAccount.id,
    severity: "info",
    title: "Account added",
    detail: `${payload.label} was linked into Trade Syncer in ${payload.environment} mode.`,
    status: "draft",
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    account: nextAccount,
  };
}

export async function bindTradeSyncerAccountToManagedFutures(payload: BindManagedFuturesAccountPayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingAccount = snapshot.accounts.find((account) => account.id === payload.accountId);
  if (!existingAccount) {
    throw new Error("Trade Syncer account was not found.");
  }

  const futuresProfiles = await getFuturesManagedProfileSnapshot();
  const managedAccount =
    payload.managedFuturesAccountId === null
      ? null
      : futuresProfiles.accounts.find((account) => account.id === payload.managedFuturesAccountId) ?? null;

  if (payload.managedFuturesAccountId && !managedAccount) {
    throw new Error("Managed futures account was not found.");
  }

  if (managedAccount && managedAccount.venue !== existingAccount.venue) {
    throw new Error("Trade Syncer account venue must match the managed futures account venue.");
  }

  const managedRoute =
    managedAccount
      ? futuresProfiles.routingProfiles.find((route) => route.id === managedAccount.routeProfileIds[0]) ?? null
      : null;

  const nextAccounts = snapshot.accounts.map((account) =>
    account.id === payload.accountId
      ? {
          ...account,
          managedFuturesAccountId: payload.managedFuturesAccountId,
          healthNote: managedAccount
            ? `Bound to managed futures lane ${managedAccount.label}${managedRoute ? ` via ${managedRoute.label}` : ""}.`
            : "Managed futures lane removed. Rebind this account before relying on dispatch preview.",
        }
      : account
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    accounts: nextAccounts,
    auditTrail: [
      createAuditEntry(
        "account_updated",
        managedAccount
          ? `Trade Syncer account ${existingAccount.label} was bound to managed futures lane ${managedAccount.label}.`
          : `Trade Syncer account ${existingAccount.label} had its managed futures binding cleared.`
      ),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  await appendTradeSyncerLog({
    groupId: null,
    accountId: existingAccount.id,
    severity: managedAccount ? "success" : "warning",
    title: managedAccount ? "Managed futures lane bound" : "Managed futures lane cleared",
    detail: managedAccount
      ? `${existingAccount.label} now dispatches through ${managedAccount.label}${managedRoute ? ` / ${managedRoute.label}` : ""}.`
      : `${existingAccount.label} no longer has a managed futures lane attached.`,
    status: managedAccount ? "bound" : "unbound",
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    account: nextAccounts.find((account) => account.id === payload.accountId) ?? null,
    managedAccount,
    managedRoute,
  };
}

export async function addTradeSyncerTemplate(payload: AddTemplatePayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();

  const nextTemplate: TradeSyncerTemplateRecord = {
    id: `ts_template_${crypto.randomUUID()}`,
    label: payload.label,
    status: payload.status ?? "draft",
    riskType: payload.riskType,
    riskSetting: payload.riskSetting,
    copyStopLoss: true,
    copyTakeProfit: true,
    copyPendingOrders: false,
    copyExpiryTime: false,
    strictClose: false,
    contractAlignment: true,
    customComment: "KWANTIFY-NEW",
    delayMode: "immediate",
    allowedSymbols: [],
    commentFilter: null,
    directionFilter: "both",
    masterLotRange: "",
  };

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    templates: [nextTemplate, ...snapshot.templates],
    auditTrail: [
      createAuditEntry("template_added", `Trade Syncer template ${payload.label} was created.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    template: nextTemplate,
  };
}

export async function addTradeSyncerSyncGroup(payload: AddSyncGroupPayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const leadAccount = snapshot.accounts.find((account) => account.id === payload.leadAccountId);
  if (!leadAccount) {
    throw new Error("Lead account was not found.");
  }

  const nextGroup: TradeSyncerSyncGroupRecord = {
    id: `ts_group_${crypto.randomUUID()}`,
    label: payload.label,
    leadAccountId: payload.leadAccountId,
    executionModeId: payload.executionModeId,
    status: payload.status ?? "disabled",
    followerRecords: cloneFollowerRecords(payload.followerRecords),
    symbolMappings: [],
    openPositions: 0,
    medianCopyLagMs: 0,
    repairState: "monitoring",
    lastEventAt: null,
  };

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: [nextGroup, ...snapshot.syncGroups],
    auditTrail: [
      createAuditEntry("sync_group_added", `Trade Syncer group ${payload.label} was created.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  await appendTradeSyncerLog({
    groupId: nextGroup.id,
    accountId: leadAccount.id,
    severity: "info",
    title: "Sync group created",
    detail: `${payload.label} was created with ${nextGroup.followerRecords.length} follower${nextGroup.followerRecords.length === 1 ? "" : "s"}.`,
    status: nextGroup.status,
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: nextGroup,
  };
}

export async function updateTradeSyncerGroupStatus(payload: {
  groupId: string;
  status: TradeSyncerGroupStatus;
}) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? {
          ...group,
          status: payload.status,
          repairState: payload.status === "enabled" ? "healthy" : group.repairState,
          lastEventAt: new Date().toISOString(),
        }
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Trade Syncer group ${existingGroup.label} status changed to ${payload.status}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingGroup.leadAccountId,
    severity: payload.status === "enabled" ? "success" : "warning",
    title: "Sync group status updated",
    detail: `${existingGroup.label} moved to ${payload.status}.`,
    status: payload.status,
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: nextGroups.find((group) => group.id === payload.groupId) ?? null,
  };
}

export async function addTradeSyncerFollower(payload: AddFollowerPayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }

  const followerAccount = snapshot.accounts.find((account) => account.id === payload.accountId);
  if (!followerAccount) {
    throw new Error("Follower account was not found.");
  }

  const duplicate = existingGroup.followerRecords.find((follower) => follower.accountId === payload.accountId);
  if (duplicate) {
    throw new Error("That follower account is already attached to the group.");
  }

  const nextFollower: TradeSyncerFollowerRecord = {
    id: `ts_follower_${crypto.randomUUID()}`,
    accountId: payload.accountId,
    riskType: payload.riskType,
    riskSetting: payload.riskSetting,
    templateId: payload.templateId ?? null,
    status: payload.status ?? "enabled",
    healthState: "monitoring" as const,
    currentDrift: null,
    lastDriftAt: null,
    positionSnapshot: createDefaultPositionSnapshot(followerAccount.enabledSymbols[0] ?? "MNQ"),
    protectionSnapshot: createDefaultProtectionSnapshot(),
    override: null,
    repairHistory: [
      createFollowerRepairEvent({
        action: "follower_attached",
        outcome: "logged",
        detail: `${followerAccount.label} joined the sync group and is awaiting the next master lifecycle event.`,
      }),
    ],
  };

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? {
          ...group,
          followerRecords: [...group.followerRecords, nextFollower],
          lastEventAt: new Date().toISOString(),
        }
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Follower ${followerAccount.label} was attached to ${existingGroup.label}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: payload.accountId,
    severity: "info",
    title: "Follower attached",
    detail: `${followerAccount.label} joined ${existingGroup.label} with ${payload.riskType} at ${payload.riskSetting}.`,
    status: "follower_attached",
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: nextGroups.find((group) => group.id === payload.groupId) ?? null,
    follower: nextFollower,
    logEntry: entry,
  };
}

export async function updateTradeSyncerFollowerOverride(payload: UpdateFollowerOverridePayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }

  const existingFollower = existingGroup.followerRecords.find((follower) => follower.id === payload.followerId);
  if (!existingFollower) {
    throw new Error("Trade Syncer follower was not found.");
  }

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? {
          ...group,
          followerRecords: group.followerRecords.map((follower) =>
            follower.id === payload.followerId
              ? {
                  ...follower,
                  riskType: payload.riskType,
                  riskSetting: payload.riskSetting,
                  healthState: "monitoring" as const,
                  override: {
                    ...(follower.override ?? {}),
                    ...(payload.copyStopLoss !== undefined ? { copyStopLoss: payload.copyStopLoss } : {}),
                    ...(payload.copyTakeProfit !== undefined ? { copyTakeProfit: payload.copyTakeProfit } : {}),
                    ...(payload.copyPendingOrders !== undefined ? { copyPendingOrders: payload.copyPendingOrders } : {}),
                    ...(payload.delayMode ? { delayMode: payload.delayMode } : {}),
                  },
                  repairHistory: [
                    createFollowerRepairEvent({
                      action: "override_updated",
                      outcome: "logged",
                      detail: "Follower override and sizing policy were changed. Monitor the next copied trade closely.",
                    }),
                    ...follower.repairHistory,
                  ].slice(0, 8),
                }
              : follower
          ),
          lastEventAt: new Date().toISOString(),
        }
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Follower override updated in ${existingGroup.label}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingFollower.accountId,
    severity: "info",
    title: "Follower override updated",
    detail: `${existingGroup.label} updated follower sizing/policy overrides.`,
    status: "override_updated",
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: nextGroups.find((group) => group.id === payload.groupId) ?? null,
    follower: nextGroups
      .find((group) => group.id === payload.groupId)
      ?.followerRecords.find((follower) => follower.id === payload.followerId) ?? null,
    logEntry: entry,
  };
}

export async function updateTradeSyncerSymbolMappings(payload: UpdateSymbolMappingsPayload) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }

  const normalizedLeader = payload.leaderSymbol.trim().toUpperCase();
  const normalizedFollower = payload.followerSymbol.trim().toUpperCase();
  if (!normalizedLeader || !normalizedFollower) {
    throw new Error("Leader and follower symbols are required.");
  }

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? {
          ...group,
          symbolMappings: [
            ...group.symbolMappings.filter((mapping) => mapping.leaderSymbol !== normalizedLeader),
            { leaderSymbol: normalizedLeader, followerSymbol: normalizedFollower },
          ],
          lastEventAt: new Date().toISOString(),
        }
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Symbol mapping ${normalizedLeader} -> ${normalizedFollower} updated in ${existingGroup.label}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingGroup.leadAccountId,
    severity: "info",
    title: "Symbol mapping updated",
    detail: `${existingGroup.label} now maps ${normalizedLeader} to ${normalizedFollower}.`,
    status: "symbol_mapping_updated",
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: nextGroups.find((group) => group.id === payload.groupId) ?? null,
    logEntry: entry,
  };
}

export async function deleteTradeSyncerSyncGroup(payload: { groupId: string }) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }

  const nextGroups = snapshot.syncGroups.filter((group) => group.id !== payload.groupId);
  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Trade Syncer group ${existingGroup.label} was deleted.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: payload.groupId,
    accountId: existingGroup.leadAccountId,
    severity: "warning",
    title: "Sync group deleted",
    detail: `${existingGroup.label} was removed from the Trade Syncer engine.`,
    status: "group_deleted",
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    deletedGroupId: payload.groupId,
    logEntry: entry,
  };
}

export async function previewTradeSyncerDispatch(payload: {
  sourceEvent: TradeSyncerMasterTradeEvent;
}): Promise<TradeSyncerDispatchPreview> {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const futuresProfiles = await getFuturesManagedProfileSnapshot();

  const group = snapshot.syncGroups.find((item) => item.id === payload.sourceEvent.groupId);
  if (!group) {
    throw new Error("Trade Syncer group was not found.");
  }

  const leadAccount = snapshot.accounts.find((account) => account.id === group.leadAccountId);
  if (!leadAccount) {
    throw new Error("Trade Syncer lead account was not found.");
  }

  const accountMap = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const templateMap = new Map(snapshot.templates.map((template) => [template.id, template]));
  const managedAccounts = futuresProfiles.accounts;
  const managedRoutes = futuresProfiles.routingProfiles;

  const intents: TradeSyncerFollowerDispatchIntent[] = group.followerRecords.map((follower) => {
    const followerAccount = accountMap.get(follower.accountId);
    const followerLabel = followerAccount?.label ?? follower.accountId;
    const warnings: string[] = [];
    const symbolMapping =
      group.symbolMappings.find(
        (mapping) => mapping.leaderSymbol.toUpperCase() === payload.sourceEvent.symbol.trim().toUpperCase()
      ) ?? null;
    const followerSymbol = symbolMapping?.followerSymbol ?? null;
    const template = follower.templateId ? templateMap.get(follower.templateId) ?? null : null;
    const policy = resolveFollowerProtectionPolicy({ template, follower });
    const quantity = deriveFollowerQuantity({
      leaderQuantity: payload.sourceEvent.quantity,
      follower,
    });
    const explicitManagedAccount =
      followerAccount?.managedFuturesAccountId
        ? managedAccounts.find((account) => account.id === followerAccount.managedFuturesAccountId) ?? null
        : null;
    const managedAccount =
      explicitManagedAccount ??
      managedAccounts.find(
        (account) =>
          account.venue === followerAccount?.venue &&
          account.brokerAccountRef &&
          followerAccount?.brokerAccountRef &&
          account.brokerAccountRef === followerAccount.brokerAccountRef
      ) ??
      null;
    const managedRoute =
      (managedAccount
        ? managedRoutes.find((route) => route.id === managedAccount.routeProfileIds[0]) ?? null
        : null) ??
      managedRoutes.find((route) => route.venue === followerAccount?.venue) ??
      null;

    let readiness: TradeSyncerFollowerDispatchIntent["readiness"] = "ready";
    let readinessReason = "Follower can be translated into a broker-specific futures dispatch intent.";

    if (!followerAccount) {
      readiness = "blocked";
      readinessReason = "Follower account record is missing from Trade Syncer.";
    } else if (!managedRoute) {
      readiness = "blocked";
      readinessReason = "No futures route profile exists yet for this follower venue.";
    } else if (group.status !== "enabled") {
      readiness = "blocked";
      readinessReason = `Group is ${group.status.replaceAll("_", " ")} and should not launch fresh follower entries.`;
    } else if (follower.status !== "enabled") {
      readiness = "blocked";
      readinessReason = `Follower is ${follower.status.replaceAll("_", " ")} and should not launch fresh entries.`;
    } else if (!followerSymbol) {
      readiness = "blocked";
      readinessReason = `No symbol mapping exists for ${payload.sourceEvent.symbol}.`;
    } else if (!quantity.requestedQuantity || quantity.blocked) {
      readiness = "blocked";
      readinessReason = "Follower sizing could not be translated into a valid whole-contract futures quantity.";
    }

    if (follower.healthState !== "healthy" && follower.healthState !== "monitoring") {
      warnings.push(`Follower health is ${follower.healthState.replaceAll("_", " ")}.`);
      if (readiness === "ready") {
        readiness = "review";
        readinessReason = "Follower needs repair review before live dispatch should be trusted.";
      }
    }

    if (followerAccount?.connectionState !== "connected") {
      warnings.push(`Account connection state is ${followerAccount?.connectionState ?? "missing"}.`);
      if (readiness === "ready") {
        readiness = "review";
        readinessReason = "Broker account is not fully connected yet.";
      }
    }

    if (followerAccount?.syncStatus !== "enabled") {
      warnings.push(`Account sync status is ${followerAccount?.syncStatus ?? "missing"}.`);
      if (readiness === "ready") {
        readiness = "review";
        readinessReason = "Follower account is not in a fully enabled sync state.";
      }
    }

    if (followerAccount?.managedFuturesAccountId && !explicitManagedAccount) {
      warnings.push("Trade Syncer account points at a managed futures lane that is missing from the managed store.");
      if (readiness === "ready") {
        readiness = "review";
        readinessReason = "The explicit managed futures binding is stale and needs to be repaired.";
      }
    } else if (!managedAccount) {
      warnings.push("No managed futures account binding matched this follower brokerAccountRef yet.");
      if (readiness === "ready") {
        readiness = "review";
        readinessReason = "A venue route exists, but managed futures account binding is still missing.";
      }
    }

    if (quantity.review && readiness === "ready") {
      readiness = "review";
      readinessReason = "Follower quantity is only an approximate preview and still needs venue-aware sizing math.";
    }

    if (!policy.copyPendingOrders && payload.sourceEvent.orderType !== "market") {
      warnings.push("Follower policy does not copy pending orders, so non-market master orders would need downgrading or rejection.");
      if (readiness === "ready") {
        readiness = "review";
        readinessReason = "Pending-order policy conflicts with the source master event.";
      }
    }

    if (!managedRoute?.supportsBrackets && (policy.copyStopLoss || policy.copyTakeProfit)) {
      warnings.push("Selected route does not advertise full bracket support.");
    }

    const dispatchPayload =
      followerAccount && managedRoute && followerSymbol && quantity.requestedQuantity
        ? {
            venue: followerAccount.venue,
            accountId: managedAccount?.id ?? null,
            symbol: followerSymbol,
            side: payload.sourceEvent.side,
            quantityMode: "fixed_contracts" as const,
            quantity: quantity.requestedQuantity,
            orderType: payload.sourceEvent.orderType,
            tif: payload.sourceEvent.tif,
            limitPrice: payload.sourceEvent.limitPrice,
            stopPrice: payload.sourceEvent.stopPrice,
            stopLossTicks: policy.copyStopLoss ? payload.sourceEvent.stopLossTicks : null,
            takeProfitTicks: policy.copyTakeProfit ? payload.sourceEvent.takeProfitTicks : null,
          }
        : null;

    return {
      followerId: follower.id,
      followerLabel,
      venue: followerAccount?.venue ?? "tradovate",
      brokerAccountRef: followerAccount?.brokerAccountRef ?? "missing",
      groupStatus: group.status,
      followerStatus: follower.status,
      healthState: follower.healthState,
      executionModeId: group.executionModeId,
      readiness,
      readinessReason,
      warnings,
      routeProfileId: managedRoute?.id ?? null,
      routeLabel: managedRoute?.label ?? null,
      managedAccountId: managedAccount?.id ?? null,
      managedAccountLabel: managedAccount?.label ?? null,
      followerSymbol,
      requestedQuantity: quantity.requestedQuantity,
      quantityDetail: quantity.quantityDetail,
      copyStopLoss: policy.copyStopLoss,
      copyTakeProfit: policy.copyTakeProfit,
      copyPendingOrders: policy.copyPendingOrders,
      dispatchPayload,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceEvent: payload.sourceEvent,
    groupId: group.id,
    groupLabel: group.label,
    leadAccountId: leadAccount.id,
    leadAccountLabel: leadAccount.label,
    readyFollowers: intents.filter((intent) => intent.readiness === "ready").length,
    reviewFollowers: intents.filter((intent) => intent.readiness === "review").length,
    blockedFollowers: intents.filter((intent) => intent.readiness === "blocked").length,
    intents,
    notes: [
      "Dispatch Preview is the first honest bridge from Trade Syncer groups into broker-specific futures intents.",
      "This preview does not place trades yet; it shows whether each follower can currently translate into a Tradovate or Rithmic dispatch payload.",
      "Followers in review or blocked state should be repaired or fully bound into the futures connector stack before live fanout is trusted.",
    ],
  };
}

export async function runTradeSyncerDispatchDryRun(payload: {
  sourceEvent: TradeSyncerMasterTradeEvent;
}): Promise<TradeSyncerDispatchDryRunResult> {
  const preview = await previewTradeSyncerDispatch(payload);

  const intents: TradeSyncerFollowerDispatchDryRun[] = await Promise.all(
    preview.intents.map(async (intent) => {
      if (intent.readiness !== "ready") {
        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          dryRunState: intent.readiness === "blocked" ? "blocked" : "review",
          dryRunReason: intent.readinessReason,
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: null,
          warnings: intent.warnings,
          requestBody: null,
          responseBody: null,
        };
      }

      const signal = buildTradeSyncerDryRunSignal({ preview, intent });
      if (!signal) {
        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          dryRunState: "failed",
          dryRunReason: "Trade Syncer could not build a valid futures signal packet for this follower.",
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: null,
          warnings: intent.warnings,
          requestBody: null,
          responseBody: null,
        };
      }

      if (intent.venue === "tradovate") {
        const result = await previewTradovateOrder(signal);
        if (!result.ok) {
          return {
            followerId: intent.followerId,
            followerLabel: intent.followerLabel,
            venue: intent.venue,
            readiness: intent.readiness,
            dryRunState: "failed",
            dryRunReason: result.error ?? "Tradovate preview failed during dry-run handoff.",
            routeLabel: intent.routeLabel,
            managedAccountLabel: intent.managedAccountLabel,
            signalId: signal.signalId,
            warnings: intent.warnings,
            requestBody: toRecord(signal as unknown),
            responseBody: null,
          };
        }
        const previewResult = result.preview;
        if (!previewResult) {
          return {
            followerId: intent.followerId,
            followerLabel: intent.followerLabel,
            venue: intent.venue,
            readiness: intent.readiness,
            dryRunState: "failed",
            dryRunReason: "Tradovate dry-run returned no preview payload.",
            routeLabel: intent.routeLabel,
            managedAccountLabel: intent.managedAccountLabel,
            signalId: signal.signalId,
            warnings: intent.warnings,
            requestBody: toRecord(signal as unknown),
            responseBody: null,
          };
        }

        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          dryRunState: "preview_ready",
          dryRunReason: `Tradovate preview resolved ${previewResult.endpoint} with ${
            previewResult.usesBrackets ? "native bracket" : "single-order"
          } semantics.`,
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: signal.signalId,
          warnings: [...intent.warnings, ...previewResult.notes],
          requestBody: previewResult.body,
          responseBody: {
            endpoint: previewResult.endpoint,
            usesBrackets: previewResult.usesBrackets,
            failureReasons: previewResult.failureReasons,
          },
        };
      }

      if (intent.venue === "rithmic") {
        const result = await previewRithmicOrder(signal);
        if (!result.ok) {
          return {
            followerId: intent.followerId,
            followerLabel: intent.followerLabel,
            venue: intent.venue,
            readiness: intent.readiness,
            dryRunState: "failed",
            dryRunReason: result.error ?? "Rithmic preview failed during dry-run handoff.",
            routeLabel: intent.routeLabel,
            managedAccountLabel: intent.managedAccountLabel,
            signalId: signal.signalId,
            warnings: intent.warnings,
            requestBody: toRecord(signal as unknown),
            responseBody: null,
          };
        }
        const previewResult = result.preview;
        if (!previewResult) {
          return {
            followerId: intent.followerId,
            followerLabel: intent.followerLabel,
            venue: intent.venue,
            readiness: intent.readiness,
            dryRunState: "failed",
            dryRunReason: "Rithmic dry-run returned no preview payload.",
            routeLabel: intent.routeLabel,
            managedAccountLabel: intent.managedAccountLabel,
            signalId: signal.signalId,
            warnings: intent.warnings,
            requestBody: toRecord(signal as unknown),
            responseBody: null,
          };
        }

        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          dryRunState: result.binding.error ? "review" : "staged",
          dryRunReason:
            result.binding.error ??
            `Rithmic preview resolved ${previewResult.preferredFlavor.replaceAll("_", " ")} handoff intent for the managed route.`,
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: signal.signalId,
          warnings: [...intent.warnings, ...previewResult.notes],
          requestBody: previewResult.body,
          responseBody: {
            preferredFlavor: previewResult.preferredFlavor,
            selectedEnvironment: previewResult.selectedEnvironment,
            accountReference: previewResult.accountReference,
            binding: previewResult.binding,
            failureReasons: previewResult.failureReasons,
          },
        };
      }

      return {
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        readiness: intent.readiness,
        dryRunState: "blocked",
        dryRunReason: `Dry-run handoff is not implemented yet for ${intent.venue}.`,
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: signal.signalId,
        warnings: intent.warnings,
        requestBody: toRecord(signal as unknown),
        responseBody: null,
      };
    })
  );

  const result: TradeSyncerDispatchDryRunResult = {
    generatedAt: new Date().toISOString(),
    sourceEvent: preview.sourceEvent,
    groupId: preview.groupId,
    groupLabel: preview.groupLabel,
    readyFollowers: preview.readyFollowers,
    reviewFollowers: intents.filter((intent) => intent.dryRunState === "review").length,
    blockedFollowers: intents.filter((intent) => intent.dryRunState === "blocked").length,
    failedFollowers: intents.filter((intent) => intent.dryRunState === "failed").length,
    stagedFollowers: intents.filter(
      (intent) => intent.dryRunState === "preview_ready" || intent.dryRunState === "staged"
    ).length,
    intents,
    notes: [
      "Dispatch Dry Run hands ready Trade Syncer follower intents into the existing futures connector preview/staging seams without placing live orders.",
      "Tradovate currently resolves through validated order preview only; Rithmic resolves through the futures preview/staging seam.",
      "Followers still in review, blocked, or failed state should not be promoted into real copied-order dispatch until their route, sizing, and health issues are cleared.",
    ],
  };

  const snapshot = await getTradeSyncerStoreSnapshot();
  const group = snapshot.syncGroups.find((item) => item.id === preview.groupId);
  if (group) {
    const stagedCount = result.stagedFollowers;
    const warningCount = result.reviewFollowers + result.blockedFollowers + result.failedFollowers;
    const severity: TradeSyncerLogEntry["severity"] = warningCount > 0 ? "warning" : "success";
    await appendTradeSyncerLog({
      groupId: group.id,
      accountId: group.leadAccountId,
      severity,
      title: warningCount > 0 ? "Dispatch dry run completed with warnings" : "Dispatch dry run staged cleanly",
      detail:
        warningCount > 0
          ? `${preview.groupLabel} dry-run staged ${stagedCount} follower handoff${stagedCount === 1 ? "" : "s"} and left ${warningCount} follower${warningCount === 1 ? "" : "s"} in review/blocked/failed state.`
          : `${preview.groupLabel} dry-run handed ${stagedCount} follower intent${stagedCount === 1 ? "" : "s"} cleanly into the futures connector preview seam.`,
      status: "dispatch_dry_run",
    });
  }

  return result;
}

export async function runTradeSyncerDispatchStage(payload: {
  sourceEvent: TradeSyncerMasterTradeEvent;
}): Promise<TradeSyncerDispatchStageResult> {
  const preview = await previewTradeSyncerDispatch(payload);

  const intents: TradeSyncerFollowerDispatchStageResult[] = await Promise.all(
    preview.intents.map(async (intent) => {
      if (intent.readiness !== "ready") {
        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          stageState: intent.readiness === "blocked" ? "blocked" : "review",
          stageReason: intent.readinessReason,
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: null,
          warnings: intent.warnings,
          requestBody: null,
          responseBody: null,
        };
      }

      const signal = buildTradeSyncerDryRunSignal({ preview, intent });
      if (!signal) {
        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          stageState: "failed",
          stageReason: "Trade Syncer could not build a valid futures signal packet for this follower.",
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: null,
          warnings: intent.warnings,
          requestBody: null,
          responseBody: null,
        };
      }

      const handoff = await ingestFuturesConnectorSignal(signal);
      if (!handoff.ok) {
        return {
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          readiness: intent.readiness,
          stageState: "failed",
          stageReason: handoff.error ?? "Futures connector queue handoff failed.",
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: signal.signalId,
          warnings: intent.warnings,
          requestBody: toRecord(signal as unknown),
          responseBody: null,
        };
      }

      return {
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        readiness: intent.readiness,
        stageState: "queued",
        stageReason: `Copied-order intent queued into the futures connector inbox for ${handoff.route?.label ?? intent.routeLabel ?? "the selected managed route"}.`,
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: signal.signalId,
        warnings: intent.warnings,
        requestBody: toRecord(signal as unknown),
        responseBody: {
          commandId: handoff.command?.id ?? null,
          commandStatus: handoff.command?.status ?? null,
          routeProfileId: handoff.route?.id ?? null,
          routeLabel: handoff.route?.label ?? null,
          riskProfileId: handoff.risk?.id ?? null,
          riskProfileLabel: handoff.risk?.label ?? null,
          accountId: handoff.command?.accountId ?? null,
          venue: handoff.command?.signal.venue ?? intent.venue,
        },
      };
    })
  );

  const result: TradeSyncerDispatchStageResult = {
    generatedAt: new Date().toISOString(),
    sourceEvent: preview.sourceEvent,
    groupId: preview.groupId,
    groupLabel: preview.groupLabel,
    readyFollowers: preview.readyFollowers,
    reviewFollowers: intents.filter((intent) => intent.stageState === "review").length,
    blockedFollowers: intents.filter((intent) => intent.stageState === "blocked").length,
    failedFollowers: intents.filter((intent) => intent.stageState === "failed").length,
    queuedFollowers: intents.filter((intent) => intent.stageState === "queued").length,
    intents,
    notes: [
      "Dispatch Stage is the first non-live copied-order path: it only hands ready follower intents into the futures connector inbox/queue.",
      "No live broker submit happens here. The result proves Trade Syncer can translate a master event into queueable follower commands inside the managed futures backbone.",
      "Followers left in review, blocked, or failed state still need routing, sizing, or health fixes before real copy execution is trusted.",
    ],
  };

  const snapshot = await getTradeSyncerStoreSnapshot();
  const group = snapshot.syncGroups.find((item) => item.id === preview.groupId);
  if (group) {
    const issueCount = result.reviewFollowers + result.blockedFollowers + result.failedFollowers;
    const severity: TradeSyncerLogEntry["severity"] = issueCount > 0 ? "warning" : "success";
    await appendTradeSyncerLog({
      groupId: group.id,
      accountId: group.leadAccountId,
      severity,
      title: issueCount > 0 ? "Copied-order staging completed with issues" : "Copied-order staging queued cleanly",
      detail:
        issueCount > 0
          ? `${preview.groupLabel} queued ${result.queuedFollowers} follower copied-order handoff${result.queuedFollowers === 1 ? "" : "s"} and left ${issueCount} follower${issueCount === 1 ? "" : "s"} in review/blocked/failed state.`
          : `${preview.groupLabel} queued ${result.queuedFollowers} follower copied-order handoff${result.queuedFollowers === 1 ? "" : "s"} into the futures connector inbox.`,
      status: "dispatch_staged",
    });
  }

  return result;
}

export async function runTradeSyncerDispatchExecutionSimulation(payload: {
  sourceEvent: TradeSyncerMasterTradeEvent;
  scenario?: TradeSyncerDispatchExecutionScenario;
}): Promise<TradeSyncerDispatchExecutionSimulationResult> {
  const stage = await runTradeSyncerDispatchStage(payload);
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === stage.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found after copied-order staging.");
  }

  const scenario = payload.scenario ?? "happy_path";
  const now = new Date().toISOString();
  const accountMap = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const queuedIntents = stage.intents.filter((intent) => intent.stageState === "queued");
  const queuedIntentMap = new Map(queuedIntents.map((intent) => [intent.followerId, intent]));
  const scenarioLabelMap: Record<TradeSyncerDispatchExecutionScenario, string> = {
    happy_path: "happy path",
    reject_branch: "reject branch",
    partial_fill_branch: "partial-fill branch",
    drift_after_fill: "drift-after-fill branch",
  };

  const simulationIntentMap = new Map<
    string,
    {
      finalState: TradeSyncerFollowerDispatchExecutionSimulationResult["finalState"];
      finalReason: string;
      executionPath: string[];
      simulatedQuantity: number | null;
      simulatedProtectionState: TradeSyncerFollowerDispatchExecutionSimulationResult["simulatedProtectionState"];
      simulatedHealthState: TradeSyncerFollowerDispatchExecutionSimulationResult["simulatedHealthState"];
      positionSnapshot: TradeSyncerFollowerRecord["positionSnapshot"] | null;
      protectionSnapshot: TradeSyncerFollowerRecord["protectionSnapshot"] | null;
      repairEvent: TradeSyncerFollowerRepairEvent;
      currentDrift: string | null;
      lastDriftAt: string | null;
    }
  >();

  queuedIntents.forEach((intent, index) => {
    const existingFollower = existingGroup.followerRecords.find((follower) => follower.id === intent.followerId);
    if (!existingFollower) {
      return;
    }

    const signalSymbol = payload.sourceEvent.symbol;
    const requestedQuantity = Math.max(1, intent.requestBody && typeof intent.requestBody.quantity === "number"
      ? intent.requestBody.quantity
      : payload.sourceEvent.quantity);
    const baseEntryPrice =
      payload.sourceEvent.limitPrice ??
      payload.sourceEvent.stopPrice ??
      existingFollower.positionSnapshot.avgEntryPrice ??
      Number((18450 + index * 0.5 + requestedQuantity * 0.25).toFixed(2));
    const nextSide = payload.sourceEvent.side === "buy" ? "long" : "short";
    const workingLegCount =
      (payload.sourceEvent.stopLossTicks ? 1 : 0) + (payload.sourceEvent.takeProfitTicks ? 1 : 0);

    if (scenario === "reject_branch" && index === 0) {
      simulationIntentMap.set(intent.followerId, {
        finalState: "rejected",
        finalReason: "Follower venue rejected the copied-order handoff during simulated submit validation.",
        executionPath: ["readiness_check", "queued", "accepted", "rejected"],
        simulatedQuantity: 0,
        simulatedProtectionState: "none",
        simulatedHealthState: "monitoring",
        positionSnapshot: {
          ...existingFollower.positionSnapshot,
          symbol: signalSymbol,
          side: "flat",
          quantity: 0,
          avgEntryPrice: null,
          state: "flat",
          updatedAt: now,
        },
        protectionSnapshot: {
          ...existingFollower.protectionSnapshot,
          stopLossState: "not_needed",
          takeProfitState: "not_needed",
          workingLegCount: 0,
          state: "none",
        },
        repairEvent: createFollowerRepairEvent({
          action: "copied_execution_rejected",
          outcome: "logged",
          detail: "Copied-order simulation forced a follower-side reject so the operator can inspect the failure path before live routing.",
          occurredAt: now,
        }),
        currentDrift: null,
        lastDriftAt: existingFollower.lastDriftAt,
      });
      return;
    }

    if (scenario === "partial_fill_branch" && index === 0) {
      const partialQuantity = Math.max(1, Math.ceil(requestedQuantity / 2));
      simulationIntentMap.set(intent.followerId, {
        finalState: "partial_fill",
        finalReason: "Follower only partially filled the copied order and still needs remaining quantity reconciliation.",
        executionPath: ["readiness_check", "queued", "accepted", "partial_fill"],
        simulatedQuantity: partialQuantity,
        simulatedProtectionState: "restaging",
        simulatedHealthState: "monitoring",
        positionSnapshot: {
          ...existingFollower.positionSnapshot,
          symbol: signalSymbol,
          side: nextSide,
          quantity: partialQuantity,
          avgEntryPrice: baseEntryPrice,
          state: "partial_exit",
          updatedAt: now,
        },
        protectionSnapshot: {
          ...existingFollower.protectionSnapshot,
          stopLossState: payload.sourceEvent.stopLossTicks ? "working" : "not_needed",
          takeProfitState: payload.sourceEvent.takeProfitTicks ? "missing" : "not_needed",
          workingLegCount: payload.sourceEvent.stopLossTicks ? 1 : 0,
          lastRestagedAt: now,
          state: "restaging",
        },
        repairEvent: createFollowerRepairEvent({
          action: "copied_execution_partial_fill",
          outcome: "in_progress",
          detail: "Follower partially filled the copied order. Remaining quantity and protection legs need reconciliation before live trust.",
          occurredAt: now,
        }),
        currentDrift: "Partial fill left the follower smaller than the leader sizing plan.",
        lastDriftAt: now,
      });
      return;
    }

    if (scenario === "drift_after_fill" && index === 0) {
      simulationIntentMap.set(intent.followerId, {
        finalState: "drifted",
        finalReason: "Follower filled the copied order but lost protection alignment afterwards, forcing a drift state.",
        executionPath: ["readiness_check", "queued", "accepted", "filled", "drift_detected"],
        simulatedQuantity: requestedQuantity,
        simulatedProtectionState: "missing",
        simulatedHealthState: "drift_detected",
        positionSnapshot: {
          ...existingFollower.positionSnapshot,
          symbol: signalSymbol,
          side: nextSide,
          quantity: requestedQuantity,
          avgEntryPrice: baseEntryPrice,
          state: "open",
          updatedAt: now,
        },
        protectionSnapshot: {
          ...existingFollower.protectionSnapshot,
          stopLossState: "missing",
          takeProfitState: payload.sourceEvent.takeProfitTicks ? "working" : "not_needed",
          workingLegCount: payload.sourceEvent.takeProfitTicks ? 1 : 0,
          lastRestagedAt: existingFollower.protectionSnapshot.lastRestagedAt,
          state: "missing",
        },
        repairEvent: createFollowerRepairEvent({
          action: "copied_execution_drift_detected",
          outcome: "logged",
          detail: "Follower filled cleanly but protection drifted afterwards. This is the post-fill repair path we need before live retail trust.",
          occurredAt: now,
        }),
        currentDrift: "Follower protection is missing after copied execution.",
        lastDriftAt: now,
      });
      return;
    }

    simulationIntentMap.set(intent.followerId, {
      finalState: "protected_open",
      finalReason: "Copied-order handoff was accepted into the queue and simulated through protected open state.",
      executionPath: ["readiness_check", "queued", "accepted", "filled", "protected_open"],
      simulatedQuantity: requestedQuantity,
      simulatedProtectionState: workingLegCount > 0 ? "protected" : "none",
      simulatedHealthState: "healthy",
      positionSnapshot: {
        ...existingFollower.positionSnapshot,
        symbol: signalSymbol,
        side: nextSide,
        quantity: requestedQuantity,
        avgEntryPrice: baseEntryPrice,
        state: "open",
        updatedAt: now,
      },
      protectionSnapshot: {
        ...existingFollower.protectionSnapshot,
        stopLossState: payload.sourceEvent.stopLossTicks ? "working" : "not_needed",
        takeProfitState: payload.sourceEvent.takeProfitTicks ? "working" : "not_needed",
        workingLegCount,
        lastRestagedAt: workingLegCount > 0 ? now : existingFollower.protectionSnapshot.lastRestagedAt,
        state: workingLegCount > 0 ? "protected" : "none",
      },
      repairEvent: createFollowerRepairEvent({
        action: "copied_execution_simulated",
        outcome: "resolved",
        detail: `Follower accepted the staged copied-order handoff and is now simulated as open with ${workingLegCount} protection leg${workingLegCount === 1 ? "" : "s"}.`,
        occurredAt: now,
      }),
      currentDrift: null,
      lastDriftAt: existingFollower.lastDriftAt,
    });
  });

  const nextGroups: TradeSyncerSyncGroupRecord[] = snapshot.syncGroups.map((group) => {
    if (group.id !== stage.groupId) {
      return group;
    }

    const nextFollowerRecords: TradeSyncerFollowerRecord[] = group.followerRecords.map((follower) => {
      const queuedIntent = queuedIntentMap.get(follower.id);
      const simulationIntent = simulationIntentMap.get(follower.id);
      if (!queuedIntent || !simulationIntent) {
        return follower;
      }

      return {
        ...follower,
        status: "enabled" as const,
        healthState: simulationIntent.simulatedHealthState ?? follower.healthState,
        currentDrift: simulationIntent.currentDrift,
        lastDriftAt: simulationIntent.lastDriftAt,
        positionSnapshot: simulationIntent.positionSnapshot ?? follower.positionSnapshot,
        protectionSnapshot: simulationIntent.protectionSnapshot ?? follower.protectionSnapshot,
        repairHistory: [
          simulationIntent.repairEvent,
          ...follower.repairHistory,
        ].slice(0, 8),
      };
    });

    const openFollowerCount = nextFollowerRecords.filter((follower) => follower.positionSnapshot.quantity > 0).length;
    const groupRepairState =
      nextFollowerRecords.some((follower) => follower.healthState === "drift_detected" || follower.healthState === "repairing")
        ? "manual_review"
        : nextFollowerRecords.some((follower) => follower.healthState === "monitoring" || follower.healthState === "flattened")
          ? "monitoring"
          : ("healthy" as const);

    return {
      ...group,
      followerRecords: nextFollowerRecords,
      openPositions: openFollowerCount,
      medianCopyLagMs: Math.max(42, Math.round(group.medianCopyLagMs * 0.9)),
      repairState: groupRepairState,
      lastEventAt: now,
    };
  });

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry(
        "sync_group_updated",
        `Trade Syncer group ${existingGroup.label} simulated copied-order execution (${scenarioLabelMap[scenario]}) for ${queuedIntentMap.size} queued follower handoff${queuedIntentMap.size === 1 ? "" : "s"}.`
      ),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const updatedGroup = nextGroups.find((group) => group.id === stage.groupId) ?? null;
  if (updatedGroup) {
    const transitionEntries = buildFollowerSnapshotTransitionEntries({
      previousGroup: existingGroup,
      nextGroup: updatedGroup,
      accountMap,
      titlePrefix: "Copied-order simulation",
    });
    for (const transitionEntry of transitionEntries) {
      await appendTradeSyncerLog(transitionEntry);
    }
  }

  await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingGroup.leadAccountId,
    severity:
      stage.failedFollowers > 0 ||
      stage.blockedFollowers > 0 ||
      scenario === "reject_branch" ||
      scenario === "partial_fill_branch" ||
      scenario === "drift_after_fill"
        ? "warning"
        : "success",
    title:
      scenario === "reject_branch"
        ? "Copied-order reject branch simulated"
        : scenario === "partial_fill_branch"
          ? "Copied-order partial-fill branch simulated"
          : scenario === "drift_after_fill"
            ? "Copied-order post-fill drift simulated"
            : stage.failedFollowers > 0 || stage.blockedFollowers > 0
              ? "Copied-order execution simulation completed with issues"
              : "Copied-order execution simulation filled cleanly",
    detail:
      scenario === "reject_branch"
        ? `${existingGroup.label} forced a follower reject path after staging so we can validate failure handling before live copy routing.`
        : scenario === "partial_fill_branch"
          ? `${existingGroup.label} forced a follower partial fill so we can validate reduced quantity and protection-restage behavior.`
          : scenario === "drift_after_fill"
            ? `${existingGroup.label} forced post-fill protection drift so we can validate follower repair after copied execution.`
            : stage.failedFollowers > 0 || stage.blockedFollowers > 0
              ? `${existingGroup.label} simulated ${stage.queuedFollowers} queued follower copied-order handoff${stage.queuedFollowers === 1 ? "" : "s"}, but some followers remained outside the execution path.`
              : `${existingGroup.label} simulated ${stage.queuedFollowers} queued follower copied-order handoff${stage.queuedFollowers === 1 ? "" : "s"} through accepted/protected open state.`,
    status: "dispatch_execution_simulated",
  });

  const intents: TradeSyncerFollowerDispatchExecutionSimulationResult[] = stage.intents.map((intent) => {
    if (intent.stageState !== "queued") {
      return {
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        finalState: intent.stageState === "failed" ? "rejected" : "skipped",
        finalReason:
          intent.stageState === "failed"
            ? intent.stageReason
            : "Follower stayed outside copied execution because it was not fully queueable.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: intent.signalId,
        commandId:
          intent.responseBody && typeof intent.responseBody.commandId === "string"
            ? intent.responseBody.commandId
            : null,
        executionPath: ["readiness_check", intent.stageState],
        warnings: intent.warnings,
        simulatedQuantity: null,
        simulatedProtectionState: null,
        simulatedHealthState: null,
      };
    }

    const simulationIntent = simulationIntentMap.get(intent.followerId);

    return {
      followerId: intent.followerId,
      followerLabel: intent.followerLabel,
      venue: intent.venue,
      finalState: simulationIntent?.finalState ?? "protected_open",
      finalReason:
        simulationIntent?.finalReason ??
        "Copied-order handoff was accepted into the queue and simulated through protected open state.",
      routeLabel: intent.routeLabel,
      managedAccountLabel: intent.managedAccountLabel,
      signalId: intent.signalId,
      commandId:
        intent.responseBody && typeof intent.responseBody.commandId === "string"
          ? intent.responseBody.commandId
          : null,
      executionPath: simulationIntent?.executionPath ?? ["readiness_check", "queued", "accepted", "filled", "protected_open"],
      warnings: intent.warnings,
      simulatedQuantity: simulationIntent?.simulatedQuantity ?? null,
      simulatedProtectionState: simulationIntent?.simulatedProtectionState ?? null,
      simulatedHealthState: simulationIntent?.simulatedHealthState ?? null,
    };
  });

  return {
    generatedAt: nextSnapshot.updatedAt,
    sourceEvent: payload.sourceEvent,
    scenario,
    groupId: stage.groupId,
    groupLabel: stage.groupLabel,
    queuedFollowers: stage.queuedFollowers,
    protectedFollowers: intents.filter((intent) => intent.finalState === "protected_open").length,
    filledFollowers: intents.filter((intent) => intent.finalState === "filled" || intent.finalState === "protected_open").length,
    partialFollowers: intents.filter((intent) => intent.finalState === "partial_fill").length,
    driftedFollowers: intents.filter((intent) => intent.finalState === "drifted").length,
    rejectedFollowers: intents.filter((intent) => intent.finalState === "rejected").length,
    skippedFollowers: intents.filter((intent) => intent.finalState === "skipped").length,
    intents,
    notes: [
      "Copied-order execution simulation builds on staging: it first queues ready follower intents into the futures connector backbone.",
      scenario === "happy_path"
        ? "Queued followers are simulated through accepted and protected-open state so Trade Syncer can test the clean lifecycle without live broker risk."
        : scenario === "reject_branch"
          ? "This branch forces a follower-side reject after staging so UI, logs, and repair controls can be exercised honestly."
          : scenario === "partial_fill_branch"
            ? "This branch forces a partial fill so we can test reduced follower quantity, imperfect protection, and reconciliation messaging."
            : "This branch forces post-fill drift so we can test follower repair after the entry seemed successful.",
      "This is still not live trading. It is the first honest end-to-end master -> follower -> connector lifecycle pass.",
    ],
  };
}

export async function runTradeSyncerVenueDispatchSimulation(payload: {
  sourceEvent: TradeSyncerMasterTradeEvent;
  scenario?: TradeSyncerDispatchExecutionScenario;
}): Promise<TradeSyncerVenueDispatchResult> {
  const preview = await previewTradeSyncerDispatch(payload);
  const scenario = payload.scenario ?? "happy_path";
  const generatedAt = new Date().toISOString();
  const intents: TradeSyncerFollowerVenueDispatchResult[] = [];
  let readyIndex = 0;

  const mapRithmicScenario = (currentScenario: TradeSyncerDispatchExecutionScenario): RithmicGatewayScenario => {
    switch (currentScenario) {
      case "reject_branch":
        return "rejected";
      case "partial_fill_branch":
        return "partial_fill";
      case "drift_after_fill":
        return "filled";
      default:
        return "filled";
    }
  };
  const classifyRithmicVenueDispatch = (args: {
    submitResponse: Record<string, unknown> | null;
    dispatchResponse: Record<string, unknown> | null;
    transportResponse: Record<string, unknown> | null;
    protocolResponse: Record<string, unknown> | null;
    lifecycleTail: {
      outcome?: string | null;
      reconciliationState?: string | null;
    } | null;
    forcedScenarioState: "rejected" | "partial_fill" | "drift_review" | null;
  }): {
    dispatchState: TradeSyncerFollowerVenueDispatchResult["dispatchState"];
    dispatchReason: string;
  } => {
    if (args.forcedScenarioState === "rejected") {
      return {
        dispatchState: "rejected",
        dispatchReason: "Rithmic non-live gateway simulation rejected this follower before a working lifecycle began.",
      };
    }
    if (args.forcedScenarioState === "partial_fill") {
      return {
        dispatchState: "partial_fill",
        dispatchReason: "Rithmic non-live gateway simulation produced a partial-fill lifecycle for this follower.",
      };
    }
    if (args.forcedScenarioState === "drift_review") {
      return {
        dispatchState: "drift_review",
        dispatchReason: "Rithmic non-live gateway accepted the follower, but Trade Syncer is flagging post-fill drift review.",
      };
    }

    const submitState =
      args.submitResponse && typeof args.submitResponse.submitState === "string"
        ? String(args.submitResponse.submitState)
        : null;
    const handoffAccepted =
      args.dispatchResponse && typeof args.dispatchResponse.handoffAccepted === "boolean"
        ? Boolean(args.dispatchResponse.handoffAccepted)
        : null;
    const dispatchTransportState =
      args.dispatchResponse && typeof args.dispatchResponse.transportState === "string"
        ? String(args.dispatchResponse.transportState)
        : null;
    const transportState =
      args.transportResponse && typeof args.transportResponse.packetState === "string"
        ? String(args.transportResponse.packetState)
        : dispatchTransportState;
    const normalizedOutcome =
      args.protocolResponse &&
      typeof args.protocolResponse.normalizedOutcome === "object" &&
      args.protocolResponse.normalizedOutcome
        ? (args.protocolResponse.normalizedOutcome as Record<string, unknown>)
        : null;
    const normalizedState =
      normalizedOutcome && typeof normalizedOutcome.state === "string"
        ? String(normalizedOutcome.state)
        : null;
    const reconciliationState = args.lifecycleTail?.reconciliationState ?? null;

    if (
      submitState === "binding_blocked" ||
      handoffAccepted === false ||
      transportState === "blocked" ||
      normalizedState === "transport_failed"
    ) {
      return {
        dispatchState: "blocked",
        dispatchReason:
          "Rithmic non-live gateway is still blocked by missing binding or transport prerequisites, so this follower is not execution-ready yet.",
      };
    }

    if (
      normalizedState === "uncertain" ||
      normalizedState === "uncertain_recovered" ||
      reconciliationState === "manual_review_required" ||
      reconciliationState === "transport_retry_required"
    ) {
      return {
        dispatchState: "review",
        dispatchReason:
          "Rithmic non-live gateway reached a review-required state and still needs broker sync or operator confirmation before the follower is considered healthy.",
      };
    }

    return {
      dispatchState: "accepted",
      dispatchReason: "Rithmic non-live gateway accepted the follower and produced a healthy simulated lifecycle.",
    };
  };

  for (const intent of preview.intents) {
    if (intent.readiness !== "ready") {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        dispatchState: intent.readiness === "blocked" ? "blocked" : "review",
        dispatchReason: intent.readinessReason,
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: null,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: null,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    const signal = buildTradeSyncerDryRunSignal({ preview, intent });
    if (!signal) {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        dispatchState: "failed",
        dispatchReason: "Trade Syncer could not build a venue handoff payload for this follower.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: null,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: null,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    const forceReject = scenario === "reject_branch" && readyIndex === 0;
    const forcePartial = scenario === "partial_fill_branch" && readyIndex === 0;
    const forceDriftReview = scenario === "drift_after_fill" && readyIndex === 0;
    readyIndex += 1;

    if (intent.venue === "tradovate") {
      const tradovatePreview = await previewTradovateOrder(signal);
      if (!tradovatePreview.ok || !tradovatePreview.preview) {
        intents.push({
          followerId: intent.followerId,
          followerLabel: intent.followerLabel,
          venue: intent.venue,
          dispatchState: "failed",
          dispatchReason: tradovatePreview.error ?? "Tradovate preview failed during non-live venue dispatch.",
          routeLabel: intent.routeLabel,
          managedAccountLabel: intent.managedAccountLabel,
          signalId: signal.signalId,
          venueOrderState: null,
          venueReconciliationState: null,
          requestBody: signal as unknown as Record<string, unknown>,
          responseBody: null,
          warnings: intent.warnings,
        });
        continue;
      }

      const dispatchState: TradeSyncerFollowerVenueDispatchResult["dispatchState"] = forceReject
        ? "rejected"
        : forcePartial
          ? "partial_fill"
          : forceDriftReview
            ? "drift_review"
            : "accepted";
      const venueOrderState =
        dispatchState === "rejected"
          ? "rejected_before_submit"
          : dispatchState === "partial_fill"
            ? "partially_filled"
            : "submitted_with_brackets";
      const venueReconciliationState =
        dispatchState === "rejected"
          ? "rejected_before_submit"
          : dispatchState === "partial_fill"
            ? "partial_fill_reconcile_required"
            : dispatchState === "drift_review"
              ? "protection_drift_review"
              : "accepted_and_protected";

      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        dispatchState,
        dispatchReason:
          dispatchState === "rejected"
            ? "Tradovate non-live venue simulation forced a submit rejection for this follower."
            : dispatchState === "partial_fill"
              ? "Tradovate non-live venue simulation forced a partial fill so quantity/protection reconciliation can be checked."
              : dispatchState === "drift_review"
                ? "Tradovate non-live venue simulation accepted the order, but flagged post-fill protection drift for operator review."
                : "Tradovate non-live venue simulation accepted the copied order and staged normal bracket protection.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: signal.signalId,
        venueOrderState,
        venueReconciliationState,
        requestBody: tradovatePreview.preview.body,
        responseBody: {
          adapterId: "tradovate-direct",
          nonLive: true,
          endpoint: tradovatePreview.preview.endpoint,
          usesBrackets: tradovatePreview.preview.usesBrackets,
          accountSpecHint: tradovatePreview.preview.accountSpecHint,
          brokerState: venueOrderState,
          reconciliationState: venueReconciliationState,
          operatorVerdict:
            dispatchState === "rejected"
              ? "simulated tradovate reject"
              : dispatchState === "partial_fill"
                ? "simulated tradovate partial fill"
                : dispatchState === "drift_review"
                  ? "simulated tradovate accepted with protection drift review"
                  : "simulated tradovate accepted",
        },
        warnings: intent.warnings,
      });
      continue;
    }

    const rithmicAttempt = await submitRithmicAttempt(signal);
    if (!rithmicAttempt.ok) {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        dispatchState: "failed",
        dispatchReason: rithmicAttempt.error ?? "Rithmic submit attempt failed during non-live venue dispatch.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: signal.signalId,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: signal as unknown as Record<string, unknown>,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    const dispatchAttempt = await stageRithmicDispatchAttempt();
    const transportAttempt = await stageRithmicTransportAttempt();
    const protocolAttempt = await runRithmicProtocolServiceAttempt({
      scenario: mapRithmicScenario(scenario),
    });

    if (!dispatchAttempt.ok || !transportAttempt.ok || !protocolAttempt.ok) {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        dispatchState: "failed",
        dispatchReason:
          (!dispatchAttempt.ok && dispatchAttempt.error) ||
          (!transportAttempt.ok && transportAttempt.error) ||
          (!protocolAttempt.ok && protocolAttempt.error) ||
          "Rithmic non-live venue dispatch could not complete the adapter/gateway chain.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: signal.signalId,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: rithmicAttempt.attempt.requestBody,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    const normalizedOutcome =
      protocolAttempt.attempt.responseBody &&
      typeof protocolAttempt.attempt.responseBody.normalizedOutcome === "object" &&
      protocolAttempt.attempt.responseBody.normalizedOutcome
        ? (protocolAttempt.attempt.responseBody.normalizedOutcome as Record<string, unknown>)
        : null;
    const venueOrderState =
      normalizedOutcome && typeof normalizedOutcome.state === "string"
        ? String(normalizedOutcome.state)
        : null;
    const lifecycleTail = protocolAttempt.lifecycleEvents[protocolAttempt.lifecycleEvents.length - 1] ?? null;
    const venueReconciliationState =
      forceDriftReview
        ? "protection_drift_review"
        : lifecycleTail?.reconciliationState ??
          (normalizedOutcome && typeof normalizedOutcome.state === "string" ? String(normalizedOutcome.state) : null);
    const classifiedRithmicState = classifyRithmicVenueDispatch({
      submitResponse: rithmicAttempt.attempt.responseBody,
      dispatchResponse: dispatchAttempt.dispatch.responseBody,
      transportResponse: transportAttempt.attempt.responseBody,
      protocolResponse: protocolAttempt.attempt.responseBody,
      lifecycleTail:
        lifecycleTail == null
          ? null
          : {
              outcome: lifecycleTail.outcome,
              reconciliationState: lifecycleTail.reconciliationState,
            },
      forcedScenarioState: forceReject ? "rejected" : forcePartial ? "partial_fill" : forceDriftReview ? "drift_review" : null,
    });
    const dispatchState = classifiedRithmicState.dispatchState;

    intents.push({
      followerId: intent.followerId,
      followerLabel: intent.followerLabel,
      venue: intent.venue,
      dispatchState,
      dispatchReason: classifiedRithmicState.dispatchReason,
      routeLabel: intent.routeLabel,
      managedAccountLabel: intent.managedAccountLabel,
      signalId: signal.signalId,
      venueOrderState,
      venueReconciliationState,
      requestBody: rithmicAttempt.attempt.requestBody,
      responseBody: {
        submitAttempt: rithmicAttempt.attempt.responseBody,
        dispatchAttempt: dispatchAttempt.dispatch.responseBody,
        transportAttempt: transportAttempt.attempt.responseBody,
        protocolAttempt: protocolAttempt.attempt.responseBody,
        lifecycleTail:
          lifecycleTail == null
            ? null
            : {
                eventType: lifecycleTail.eventType,
                outcome: lifecycleTail.outcome,
                ordStatus: lifecycleTail.ordStatus,
                execType: lifecycleTail.execType,
                reconciliationState: lifecycleTail.reconciliationState,
              },
      },
      warnings: intent.warnings,
    });
  }

  const result: TradeSyncerVenueDispatchResult = {
    generatedAt,
    sourceEvent: preview.sourceEvent,
    scenario,
    groupId: preview.groupId,
    groupLabel: preview.groupLabel,
    acceptedFollowers: intents.filter((intent) => intent.dispatchState === "accepted").length,
    rejectedFollowers: intents.filter((intent) => intent.dispatchState === "rejected").length,
    partialFollowers: intents.filter((intent) => intent.dispatchState === "partial_fill").length,
    driftReviewFollowers: intents.filter((intent) => intent.dispatchState === "drift_review").length,
    reviewFollowers: intents.filter((intent) => intent.dispatchState === "review").length,
    blockedFollowers: intents.filter((intent) => intent.dispatchState === "blocked").length,
    failedFollowers: intents.filter((intent) => intent.dispatchState === "failed").length,
    intents,
    notes: [
      "Venue Dispatch Simulation is still non-live. It uses venue-shaped Tradovate and Rithmic submit/reconciliation seams without placing real copied trades.",
      "Tradovate followers are validated through the order-preview contract; Rithmic followers are walked through the adapter/gateway lifecycle stack.",
      "This is the bridge between generic copied-order simulation and the real venue-specific dispatch architecture we need for retail trust.",
    ],
  };

  const snapshot = await getTradeSyncerStoreSnapshot();
  const group = snapshot.syncGroups.find((item) => item.id === preview.groupId);
  if (group) {
    const warningCount =
      result.rejectedFollowers +
      result.partialFollowers +
      result.driftReviewFollowers +
      result.reviewFollowers +
      result.blockedFollowers +
      result.failedFollowers;
    await appendTradeSyncerLog({
      groupId: group.id,
      accountId: group.leadAccountId,
      severity: warningCount > 0 ? "warning" : "success",
      title: warningCount > 0 ? "Venue dispatch simulation completed with review items" : "Venue dispatch simulation completed cleanly",
      detail:
        warningCount > 0
          ? `${result.groupLabel} ran venue-specific non-live dispatch for ${result.acceptedFollowers + result.rejectedFollowers + result.partialFollowers + result.driftReviewFollowers} ready follower${result.acceptedFollowers + result.rejectedFollowers + result.partialFollowers + result.driftReviewFollowers === 1 ? "" : "s"} with ${warningCount} branch or review outcome${warningCount === 1 ? "" : "s"}.`
          : `${result.groupLabel} ran venue-specific non-live dispatch cleanly across ${result.acceptedFollowers} follower${result.acceptedFollowers === 1 ? "" : "s"}.`,
      status: "venue_dispatch_simulated",
    });
  }

  return result;
}

export async function runTradeSyncerTradovateLiveBridge(payload: {
  sourceEvent: TradeSyncerMasterTradeEvent;
}): Promise<TradeSyncerTradovateLiveBridgeResult> {
  const preview = await previewTradeSyncerDispatch(payload);
  const generatedAt = new Date().toISOString();
  const intents: TradeSyncerFollowerTradovateLiveBridgeResult[] = [];

  const classifyTradovateBridgeFailure = (
    error: string
  ): {
    bridgeState: TradeSyncerFollowerTradovateLiveBridgeResult["bridgeState"];
    bridgeReason: string;
  } => {
    const normalized = error.toLowerCase();
    if (
      normalized.includes("binding") ||
      normalized.includes("accountspec") ||
      normalized.includes("accountid")
    ) {
      return {
        bridgeState: "blocked",
        bridgeReason:
          "Tradovate live bridge is blocked by managed-lane binding or account resolution gaps for this follower.",
      };
    }
    if (
      normalized.includes("oauth") ||
      normalized.includes("credential") ||
      normalized.includes("token") ||
      normalized.includes("auth")
    ) {
      return {
        bridgeState: "review",
        bridgeReason:
          "Tradovate live bridge could not authenticate the configured broker lane, so this follower still needs broker-login review.",
      };
    }
    return {
      bridgeState: "failed",
      bridgeReason: error,
    };
  };

  for (const intent of preview.intents) {
    if (intent.readiness !== "ready") {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        bridgeState: intent.readiness === "blocked" ? "blocked" : "review",
        bridgeReason: intent.readinessReason,
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: null,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: null,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    if (intent.venue !== "tradovate") {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        bridgeState: "skipped",
        bridgeReason:
          "The first live bridge only dispatches Tradovate followers. Other venues stay on the non-live handoff path for now.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: null,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: null,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    const signal = buildTradeSyncerDryRunSignal({ preview, intent });
    if (!signal) {
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        bridgeState: "failed",
        bridgeReason: "Trade Syncer could not build a live Tradovate signal packet for this follower.",
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: null,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: null,
        responseBody: null,
        warnings: intent.warnings,
      });
      continue;
    }

    const submission = await submitTradovateOrder(signal);
    if (!submission.ok) {
      const classified = classifyTradovateBridgeFailure(submission.error ?? "Tradovate live bridge failed.");
      intents.push({
        followerId: intent.followerId,
        followerLabel: intent.followerLabel,
        venue: intent.venue,
        bridgeState: classified.bridgeState,
        bridgeReason: classified.bridgeReason,
        routeLabel: intent.routeLabel,
        managedAccountLabel: intent.managedAccountLabel,
        signalId: signal.signalId,
        venueOrderState: null,
        venueReconciliationState: null,
        requestBody: toRecord(signal as unknown),
        responseBody:
          "binding" in submission && submission.binding
            ? (submission.binding as unknown as Record<string, unknown>)
            : null,
        warnings: intent.warnings,
      });
      continue;
    }

    const submit = submission.submit;
    const bridgeState: TradeSyncerFollowerTradovateLiveBridgeResult["bridgeState"] = submit.brokerAccepted
      ? "submitted"
      : "rejected";
    intents.push({
      followerId: intent.followerId,
      followerLabel: intent.followerLabel,
      venue: intent.venue,
      bridgeState,
      bridgeReason: submit.brokerAccepted
        ? "Tradovate accepted the copied follower order through the live bridge."
        : submit.operatorMessage,
      routeLabel: intent.routeLabel,
      managedAccountLabel: intent.managedAccountLabel,
      signalId: signal.signalId,
      venueOrderState: submit.brokerAccepted ? "submitted_with_brackets" : "rejected_before_submit",
      venueReconciliationState: submit.brokerAccepted ? "live_submit_pending_reconciliation" : "rejected_before_submit",
      requestBody: submit.requestBody,
      responseBody: {
        adapterId: submit.adapterId,
        endpoint: submit.endpoint,
        selectedEnvironment: submit.selectedEnvironment,
        brokerAccepted: submit.brokerAccepted,
        responseStatus: submit.responseStatus,
        failureReason: submit.failureReason,
        failureText: submit.failureText,
        operatorVerdict: submit.operatorVerdict,
        operatorMessage: submit.operatorMessage,
        binding: submit.binding,
        brokerResponse: submit.responseBody,
      } as unknown as Record<string, unknown>,
      warnings: intent.warnings,
    });
  }

  const result: TradeSyncerTradovateLiveBridgeResult = {
    generatedAt,
    sourceEvent: preview.sourceEvent,
    groupId: preview.groupId,
    groupLabel: preview.groupLabel,
    submittedFollowers: intents.filter((intent) => intent.bridgeState === "submitted").length,
    rejectedFollowers: intents.filter((intent) => intent.bridgeState === "rejected").length,
    reviewFollowers: intents.filter((intent) => intent.bridgeState === "review").length,
    blockedFollowers: intents.filter((intent) => intent.bridgeState === "blocked").length,
    failedFollowers: intents.filter((intent) => intent.bridgeState === "failed").length,
    skippedFollowers: intents.filter((intent) => intent.bridgeState === "skipped").length,
    intents,
    notes: [
      "Tradovate Live Bridge reuses the real Tradovate submit contract for ready Tradovate followers instead of a simulation-only handoff.",
      "Only Tradovate followers are bridged here. Rithmic and other venues intentionally stay outside this first live-dispatch button.",
      "Submitted followers may still need broker-state reconciliation after submit; this bridge proves the copied-order path can reach the real broker seam.",
    ],
  };

  const snapshot = await getTradeSyncerStoreSnapshot();
  const group = snapshot.syncGroups.find((item) => item.id === preview.groupId);
  if (group) {
    const warningCount =
      result.rejectedFollowers +
      result.reviewFollowers +
      result.blockedFollowers +
      result.failedFollowers;
    await appendTradeSyncerLog({
      groupId: group.id,
      accountId: group.leadAccountId,
      severity: warningCount > 0 ? "warning" : "success",
      title:
        warningCount > 0
          ? "Tradovate live bridge completed with review items"
          : "Tradovate live bridge submitted cleanly",
      detail:
        warningCount > 0
          ? `${result.groupLabel} live-bridged ${result.submittedFollowers} Tradovate follower order${result.submittedFollowers === 1 ? "" : "s"} and left ${warningCount} follower${warningCount === 1 ? "" : "s"} in rejected/review/blocked/failed state.`
          : `${result.groupLabel} live-bridged ${result.submittedFollowers} Tradovate follower order${result.submittedFollowers === 1 ? "" : "s"} through the real submit seam.`,
      status: "tradovate_live_bridge",
    });
  }

  return result;
}

export async function simulateTradeSyncerGroupEvent(payload: {
  groupId: string;
  scenario: TradeSyncerSimulationScenario;
}) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }
  const accountMap = new Map(snapshot.accounts.map((account) => [account.id, account]));

  const nextState = (() => {
    switch (payload.scenario) {
      case "fanout_success":
        return {
          openPositions: Math.max(existingGroup.openPositions, 1),
          medianCopyLagMs: Math.max(42, existingGroup.medianCopyLagMs - 9),
          repairState: "healthy" as const,
          title: "Follower fanout simulated",
          detail: `${existingGroup.label} copied a master fill into ${existingGroup.followerRecords.length} follower${existingGroup.followerRecords.length === 1 ? "" : "s"} cleanly.`,
          severity: "success" as const,
          status: "copied",
        };
      case "drift_detected":
        return {
          openPositions: Math.max(existingGroup.openPositions, 1),
          medianCopyLagMs: existingGroup.medianCopyLagMs + 35,
          repairState: "manual_review" as const,
          title: "Follower drift detected",
          detail: `${existingGroup.label} now shows a follower mismatch that requires repair or flatten review.`,
          severity: "warning" as const,
          status: "drift_detected",
        };
      default:
        return {
          openPositions: 0,
          medianCopyLagMs: existingGroup.medianCopyLagMs,
          repairState: "healthy" as const,
          title: "Followers flattened",
          detail: `${existingGroup.label} was flattened across followers as a safety action.`,
          severity: "info" as const,
          status: "flattened",
        };
    }
  })();

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? {
          ...group,
          followerRecords: updateFollowersForScenario(group.followerRecords, payload.scenario),
          openPositions: nextState.openPositions,
          medianCopyLagMs: nextState.medianCopyLagMs,
          repairState: nextState.repairState,
          lastEventAt: new Date().toISOString(),
        }
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Trade Syncer group ${existingGroup.label} simulated ${payload.scenario}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingGroup.leadAccountId,
    severity: nextState.severity,
    title: nextState.title,
    detail: nextState.detail,
    status: nextState.status,
  });

  const updatedGroup = nextGroups.find((group) => group.id === payload.groupId) ?? null;
  if (updatedGroup) {
    const transitionEntries = buildFollowerSnapshotTransitionEntries({
      previousGroup: existingGroup,
      nextGroup: updatedGroup,
      accountMap,
      titlePrefix: "Follower",
    });
    for (const transitionEntry of transitionEntries) {
      await appendTradeSyncerLog(transitionEntry);
    }
  }

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: updatedGroup,
    logEntry: entry,
  };
}

export async function runTradeSyncerRepairAction(payload: {
  groupId: string;
  action: TradeSyncerRepairAction;
}) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }
  const accountMap = new Map(snapshot.accounts.map((account) => [account.id, account]));

  const nextState = (() => {
    switch (payload.action) {
      case "pause_group":
        return {
          status: "monitor_existing" as const,
          repairState: "manual_review" as const,
          openPositions: existingGroup.openPositions,
          medianCopyLagMs: existingGroup.medianCopyLagMs,
          title: "Group paused for repair review",
          detail: `${existingGroup.label} is now ignoring fresh leader entries while operators review follower drift.`,
          severity: "warning" as const,
          logStatus: "paused_for_repair",
        };
      case "restage_protection":
        return {
          status: existingGroup.status,
          repairState: "monitoring" as const,
          openPositions: Math.max(existingGroup.openPositions, 1),
          medianCopyLagMs: Math.max(55, existingGroup.medianCopyLagMs - 18),
          title: "Protection restaged on followers",
          detail: `${existingGroup.label} reattached follower protection legs and moved back into monitored state.`,
          severity: "info" as const,
          logStatus: "protection_restaged",
        };
      case "flatten_followers":
        return {
          status: "monitor_existing" as const,
          repairState: "monitoring" as const,
          openPositions: 0,
          medianCopyLagMs: existingGroup.medianCopyLagMs,
          title: "Followers flattened after drift",
          detail: `${existingGroup.label} flattened follower exposure and is holding monitor-existing mode until the operator resumes live copying.`,
          severity: "warning" as const,
          logStatus: "followers_flattened",
        };
      default:
        return {
          status: existingGroup.status === "disabled" ? "monitor_existing" : existingGroup.status,
          repairState: "healthy" as const,
          openPositions: existingGroup.openPositions,
          medianCopyLagMs: Math.max(42, existingGroup.medianCopyLagMs - 12),
          title: "Repair cycle resolved",
          detail: `${existingGroup.label} was marked healthy after follower state and protection were revalidated.`,
          severity: "success" as const,
          logStatus: "healthy",
        };
    }
  })();

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? {
          ...group,
          followerRecords: updateFollowersForRepairAction(group.followerRecords, payload.action),
          status: nextState.status,
          repairState: nextState.repairState,
          openPositions: nextState.openPositions,
          medianCopyLagMs: nextState.medianCopyLagMs,
          lastEventAt: new Date().toISOString(),
        }
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry("sync_group_updated", `Trade Syncer group ${existingGroup.label} applied repair action ${payload.action}.`),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingGroup.leadAccountId,
    severity: nextState.severity,
    title: nextState.title,
    detail: nextState.detail,
    status: nextState.logStatus,
  });

  const updatedGroup = nextGroups.find((group) => group.id === payload.groupId) ?? null;
  if (updatedGroup) {
    const transitionEntries = buildFollowerSnapshotTransitionEntries({
      previousGroup: existingGroup,
      nextGroup: updatedGroup,
      accountMap,
      titlePrefix: "Repair",
    });
    for (const transitionEntry of transitionEntries) {
      await appendTradeSyncerLog(transitionEntry);
    }
  }

  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: updatedGroup,
    logEntry: entry,
  };
}

export async function runTradeSyncerFollowerRepairAction(payload: {
  groupId: string;
  followerId: string;
  action: TradeSyncerFollowerRepairAction;
}) {
  const snapshot = await getTradeSyncerStoreSnapshot();
  const existingGroup = snapshot.syncGroups.find((group) => group.id === payload.groupId);
  if (!existingGroup) {
    throw new Error("Trade Syncer group was not found.");
  }

  const existingFollower = existingGroup.followerRecords.find((follower) => follower.id === payload.followerId);
  if (!existingFollower) {
    throw new Error("Trade Syncer follower was not found.");
  }

  const followerAccount = snapshot.accounts.find((account) => account.id === existingFollower.accountId);
  const followerLabel = followerAccount?.label ?? existingFollower.accountId;
  const now = new Date().toISOString();
  const accountMap = new Map(snapshot.accounts.map((account) => [account.id, account]));

  const nextFollowerState: {
    healthState: TradeSyncerFollowerRecord["healthState"];
    currentDrift: string | null;
    repairEvent: TradeSyncerFollowerRepairEvent;
    positionSnapshot: TradeSyncerFollowerRecord["positionSnapshot"];
    protectionSnapshot: TradeSyncerFollowerRecord["protectionSnapshot"];
    logSeverity: "info" | "warning" | "success";
    logTitle: string;
    logDetail: string;
    logStatus: string;
  } = (() => {
    switch (payload.action) {
      case "pause_follower":
        return {
          healthState: "repairing" as const,
          currentDrift: existingFollower.currentDrift ?? "Follower manually paused for targeted review.",
          repairEvent: createFollowerRepairEvent({
            action: "pause_follower",
            outcome: "in_progress",
            detail: `${followerLabel} was paused independently while the operator reviews its local sync state.`,
            occurredAt: now,
          }),
          positionSnapshot: {
            ...existingFollower.positionSnapshot,
            updatedAt: now,
          },
          protectionSnapshot: {
            ...existingFollower.protectionSnapshot,
          },
          logSeverity: "warning" as const,
          logTitle: "Follower paused for review",
          logDetail: `${followerLabel} is paused independently inside ${existingGroup.label}.`,
          logStatus: "follower_paused",
        };
      case "restage_follower_protection":
        return {
          healthState: "monitoring" as const,
          currentDrift: null,
          repairEvent: createFollowerRepairEvent({
            action: "restage_follower_protection",
            outcome: "resolved",
            detail: `${followerLabel} had protection legs restaged and moved back into monitoring.`,
            occurredAt: now,
          }),
          positionSnapshot: {
            ...existingFollower.positionSnapshot,
            updatedAt: now,
          },
          protectionSnapshot: {
            ...existingFollower.protectionSnapshot,
            stopLossState: existingFollower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
            takeProfitState: existingFollower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
            workingLegCount: existingFollower.positionSnapshot.quantity > 0 ? 2 : 0,
            lastRestagedAt: now,
            state: existingFollower.positionSnapshot.quantity > 0 ? "protected" : "none",
          },
          logSeverity: "info" as const,
          logTitle: "Follower protection restaged",
          logDetail: `${followerLabel} had its follower-only protection legs restaged.`,
          logStatus: "follower_protection_restaged",
        };
      case "flatten_follower":
        return {
          healthState: "flattened" as const,
          currentDrift: null,
          repairEvent: createFollowerRepairEvent({
            action: "flatten_follower",
            outcome: "resolved",
            detail: `${followerLabel} was flattened without forcing the rest of the sync group flat.`,
            occurredAt: now,
          }),
          positionSnapshot: {
            ...existingFollower.positionSnapshot,
            side: "flat",
            quantity: 0,
            avgEntryPrice: null,
            state: "flat",
            updatedAt: now,
          },
          protectionSnapshot: {
            ...existingFollower.protectionSnapshot,
            stopLossState: "not_needed",
            takeProfitState: "not_needed",
            workingLegCount: 0,
            state: "none",
          },
          logSeverity: "warning" as const,
          logTitle: "Follower flattened",
          logDetail: `${followerLabel} was flattened independently as a targeted safety action.`,
          logStatus: "follower_flattened",
        };
      default:
        return {
          healthState: "healthy" as const,
          currentDrift: null,
          repairEvent: createFollowerRepairEvent({
            action: "mark_follower_healthy",
            outcome: "resolved",
            detail: `${followerLabel} was revalidated and returned to healthy follower state.`,
            occurredAt: now,
          }),
          positionSnapshot: {
            ...existingFollower.positionSnapshot,
            state: existingFollower.positionSnapshot.quantity > 0 ? "open" : "flat",
            updatedAt: now,
          },
          protectionSnapshot: {
            ...existingFollower.protectionSnapshot,
            stopLossState: existingFollower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
            takeProfitState: existingFollower.positionSnapshot.quantity > 0 ? "working" : "not_needed",
            workingLegCount: existingFollower.positionSnapshot.quantity > 0 ? 2 : 0,
            state: existingFollower.positionSnapshot.quantity > 0 ? "protected" : "none",
          },
          logSeverity: "success" as const,
          logTitle: "Follower marked healthy",
          logDetail: `${followerLabel} was marked healthy after targeted repair review.`,
          logStatus: "follower_healthy",
        };
    }
  })();

  const nextGroups = snapshot.syncGroups.map((group) =>
    group.id === payload.groupId
      ? (() => {
          const nextFollowerRecords = group.followerRecords.map((follower) =>
            follower.id === payload.followerId
              ? {
                  ...follower,
                  healthState: nextFollowerState.healthState,
                  currentDrift: nextFollowerState.currentDrift,
                  lastDriftAt:
                    nextFollowerState.healthState === "healthy" || nextFollowerState.healthState === "flattened"
                      ? follower.lastDriftAt
                      : now,
                  positionSnapshot: nextFollowerState.positionSnapshot,
                  protectionSnapshot: nextFollowerState.protectionSnapshot,
                  repairHistory: [nextFollowerState.repairEvent, ...follower.repairHistory].slice(0, 8),
                }
              : follower
          );

          return {
          ...group,
          followerRecords: nextFollowerRecords,
          repairState: deriveGroupRepairStateFromFollowers(nextFollowerRecords),
          lastEventAt: now,
        }
      })()
      : group
  );

  const nextSnapshot = await writeTradeSyncerStoreSnapshot({
    ...snapshot,
    syncGroups: nextGroups,
    auditTrail: [
      createAuditEntry(
        "sync_group_updated",
        `Follower-level repair action ${payload.action} applied to ${followerLabel} in ${existingGroup.label}.`
      ),
      ...snapshot.auditTrail,
    ].slice(0, 40),
  });

  const entry = await appendTradeSyncerLog({
    groupId: existingGroup.id,
    accountId: existingFollower.accountId,
    severity: nextFollowerState.logSeverity,
    title: nextFollowerState.logTitle,
    detail: nextFollowerState.logDetail,
    status: nextFollowerState.logStatus,
  });

  const updatedGroup = nextGroups.find((group) => group.id === payload.groupId) ?? null;
  if (updatedGroup) {
    const transitionEntries = buildFollowerSnapshotTransitionEntries({
      previousGroup: existingGroup,
      nextGroup: updatedGroup,
      accountMap,
      titlePrefix: "Follower repair",
    });
    for (const transitionEntry of transitionEntries) {
      await appendTradeSyncerLog(transitionEntry);
    }
  }
  return {
    updatedAt: nextSnapshot.updatedAt,
    syncGroup: updatedGroup,
    follower: updatedGroup?.followerRecords.find((follower) => follower.id === payload.followerId) ?? null,
    logEntry: entry,
  };
}
