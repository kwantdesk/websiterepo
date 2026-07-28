import fs from "node:fs/promises";
import path from "node:path";

import type { TradeSyncerAccountRecord, TradeSyncerFollowerRecord, TradeSyncerStore } from "@/lib/tradeSyncer";
import { createTradeSyncerSeedStore } from "@/lib/tradeSyncer";

const TRADE_SYNCER_STATE_DIRECTORY = path.join(process.cwd(), "data-cache");
const TRADE_SYNCER_STATE_FILE = path.join(TRADE_SYNCER_STATE_DIRECTORY, "trade-syncer-store.json");

async function ensurePersistenceDirectory() {
  await fs.mkdir(TRADE_SYNCER_STATE_DIRECTORY, { recursive: true });
}

async function readSnapshot(): Promise<TradeSyncerStore | null> {
  try {
    const raw = await fs.readFile(TRADE_SYNCER_STATE_FILE, "utf8");
    return JSON.parse(raw) as TradeSyncerStore;
  } catch {
    return null;
  }
}

async function writeSnapshot(snapshot: TradeSyncerStore) {
  await ensurePersistenceDirectory();
  await fs.writeFile(TRADE_SYNCER_STATE_FILE, JSON.stringify(snapshot, null, 2));
}

function cloneStore(snapshot: TradeSyncerStore): TradeSyncerStore {
  return structuredClone(snapshot);
}

function normalizeAccountRecord(
  account: Partial<TradeSyncerAccountRecord>,
  seedAccount?: TradeSyncerAccountRecord
): TradeSyncerAccountRecord {
  return {
    id: typeof account.id === "string" && account.id.trim() ? account.id : seedAccount?.id ?? `ts_account_${crypto.randomUUID()}`,
    label:
      typeof account.label === "string" && account.label.trim()
        ? account.label
        : seedAccount?.label ?? "Trade Syncer Account",
    brokerAccountRef:
      typeof account.brokerAccountRef === "string" && account.brokerAccountRef.trim()
        ? account.brokerAccountRef
        : seedAccount?.brokerAccountRef ?? "",
    venue:
      account.venue === "tradovate" ||
      account.venue === "rithmic" ||
      account.venue === "metatrader5" ||
      account.venue === "metatrader4" ||
      account.venue === "ctrader" ||
      account.venue === "dxtrade" ||
      account.venue === "matchtrader" ||
      account.venue === "tradelocker" ||
      account.venue === "projectx" ||
      account.venue === "quantower"
        ? account.venue
        : seedAccount?.venue ?? "tradovate",
    environment:
      account.environment === "demo" ||
      account.environment === "live" ||
      account.environment === "staging"
        ? account.environment
        : seedAccount?.environment ?? "demo",
    managedFuturesAccountId:
      typeof account.managedFuturesAccountId === "string" || account.managedFuturesAccountId === null
        ? account.managedFuturesAccountId
        : seedAccount?.managedFuturesAccountId ?? null,
    connectionState:
      account.connectionState === "connected" ||
      account.connectionState === "needs_reauth" ||
      account.connectionState === "review" ||
      account.connectionState === "draft"
        ? account.connectionState
        : seedAccount?.connectionState ?? "draft",
    syncStatus:
      account.syncStatus === "enabled" ||
      account.syncStatus === "review" ||
      account.syncStatus === "paused"
        ? account.syncStatus
        : seedAccount?.syncStatus ?? "review",
    balance: typeof account.balance === "number" ? account.balance : seedAccount?.balance ?? 0,
    equity: typeof account.equity === "number" ? account.equity : seedAccount?.equity ?? 0,
    timezone:
      typeof account.timezone === "string" && account.timezone.trim()
        ? account.timezone
        : seedAccount?.timezone ?? "Broker local",
    enabledSymbols: Array.isArray(account.enabledSymbols)
      ? structuredClone(account.enabledSymbols)
      : seedAccount?.enabledSymbols ?? [],
    healthNote:
      typeof account.healthNote === "string" && account.healthNote.trim()
        ? account.healthNote
        : seedAccount?.healthNote ?? "Account awaiting review.",
    lastHeartbeatAt:
      typeof account.lastHeartbeatAt === "string" || account.lastHeartbeatAt === null
        ? account.lastHeartbeatAt
        : seedAccount?.lastHeartbeatAt ?? null,
  };
}

function normalizeFollowerRecord(
  follower: Partial<TradeSyncerFollowerRecord>,
  seedFollower?: TradeSyncerFollowerRecord
): TradeSyncerFollowerRecord {
  return {
    id: typeof follower.id === "string" && follower.id.trim() ? follower.id : seedFollower?.id ?? `ts_follower_${crypto.randomUUID()}`,
    accountId:
      typeof follower.accountId === "string" && follower.accountId.trim()
        ? follower.accountId
        : seedFollower?.accountId ?? "",
    riskType:
      typeof follower.riskType === "string" && follower.riskType.trim()
        ? follower.riskType
        : seedFollower?.riskType ?? "Fixed Lot",
    riskSetting:
      typeof follower.riskSetting === "string" && follower.riskSetting.trim()
        ? follower.riskSetting
        : seedFollower?.riskSetting ?? "1 contract",
    templateId:
      typeof follower.templateId === "string" || follower.templateId === null
        ? follower.templateId
        : seedFollower?.templateId ?? null,
    status: follower.status ?? seedFollower?.status ?? "enabled",
    healthState: follower.healthState ?? seedFollower?.healthState ?? "monitoring",
    currentDrift:
      typeof follower.currentDrift === "string" || follower.currentDrift === null
        ? follower.currentDrift
        : seedFollower?.currentDrift ?? null,
    lastDriftAt:
      typeof follower.lastDriftAt === "string" || follower.lastDriftAt === null
        ? follower.lastDriftAt
        : seedFollower?.lastDriftAt ?? null,
    positionSnapshot:
      typeof follower.positionSnapshot === "object" && follower.positionSnapshot !== null
        ? {
            symbol:
              typeof follower.positionSnapshot.symbol === "string" && follower.positionSnapshot.symbol.trim()
                ? follower.positionSnapshot.symbol
                : seedFollower?.positionSnapshot.symbol ?? "MNQ",
            side:
              follower.positionSnapshot.side === "long" ||
              follower.positionSnapshot.side === "short" ||
              follower.positionSnapshot.side === "flat"
                ? follower.positionSnapshot.side
                : seedFollower?.positionSnapshot.side ?? "flat",
            quantity:
              typeof follower.positionSnapshot.quantity === "number"
                ? follower.positionSnapshot.quantity
                : seedFollower?.positionSnapshot.quantity ?? 0,
            avgEntryPrice:
              typeof follower.positionSnapshot.avgEntryPrice === "number" ||
              follower.positionSnapshot.avgEntryPrice === null
                ? follower.positionSnapshot.avgEntryPrice
                : seedFollower?.positionSnapshot.avgEntryPrice ?? null,
            state:
              follower.positionSnapshot.state === "flat" ||
              follower.positionSnapshot.state === "entry_working" ||
              follower.positionSnapshot.state === "open" ||
              follower.positionSnapshot.state === "partial_exit" ||
              follower.positionSnapshot.state === "flattening"
                ? follower.positionSnapshot.state
                : seedFollower?.positionSnapshot.state ?? "flat",
            updatedAt:
              typeof follower.positionSnapshot.updatedAt === "string" || follower.positionSnapshot.updatedAt === null
                ? follower.positionSnapshot.updatedAt
                : seedFollower?.positionSnapshot.updatedAt ?? null,
          }
        : structuredClone(
            seedFollower?.positionSnapshot ?? {
              symbol: "MNQ",
              side: "flat",
              quantity: 0,
              avgEntryPrice: null,
              state: "flat",
              updatedAt: null,
            }
          ),
    protectionSnapshot:
      typeof follower.protectionSnapshot === "object" && follower.protectionSnapshot !== null
        ? {
            stopLossState:
              follower.protectionSnapshot.stopLossState === "working" ||
              follower.protectionSnapshot.stopLossState === "missing" ||
              follower.protectionSnapshot.stopLossState === "not_needed"
                ? follower.protectionSnapshot.stopLossState
                : seedFollower?.protectionSnapshot.stopLossState ?? "not_needed",
            takeProfitState:
              follower.protectionSnapshot.takeProfitState === "working" ||
              follower.protectionSnapshot.takeProfitState === "missing" ||
              follower.protectionSnapshot.takeProfitState === "not_needed"
                ? follower.protectionSnapshot.takeProfitState
                : seedFollower?.protectionSnapshot.takeProfitState ?? "not_needed",
            workingLegCount:
              typeof follower.protectionSnapshot.workingLegCount === "number"
                ? follower.protectionSnapshot.workingLegCount
                : seedFollower?.protectionSnapshot.workingLegCount ?? 0,
            lastRestagedAt:
              typeof follower.protectionSnapshot.lastRestagedAt === "string" ||
              follower.protectionSnapshot.lastRestagedAt === null
                ? follower.protectionSnapshot.lastRestagedAt
                : seedFollower?.protectionSnapshot.lastRestagedAt ?? null,
            state:
              follower.protectionSnapshot.state === "none" ||
              follower.protectionSnapshot.state === "staged" ||
              follower.protectionSnapshot.state === "protected" ||
              follower.protectionSnapshot.state === "restaging" ||
              follower.protectionSnapshot.state === "missing"
                ? follower.protectionSnapshot.state
                : seedFollower?.protectionSnapshot.state ?? "none",
          }
        : structuredClone(
            seedFollower?.protectionSnapshot ?? {
              stopLossState: "not_needed",
              takeProfitState: "not_needed",
              workingLegCount: 0,
              lastRestagedAt: null,
              state: "none",
            }
          ),
    override: follower.override ?? seedFollower?.override ?? null,
    repairHistory: Array.isArray(follower.repairHistory)
      ? structuredClone(follower.repairHistory)
      : seedFollower?.repairHistory ?? [],
  };
}

function normalizeSnapshot(snapshot: TradeSyncerStore | null): TradeSyncerStore {
  const seed = createTradeSyncerSeedStore();
  const seedAccountsById = new Map(seed.accounts.map((account) => [account.id, account]));

  return {
    updatedAt:
      typeof snapshot?.updatedAt === "string" && snapshot.updatedAt.trim()
        ? snapshot.updatedAt
        : seed.updatedAt,
    accounts: Array.isArray(snapshot?.accounts) && snapshot.accounts.length
      ? snapshot.accounts.map((account, accountIndex) =>
          normalizeAccountRecord(
            account,
            seedAccountsById.get(account.id ?? "") ?? seed.accounts[accountIndex]
          )
        )
      : seed.accounts,
    templates: Array.isArray(snapshot?.templates) && snapshot.templates.length
      ? structuredClone(snapshot.templates)
      : seed.templates,
    syncGroups:
      Array.isArray(snapshot?.syncGroups) && snapshot.syncGroups.length
        ? snapshot.syncGroups.map((group, groupIndex) => {
            const seedGroup = seed.syncGroups[groupIndex];
            return {
              ...structuredClone(group),
              followerRecords: Array.isArray(group.followerRecords)
                ? group.followerRecords.map((follower, followerIndex) =>
                    normalizeFollowerRecord(follower, seedGroup?.followerRecords[followerIndex])
                  )
                : seedGroup?.followerRecords ?? [],
            };
          })
        : seed.syncGroups,
    logs: Array.isArray(snapshot?.logs) && snapshot.logs.length
      ? structuredClone(snapshot.logs)
      : seed.logs,
    auditTrail: Array.isArray(snapshot?.auditTrail)
      ? structuredClone(snapshot.auditTrail)
      : seed.auditTrail,
  };
}

function applyKnownFixtureUpgrades(snapshot: TradeSyncerStore) {
  const next = cloneStore(snapshot);
  const seed = createTradeSyncerSeedStore();
  const seedAccountsById = new Map(seed.accounts.map((account) => [account.id, account]));
  const seedGroupsById = new Map(seed.syncGroups.map((group) => [group.id, group]));
  let changed = false;

  for (const seedAccountId of ["ts_account_rithmic_sim_lead", "ts_account_rithmic_follower_a"]) {
    const existingAccount = next.accounts.find((account) => account.id === seedAccountId);
    const seedAccount = seedAccountsById.get(seedAccountId);
    if (!existingAccount || !seedAccount) {
      continue;
    }

    const desiredFields: Array<keyof TradeSyncerAccountRecord> = [
      "managedFuturesAccountId",
      "connectionState",
      "syncStatus",
      "healthNote",
      "lastHeartbeatAt",
    ];

    for (const field of desiredFields) {
      if (existingAccount[field] !== seedAccount[field]) {
        (existingAccount as Record<string, unknown>)[field] = seedAccount[field];
        changed = true;
      }
    }
  }

  const existingRithmicGroup = next.syncGroups.find((group) => group.id === "ts_group_rithmic_test_ladder");
  const seedRithmicGroup = seedGroupsById.get("ts_group_rithmic_test_ladder");
  if (existingRithmicGroup && seedRithmicGroup) {
    const groupFields: Array<keyof typeof seedRithmicGroup> = [
      "status",
      "repairState",
      "openPositions",
      "medianCopyLagMs",
      "lastEventAt",
    ];

    for (const field of groupFields) {
      if (existingRithmicGroup[field] !== seedRithmicGroup[field]) {
        (existingRithmicGroup as Record<string, unknown>)[field] = seedRithmicGroup[field];
        changed = true;
      }
    }

    const existingFollower = existingRithmicGroup.followerRecords.find(
      (follower) => follower.id === "ts_follower_rithmic_a"
    );
    const seedFollower = seedRithmicGroup.followerRecords.find(
      (follower) => follower.id === "ts_follower_rithmic_a"
    );

    if (existingFollower && seedFollower) {
      const followerFields: Array<keyof TradeSyncerFollowerRecord> = [
        "status",
        "healthState",
        "currentDrift",
        "lastDriftAt",
        "positionSnapshot",
        "protectionSnapshot",
        "repairHistory",
      ];

      for (const field of followerFields) {
        const current = JSON.stringify(existingFollower[field]);
        const desired = JSON.stringify(seedFollower[field]);
        if (current !== desired) {
          (existingFollower as Record<string, unknown>)[field] = structuredClone(seedFollower[field]);
          changed = true;
        }
      }
    }
  }

  const existingAccountIds = new Set(next.accounts.map((account) => account.id));
  for (const seedAccount of seed.accounts) {
    if (!existingAccountIds.has(seedAccount.id)) {
      next.accounts.push(structuredClone(seedAccount));
      changed = true;
    }
  }

  const existingGroupIds = new Set(next.syncGroups.map((group) => group.id));
  for (const seedGroup of seed.syncGroups) {
    if (!existingGroupIds.has(seedGroup.id)) {
      next.syncGroups.push(structuredClone(seedGroup));
      changed = true;
    }
  }

  return { snapshot: next, changed };
}

export async function getTradeSyncerStoreSnapshot(): Promise<TradeSyncerStore> {
  const existing = await readSnapshot();
  const normalized = normalizeSnapshot(existing);
  const upgraded = applyKnownFixtureUpgrades(normalized);

  const snapshotMissing =
    !existing ||
    !Array.isArray(existing.accounts) ||
    !Array.isArray(existing.templates) ||
    !Array.isArray(existing.syncGroups) ||
    !Array.isArray(existing.logs);

  const migratedFollowersMissing =
    !!existing &&
    Array.isArray(existing.syncGroups) &&
    existing.syncGroups.some((group) =>
      Array.isArray(group.followerRecords)
        ? group.followerRecords.some(
            (follower) =>
              !("healthState" in follower) ||
              !("currentDrift" in follower) ||
              !("lastDriftAt" in follower) ||
              !("positionSnapshot" in follower) ||
              !("protectionSnapshot" in follower) ||
              !("repairHistory" in follower)
          )
        : false
    );

  const migratedAccountsMissing =
    !!existing &&
    Array.isArray(existing.accounts) &&
    existing.accounts.some((account) => !("managedFuturesAccountId" in account));

  if (snapshotMissing || migratedFollowersMissing || migratedAccountsMissing || upgraded.changed) {
    await writeSnapshot(upgraded.snapshot);
  }

  return cloneStore(upgraded.snapshot);
}

export async function writeTradeSyncerStoreSnapshot(snapshot: TradeSyncerStore) {
  const nextSnapshot: TradeSyncerStore = {
    ...cloneStore(snapshot),
    updatedAt: new Date().toISOString(),
  };
  await writeSnapshot(nextSnapshot);
  return nextSnapshot;
}

export function getTradeSyncerStoreDescriptor() {
  return {
    kind: "file_json" as const,
    location: TRADE_SYNCER_STATE_FILE,
  };
}
