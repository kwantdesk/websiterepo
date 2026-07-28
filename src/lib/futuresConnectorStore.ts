import fs from "node:fs/promises";
import path from "node:path";

import type {
  FuturesAccountRecord,
  FuturesManagedProfileAuditEntry,
  FuturesManagedProfileStore,
  FuturesJournalEntry,
  FuturesRoutingProfile,
  RithmicDiscoveredAccount,
  TradovateDiscoveredAccount,
} from "@/lib/futuresConnectors";

type FuturesStoreSnapshot = {
  updatedAt: string;
  routingProfiles: FuturesRoutingProfile[];
  accounts: FuturesAccountRecord[];
  auditTrail: FuturesManagedProfileAuditEntry[];
  journal: FuturesJournalEntry[];
};

const FUTURES_STATE_DIRECTORY = path.join(process.cwd(), "data-cache");
const FUTURES_STATE_FILE = path.join(FUTURES_STATE_DIRECTORY, "futures-connector-profiles.json");

async function ensurePersistenceDirectory() {
  await fs.mkdir(FUTURES_STATE_DIRECTORY, { recursive: true });
}

async function readSnapshot(): Promise<FuturesStoreSnapshot | null> {
  try {
    const raw = await fs.readFile(FUTURES_STATE_FILE, "utf8");
    return JSON.parse(raw) as FuturesStoreSnapshot;
  } catch {
    return null;
  }
}

async function writeSnapshot(snapshot: FuturesStoreSnapshot) {
  await ensurePersistenceDirectory();
  await fs.writeFile(FUTURES_STATE_FILE, JSON.stringify(snapshot, null, 2));
}

function cloneProfiles<T>(value: T): T {
  return structuredClone(value);
}

function mergeDefaultProfilesById<T extends { id: string }>(existing: T[], defaults: T[]) {
  const existingIds = new Set(existing.map((item) => item.id));
  return [...cloneProfiles(existing), ...defaults.filter((item) => !existingIds.has(item.id)).map((item) => cloneProfiles(item))];
}

function normalizeSnapshot(
  snapshot: Partial<FuturesStoreSnapshot> | null,
  defaults: { routingProfiles: FuturesRoutingProfile[]; accounts: FuturesAccountRecord[] }
): FuturesStoreSnapshot {
  return {
    updatedAt:
      typeof snapshot?.updatedAt === "string" && snapshot.updatedAt.trim()
        ? snapshot.updatedAt
        : new Date().toISOString(),
    routingProfiles: Array.isArray(snapshot?.routingProfiles) && snapshot.routingProfiles.length
      ? mergeDefaultProfilesById(snapshot.routingProfiles, defaults.routingProfiles)
      : cloneProfiles(defaults.routingProfiles),
    accounts: Array.isArray(snapshot?.accounts) && snapshot.accounts.length
      ? mergeDefaultProfilesById(snapshot.accounts, defaults.accounts)
      : cloneProfiles(defaults.accounts),
    auditTrail: Array.isArray(snapshot?.auditTrail) ? cloneProfiles(snapshot.auditTrail) : [],
    journal: Array.isArray(snapshot?.journal) ? cloneProfiles(snapshot.journal) : [],
  };
}

function createAuditEntry(
  kind: FuturesManagedProfileAuditEntry["kind"],
  detail: string
): FuturesManagedProfileAuditEntry {
  return {
    id: `audit_${crypto.randomUUID()}`,
    kind,
    detail,
    occurredAt: new Date().toISOString(),
  };
}

export async function getManagedFuturesProfileStore(defaults: {
  routingProfiles: FuturesRoutingProfile[];
  accounts: FuturesAccountRecord[];
}): Promise<FuturesManagedProfileStore> {
  const existing = await readSnapshot();
  const normalized = normalizeSnapshot(existing, defaults);

  const snapshotMissing =
    !existing ||
    !Array.isArray(existing.routingProfiles) ||
    !Array.isArray(existing.accounts) ||
    !existing.updatedAt;

  const migratedMissingDefaults =
    !!existing &&
    ((Array.isArray(existing.routingProfiles) &&
      defaults.routingProfiles.some((profile) => !existing.routingProfiles.some((item) => item.id === profile.id))) ||
      (Array.isArray(existing.accounts) &&
        defaults.accounts.some((account) => !existing.accounts.some((item) => item.id === account.id))));

  if (snapshotMissing || migratedMissingDefaults) {
    await writeSnapshot(normalized);
  }

  return {
    descriptor: {
      kind: "file_json",
      location: FUTURES_STATE_FILE,
    },
    updatedAt: normalized.updatedAt,
    routingProfiles: normalized.routingProfiles,
    accounts: normalized.accounts,
    auditTrail: normalized.auditTrail,
    journal: normalized.journal,
    notes: [
      "Futures route and account profiles are now persisted locally so adapter bindings stop depending only on hardcoded seed arrays.",
      "Tradovate and Rithmic resolution should read from this managed profile store first, then fall back to seeded runtime assumptions only where live broker discovery is still missing.",
    ],
  };
}

export async function updateManagedFuturesProfileStore(snapshot: FuturesStoreSnapshot) {
  const nextSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
  await writeSnapshot(nextSnapshot);
  return nextSnapshot;
}

function createJournalEntry(entry: Omit<FuturesJournalEntry, "id" | "occurredAt"> & { occurredAt?: string }): FuturesJournalEntry {
  return {
    id: `journal_${crypto.randomUUID()}`,
    occurredAt: entry.occurredAt ?? new Date().toISOString(),
    ...entry,
  };
}

export async function appendManagedFuturesJournalEntry(
  defaults: { routingProfiles: FuturesRoutingProfile[]; accounts: FuturesAccountRecord[] },
  entry: Omit<FuturesJournalEntry, "id" | "occurredAt"> & { occurredAt?: string }
) {
  const store = await getManagedFuturesProfileStore(defaults);
  const nextSnapshot = await updateManagedFuturesProfileStore({
    updatedAt: store.updatedAt,
    routingProfiles: store.routingProfiles,
    accounts: store.accounts,
    auditTrail: store.auditTrail,
    journal: [createJournalEntry(entry), ...store.journal].slice(0, 80),
  });

  return nextSnapshot.journal[0] ?? null;
}

export async function updateManagedFuturesAccountBinding(
  defaults: { routingProfiles: FuturesRoutingProfile[]; accounts: FuturesAccountRecord[] },
  payload: {
    accountId: string;
    routeProfileId: string;
    riskProfileId?: string;
  }
) {
  const store = await getManagedFuturesProfileStore(defaults);
  const account = store.accounts.find((item) => item.id === payload.accountId);
  if (!account) {
    throw new Error("Managed futures account was not found.");
  }

  const route = store.routingProfiles.find((item) => item.id === payload.routeProfileId);
  if (!route) {
    throw new Error("Managed futures route profile was not found.");
  }

  if (route.venue !== account.venue) {
    throw new Error("Managed futures account and route must use the same venue.");
  }

  const nextAccounts = store.accounts.map((item) =>
    item.id === payload.accountId
      ? {
          ...item,
          routeProfileIds: [payload.routeProfileId],
          riskProfileId: payload.riskProfileId ?? item.riskProfileId,
          lastSyncAt: new Date().toISOString(),
          detail: `Managed binding now points at ${route.label}.`,
        }
      : item
  );

  const nextSnapshot = await updateManagedFuturesProfileStore({
    updatedAt: store.updatedAt,
    routingProfiles: store.routingProfiles,
    accounts: nextAccounts,
    auditTrail: [
      createAuditEntry(
        "account_binding_updated",
        `Managed futures account ${payload.accountId} was rebound to route ${payload.routeProfileId}${payload.riskProfileId ? ` with risk ${payload.riskProfileId}` : ""}.`
      ),
      ...store.auditTrail,
    ].slice(0, 25),
    journal: [
      createJournalEntry({
        category: "config",
        venue: account.venue,
        title: "Managed account binding updated",
        detail: `Account ${payload.accountId} now points at route ${payload.routeProfileId}${payload.riskProfileId ? ` with risk ${payload.riskProfileId}` : ""}.`,
        accountId: payload.accountId,
        routeProfileId: payload.routeProfileId,
        signalId: null,
        status: "ready",
        requestBody: payload as unknown as Record<string, unknown>,
        responseBody: null,
      }),
      ...store.journal,
    ].slice(0, 80),
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    account: nextAccounts.find((item) => item.id === payload.accountId) ?? null,
  };
}

export async function updateManagedFuturesRouteProfile(
  defaults: { routingProfiles: FuturesRoutingProfile[]; accounts: FuturesAccountRecord[] },
  payload: {
    routeProfileId: string;
    defaultQuantity: number;
  }
) {
  const store = await getManagedFuturesProfileStore(defaults);
  const route = store.routingProfiles.find((item) => item.id === payload.routeProfileId);
  if (!route) {
    throw new Error("Managed futures route profile was not found.");
  }

  if (!Number.isFinite(payload.defaultQuantity) || payload.defaultQuantity <= 0) {
    throw new Error("Managed futures route quantity must be a positive number.");
  }

  const nextRoutingProfiles = store.routingProfiles.map((item) =>
    item.id === payload.routeProfileId
      ? {
          ...item,
          defaultQuantity: payload.defaultQuantity,
          notes: `${item.notes} Managed default quantity updated.`,
        }
      : item
  );

  const nextSnapshot = await updateManagedFuturesProfileStore({
    updatedAt: store.updatedAt,
    routingProfiles: nextRoutingProfiles,
    accounts: store.accounts,
    auditTrail: [
      createAuditEntry(
        "route_profile_updated",
        `Managed futures route ${payload.routeProfileId} default quantity changed to ${payload.defaultQuantity}.`
      ),
      ...store.auditTrail,
    ].slice(0, 25),
    journal: [
      createJournalEntry({
        category: "config",
        venue: route.venue,
        title: "Managed route profile updated",
        detail: `Route ${payload.routeProfileId} default quantity changed to ${payload.defaultQuantity}.`,
        accountId: null,
        routeProfileId: payload.routeProfileId,
        signalId: null,
        status: "ready",
        requestBody: payload as unknown as Record<string, unknown>,
        responseBody: null,
      }),
      ...store.journal,
    ].slice(0, 80),
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    routeProfile: nextRoutingProfiles.find((item) => item.id === payload.routeProfileId) ?? null,
  };
}

export async function syncTradovateDiscoveredAccountsIntoManagedStore(
  defaults: { routingProfiles: FuturesRoutingProfile[]; accounts: FuturesAccountRecord[] },
  payload: {
    environment: FuturesAccountRecord["environment"];
    routeProfileId: string;
    riskProfileId: string;
    discoveredAccounts: TradovateDiscoveredAccount[];
  }
) {
  const store = await getManagedFuturesProfileStore(defaults);
  const route = store.routingProfiles.find((item) => item.id === payload.routeProfileId);
  if (!route || route.venue !== "tradovate") {
    throw new Error("Tradovate managed route profile was not found.");
  }

  const nextAccounts = cloneProfiles(store.accounts);

  for (const discovered of payload.discoveredAccounts) {
    const brokerAccountRef = discovered.id;
    const existingIndex = nextAccounts.findIndex(
      (item) => item.venue === "tradovate" && item.brokerAccountRef === brokerAccountRef
    );

    const nextAccount: FuturesAccountRecord = existingIndex >= 0
      ? {
          ...nextAccounts[existingIndex],
          environment: payload.environment,
          brokerAccountRef,
          label: discovered.name || nextAccounts[existingIndex].label,
          status: discovered.active === false ? "planned" : "build_first",
          tone: discovered.active === false ? "warning" : "ready",
          connectionState: discovered.active === false ? "planned" : "connected",
          routeProfileIds: [payload.routeProfileId],
          riskProfileId: payload.riskProfileId,
          lastSyncAt: new Date().toISOString(),
          detail: `Synced from Tradovate account/list. Broker account ${brokerAccountRef}${discovered.accountType ? ` · ${discovered.accountType}` : ""}.`,
        }
      : {
          id: `tradovate-managed-${brokerAccountRef}`,
          venue: "tradovate",
          environment: payload.environment,
          brokerAccountRef,
          label: discovered.name || `Tradovate Account ${brokerAccountRef}`,
          firm: "Tradovate discovered lane",
          platformAccess: "Tradovate Partner API",
          status: discovered.active === false ? "planned" : "build_first",
          tone: discovered.active === false ? "warning" : "ready",
          connectionState: discovered.active === false ? "planned" : "connected",
          riskProfileId: payload.riskProfileId,
          routeProfileIds: [payload.routeProfileId],
          lastSyncAt: new Date().toISOString(),
          detail: `Created from Tradovate account/list sync for broker account ${brokerAccountRef}.`,
        };

    if (existingIndex >= 0) {
      nextAccounts[existingIndex] = nextAccount;
    } else {
      nextAccounts.unshift(nextAccount);
    }
  }

  const nextSnapshot = await updateManagedFuturesProfileStore({
    updatedAt: store.updatedAt,
    routingProfiles: store.routingProfiles,
    accounts: nextAccounts,
    auditTrail: [
      createAuditEntry(
        "tradovate_accounts_synced",
        `Imported ${payload.discoveredAccounts.length} Tradovate discovered account${payload.discoveredAccounts.length === 1 ? "" : "s"} into route ${payload.routeProfileId}.`
      ),
      ...store.auditTrail,
    ].slice(0, 25),
    journal: [
      createJournalEntry({
        category: "sync",
        venue: "tradovate",
        title: "Tradovate accounts synced",
        detail: `Imported ${payload.discoveredAccounts.length} discovered Tradovate account${payload.discoveredAccounts.length === 1 ? "" : "s"} into route ${payload.routeProfileId}.`,
        accountId: null,
        routeProfileId: payload.routeProfileId,
        signalId: null,
        status: "ready",
        requestBody: {
          environment: payload.environment,
          routeProfileId: payload.routeProfileId,
          riskProfileId: payload.riskProfileId,
          importedAccounts: payload.discoveredAccounts.length,
        },
        responseBody: null,
      }),
      ...store.journal,
    ].slice(0, 80),
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    importedAccounts: payload.discoveredAccounts.length,
    accounts: nextAccounts.filter((item) => item.venue === "tradovate"),
  };
}

export async function syncRithmicDiscoveredAccountsIntoManagedStore(
  defaults: { routingProfiles: FuturesRoutingProfile[]; accounts: FuturesAccountRecord[] },
  payload: {
    environment: FuturesAccountRecord["environment"];
    routeProfileId: string;
    riskProfileId: string;
    discoveredAccounts: RithmicDiscoveredAccount[];
  }
) {
  const store = await getManagedFuturesProfileStore(defaults);
  const route = store.routingProfiles.find((item) => item.id === payload.routeProfileId);
  if (!route || route.venue !== "rithmic") {
    throw new Error("Rithmic managed route profile was not found.");
  }

  const nextAccounts = cloneProfiles(store.accounts);

  for (const discovered of payload.discoveredAccounts) {
    const brokerAccountRef = discovered.id;
    const existingIndex = nextAccounts.findIndex(
      (item) => item.venue === "rithmic" && item.brokerAccountRef === brokerAccountRef
    );

    const baseDetail = discovered.systemName
      ? `Rithmic ${discovered.systemName}${discovered.userId ? ` / ${discovered.userId}` : ""}`
      : `Rithmic account ${brokerAccountRef}`;

    const nextAccount: FuturesAccountRecord =
      existingIndex >= 0
        ? {
            ...nextAccounts[existingIndex],
            environment: payload.environment,
            brokerAccountRef,
            label: discovered.label || nextAccounts[existingIndex].label,
            firm: discovered.firm || nextAccounts[existingIndex].firm,
            status: discovered.active === false ? "planned" : "build_next",
            tone: discovered.active === false ? "warning" : "ready",
            connectionState: discovered.active === false ? "planned" : "connected",
            routeProfileIds: [payload.routeProfileId],
            riskProfileId: payload.riskProfileId,
            lastSyncAt: new Date().toISOString(),
            detail: `Synced from Rithmic account assumptions. ${baseDetail}${discovered.routeMode ? ` · ${discovered.routeMode.replaceAll("_", " ")}` : ""}.`,
          }
        : {
            id: `rithmic-managed-${brokerAccountRef.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
            venue: "rithmic",
            environment: payload.environment,
            brokerAccountRef,
            label: discovered.label || `Rithmic Account ${brokerAccountRef}`,
            firm: discovered.firm || "Rithmic discovered lane",
            platformAccess: "Rithmic dev kit + conformance",
            status: discovered.active === false ? "planned" : "build_next",
            tone: discovered.active === false ? "warning" : "ready",
            connectionState: discovered.active === false ? "planned" : "connected",
            riskProfileId: payload.riskProfileId,
            routeProfileIds: [payload.routeProfileId],
            lastSyncAt: new Date().toISOString(),
            detail: `Created from Rithmic account assumptions for ${baseDetail}.`,
          };

    if (existingIndex >= 0) {
      nextAccounts[existingIndex] = nextAccount;
    } else {
      nextAccounts.unshift(nextAccount);
    }
  }

  const nextSnapshot = await updateManagedFuturesProfileStore({
    updatedAt: store.updatedAt,
    routingProfiles: store.routingProfiles,
    accounts: nextAccounts,
    auditTrail: [
      createAuditEntry(
        "rithmic_accounts_synced",
        `Imported ${payload.discoveredAccounts.length} Rithmic discovered account${payload.discoveredAccounts.length === 1 ? "" : "s"} into route ${payload.routeProfileId}.`
      ),
      ...store.auditTrail,
    ].slice(0, 25),
    journal: [
      createJournalEntry({
        category: "sync",
        venue: "rithmic",
        title: "Rithmic accounts synced",
        detail: `Imported ${payload.discoveredAccounts.length} discovered Rithmic account${payload.discoveredAccounts.length === 1 ? "" : "s"} into route ${payload.routeProfileId}.`,
        accountId: null,
        routeProfileId: payload.routeProfileId,
        signalId: null,
        status: "ready",
        requestBody: {
          environment: payload.environment,
          routeProfileId: payload.routeProfileId,
          riskProfileId: payload.riskProfileId,
          importedAccounts: payload.discoveredAccounts.length,
        },
        responseBody: null,
      }),
      ...store.journal,
    ].slice(0, 80),
  });

  return {
    updatedAt: nextSnapshot.updatedAt,
    importedAccounts: payload.discoveredAccounts.length,
    accounts: nextAccounts.filter((item) => item.venue === "rithmic"),
  };
}
