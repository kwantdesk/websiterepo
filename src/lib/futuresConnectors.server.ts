import {
  FUTURES_CONNECTOR_SCHEMA_VERSION,
  type FuturesAccountRecord,
  type FuturesAdapterRuntimeStatus,
  type FuturesConnectorAdapterProfile,
  type FuturesConnectorOverview,
  type FuturesExecutionEvent,
  type FuturesQueuedCommand,
  type FuturesRiskProfile,
  type RithmicAdapterBoundary,
  type RithmicDispatchAttemptResult,
  type RithmicLiveSubmitHandoff,
  type RithmicOrderPreview,
  type RithmicProtocolServiceAttemptResult,
  type RithmicProtocolServiceConfig,
  type RithmicSimulatedLifecycleEvent,
  type RithmicProtocolStubAttemptResult,
  type RithmicTransportAttemptResult,
  type RithmicTransportPacket,
  type RithmicSubmitAttemptResult,
  type FuturesRoutingProfile,
  type FuturesConnectorSignalIntent,
  type RithmicAccountDiscovery,
  type RithmicExecutionBlueprint,
  type RithmicGatewayScenario,
  type RithmicRouteBinding,
  type RithmicSessionBlueprint,
  type TradovateAccountDiscovery,
  type TradovateConnectionConfigSummary,
  type TradovateRetailConnectStatus,
  type TradovateBrokerState,
  type TradovateDiscoveredAccount,
  type TradovateControlResult,
  type TradovateRouteBinding,
  type TradovateSessionDiscovery,
  type TradovateSubmitResult,
} from "@/lib/futuresConnectors";
import {
  appendManagedFuturesJournalEntry,
  getManagedFuturesProfileStore,
  syncRithmicDiscoveredAccountsIntoManagedStore,
  syncTradovateDiscoveredAccountsIntoManagedStore,
  updateManagedFuturesAccountBinding,
  updateManagedFuturesRouteProfile,
} from "@/lib/futuresConnectorStore";
import { buildTradovateOrderPreview, buildTradovateOrderRequest } from "@/lib/tradovateAdapter";
import { buildRithmicLiveSubmitHandoff, buildRithmicOrderPreview, normalizeRithmicApiFlavor, RITHMIC_FLAVOR_BLUEPRINTS } from "@/lib/rithmicAdapter";
import { buildRithmicAdapterBoundary, stageRithmicTransportDispatch } from "@/lib/rithmicAdapterRuntime";
import { buildRithmicTransportPacket, runRithmicTransportStub } from "@/lib/rithmicProtocolTransport";
import { getRithmicProtocolServiceConfig, runRithmicProtocolService } from "@/lib/rithmicProtocolService";
import { handleRithmicProtocolStubPacket } from "@/lib/rithmicProtocolStub";
import {
  clearStoredTradovateConnectionConfig,
  getTradovateConnectionStoreLocation,
  readStoredTradovateConnectionConfigSync,
  saveStoredTradovateConnectionConfig,
} from "@/lib/tradovateConnectionStore";
import {
  clearStoredTradovateOAuthConnection,
  getTradovateOAuthStoreLocation,
  readStoredTradovateOAuthConnectionSync,
  saveStoredTradovateOAuthConnection,
} from "@/lib/tradovateOAuthStore";

const futuresAdapters: FuturesConnectorAdapterProfile[] = [
  {
    id: "tradovate-direct",
    venue: "tradovate",
    name: "Tradovate Direct",
    status: "build_first",
    rationale:
      "Best first direct futures execution adapter. Official REST + WebSocket partner surface, explicit live/demo environments, documented account/risk operations, and official bracket order semantics.",
    accessModel: "tradovate_partner_api",
    capabilities: [
      "rest_auth",
      "websocket_auth",
      "market_data_ws",
      "order_placement",
      "order_cancel",
      "order_modify",
      "oso",
      "oco",
      "account_creation",
      "account_risk_controls",
      "position_sync",
      "execution_reports",
      "conformance_required",
    ],
    environments: [
      {
        label: "Staging Demo",
        kind: "staging",
        apiBase: "https://demo-api.staging.ninjatrader.dev/v1",
        websocket: "wss://demo-api.staging.ninjatrader.dev/v1/websocket",
        marketDataBase: "https://md-api.staging.ninjatrader.dev",
      },
      {
        label: "Production Demo",
        kind: "demo",
        apiBase: "https://demo.tradovateapi.com/v1",
        websocket: "wss://demo.tradovateapi.com/v1/websocket",
        marketDataBase: "https://md.tradovateapi.com",
      },
      {
        label: "Production Live",
        kind: "live",
        apiBase: "https://live.tradovateapi.com/v1",
        websocket: "wss://live.tradovateapi.com/v1/websocket",
        marketDataBase: "https://md.tradovateapi.com",
      },
    ],
    requirements: [
      "Partner / org admin credentials, API key, and CID for the partner surface.",
      "Conformance testing required before production access is granted.",
      "Retail API path separately requires live account, balance minimum, CME paperwork, and API Access add-on.",
    ],
    docs: [
      {
        label: "Partner API Intro",
        url: "https://partner.ninjatrader.com/nt-prop/overview/welcome/introduction-to-tradovate-partner-api",
        note: "Partner capabilities, environments, auth prerequisites, and market-data surface.",
      },
      {
        label: "Quickstart",
        url: "https://partner.ninjatrader.com/nt-prop/overview/quick-setup/5-minute-quickstart",
        note: "Access-token request flow and first-call sequence.",
      },
      {
        label: "Environments",
        url: "https://partner.ninjatrader.com/nt-prop/resources/reference/environments",
        note: "Staging vs production API and WebSocket endpoints.",
      },
      {
        label: "Conformance",
        url: "https://partner.ninjatrader.com/nt-prop/overview/conformance-testing/overview",
        note: "Authentication, websocket, and account-management conformance stages.",
      },
      {
        label: "Place OSO",
        url: "https://partner.ninjatrader.com/nt-prop/api/rest-api-endpoints/orders/place-oso",
        note: "Documented bracket / OSO order flow and explicit failure reasons.",
      },
      {
        label: "Retail API Access",
        url: "https://tradovate.zendesk.com/hc/en-us/articles/4403105829523-How-Do-I-Get-Access-to-the-Tradovate-API",
        note: "Useful constraints for retail-style direct access and account requirements.",
      },
    ],
  },
  {
    id: "rithmic-direct",
    venue: "rithmic",
    name: "Rithmic Direct",
    status: "build_next",
    rationale:
      "Strategically crucial second adapter for serious futures prop coverage. Rithmic exposes a normalized order-management backbone with server-side brackets, OCOs, and trailing features.",
    accessModel: "rithmic_dev_kit",
    capabilities: [
      "order_placement",
      "order_cancel",
      "order_modify",
      "oco",
      "server_side_brackets",
      "server_side_trailing",
      "position_sync",
      "symbol_metadata_lookup",
      "execution_reports",
      "conformance_required",
    ],
    environments: [
      {
        label: "Rithmic Test",
        kind: "test",
      },
      {
        label: "Rithmic Paper",
        kind: "demo",
      },
      {
        label: "Rithmic Live",
        kind: "live",
      },
    ],
    requirements: [
      "Request dev kit directly from Rithmic with organization/contact details and intended API flavor.",
      "Build against Rithmic Test before requesting production conformance.",
      "Pass conformance before connecting to production systems or live FCM credentials.",
    ],
    docs: [
      {
        label: "Rithmic Documentation",
        url: "https://www.rithmic.com/documentation",
        note: "Official API families, capabilities, and production onboarding flow.",
      },
    ],
  },
  {
    id: "cqg-later",
    venue: "cqg",
    name: "CQG Later",
    status: "later",
    rationale:
      "Worth considering later for additional broker / platform reach, but not the first futures execution spine.",
    accessModel: "terminal_shell",
    capabilities: ["order_placement", "position_sync"],
    environments: [{ label: "Later", kind: "live" }],
    requirements: ["Defer until real product demand or partner access requires CQG coverage."],
    docs: [],
  },
];

const futuresRoutingProfiles: FuturesRoutingProfile[] = [
  {
    id: "tradovate-prop-demo",
    label: "Tradovate Prop Demo",
    adapterId: "tradovate-direct",
    venue: "tradovate",
    environment: "demo",
    quantityMode: "fixed_contracts",
    defaultQuantity: 1,
    allowedOrderTypes: ["market", "limit", "stop", "stop_limit"],
    allowedTif: ["day", "gtc", "gtd", "ioc", "fok"],
    supportsBrackets: true,
    supportsTrailing: false,
    notes: "First serious build lane for futures connector architecture and prop-style demo workflows.",
  },
  {
    id: "rithmic-prop-live",
    label: "Rithmic Prop Live",
    adapterId: "rithmic-direct",
    venue: "rithmic",
    environment: "live",
    quantityMode: "fixed_contracts",
    defaultQuantity: 1,
    allowedOrderTypes: ["market", "limit", "stop", "stop_limit", "trailing_stop", "trailing_stop_limit"],
    allowedTif: ["day", "gtc", "gtd", "ioc", "fok"],
    supportsBrackets: true,
    supportsTrailing: true,
    notes: "Second adapter target for broader prop-firm coverage and richer server-side protection support.",
  },
];

const futuresRiskProfiles: FuturesRiskProfile[] = [
  {
    id: "risk-tradovate-prop-demo",
    label: "Tradovate Prop Demo Risk",
    maxContractsPerOrder: 5,
    maxOpenPositions: 3,
    duplicateWindowSeconds: 20,
    sessionWindow: "US index futures hours",
    killSwitchReady: true,
    notes: "First demo-safe risk profile for the Tradovate adapter while we build order and journal flow.",
  },
  {
    id: "risk-rithmic-prop-live",
    label: "Rithmic Prop Live Risk",
    maxContractsPerOrder: 10,
    maxOpenPositions: 5,
    duplicateWindowSeconds: 15,
    sessionWindow: "Broker / prop account session",
    killSwitchReady: true,
    notes: "Higher-performance second-lane profile once Rithmic access is available.",
  },
];

const futuresAccounts: FuturesAccountRecord[] = [
  {
    id: "tradovate-demo-sim-001",
    venue: "tradovate",
    environment: "demo",
    label: "Tradovate Sim Primary",
    firm: "Direct / partner test lane",
    platformAccess: "Tradovate Partner API",
    status: "build_first",
    tone: "ready",
    connectionState: "planned",
    riskProfileId: "risk-tradovate-prop-demo",
    routeProfileIds: ["tradovate-prop-demo"],
    lastSyncAt: null,
    detail: "First target account lane for the futures connector. This is where auth/session and order journal plumbing should begin.",
  },
  {
    id: "tradovate-live-prop-001",
    venue: "tradovate",
    environment: "live",
    label: "Tradovate Live Prop",
    firm: "Partner / prop distribution lane",
    platformAccess: "Tradovate Partner API",
    status: "planned",
    tone: "planned",
    connectionState: "planned",
    riskProfileId: "risk-tradovate-prop-demo",
    routeProfileIds: ["tradovate-prop-demo"],
    lastSyncAt: null,
    detail: "Live Tradovate lane stays gated until demo auth/session, sync, and order semantics are proven.",
  },
  {
    id: "tradovate-live-prop-002",
    venue: "tradovate",
    environment: "live",
    label: "Tradovate Live Prop B",
    firm: "Partner / prop distribution lane",
    platformAccess: "Tradovate Partner API",
    status: "planned",
    tone: "planned",
    connectionState: "planned",
    riskProfileId: "risk-tradovate-prop-demo",
    routeProfileIds: ["tradovate-prop-demo"],
    lastSyncAt: null,
    detail: "Second managed Tradovate live lane so Trade Syncer fanout can model distinct follower accounts instead of one shared placeholder.",
  },
  {
    id: "rithmic-live-prop-001",
    venue: "rithmic",
    environment: "live",
    label: "Rithmic Prop Primary",
    firm: "Prop / FCM-backed lane",
    platformAccess: "Rithmic dev kit + conformance",
    status: "build_next",
    tone: "warning",
    connectionState: "planned",
    riskProfileId: "risk-rithmic-prop-live",
    routeProfileIds: ["rithmic-prop-live"],
    lastSyncAt: null,
    detail: "Strategic second adapter after Tradovate. Needed for broader serious prop-firm coverage.",
  },
];

const sampleSignal: FuturesConnectorSignalIntent = {
  schemaVersion: FUTURES_CONNECTOR_SCHEMA_VERSION,
  signalId: "sig_fut_20260523_es_open_drive_v1",
  strategyId: "es_open_drive",
  versionId: "v1",
  venue: "tradovate",
  accountId: "sim-tradovate-001",
  symbol: "MESU6",
  side: "buy",
  quantityMode: "fixed_contracts",
  quantity: 1,
  orderType: "market",
  limitPrice: null,
  stopPrice: null,
  tif: "day",
  stopLoss: {
    mode: "ticks",
    value: 20,
  },
  takeProfit: {
    mode: "ticks",
    value: 40,
  },
  timestamp: "2026-05-23T14:31:00.000Z",
  comment: "KWANT:es_open_drive:v1",
};

const executionJournalPreview: FuturesExecutionEvent[] = [
  {
    id: "evt_fut_001",
    venue: "tradovate",
    accountId: "sim-tradovate-001",
    signalId: sampleSignal.signalId,
    stage: "received",
    detail: "Signal arrived from kwantify runtime and was accepted into the futures inbox.",
    occurredAt: "2026-05-23T14:31:00.000Z",
  },
  {
    id: "evt_fut_002",
    venue: "tradovate",
    accountId: "sim-tradovate-001",
    signalId: sampleSignal.signalId,
    stage: "validated",
    detail: "Route profile confirmed adapter, environment, symbol, and fixed-contract sizing policy.",
    occurredAt: "2026-05-23T14:31:00.120Z",
  },
  {
    id: "evt_fut_003",
    venue: "tradovate",
    accountId: "sim-tradovate-001",
    signalId: sampleSignal.signalId,
    stage: "submitted",
    detail: "Order submitted as an automated futures order with bracket-capable route semantics.",
    occurredAt: "2026-05-23T14:31:00.310Z",
  },
];

const signalInbox: FuturesExecutionEvent[] = [
  {
    id: "evt_fut_inbox_001",
    venue: "tradovate",
    accountId: "tradovate-demo-sim-001",
    signalId: "sig_fut_20260523_es_open_drive_v1",
    stage: "validated",
    detail: "Reference futures signal validated against the first Tradovate demo route.",
    occurredAt: "2026-05-23T14:31:00.120Z",
  },
];

const queuedCommands: FuturesQueuedCommand[] = [
  {
    id: "fut_cmd_001",
    adapterId: "tradovate-direct",
    routeProfileId: "tradovate-prop-demo",
    accountId: "tradovate-demo-sim-001",
    signal: sampleSignal,
    createdAt: "2026-05-23T14:31:00.130Z",
    status: "queued",
  },
];

type FuturesRuntimeState = {
  signalInbox: FuturesExecutionEvent[];
  queuedCommands: FuturesQueuedCommand[];
};

const globalForFutures = globalThis as typeof globalThis & {
  __kwantifyFuturesRuntimeState?: FuturesRuntimeState;
  __kwantifyTradovateLastAuthTest?: FuturesAdapterRuntimeStatus;
  __kwantifyTradovateLastSubmit?: TradovateSubmitResult | null;
  __kwantifyTradovateLastControl?: TradovateControlResult | null;
  __kwantifyRithmicLastSubmitAttempt?: RithmicSubmitAttemptResult | null;
  __kwantifyRithmicLastDispatchAttempt?: RithmicDispatchAttemptResult | null;
  __kwantifyRithmicLastTransportAttempt?: RithmicTransportAttemptResult | null;
  __kwantifyRithmicLastProtocolServiceAttempt?: RithmicProtocolServiceAttemptResult | null;
  __kwantifyRithmicSimulatedLifecycle?: RithmicSimulatedLifecycleEvent[];
  __kwantifyRithmicLastProtocolStubAttempt?: RithmicProtocolStubAttemptResult | null;
};

async function getManagedFuturesProfiles() {
  return getManagedFuturesProfileStore({
    routingProfiles: futuresRoutingProfiles,
    accounts: futuresAccounts,
  });
}

export async function getFuturesManagedProfileSnapshot() {
  return getManagedFuturesProfiles();
}

async function appendFuturesJournalEntry(
  entry: Parameters<typeof appendManagedFuturesJournalEntry>[1]
) {
  return appendManagedFuturesJournalEntry(
    {
      routingProfiles: futuresRoutingProfiles,
      accounts: futuresAccounts,
    },
    entry
  );
}

async function resolveManagedTradovateBindingContext(args: {
  account?: FuturesAccountRecord | null;
  route?: FuturesRoutingProfile | null;
  brokerAccountRef?: string | null;
}) {
  const managedProfiles = await getManagedFuturesProfiles();
  const managedAccount =
    args.account ??
    managedProfiles.accounts.find(
      (item) => item.venue === "tradovate" && item.brokerAccountRef === (args.brokerAccountRef ?? "")
    ) ??
    null;
  const managedRoute =
    args.route ??
    managedProfiles.routingProfiles.find((item) => item.id === managedAccount?.routeProfileIds[0]) ??
    null;
  const managedRisk = futuresRiskProfiles.find((item) => item.id === managedAccount?.riskProfileId) ?? null;

  return {
    managedAccountId: managedAccount?.id ?? null,
    managedAccountLabel: managedAccount?.label ?? null,
    managedRouteLabel: managedRoute?.label ?? null,
    managedRiskProfileLabel: managedRisk?.label ?? null,
  };
}

async function resolveManagedRithmicBindingContext(args: {
  account?: FuturesAccountRecord | null;
  route?: FuturesRoutingProfile | null;
  brokerAccountRef?: string | null;
}) {
  const managedProfiles = await getManagedFuturesProfiles();
  const managedAccount =
    args.account ??
    managedProfiles.accounts.find(
      (item) => item.venue === "rithmic" && item.brokerAccountRef === (args.brokerAccountRef ?? "")
    ) ??
    null;
  const managedRoute =
    args.route ??
    managedProfiles.routingProfiles.find((item) => item.id === managedAccount?.routeProfileIds[0]) ??
    null;
  const managedRisk = futuresRiskProfiles.find((item) => item.id === managedAccount?.riskProfileId) ?? null;

  return {
    managedAccountId: managedAccount?.id ?? null,
    managedAccountLabel: managedAccount?.label ?? null,
    managedRouteLabel: managedRoute?.label ?? null,
    managedRiskProfileLabel: managedRisk?.label ?? null,
    brokerAccountRef: managedAccount?.brokerAccountRef ?? args.brokerAccountRef ?? null,
  };
}

export async function updateFuturesManagedAccountBinding(payload: {
  accountId: string;
  routeProfileId: string;
  riskProfileId?: string;
}) {
  return updateManagedFuturesAccountBinding(
    {
      routingProfiles: futuresRoutingProfiles,
      accounts: futuresAccounts,
    },
    payload
  );
}

export async function updateFuturesManagedRouteProfile(payload: {
  routeProfileId: string;
  defaultQuantity: number;
}) {
  return updateManagedFuturesRouteProfile(
    {
      routingProfiles: futuresRoutingProfiles,
      accounts: futuresAccounts,
    },
    payload
  );
}

export async function syncTradovateDiscoveredAccountsToManagedStore(payload: {
  routeProfileId: string;
  riskProfileId: string;
}) {
  const discovery = await discoverTradovateAccounts();
  if (discovery.authStatus !== "auth_ok" || discovery.error) {
    throw new Error(discovery.error ?? "Tradovate account discovery is not ready for managed sync.");
  }

  return syncTradovateDiscoveredAccountsIntoManagedStore(
    {
      routingProfiles: futuresRoutingProfiles,
      accounts: futuresAccounts,
    },
    {
      environment: discovery.selectedEnvironment,
      routeProfileId: payload.routeProfileId,
      riskProfileId: payload.riskProfileId,
      discoveredAccounts: discovery.accounts as TradovateDiscoveredAccount[],
    }
  );
}

export async function syncRithmicDiscoveredAccountsToManagedStore(payload: {
  routeProfileId: string;
  riskProfileId: string;
}) {
  const discovery = await discoverRithmicAccounts();
  if (discovery.error) {
    throw new Error(discovery.error);
  }

  return syncRithmicDiscoveredAccountsIntoManagedStore(
    {
      routingProfiles: futuresRoutingProfiles,
      accounts: futuresAccounts,
    },
    {
      environment: discovery.selectedEnvironment,
      routeProfileId: payload.routeProfileId,
      riskProfileId: payload.riskProfileId,
      discoveredAccounts: discovery.accounts,
    }
  );
}

function getFuturesState(): FuturesRuntimeState {
  if (!globalForFutures.__kwantifyFuturesRuntimeState) {
    globalForFutures.__kwantifyFuturesRuntimeState = {
      signalInbox: structuredClone(signalInbox),
      queuedCommands: structuredClone(queuedCommands),
    };
  }

  return globalForFutures.__kwantifyFuturesRuntimeState;
}

function getTradovateEnvAuthConfig() {
  const environmentRaw = (process.env.TRADOVATE_PARTNER_ENV ?? "demo").trim().toLowerCase();
  const environment: "demo" | "live" | "staging" =
    environmentRaw === "live" ? "live" : environmentRaw === "staging" ? "staging" : "demo";
  return {
    username: process.env.TRADOVATE_PARTNER_USERNAME?.trim() ?? "",
    password: process.env.TRADOVATE_PARTNER_PASSWORD?.trim() ?? "",
    appId: process.env.TRADOVATE_PARTNER_APP_ID?.trim() ?? "",
    appVersion: process.env.TRADOVATE_PARTNER_APP_VERSION?.trim() || "1.0.0",
    cid: process.env.TRADOVATE_PARTNER_CID?.trim() ?? "",
    secret: process.env.TRADOVATE_PARTNER_SECRET?.trim() ?? "",
    accountIdOverride: process.env.TRADOVATE_PARTNER_ACCOUNT_ID?.trim() ?? "",
    accountNameOverride: process.env.TRADOVATE_PARTNER_ACCOUNT_NAME?.trim() ?? "",
    environment,
  };
}

function getTradovateAuthConfig() {
  const envConfig = getTradovateEnvAuthConfig();
  const storedConfig = readStoredTradovateConnectionConfigSync();
  const hasStoredConfig = Boolean(
    storedConfig &&
      [
        storedConfig.username,
        storedConfig.password,
        storedConfig.appId,
        storedConfig.cid,
        storedConfig.secret,
        storedConfig.accountIdOverride,
        storedConfig.accountNameOverride,
      ].some(Boolean)
  );
  const hasEnvConfig = [
    envConfig.username,
    envConfig.password,
    envConfig.appId,
    envConfig.cid,
    envConfig.secret,
    envConfig.accountIdOverride,
    envConfig.accountNameOverride,
  ].some(Boolean);

  return {
    username: storedConfig?.username || envConfig.username,
    password: storedConfig?.password || envConfig.password,
    appId: storedConfig?.appId || envConfig.appId,
    appVersion: storedConfig?.appVersion || envConfig.appVersion,
    cid: storedConfig?.cid || envConfig.cid,
    secret: storedConfig?.secret || envConfig.secret,
    accountIdOverride: storedConfig?.accountIdOverride || envConfig.accountIdOverride,
    accountNameOverride: storedConfig?.accountNameOverride || envConfig.accountNameOverride,
    environment: storedConfig?.environment ?? envConfig.environment,
    source: hasStoredConfig
      ? hasEnvConfig
        ? ("mixed" as const)
        : ("local_store" as const)
      : hasEnvConfig
        ? ("env" as const)
        : ("missing" as const),
    updatedAt: storedConfig?.updatedAt ?? null,
  };
}

function getTradovateConnectionConfigSummary(): TradovateConnectionConfigSummary {
  const config = getTradovateAuthConfig();
  const fieldMap = {
    username: config.username,
    password: config.password,
    appId: config.appId,
    cid: config.cid,
    secret: config.secret,
  };

  const configuredFields = Object.entries(fieldMap)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  const missingFields = Object.entries(fieldMap)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    adapterId: "tradovate-direct",
    source: config.source,
    selectedEnvironment: config.environment,
    username: config.username,
    appId: config.appId,
    appVersion: config.appVersion,
    cid: config.cid,
    accountIdOverride: config.accountIdOverride || null,
    accountNameOverride: config.accountNameOverride || null,
    passwordSaved: Boolean(config.password),
    secretSaved: Boolean(config.secret),
    configuredFields,
    missingFields,
    updatedAt: config.updatedAt,
    storageLocation:
      config.source === "local_store" || config.source === "mixed"
        ? getTradovateConnectionStoreLocation()
        : null,
    notes: [
      "This is the first real product-side Tradovate connection profile for local admin/operator setup.",
      "Today it stores credentials locally on the server machine so the futures page can own connect/test/sync. Production should move this into encrypted secrets storage.",
    ],
  };
}

function getTradovateAuthEndpoint(environment: "demo" | "live" | "staging") {
  switch (environment) {
    case "live":
      return "https://live.tradovateapi.com/v1";
    case "staging":
      return "https://demo-api.staging.ninjatrader.dev/v1";
    default:
      return "https://demo.tradovateapi.com/v1";
  }
}

function getTradovateEnvironmentMetadata(environment: "demo" | "live" | "staging") {
  switch (environment) {
    case "live":
      return {
        apiBase: "https://live.tradovateapi.com/v1",
        userWebsocket: "wss://live.tradovateapi.com/v1/websocket",
        marketDataWebsocket: "wss://md.tradovateapi.com/v1/websocket",
        clientAccess: "https://web.ninjatrader.com",
        adminDashboard: "https://dashboards.tradovate.com",
      };
    case "staging":
      return {
        apiBase: "https://demo-api.staging.ninjatrader.dev/v1",
        userWebsocket: "wss://demo-api.staging.ninjatrader.dev/v1/websocket",
        marketDataWebsocket: "wss://md-api.staging.ninjatrader.dev/v1/websocket",
        clientAccess: "https://web.staging.ninjatrader.dev/",
        adminDashboard: "https://dashboards.staging.ninjatrader.dev",
      };
    default:
      return {
        apiBase: "https://demo.tradovateapi.com/v1",
        userWebsocket: "wss://demo.tradovateapi.com/v1/websocket",
        marketDataWebsocket: "wss://md.tradovateapi.com/v1/websocket",
        clientAccess: "https://web.ninjatrader.com",
        adminDashboard: "https://dashboards.tradovate.com",
      };
  }
}

function getTradovateOAuthConfig() {
  const environmentRaw = (process.env.TRADOVATE_OAUTH_ENV ?? process.env.TRADOVATE_PARTNER_ENV ?? "live")
    .trim()
    .toLowerCase();
  const environment: "demo" | "live" | "staging" =
    environmentRaw === "demo" ? "demo" : environmentRaw === "staging" ? "staging" : "live";
  return {
    clientId: process.env.TRADOVATE_OAUTH_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.TRADOVATE_OAUTH_CLIENT_SECRET?.trim() ?? "",
    redirectUri: process.env.TRADOVATE_OAUTH_REDIRECT_URI?.trim() ?? "",
    authUrl: process.env.TRADOVATE_OAUTH_AUTH_URL?.trim() ?? "https://trader.tradovate.com/oauth",
    environment,
  };
}

function encodeTradovateOAuthState(payload: { redirectTo?: string | null; source?: string | null }) {
  return Buffer.from(
    JSON.stringify({
      redirectTo: payload.redirectTo ?? null,
      source: payload.source ?? null,
    }),
    "utf8"
  ).toString("base64url");
}

function decodeTradovateOAuthState(state: string | null | undefined) {
  if (!state) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      redirectTo?: unknown;
      source?: unknown;
    };
    return {
      redirectTo:
        typeof parsed.redirectTo === "string" && parsed.redirectTo.trim() ? parsed.redirectTo : null,
      source: typeof parsed.source === "string" && parsed.source.trim() ? parsed.source : null,
    };
  } catch {
    return null;
  }
}

function buildTradovateOAuthAuthorizationUrl(options?: {
  redirectTo?: string | null;
  source?: string | null;
}) {
  const oauth = getTradovateOAuthConfig();
  if (!oauth.clientId || !oauth.redirectUri) {
    return null;
  }

  const query = new URLSearchParams({
    response_type: "code",
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
  });
  query.set(
    "state",
    encodeTradovateOAuthState({
      redirectTo: options?.redirectTo ?? null,
      source: options?.source ?? null,
    })
  );

  return `${oauth.authUrl}?${query.toString()}`;
}

function getTradovateRetailConnectStatus(): TradovateRetailConnectStatus {
  const oauth = getTradovateOAuthConfig();
  const missingFields = [
    !oauth.clientId ? "client_id" : null,
    !oauth.clientSecret ? "client_secret" : null,
    !oauth.redirectUri ? "redirect_uri" : null,
  ].filter((item): item is string => Boolean(item));
  const connection = readStoredTradovateOAuthConnectionSync();
  const authorizationUrl = buildTradovateOAuthAuthorizationUrl();

  return {
    adapterId: "tradovate-direct",
    connectMode: "oauth_vendor",
    selectedEnvironment: oauth.environment,
    oauthConfigured: missingFields.length === 0,
    connected: Boolean(connection?.accessToken),
    missingFields,
    authorizationUrl,
    redirectUri: oauth.redirectUri || null,
    connectedAt: connection?.connectedAt ?? null,
    tokenExpiresAt: connection?.expiresAt ?? null,
    connectedUserName: connection?.user?.userName ?? connection?.user?.name ?? null,
    storageLocation: connection ? getTradovateOAuthStoreLocation() : null,
    notes: [
      "This is the public-product broker-connect path that should eventually feel like PickMyTrade: connect broker, sync accounts, bind route/risk, then test.",
      "Tradovate's own docs say OAuth is the right choice for applications used by other users who should not hand their credentials directly to the app.",
      "If OAuth app credentials are not configured on this server yet, the advanced direct API lane remains the fallback for internal testing.",
    ],
  };
}

function getTradovateRuntimeStatus(): FuturesAdapterRuntimeStatus {
  const config = getTradovateAuthConfig();
  const summary = getTradovateConnectionConfigSummary();
  const retailConnect = getTradovateRetailConnectStatus();
  const last = globalForFutures.__kwantifyTradovateLastAuthTest;
  const oauthReady = retailConnect.connected;
  const missingFields = oauthReady ? [] : summary.missingFields;
  const configuredFields = oauthReady
    ? ["oauth_access_token", "oauth_app", "oauth_redirect_uri"]
    : summary.configuredFields;

  return {
    adapterId: "tradovate-direct",
    adapterName: "Tradovate Direct",
    authStatus: missingFields.length ? "missing_config" : last?.authStatus ?? "configured",
    selectedEnvironment: config.environment,
    configuredFields,
    missingFields,
    lastAuthTestAt: last?.lastAuthTestAt ?? null,
    lastAuthDetail: missingFields.length
      ? `Missing Tradovate connection fields: ${missingFields.join(", ")}`
      : last?.lastAuthDetail ??
        (oauthReady
          ? "Tradovate retail OAuth connection is linked and ready for auth testing."
          : summary.source === "local_store" || summary.source === "mixed"
          ? "Stored Tradovate connection is ready for auth testing."
          : "Tradovate env credentials are configured and ready for auth testing."),
  };
}

function getRithmicAuthConfig() {
  const environmentRaw = (process.env.RITHMIC_ENV ?? "test").trim().toLowerCase();
  const environment: "test" | "demo" | "live" =
    environmentRaw === "live" ? "live" : environmentRaw === "demo" || environmentRaw === "paper" ? "demo" : "test";

  return {
    environment,
    preferredFlavor: normalizeRithmicApiFlavor(process.env.RITHMIC_API_FLAVOR),
    userId: process.env.RITHMIC_USER_ID?.trim() ?? "",
    password: process.env.RITHMIC_PASSWORD?.trim() ?? "",
    systemName: process.env.RITHMIC_SYSTEM_NAME?.trim() ?? "",
    appName: process.env.RITHMIC_APP_NAME?.trim() ?? "",
    appVersion: process.env.RITHMIC_APP_VERSION?.trim() || "1.0.0",
    fcmId: process.env.RITHMIC_FCM_ID?.trim() ?? "",
    ibId: process.env.RITHMIC_IB_ID?.trim() ?? "",
  };
}

function getRithmicRuntimeStatus(): FuturesAdapterRuntimeStatus {
  const config = getRithmicAuthConfig();
  const fieldMap = {
    userId: config.userId,
    password: config.password,
    systemName: config.systemName,
    appName: config.appName,
  };

  const configuredFields = Object.entries(fieldMap)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
  const missingFields = Object.entries(fieldMap)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    adapterId: "rithmic-direct",
    adapterName: "Rithmic Direct",
    authStatus: missingFields.length ? "missing_config" : "configured",
    selectedEnvironment: config.environment,
    configuredFields,
    missingFields,
    lastAuthTestAt: null,
    lastAuthDetail: missingFields.length
      ? `Missing env vars: ${missingFields.join(", ")}`
      : `Rithmic ${config.preferredFlavor.replaceAll("_", " ")} credentials are staged for the ${config.environment} environment.`,
  };
}

function normalizeTradovateOperatorVerdict(failureReason: string | null, failureText: string | null, responseStatus: number, brokerAccepted: boolean) {
  if (brokerAccepted) {
    return {
      operatorVerdict: "accepted",
      operatorMessage: "Tradovate accepted the request.",
    };
  }

  const normalizedReason = (failureReason ?? "").trim();
  const reasonKey = normalizedReason.toLowerCase();
  const text = failureText?.trim();

  switch (reasonKey) {
    case "sessionclosed":
      return {
        operatorVerdict: "market closed",
        operatorMessage: "Tradovate rejected the request because the trading session is closed for the selected contract.",
      };
    case "noquote":
      return {
        operatorVerdict: "no quote",
        operatorMessage: "Tradovate could not place the order because there was no actionable quote for the contract.",
      };
    case "invalidcontract":
      return {
        operatorVerdict: "invalid contract",
        operatorMessage: "Tradovate rejected the contract reference. Check symbol mapping, rollover state, and product selection.",
      };
    case "tradinglocked":
      return {
        operatorVerdict: "trading locked",
        operatorMessage: "Tradovate says trading is locked for this account or venue. Check broker permissions and account state.",
      };
    case "riskchecktimeout":
      return {
        operatorVerdict: "risk timeout",
        operatorMessage: "Tradovate timed out during broker-side risk checks. Treat this as an uncertain submission until broker state is refreshed.",
      };
    case "http_401":
    case "http_403":
      return {
        operatorVerdict: "auth rejected",
        operatorMessage: "Tradovate rejected the request at the auth layer. Recheck credentials, environment, and account entitlements.",
      };
    case "http_429":
      return {
        operatorVerdict: "rate limited",
        operatorMessage: "Tradovate rate-limited the request. The connector should back off and retry carefully.",
      };
    case "http_500":
    case "http_502":
    case "http_503":
    case "http_504":
      return {
        operatorVerdict: "broker unavailable",
        operatorMessage: "Tradovate returned a server-side failure. Refresh broker state and treat the execution result as uncertain until reconciled.",
      };
    default:
      return {
        operatorVerdict: normalizedReason || `http ${responseStatus}`,
        operatorMessage:
          text ||
          (normalizedReason
            ? `Tradovate returned ${normalizedReason}.`
            : `Tradovate returned HTTP ${responseStatus} without a richer failure reason.`),
      };
  }
}

export async function discoverRithmicSessionBlueprint(): Promise<RithmicSessionBlueprint> {
  const config = getRithmicAuthConfig();
  const runtime = getRithmicRuntimeStatus();

  return {
    adapterId: "rithmic-direct",
    authStatus: runtime.authStatus,
    selectedEnvironment: config.environment,
    preferredFlavor: config.preferredFlavor,
    configuredFields: runtime.configuredFields,
    missingFields: runtime.missingFields,
    flavors: RITHMIC_FLAVOR_BLUEPRINTS,
    onboardingSteps: [
      "Request the Rithmic dev kit and confirm which API flavor we are approved to use.",
      "Build against Rithmic Test first, then move to paper/live only after conformance passes.",
      "Map FCM ID, IB ID, and account routing metadata into kwantify route profiles before first live submit.",
      "Treat reconnect, resubscribe, and execution report replay as mandatory parts of the adapter contract.",
    ],
    notes: [
      "R | Protocol API is the best first cloud-backend target because it is language-agnostic and still sits on the same normalized execution backbone.",
      "R | API+ is still important as a reference for the richest desktop-style feature set and server-side order semantics.",
      "Rithmic conformance is not optional for production, so the adapter has to be built with auditability and replay safety from day one.",
      config.fcmId || config.ibId
        ? `FCM/IB metadata is partially configured${config.fcmId ? ` (FCM ${config.fcmId})` : ""}${config.ibId ? ` (IB ${config.ibId})` : ""}.`
        : "FCM/IB metadata is not configured yet; route/account binding will need it before production-style execution can begin.",
    ],
    error: runtime.missingFields.length ? runtime.lastAuthDetail : null,
  };
}

export async function resolveRithmicRouteBinding({
  route,
  account,
}: {
  route: FuturesRoutingProfile;
  account: FuturesAccountRecord;
}): Promise<RithmicRouteBinding> {
  const config = getRithmicAuthConfig();
  const protocolService = getRithmicProtocolServiceConfig();
  const managedBrokerAccountRef = account.brokerAccountRef?.trim() || null;
  const managedContext = await resolveManagedRithmicBindingContext({
    account,
    route,
    brokerAccountRef: managedBrokerAccountRef,
  });
  const localGatewayIdentityReady =
    protocolService.mode === "local_gateway" &&
    route.venue === "rithmic" &&
    Boolean(managedBrokerAccountRef || account.id);
  const resolvedSystemName =
    config.systemName ||
    (localGatewayIdentityReady ? "KWANTIFY-RITHMIC-LOCAL-GATEWAY" : null);
  const resolvedUserId =
    config.userId ||
    (localGatewayIdentityReady ? managedBrokerAccountRef || account.id : null);
  const accountReference =
      [config.fcmId, config.ibId, managedBrokerAccountRef || account.label]
        .filter(Boolean)
        .join(" / ")
        .trim() || null;
  const hasCoreIdentity = Boolean(resolvedUserId && resolvedSystemName);
  const resolutionSource =
      hasCoreIdentity && managedBrokerAccountRef
        ? "managed_account_ref"
        : hasCoreIdentity
          ? "env_credentials"
        : "unresolved";

  return {
    adapterId: "rithmic-direct",
    routeProfileId: route.id,
    accountId: account.id,
    selectedEnvironment: config.environment,
    preferredFlavor: config.preferredFlavor,
    resolvedSystemName,
    resolvedUserId,
    resolvedFcmId: config.fcmId || null,
    resolvedIbId: config.ibId || null,
    brokerAccountRef: managedContext.brokerAccountRef,
    accountReference,
    resolutionSource,
    managedAccountLabel: managedContext.managedAccountLabel,
    managedRouteLabel: managedContext.managedRouteLabel,
    managedRiskProfileLabel: managedContext.managedRiskProfileLabel,
    notes: [
      managedBrokerAccountRef
        ? `Managed Rithmic broker account reference ${managedBrokerAccountRef} is now feeding the route binding.`
        : "Rithmic route binding should eventually be backed by persisted account/session metadata, not only env-driven assumptions.",
      config.preferredFlavor === "protocol_api"
        ? "Protocol API stays the preferred first cloud-backend lane for kwantify because it matches a service-oriented execution stack better than a desktop-only embedding path."
        : "A non-default Rithmic flavor is selected; make sure the adapter contract still matches the actual dev-kit access we receive.",
        config.fcmId || config.ibId
          ? "FCM and IB identifiers are present, which is the minimum shape we need before account routing can become trustworthy."
          : "FCM and IB identifiers are still missing, so this route binding is only a planning scaffold for now.",
        localGatewayIdentityReady && !config.systemName && !config.userId
          ? "Local gateway mode is supplying a non-live simulated system/user identity so the Rithmic protocol-service seam can be exercised honestly before real credentials arrive."
          : "Runtime system/user identity is being sourced from configured Rithmic credentials.",
        managedContext.managedRiskProfileLabel
          ? `Managed risk profile ${managedContext.managedRiskProfileLabel} is attached to this binding path.`
          : "Managed risk profile context is not attached yet.",
      ],
    error: hasCoreIdentity
      ? null
      : "Rithmic route binding is not ready until at least userId and systemName are configured.",
  };
}

export async function discoverRithmicAccounts(): Promise<RithmicAccountDiscovery> {
  const config = getRithmicAuthConfig();
  const runtime = getRithmicRuntimeStatus();
  const hasSeededIdentity = Boolean(config.userId || config.systemName || config.fcmId || config.ibId);
  const seededRouteMode: "single_account" | "prop_lane" = config.fcmId || config.ibId ? "prop_lane" : "single_account";

  const seededAccounts = hasSeededIdentity
    ? [
        {
          id: [config.systemName || "rithmic", config.userId || "user", config.environment].join(":"),
          label: `${config.systemName || "Rithmic System"} ${config.environment.toUpperCase()} Lane`,
          environment: config.environment,
          firm: config.fcmId || config.ibId ? "Configured broker / prop lane" : "Configured runtime lane",
          fcmId: config.fcmId || null,
          ibId: config.ibId || null,
          systemName: config.systemName || null,
          userId: config.userId || null,
          routeMode: seededRouteMode,
          readonly: false,
          active: true,
          source: "env_seed" as const,
        },
      ]
    : [];

  const planningAccounts = [
    {
      id: "rithmic-test-primary",
      label: "Rithmic Test Primary",
      environment: "test" as const,
      firm: "Dev kit / conformance lane",
      fcmId: null,
      ibId: null,
      systemName: null,
      userId: null,
      routeMode: "single_account" as const,
      readonly: null,
      active: null,
      source: "planning_seed" as const,
    },
    {
      id: "rithmic-paper-prop-cluster",
      label: "Rithmic Paper Prop Cluster",
      environment: "demo" as const,
      firm: "Paper / evaluator staging lane",
      fcmId: null,
      ibId: null,
      systemName: null,
      userId: null,
      routeMode: "copy_group" as const,
      readonly: null,
      active: null,
      source: "planning_seed" as const,
    },
  ];

  const accounts = [...seededAccounts, ...planningAccounts];

  return {
    adapterId: "rithmic-direct",
    authStatus: runtime.authStatus,
    selectedEnvironment: config.environment,
    accountCount: accounts.length,
    accounts,
    notes: [
      "This is an honest planning/discovery surface until the Rithmic dev kit gives us a real account/session query path.",
      "The env-seeded lane shows what we already know from runtime credentials; the planning lanes show the account shapes we need to support for test, paper, and prop-style deployment.",
      "Rithmic account routing will need to understand not only a single account, but also copy-group and prop-lane semantics once we support evaluator fanout seriously.",
    ],
    testedAt: hasSeededIdentity ? new Date().toISOString() : null,
    error: runtime.missingFields.length
      ? "Rithmic credentials are incomplete, so live account identity is only partially seeded from env."
      : null,
  };
}

export async function discoverRithmicExecutionBlueprint(): Promise<RithmicExecutionBlueprint> {
  const config = getRithmicAuthConfig();

  return {
    adapterId: "rithmic-direct",
    preferredFlavor: config.preferredFlavor,
    selectedEnvironment: config.environment,
    executionPath: [
      "kwantify futures signal accepted into normalized inbox",
      "route + risk profile resolves Rithmic account lane",
      "adapter translates order intent into Rithmic request payload",
      "Rithmic acknowledges or rejects submit",
      "execution reports update fills, partials, cancels, and flatten state",
      "broker/account sync reconciles positions and working orders after disconnects or uncertainty",
    ],
    requiredJournalFields: [
      "signalId",
      "routeProfileId",
      "accountId",
      "rithmic flavor",
      "environment",
      "symbol / contract reference",
      "submit correlation id",
      "broker order id",
      "execution report sequence",
      "reject code / text",
      "fill quantity / price",
      "recovery source",
    ],
    recoveryGuarantees: [
      "Connector must be able to rebuild the open order / position view from broker truth after reconnect.",
      "Execution reports must be idempotent so replayed events do not double-count fills or cancels.",
      "Submit uncertainty must be visible as a first-class state until broker positions and working orders are reconciled.",
      "Flatten / cancel actions must emit the same normalized journal stages as regular signal-driven actions.",
    ],
    lifecycleSteps: [
      {
        stage: "received",
        label: "Signal Received",
        detail: "A futures instruction enters kwantify with strategy, account, and contract intent attached.",
        sourceOfTruth: "kwantify signal inbox",
      },
      {
        stage: "validated",
        label: "Route Validated",
        detail: "Risk policy, session window, symbol mapping, and account lane are approved for Rithmic routing.",
        sourceOfTruth: "kwantify routing layer",
      },
      {
        stage: "submitted",
        label: "Submit Attempted",
        detail: "The adapter emits a concrete Rithmic request and records a correlation id before broker acknowledgement.",
        sourceOfTruth: "adapter submit journal",
      },
      {
        stage: "accepted",
        label: "Broker Accepted",
        detail: "Rithmic acknowledges the order and returns broker-side identity that we can reconcile later.",
        sourceOfTruth: "Rithmic ack / execution report",
      },
      {
        stage: "partially_filled",
        label: "Partially Filled",
        detail: "Fills arrive incrementally and must update quantity and protection state without losing idempotency.",
        sourceOfTruth: "Rithmic execution reports",
      },
      {
        stage: "filled",
        label: "Fully Filled",
        detail: "The order is complete and any server-side bracket / trailing logic should now be visible in broker state.",
        sourceOfTruth: "Rithmic execution reports + broker sync",
      },
      {
        stage: "rejected",
        label: "Rejected",
        detail: "Broker-side or pre-trade rejection is captured with normalized operator wording and preserved for support review.",
        sourceOfTruth: "Rithmic reject / error response",
      },
      {
        stage: "flat",
        label: "Flat / Reconciled",
        detail: "Positions are flattened or otherwise reconciled back to zero and journal state confirms the lane is clean.",
        sourceOfTruth: "broker position sync",
      },
    ],
    notes: [
      "The second adapter should be built as an event system first and a submit button second.",
      "R | Protocol API remains the preferred first backend flavor for kwantify because the lifecycle contract fits a cloud service better than embedding a desktop SDK surface.",
      "The journal contract should look the same from the operator perspective whether the venue is Tradovate or Rithmic.",
    ],
  };
}

export async function previewRithmicOrder(payload: unknown) {
  const managedProfiles = await getManagedFuturesProfiles();
  const normalized = normalizeFuturesConnectorSignal(payload);
  const route =
    managedProfiles.routingProfiles.find(
      (item) =>
        normalized.accountId &&
        managedProfiles.accounts.some(
          (account) => account.id === normalized.accountId && account.routeProfileIds.includes(item.id)
        )
    ) ??
    managedProfiles.routingProfiles.find((item) => item.venue === "rithmic") ??
    managedProfiles.routingProfiles.find((item) => item.id === "rithmic-prop-live");
  const account =
    managedProfiles.accounts.find((item) => item.id === normalized.accountId && item.venue === "rithmic") ??
    managedProfiles.accounts.find((item) => item.venue === "rithmic") ??
    managedProfiles.accounts.find((item) => item.id === "rithmic-live-prop-001");

  if (!route || !account) {
    return { ok: false as const, error: "Rithmic route or account scaffold is missing." };
  }

  const signal: FuturesConnectorSignalIntent = {
    ...normalized,
    venue: "rithmic",
    accountId: account.id,
  };
  const validated = await validateFuturesConnectorSignal(signal);
  if (!validated.ok) {
    return { ok: false as const, error: validated.error };
  }

  const binding = await resolveRithmicRouteBinding({
    route: validated.route,
    account: validated.account,
  });

  const preview: RithmicOrderPreview = buildRithmicOrderPreview({
    signal: validated.normalized,
    route: validated.route,
    account: validated.account,
    binding,
  });

  await appendFuturesJournalEntry({
    category: "execution",
    venue: "rithmic",
    title: binding.error ? "Rithmic preview staged with binding warning" : "Rithmic order preview staged",
    detail: binding.error
      ? `Preview for ${validated.normalized.symbol} staged, but the binding still warns: ${binding.error}`
      : `Previewed ${validated.normalized.side} ${validated.normalized.symbol} for Rithmic route ${validated.route.label}.`,
    accountId: validated.account.id,
    routeProfileId: validated.route.id,
    signalId: validated.normalized.signalId,
    status: binding.error ? "warning" : "ready",
    requestBody: validated.normalized as unknown as Record<string, unknown>,
    responseBody: preview.body,
  });

  return {
    ok: true as const,
    preview,
    binding,
  };
}

export async function submitRithmicAttempt(payload: unknown) {
  const managedProfiles = await getManagedFuturesProfiles();
  const normalized = normalizeFuturesConnectorSignal(payload);
  const route =
    managedProfiles.routingProfiles.find(
      (item) =>
        normalized.accountId &&
        managedProfiles.accounts.some(
          (account) => account.id === normalized.accountId && account.routeProfileIds.includes(item.id)
        )
    ) ??
    managedProfiles.routingProfiles.find((item) => item.venue === "rithmic") ??
    managedProfiles.routingProfiles.find((item) => item.id === "rithmic-prop-live");
  const account =
    managedProfiles.accounts.find((item) => item.id === normalized.accountId && item.venue === "rithmic") ??
    managedProfiles.accounts.find((item) => item.venue === "rithmic") ??
    managedProfiles.accounts.find((item) => item.id === "rithmic-live-prop-001");

  if (!route || !account) {
    return { ok: false as const, error: "Rithmic route or account scaffold is missing." };
  }

  const signal: FuturesConnectorSignalIntent = {
    ...normalized,
    venue: "rithmic",
    accountId: account.id,
  };
  const validated = await validateFuturesConnectorSignal(signal);
  if (!validated.ok) {
    return { ok: false as const, error: validated.error };
  }

  const binding = await resolveRithmicRouteBinding({
    route: validated.route,
    account: validated.account,
  });
  const preview = buildRithmicOrderPreview({
    signal: validated.normalized,
    route: validated.route,
    account: validated.account,
    binding,
  });
  const submittedAt = new Date().toISOString();
  const protocolService = getRithmicProtocolServiceConfig();
  const localGatewayReady = protocolService.mode === "local_gateway";

  const submitState: RithmicSubmitAttemptResult["submitState"] = binding.error
    ? "binding_blocked"
    : binding.preferredFlavor === "protocol_api"
      ? "staged_for_submit"
      : "ready_for_dev_kit";

  const operatorVerdict =
    submitState === "binding_blocked"
      ? "binding blocked"
      : submitState === "staged_for_submit"
        ? "staged for protocol submit"
        : "ready for dev kit submit";
  const operatorMessage =
    submitState === "binding_blocked"
      ? binding.error ?? "Rithmic binding is not ready."
      : submitState === "staged_for_submit"
        ? `Rithmic ${binding.preferredFlavor.replaceAll("_", " ")} submit intent was staged with managed binding context and is ready for the first real adapter handoff.`
        : `Rithmic ${binding.preferredFlavor.replaceAll("_", " ")} is configured enough to define submit intent, but the live dev-kit handoff is still the next implementation step.`;

  const result: RithmicSubmitAttemptResult = {
      adapterId: "rithmic-direct",
      routeProfileId: validated.route.id,
      accountId: validated.account.id,
      signalId: validated.normalized.signalId,
      preferredFlavor: binding.preferredFlavor,
      selectedEnvironment: binding.selectedEnvironment,
      localGatewayReady,
      binding,
      requestBody: preview.body,
      submitState,
    operatorVerdict,
    operatorMessage,
    responseBody: {
      accountReference: binding.accountReference,
      submitState,
      managedAccount: binding.managedAccountLabel,
      managedRoute: binding.managedRouteLabel,
      managedRisk: binding.managedRiskProfileLabel,
    },
    submittedAt,
  };

  globalForFutures.__kwantifyRithmicLastSubmitAttempt = result;

  await appendFuturesJournalEntry({
    category: "execution",
    venue: "rithmic",
    title:
      submitState === "binding_blocked"
        ? "Rithmic submit attempt blocked"
        : submitState === "staged_for_submit"
          ? "Rithmic submit attempt staged"
          : "Rithmic submit attempt prepared",
    detail: operatorMessage,
    accountId: validated.account.id,
    routeProfileId: validated.route.id,
    signalId: validated.normalized.signalId,
    status: submitState === "binding_blocked" ? "warning" : "ready",
    requestBody: preview.body,
    responseBody: result.responseBody,
    occurredAt: submittedAt,
  });

  return {
    ok: true as const,
    attempt: result,
  };
}

export function getRithmicLiveSubmitHandoff(): RithmicLiveSubmitHandoff | null {
  const attempt = globalForFutures.__kwantifyRithmicLastSubmitAttempt ?? null;
  if (!attempt) {
    return null;
  }

  return buildRithmicLiveSubmitHandoff({ attempt });
}

export function getRithmicAdapterBoundary(): RithmicAdapterBoundary | null {
  const handoff = getRithmicLiveSubmitHandoff();
  if (!handoff) {
    return null;
  }

  return buildRithmicAdapterBoundary({ handoff });
}

export function getRithmicTransportPacket(): RithmicTransportPacket | null {
  const handoff = getRithmicLiveSubmitHandoff();
  const boundary = getRithmicAdapterBoundary();
  if (!handoff || !boundary) {
    return null;
  }

  return buildRithmicTransportPacket({ handoff, boundary });
}

export function getRithmicProtocolServiceRunner(): RithmicProtocolServiceConfig {
  return getRithmicProtocolServiceConfig();
}

function getRithmicSimulatedLifecycle(): RithmicSimulatedLifecycleEvent[] {
  if (!Array.isArray(globalForFutures.__kwantifyRithmicSimulatedLifecycle)) {
    globalForFutures.__kwantifyRithmicSimulatedLifecycle = [];
  }
  return globalForFutures.__kwantifyRithmicSimulatedLifecycle;
}

function shiftIsoTimestamp(baseIso: string, offsetMs: number) {
  const base = Date.parse(baseIso);
  if (!Number.isFinite(base)) {
    return new Date().toISOString();
  }
  return new Date(base + offsetMs).toISOString();
}

function isoToMicros(iso: string, offsetMicros = 0) {
  const base = Date.parse(iso);
  if (!Number.isFinite(base)) {
    return Date.now() * 1000 + offsetMicros;
  }
  return base * 1000 + offsetMicros;
}

function getAccountAndRouteFromRithmicPacket(packet: RithmicTransportPacket) {
  const envelope =
    typeof packet.payload.requestEnvelope === "object" && packet.payload.requestEnvelope
      ? (packet.payload.requestEnvelope as Record<string, unknown>)
      : null;
  return {
    accountId: envelope && typeof envelope.accountId === "string" ? envelope.accountId : null,
    routeProfileId: envelope && typeof envelope.routeProfileId === "string" ? envelope.routeProfileId : null,
  };
}

function deriveRithmicGatewayScenarioFromAttempt(
  attempt: RithmicProtocolServiceAttemptResult
): RithmicGatewayScenario | null {
  const body = (attempt.responseBody ?? {}) as Record<string, unknown>;
  const transport =
    typeof body.transport === "object" && body.transport ? (body.transport as Record<string, unknown>) : null;
  const brokerState =
    (transport && typeof transport.brokerState === "string" ? transport.brokerState : null) ??
    (typeof body.brokerState === "string" ? body.brokerState : null);
  const normalizedOutcome =
    typeof body.normalizedOutcome === "object" && body.normalizedOutcome
      ? (body.normalizedOutcome as Record<string, unknown>)
      : null;
  const normalizedState =
    normalizedOutcome && typeof normalizedOutcome.state === "string" ? normalizedOutcome.state : null;

  if (attempt.runState === "transport_error" || brokerState === "transport_failed") return "transport_failed";
  if (normalizedState === "uncertain_recovered" || brokerState === "filled_after_recovery") return "uncertain_recovered";
  if (normalizedState === "transport_recovered" || brokerState === "submitted_after_recovery")
    return "transport_recovered";
  if (normalizedState === "partial_fill" || brokerState === "partially_filled") return "partial_fill";
  if (normalizedState === "filled" || brokerState === "filled") return "filled";
  if (normalizedState === "flat_exit" || brokerState === "flat") return "flat_exit";
  if (normalizedState === "rejected" || brokerState === "rejected") return "rejected";
  if (normalizedState === "uncertain" || brokerState === "uncertain") return "uncertain";
  if (normalizedState === "transport_failed") return "transport_failed";
  if (normalizedState === "submitted" || brokerState === "submitted") return "submitted";
  return null;
}

function getLatestRithmicLifecycleScenario(): RithmicGatewayScenario | null {
  const lastAttempt = globalForFutures.__kwantifyRithmicLastProtocolServiceAttempt ?? null;
  if (lastAttempt) {
    const scenario = deriveRithmicGatewayScenarioFromAttempt(lastAttempt);
    if (scenario) {
      return scenario;
    }
  }

  const latestEvent = getRithmicSimulatedLifecycle()[0] ?? null;
  const payload =
    latestEvent && typeof latestEvent.payload === "object" && latestEvent.payload
      ? (latestEvent.payload as Record<string, unknown>)
      : null;
  const scenario = payload && typeof payload.scenario === "string" ? payload.scenario : null;
  if (
    scenario === "submitted" ||
    scenario === "partial_fill" ||
    scenario === "filled" ||
    scenario === "flat_exit" ||
    scenario === "rejected" ||
    scenario === "uncertain" ||
    scenario === "transport_failed" ||
    scenario === "uncertain_recovered" ||
    scenario === "transport_recovered"
  ) {
    return scenario;
  }

  return null;
}

function getRithmicLifecycleExecutionContext(packet: RithmicTransportPacket) {
  const envelope =
    typeof packet.payload.requestEnvelope === "object" && packet.payload.requestEnvelope
      ? (packet.payload.requestEnvelope as Record<string, unknown>)
      : null;
  const requestBody =
    envelope && typeof envelope.requestBody === "object" && envelope.requestBody
      ? (envelope.requestBody as Record<string, unknown>)
      : null;
  const bracket =
    requestBody && typeof requestBody.bracket === "object" && requestBody.bracket
      ? (requestBody.bracket as Record<string, unknown>)
      : null;
  const trail =
    requestBody && typeof requestBody.trail === "object" && requestBody.trail
      ? (requestBody.trail as Record<string, unknown>)
      : null;
  const quantity =
    requestBody && Number.isFinite(Number(requestBody.quantity)) ? Number(requestBody.quantity) : null;
  const stopTicks = bracket && Number.isFinite(Number(bracket.stopTicks)) ? Number(bracket.stopTicks) : null;
  const targetTicks = bracket && Number.isFinite(Number(bracket.targetTicks)) ? Number(bracket.targetTicks) : null;

  return {
    accountReference:
      envelope && typeof envelope.accountReference === "string" ? envelope.accountReference : null,
    systemName: requestBody && typeof requestBody.systemName === "string" ? requestBody.systemName : null,
    userId: requestBody && typeof requestBody.userId === "string" ? requestBody.userId : null,
    symbol: requestBody && typeof requestBody.symbol === "string" ? requestBody.symbol : null,
    side: requestBody && typeof requestBody.side === "string" ? requestBody.side : null,
    quantity,
    orderType: requestBody && typeof requestBody.orderType === "string" ? requestBody.orderType : null,
    tif: requestBody && typeof requestBody.tif === "string" ? requestBody.tif : null,
    clientOrderId:
      requestBody && typeof requestBody.clientOrderId === "string" ? requestBody.clientOrderId : null,
    text: requestBody && typeof requestBody.text === "string" ? requestBody.text : null,
    stopTicks,
    targetTicks,
    hasBracketProtection: stopTicks != null && targetTicks != null,
    hasTrailingProtection: !!trail && Object.values(trail).some((value) => value != null),
  };
}

function buildSimulatedRithmicBrokerOrderIds(correlationId: string) {
  const suffix = correlationId.replace(/[^a-zA-Z0-9]/g, "").slice(-16) || "SIM";
  return {
    brokerOrderId: `RIT-ORD-${suffix}`,
    parentOrderId: `RIT-PARENT-${suffix}`,
    bracketGroupId: `RIT-BRG-${suffix}`,
  };
}

function deriveRithmicReconciliationVerdict(args: {
  primaryOrderState: string | null;
  reconciliationState: string | null;
  positionState: string | null;
  openPositionQty: number | null;
  workingOrderPresent: boolean | null;
  protectionOrders: Record<string, unknown>[];
  bracketEnabled: boolean;
}) {
  const {
    primaryOrderState,
    reconciliationState,
    positionState,
    openPositionQty,
    workingOrderPresent,
    protectionOrders,
    bracketEnabled,
  } = args;

  const warnings: string[] = [];
  const activeProtectionOrders = protectionOrders.filter((row) => {
    const ordStatus = typeof row.ordStatus === "string" ? row.ordStatus : null;
    return ordStatus === "working" || ordStatus === "new";
  });

  if (
    reconciliationState === "manual_review_required" ||
    reconciliationState === "transport_retry_required"
  ) {
    warnings.push(`Reconciliation remains open: ${reconciliationState}.`);
  }

  if (
    (positionState === "open" || positionState === "open_partial") &&
    openPositionQty != null &&
    openPositionQty > 0 &&
    bracketEnabled &&
    activeProtectionOrders.length === 0
  ) {
    warnings.push("Open position is visible, but no active protection legs are present.");
  }

  if (
    (primaryOrderState === "working" || primaryOrderState === "partially_filled") &&
    workingOrderPresent === false
  ) {
    warnings.push(
      "Primary order still reads as working, but reconciliation says no working order is present."
    );
  }

  if (
    (positionState === "flat" || positionState === "flat_after_exit") &&
    workingOrderPresent === true
  ) {
    warnings.push("Position is flat, but a working order is still present and needs review.");
  }

  if (
    primaryOrderState === "filled" &&
    openPositionQty != null &&
    openPositionQty === 0 &&
    positionState === "flat"
  ) {
    warnings.push(
      "Entry order is filled but the position is already flat; verify whether an exit lifecycle event was missed."
    );
  }

  return {
    verdict: warnings.length ? "attention_required" : "aligned",
    warnings,
  };
}

function buildRithmicSimulatedLifecycleEvents(args: {
  attempt: RithmicProtocolServiceAttemptResult;
  packet: RithmicTransportPacket;
}): RithmicSimulatedLifecycleEvent[] {
  const { attempt, packet } = args;
  const scenario = deriveRithmicGatewayScenarioFromAttempt(attempt);
  if (!scenario) {
    return [];
  }

  const context = getRithmicLifecycleExecutionContext(packet);
  const gatewayBody = (attempt.responseBody ?? {}) as Record<string, unknown>;
  const executionReference =
    typeof gatewayBody.executionReference === "object" && gatewayBody.executionReference
      ? (gatewayBody.executionReference as Record<string, unknown>)
      : null;
  const normalizedOutcome =
    typeof gatewayBody.normalizedOutcome === "object" && gatewayBody.normalizedOutcome
      ? (gatewayBody.normalizedOutcome as Record<string, unknown>)
      : null;
  const transport =
    typeof gatewayBody.transport === "object" && gatewayBody.transport
      ? (gatewayBody.transport as Record<string, unknown>)
      : null;
  const lifecycleHints =
    typeof gatewayBody.lifecycleHints === "object" && gatewayBody.lifecycleHints
      ? (gatewayBody.lifecycleHints as Record<string, unknown>)
      : null;
  const executionSnapshot =
    typeof gatewayBody.executionSnapshot === "object" && gatewayBody.executionSnapshot
      ? (gatewayBody.executionSnapshot as Record<string, unknown>)
      : null;
  const executionHistory = Array.isArray(gatewayBody.executionHistory)
    ? (gatewayBody.executionHistory as Record<string, unknown>[])
    : [];
  const reconciliationTimeline = Array.isArray(gatewayBody.reconciliationTimeline)
    ? (gatewayBody.reconciliationTimeline as Record<string, unknown>[])
    : [];
  const protectionTimeline = Array.isArray(gatewayBody.protectionTimeline)
    ? (gatewayBody.protectionTimeline as Record<string, unknown>[])
    : [];
  const recoveryPlan = Array.isArray(gatewayBody.recoveryPlan)
    ? (gatewayBody.recoveryPlan as Record<string, unknown>[])
    : [];
  const primaryOrder =
    executionSnapshot && typeof executionSnapshot.primaryOrder === "object" && executionSnapshot.primaryOrder
      ? (executionSnapshot.primaryOrder as Record<string, unknown>)
      : null;
  const positionSnapshot =
    executionSnapshot && typeof executionSnapshot.positionSnapshot === "object" && executionSnapshot.positionSnapshot
      ? (executionSnapshot.positionSnapshot as Record<string, unknown>)
      : null;
  const protectionOrders =
    executionSnapshot && Array.isArray(executionSnapshot.protectionOrders)
      ? (executionSnapshot.protectionOrders as Record<string, unknown>[])
      : [];
  const fallbackIds = buildSimulatedRithmicBrokerOrderIds(packet.correlationId);
  const ids = {
    brokerOrderId:
      executionReference && typeof executionReference.brokerOrderId === "string"
        ? String(executionReference.brokerOrderId)
        : fallbackIds.brokerOrderId,
    parentOrderId:
      executionReference && typeof executionReference.parentOrderId === "string"
        ? String(executionReference.parentOrderId)
        : fallbackIds.parentOrderId,
    bracketGroupId:
      executionReference && typeof executionReference.bracketGroupId === "string"
        ? String(executionReference.bracketGroupId)
        : fallbackIds.bracketGroupId,
  };

  const basePayload = {
    scenario,
    endpoint: attempt.endpoint,
    runState: attempt.runState,
    responseBody: attempt.responseBody,
    gatewayContract:
      typeof gatewayBody.gatewayContract === "object" && gatewayBody.gatewayContract ? gatewayBody.gatewayContract : null,
    transport,
    lifecycleHints,
    executionSnapshot,
    executionHistory,
    reconciliationTimeline,
    protectionTimeline,
    recoveryPlan,
    correlationId: packet.correlationId,
    accountReference:
      executionReference && typeof executionReference.accountReference === "string"
        ? String(executionReference.accountReference)
        : context.accountReference,
    systemName: context.systemName,
    userId: context.userId,
    symbol:
      executionReference && typeof executionReference.symbol === "string"
        ? String(executionReference.symbol)
        : context.symbol,
    side: context.side,
    orderType:
      executionReference && typeof executionReference.orderType === "string"
        ? String(executionReference.orderType)
        : context.orderType,
    tif:
      executionReference && typeof executionReference.tif === "string"
        ? String(executionReference.tif)
        : context.tif,
    orderQty:
      executionReference && Number.isFinite(Number(executionReference.quantity))
        ? Number(executionReference.quantity)
        : context.quantity,
    clientOrderId:
      executionReference && typeof executionReference.clientOrderId === "string"
        ? String(executionReference.clientOrderId)
        : context.clientOrderId,
    text: context.text,
    brokerOrderId: ids.brokerOrderId,
    parentOrderId: ids.parentOrderId,
    bracketGroupId: ids.bracketGroupId,
    protection: {
      bracketEnabled: context.hasBracketProtection,
      targetTicks: context.targetTicks,
      stopTicks: context.stopTicks,
      trailingEnabled: context.hasTrailingProtection,
    },
  } as Record<string, unknown>;

  const makeEvent = (
    stage: RithmicSimulatedLifecycleEvent["stage"],
    eventType: string,
    outcome: string,
    status: RithmicSimulatedLifecycleEvent["status"],
    detail: string,
    offsetMs: number,
    payload: Record<string, unknown> | null = null,
    quantities?: {
      leavesQty?: number | null;
      filledQty?: number | null;
    },
    identity?: {
      brokerOrderId?: string | null;
      clientOrderId?: string | null;
    }
  ): RithmicSimulatedLifecycleEvent => {
    const payloadRecord = payload ?? {};
    const readNumber = (key: string) =>
      Number.isFinite(Number(payloadRecord[key])) ? Number(payloadRecord[key]) : null;
    const readString = (key: string) => (typeof payloadRecord[key] === "string" ? String(payloadRecord[key]) : null);

    return {
      id: `rithmic_lifecycle_${crypto.randomUUID()}`,
      signalId: attempt.signalId,
      correlationId: packet.correlationId,
      stage,
      eventType,
      outcome,
      status,
      detail,
      brokerOrderId: identity?.brokerOrderId ?? readString("brokerOrderId") ?? ids.brokerOrderId,
      clientOrderId: identity?.clientOrderId ?? readString("clientOrderId") ?? context.clientOrderId,
      parentOrderId: readString("parentOrderId") ?? ids.parentOrderId,
      leavesQty: quantities?.leavesQty ?? readNumber("leavesQty"),
      filledQty: quantities?.filledQty ?? readNumber("filledQty"),
      cumQty: readNumber("cumQty"),
      avgFillPrice: readNumber("avgFillPrice"),
      execType: readString("execType"),
      ordStatus: readString("ordStatus"),
      rejectCode: readString("rejectCode"),
      rejectReason: readString("rejectReason"),
      reconciliationState: readString("reconciliationState"),
      gatewayTimestampMicros: readNumber("gatewayTimestampMicros"),
      brokerTimestampMicros: readNumber("brokerTimestampMicros"),
      occurredAt: shiftIsoTimestamp(attempt.attemptedAt, offsetMs),
      payload,
    };
  };

  const buildReconciliationPayload = (args: {
    reconciliation: string;
    reconciliationState: string;
    workingOrderPresent: boolean | null;
    openPositionQty: number | null;
    positionState: string;
    nextAction: string;
    brokerTimestampMicros: number | null;
  }) => {
    const driftVerdict = deriveRithmicReconciliationVerdict({
      primaryOrderState:
        primaryOrder && typeof primaryOrder.orderState === "string"
          ? String(primaryOrder.orderState)
          : null,
      reconciliationState: args.reconciliationState,
      positionState: args.positionState,
      openPositionQty: args.openPositionQty,
      workingOrderPresent: args.workingOrderPresent,
      protectionOrders,
      bracketEnabled: context.hasBracketProtection,
    });

    return {
      ...basePayload,
      reconciliation: args.reconciliation,
      reconciliationState: args.reconciliationState,
      workingOrderPresent: args.workingOrderPresent,
      openPositionQty: args.openPositionQty,
      positionState: args.positionState,
      nextAction: args.nextAction,
      brokerTimestampMicros: args.brokerTimestampMicros,
      reconciliationVerdict: driftVerdict.verdict,
      reconciliationWarnings: driftVerdict.warnings,
    };
  };

  switch (scenario) {
    case "submitted":
      return [
        makeEvent(
          "ack",
          "order_acknowledged",
          "accepted",
          "ready",
          "Broker acknowledgement accepted the staged submit and returned a live correlation handle.",
          120,
          {
            ...basePayload,
            ackState: "accepted",
            routeStatus: "working",
            riskStatus: "passed",
            gatewayTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.gatewayTimestampMicros))
                ? Number(normalizedOutcome.gatewayTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 120_000),
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 145_000),
          },
          {
            leavesQty: context.quantity,
            filledQty: 0,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_new",
          "working",
          "ready",
          "Execution report confirms the order is working and bracket-capable on the broker lane.",
          520,
          {
            ...basePayload,
            executionState: "working",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "new",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "working",
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : 0,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            serverSideProtection: true,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "working",
            childOrderIds:
              protectionOrders.length > 0
                ? {
                    targetOrderId:
                      protectionOrders.find((item) => item.role === "take_profit" && typeof item.orderId === "string")
                        ?.orderId ?? null,
                    stopOrderId:
                      protectionOrders.find((item) => item.role === "stop_loss" && typeof item.orderId === "string")
                        ?.orderId ?? null,
                    ocoGroupId: ids.bracketGroupId,
                  }
                : context.hasBracketProtection
                  ? {
                      targetOrderId: `${ids.bracketGroupId}-TP`,
                      stopOrderId: `${ids.bracketGroupId}-SL`,
                      ocoGroupId: ids.bracketGroupId,
                    }
                  : null,
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : 0,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_reconciled",
          "position_synced",
          "ready",
          "Reconciliation verified account and route state for the working order lifecycle.",
          1080,
          buildReconciliationPayload({
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "working_order_confirmed",
            workingOrderPresent:
              primaryOrder && typeof primaryOrder.ordStatus === "string"
                ? String(primaryOrder.ordStatus) === "working"
                : true,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : 0,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "flat",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "await_fill_or_flat",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : 0,
          }
        ),
      ];
    case "partial_fill":
      return [
        makeEvent(
          "ack",
          "order_acknowledged",
          "accepted",
          "ready",
          "Broker acknowledgement accepted the staged submit and began a partially filled lifecycle.",
          120,
          {
            ...basePayload,
            ackState: "accepted",
            routeStatus: "working",
            riskStatus: "passed",
            gatewayTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.gatewayTimestampMicros))
                ? Number(normalizedOutcome.gatewayTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 120_000),
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 145_000),
          },
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.leavesQty))
                  ? Number(primaryOrder.leavesQty)
                  : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : null,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_partial_fill",
          "partially_filled",
          "ready",
          "Execution report confirms a partial fill with residual working quantity and active protection state.",
          520,
          {
            ...basePayload,
            executionState: "partially_filled",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "partial_fill",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "partially_filled",
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.leavesQty))
                  ? Number(primaryOrder.leavesQty)
                  : null,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.cumQty))
                  ? Number(primaryOrder.cumQty)
                  : null,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "partially_filled",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.leavesQty))
                  ? Number(primaryOrder.leavesQty)
                  : null,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : null,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_reconciled",
          "position_open_partial",
          "ready",
          "Reconciliation confirms a partially open position with residual order quantity still working.",
          1080,
          buildReconciliationPayload({
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "partial_fill_open_position",
            workingOrderPresent:
              primaryOrder && Number.isFinite(Number(primaryOrder.leavesQty))
                ? Number(primaryOrder.leavesQty) > 0
                : true,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : null,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "open_partial",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "monitor_residual_order_and_protection",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.leavesQty))
                  ? Number(primaryOrder.leavesQty)
                  : null,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : null,
          }
        ),
      ];
    case "filled":
      return [
        makeEvent(
          "ack",
          "order_acknowledged",
          "accepted",
          "ready",
          "Broker acknowledgement accepted the staged submit and completed a full fill lifecycle.",
          120,
          {
            ...basePayload,
            ackState: "accepted",
            routeStatus: "filled",
            riskStatus: "passed",
            gatewayTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.gatewayTimestampMicros))
                ? Number(normalizedOutcome.gatewayTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 120_000),
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 145_000),
          },
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_filled",
          "filled",
          "ready",
          "Execution report confirms the entry order is fully filled and protection is now managing the open position.",
          520,
          {
            ...basePayload,
            executionState: "filled",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "fill",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "filled",
            leavesQty: 0,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.cumQty))
                  ? Number(primaryOrder.cumQty)
                  : context.quantity,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "filled",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_reconciled",
          "position_open",
          "ready",
          "Reconciliation confirms the account is now long/short and the protection legs are working.",
          1080,
          buildReconciliationPayload({
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "filled_open_position",
            workingOrderPresent: false,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : context.quantity,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "open",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "monitor_position_and_protection",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
      ];
    case "flat_exit":
      return [
        makeEvent(
          "ack",
          "order_acknowledged",
          "accepted",
          "ready",
          "Broker acknowledgement accepted the staged submit and the simulated trade lifecycle has already returned to flat.",
          120,
          {
            ...basePayload,
            ackState: "accepted",
            routeStatus: "completed",
            riskStatus: "passed",
            gatewayTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.gatewayTimestampMicros))
                ? Number(normalizedOutcome.gatewayTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 120_000),
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 145_000),
          },
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
        makeEvent(
          "execution_report",
          "trade_lifecycle_flat_exit",
          "flat",
          "ready",
          "Execution report shows the trade lifecycle completed and a protection child order flattened the position.",
          520,
          {
            ...basePayload,
            executionState: "flat_after_exit",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "fill",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "filled",
            leavesQty: 0,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.cumQty))
                  ? Number(primaryOrder.cumQty)
                  : context.quantity,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "filled_then_flattened",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_reconciled",
          "flat_confirmed",
          "ready",
          "Reconciliation confirms the position is flat and the simulated lifecycle is complete.",
          1080,
          buildReconciliationPayload({
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "flat_after_exit",
            workingOrderPresent: false,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : 0,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "flat_after_exit",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "journal_trade_complete",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
      ];
    case "rejected":
      return [
        makeEvent(
          "ack",
          "order_rejected",
          "rejected",
          "warning",
          "Broker acknowledgement rejected the staged submit before it became active.",
          120,
          {
            ...basePayload,
            ackState: "rejected",
            rejectCode:
              normalizedOutcome && typeof normalizedOutcome.rejectCode === "string"
                ? String(normalizedOutcome.rejectCode)
                : "RISK_REJECT",
            rejectReason:
              normalizedOutcome && typeof normalizedOutcome.rejectReason === "string"
                ? String(normalizedOutcome.rejectReason)
                : "simulated_risk_reject",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 120_000),
          },
          {
            leavesQty: 0,
            filledQty: 0,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_rejected",
          "rejected",
          "warning",
          "Execution report returned a reject state and no live working order was created.",
          520,
          {
            ...basePayload,
            executionState: "rejected",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "rejected",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "rejected",
            leavesQty: 0,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : 0,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : null,
            rejectCode:
              normalizedOutcome && typeof normalizedOutcome.rejectCode === "string"
                ? String(normalizedOutcome.rejectCode)
                : "RISK_REJECT",
            rejectReason:
              normalizedOutcome && typeof normalizedOutcome.rejectReason === "string"
                ? String(normalizedOutcome.rejectReason)
                : "simulated_risk_reject",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty: 0,
            filledQty: 0,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_reconciled",
          "no_live_order",
          "ready",
          "Reconciliation confirmed no open broker position for this rejected command.",
          1080,
          {
            ...basePayload,
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "rejected_no_live_order",
            workingOrderPresent: false,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : 0,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "flat",
            positionDelta: 0,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          },
          {
            leavesQty: 0,
            filledQty: 0,
          }
        ),
      ];
    case "uncertain":
      return [
        makeEvent(
          "ack",
          "order_acknowledgement_uncertain",
          "uncertain",
          "warning",
          "Broker acknowledgement came back uncertain and requires explicit follow-up checks.",
          120,
          {
            ...basePayload,
            ackState: "uncertain",
            recoveryHint: "await_order_sync",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 120_000),
          },
          {
            leavesQty: context.quantity,
            filledQty: null,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_pending_reconciliation",
          "pending_reconciliation",
          "warning",
          "Execution state is ambiguous; the order may be live and must be confirmed by broker sync.",
          520,
          {
            ...basePayload,
            executionState: "unknown",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "pending",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "unknown",
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : null,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "pending_reconciliation",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : null,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_reconciliation_pending",
          "manual_review_required",
          "warning",
          "Reconciliation remains open until broker position/order sync resolves the uncertain state.",
          1080,
          buildReconciliationPayload({
            reconciliation: "pending",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "manual_review_required",
            workingOrderPresent: null,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : null,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "unknown",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "trigger_broker_state_sync",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : null,
          }
        ),
      ];
    case "uncertain_recovered":
      return [
        makeEvent(
          "ack",
          "order_acknowledgement_recovered",
          "recovered",
          "ready",
          "Initial broker uncertainty was resolved and the original order correlation was recovered successfully.",
          120,
          {
            ...basePayload,
            ackState: "recovered",
            recoveryHint: "broker_sync_resolved",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 245_000),
          },
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_recovered_fill",
          "filled_after_recovery",
          "ready",
          "Broker sync confirmed the order actually filled and protection legs were restored into the normal working lifecycle.",
          520,
          {
            ...basePayload,
            executionState: "recovered_fill",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "fill_after_recovery",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "filled",
            leavesQty: 0,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : context.quantity,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "filled_after_recovery",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_recovered",
          "aligned",
          "ready",
          "Reconciliation resolved the uncertain state and the downstream lane is now healthy again.",
          1080,
          buildReconciliationPayload({
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "filled_open_position",
            workingOrderPresent: false,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : context.quantity,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "open",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "monitor_position_and_protection",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty: 0,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : primaryOrder && Number.isFinite(Number(primaryOrder.filledQty))
                  ? Number(primaryOrder.filledQty)
                  : context.quantity,
          }
        ),
      ];
    case "transport_failed":
      return [
        makeEvent(
          "ack",
          "submit_not_received",
          "not_received",
          "error",
          "No broker acknowledgement was received because transport failed before submit reached the gateway.",
          120,
          {
            ...basePayload,
            ackState: "missing",
            transportState: "failed_before_gateway",
            retryable: true,
            brokerOrderId: null,
            rejectCode:
              normalizedOutcome && typeof normalizedOutcome.rejectCode === "string"
                ? String(normalizedOutcome.rejectCode)
                : "TRANSPORT_FAILED",
            rejectReason:
              normalizedOutcome && typeof normalizedOutcome.rejectReason === "string"
                ? String(normalizedOutcome.rejectReason)
                : "transport_failed_before_gateway",
          },
          {
            leavesQty: null,
            filledQty: null,
          },
          {
            brokerOrderId: null,
          }
        ),
        makeEvent(
          "execution_report",
          "execution_report_unavailable",
          "unavailable",
          "error",
          "Execution report stream is unavailable because the protocol transport failed.",
          520,
          {
            ...basePayload,
            executionState: "unavailable",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "unavailable",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "not_sent",
            brokerOrderId: null,
            rejectCode:
              normalizedOutcome && typeof normalizedOutcome.rejectCode === "string"
                ? String(normalizedOutcome.rejectCode)
                : "TRANSPORT_FAILED",
            rejectReason:
              normalizedOutcome && typeof normalizedOutcome.rejectReason === "string"
                ? String(normalizedOutcome.rejectReason)
                : "transport_failed_before_gateway",
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "transport_failed_before_gateway",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : null,
          },
          {
            leavesQty: null,
            filledQty: null,
          },
          {
            brokerOrderId: null,
          }
        ),
        makeEvent(
          "reconciliation",
          "retry_required",
          "retry_required",
          "warning",
          "Reconciliation marked the command for retry after transport recovery.",
          1080,
          {
            ...buildReconciliationPayload({
              reconciliation: "retry_required",
              reconciliationState:
                normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                  ? String(normalizedOutcome.reconciliationState)
                  : "transport_retry_required",
              workingOrderPresent: null,
              openPositionQty: null,
              positionState:
                positionSnapshot && typeof positionSnapshot.positionState === "string"
                  ? String(positionSnapshot.positionState)
                  : "unknown",
              nextAction:
                lifecycleHints && typeof lifecycleHints.nextAction === "string"
                  ? String(lifecycleHints.nextAction)
                  : "restage_transport",
              brokerTimestampMicros: null,
            }),
            retryable: true,
            brokerOrderId: null,
          },
          {
            leavesQty: null,
            filledQty: null,
          },
          {
            brokerOrderId: null,
          }
        ),
      ];
    case "transport_recovered":
      return [
        makeEvent(
          "ack",
          "transport_recovered_submit_accepted",
          "recovered",
          "ready",
          "A failed transport was restaged successfully and the broker accepted the original intent.",
          120,
          {
            ...basePayload,
            ackState: "accepted_after_recovery",
            transportState: "recovered",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 245_000),
          },
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : 0,
          }
        ),
        makeEvent(
          "execution_report",
          "order_status_working_after_recovery",
          "working_after_recovery",
          "ready",
          "Execution report confirms the recovered transport path is now back to a live working order with normal protection flow.",
          520,
          {
            ...basePayload,
            executionState: "working_after_recovery",
            execType:
              normalizedOutcome && typeof normalizedOutcome.execType === "string"
                ? String(normalizedOutcome.execType)
                : "new_after_recovery",
            ordStatus:
              normalizedOutcome && typeof normalizedOutcome.ordStatus === "string"
                ? String(normalizedOutcome.ordStatus)
                : "working",
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            cumQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.cumQty))
                ? Number(normalizedOutcome.cumQty)
                : 0,
            avgFillPrice:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.avgFillPrice))
                ? Number(normalizedOutcome.avgFillPrice)
                : primaryOrder && Number.isFinite(Number(primaryOrder.avgFillPrice))
                  ? Number(primaryOrder.avgFillPrice)
                  : null,
            primaryOrderState:
              primaryOrder && typeof primaryOrder.orderState === "string"
                ? String(primaryOrder.orderState)
                : "working_after_recovery",
            protectionOrders,
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 520_000),
          },
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : 0,
          }
        ),
        makeEvent(
          "reconciliation",
          "broker_state_recovered",
          "aligned",
          "ready",
          "Reconciliation confirms the recovered transport path is healthy and back to normal monitoring.",
          1080,
          buildReconciliationPayload({
            reconciliation: "complete",
            reconciliationState:
              normalizedOutcome && typeof normalizedOutcome.reconciliationState === "string"
                ? String(normalizedOutcome.reconciliationState)
                : "working_order_confirmed",
            workingOrderPresent: true,
            openPositionQty:
              positionSnapshot && Number.isFinite(Number(positionSnapshot.openPositionQty))
                ? Number(positionSnapshot.openPositionQty)
                : 0,
            positionState:
              positionSnapshot && typeof positionSnapshot.positionState === "string"
                ? String(positionSnapshot.positionState)
                : "flat",
            nextAction:
              lifecycleHints && typeof lifecycleHints.nextAction === "string"
                ? String(lifecycleHints.nextAction)
                : "monitor_working_order_and_protection",
            brokerTimestampMicros:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.brokerTimestampMicros))
                ? Number(normalizedOutcome.brokerTimestampMicros)
                : isoToMicros(attempt.attemptedAt, 1_080_000),
          }),
          {
            leavesQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.leavesQty))
                ? Number(normalizedOutcome.leavesQty)
                : context.quantity,
            filledQty:
              normalizedOutcome && Number.isFinite(Number(normalizedOutcome.filledQty))
                ? Number(normalizedOutcome.filledQty)
                : 0,
          }
        ),
      ];
    default:
      return [];
  }
}

export async function stageRithmicDispatchAttempt() {
  const handoff = getRithmicLiveSubmitHandoff();
  if (!handoff) {
    return { ok: false as const, error: "Stage a Rithmic submit attempt before dispatching the adapter boundary." };
  }

  const boundary = buildRithmicAdapterBoundary({ handoff });
  const dispatch = stageRithmicTransportDispatch({ handoff, boundary });
  globalForFutures.__kwantifyRithmicLastDispatchAttempt = dispatch;

  await appendFuturesJournalEntry({
    category: "execution",
    venue: "rithmic",
    title:
      dispatch.dispatchState === "handoff_blocked"
        ? "Rithmic dispatch blocked"
        : dispatch.dispatchState === "boundary_ready"
          ? "Rithmic adapter boundary accepted handoff"
          : "Rithmic transport stub staged",
    detail: dispatch.operatorMessage,
    accountId:
      typeof handoff.requestEnvelope.accountId === "string" ? handoff.requestEnvelope.accountId : null,
    routeProfileId:
      typeof handoff.requestEnvelope.routeProfileId === "string" ? handoff.requestEnvelope.routeProfileId : null,
    signalId: dispatch.signalId,
    status: dispatch.dispatchState === "handoff_blocked" ? "warning" : "ready",
    requestBody: dispatch.requestEnvelope,
    responseBody: dispatch.responseBody,
    occurredAt: dispatch.dispatchedAt,
  });

  return {
    ok: true as const,
    boundary,
    dispatch,
  };
}

export async function stageRithmicTransportAttempt() {
  const handoff = getRithmicLiveSubmitHandoff();
  const boundary = getRithmicAdapterBoundary();
  if (!handoff || !boundary) {
    return { ok: false as const, error: "Stage a Rithmic submit attempt before building the transport packet." };
  }

  const packet = buildRithmicTransportPacket({ handoff, boundary });
  const attempt = runRithmicTransportStub({ handoff, boundary, packet });
  globalForFutures.__kwantifyRithmicLastTransportAttempt = attempt;

  await appendFuturesJournalEntry({
    category: "execution",
    venue: "rithmic",
    title: attempt.transportState === "handoff_blocked" ? "Rithmic transport blocked" : "Rithmic transport packet staged",
    detail: attempt.operatorMessage,
    accountId:
      typeof handoff.requestEnvelope.accountId === "string" ? handoff.requestEnvelope.accountId : null,
    routeProfileId:
      typeof handoff.requestEnvelope.routeProfileId === "string" ? handoff.requestEnvelope.routeProfileId : null,
    signalId: attempt.signalId,
    status: attempt.transportState === "handoff_blocked" ? "warning" : "ready",
    requestBody: attempt.payload,
    responseBody: attempt.responseBody,
    occurredAt: attempt.attemptedAt,
  });

  return {
    ok: true as const,
    packet,
    attempt,
  };
}

export async function runRithmicProtocolServiceAttempt(options?: { scenario?: RithmicGatewayScenario }) {
  const packet = getRithmicTransportPacket();
  if (!packet) {
    return { ok: false as const, error: "Stage a Rithmic submit attempt before running the protocol-service runner." };
  }

  const attempt = await runRithmicProtocolService({ packet, scenario: options?.scenario });
  globalForFutures.__kwantifyRithmicLastProtocolServiceAttempt = attempt;
  const { accountId, routeProfileId } = getAccountAndRouteFromRithmicPacket(packet);

  await appendFuturesJournalEntry({
    category: "execution",
    venue: "rithmic",
    title:
      attempt.runState === "config_blocked"
        ? "Rithmic protocol runner blocked"
        : attempt.runState === "dry_run_staged"
          ? "Rithmic protocol dry run staged"
          : attempt.runState === "live_stubbed"
            ? "Rithmic protocol service invoked"
            : "Rithmic protocol transport error",
    detail: attempt.operatorMessage,
    accountId,
    routeProfileId,
    signalId: attempt.signalId,
    status:
      attempt.runState === "transport_error"
        ? "error"
        : attempt.runState === "config_blocked"
          ? "warning"
          : "ready",
    requestBody: attempt.requestBody,
    responseBody: attempt.responseBody,
    occurredAt: attempt.attemptedAt,
  });

  const lifecycleEvents = buildRithmicSimulatedLifecycleEvents({ attempt, packet });
  if (lifecycleEvents.length) {
    const current = getRithmicSimulatedLifecycle();
    globalForFutures.__kwantifyRithmicSimulatedLifecycle = [...lifecycleEvents, ...current].slice(0, 36);

    for (const event of lifecycleEvents) {
      await appendFuturesJournalEntry({
        category: "execution",
        venue: "rithmic",
        title: `Rithmic lifecycle ${event.stage.replaceAll("_", " ")}`,
        detail: `${event.detail} Outcome: ${event.outcome.replaceAll("_", " ")}.`,
        accountId,
        routeProfileId,
        signalId: event.signalId,
        status: event.status,
        requestBody: event.payload,
        responseBody: {
          correlationId: event.correlationId,
          stage: event.stage,
          eventType: event.eventType,
          outcome: event.outcome,
          brokerOrderId: event.brokerOrderId,
          clientOrderId: event.clientOrderId,
          parentOrderId: event.parentOrderId,
          leavesQty: event.leavesQty,
          filledQty: event.filledQty,
          cumQty: event.cumQty,
          avgFillPrice: event.avgFillPrice,
          execType: event.execType,
          ordStatus: event.ordStatus,
          rejectCode: event.rejectCode,
          rejectReason: event.rejectReason,
          reconciliationState: event.reconciliationState,
          gatewayTimestampMicros: event.gatewayTimestampMicros,
          brokerTimestampMicros: event.brokerTimestampMicros,
        },
        occurredAt: event.occurredAt,
      });
    }
  }

  return {
    ok: true as const,
    attempt,
    lifecycleEvents,
  };
}

export async function replayLatestRithmicLifecycleScenario() {
  const scenario = getLatestRithmicLifecycleScenario();
  if (!scenario) {
    return {
      ok: false as const,
      error: "Run at least one Rithmic protocol-service lifecycle scenario before replaying it.",
    };
  }

  const result = await runRithmicProtocolServiceAttempt({ scenario });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true as const,
    scenario,
    attempt: result.attempt,
    lifecycleEvents: result.lifecycleEvents,
  };
}

export async function clearRithmicSimulatedLifecycleStream() {
  const clearedCount = getRithmicSimulatedLifecycle().length;
  globalForFutures.__kwantifyRithmicSimulatedLifecycle = [];

  await appendFuturesJournalEntry({
    category: "control",
    venue: "rithmic",
    title: "Rithmic lifecycle stream cleared",
    detail:
      clearedCount > 0
        ? `Cleared ${clearedCount} simulated lifecycle event${clearedCount === 1 ? "" : "s"} from the operator stream.`
        : "Lifecycle clear requested while the simulated stream was already empty.",
    accountId: null,
    routeProfileId: null,
    signalId: null,
    status: "info",
    requestBody: {
      action: "clear_simulated_lifecycle_stream",
      clearedCount,
    },
    responseBody: {
      remaining: 0,
    },
    occurredAt: new Date().toISOString(),
  });

  return {
    ok: true as const,
    clearedCount,
  };
}

export async function runRithmicProtocolStubAttempt() {
  const packet = getRithmicTransportPacket();
  if (!packet) {
    return { ok: false as const, error: "Stage a Rithmic submit attempt before running the local protocol stub." };
  }

  const result = handleRithmicProtocolStubPacket({ packet });
  globalForFutures.__kwantifyRithmicLastProtocolStubAttempt = result;

  await appendFuturesJournalEntry({
    category: "execution",
    venue: "rithmic",
    title: result.runState === "stub_blocked" ? "Rithmic protocol stub blocked" : "Rithmic protocol stub accepted packet",
    detail: result.operatorMessage,
    accountId:
      typeof packet.payload.requestEnvelope === "object" &&
      packet.payload.requestEnvelope &&
      typeof (packet.payload.requestEnvelope as Record<string, unknown>).accountId === "string"
        ? String((packet.payload.requestEnvelope as Record<string, unknown>).accountId)
        : null,
    routeProfileId:
      typeof packet.payload.requestEnvelope === "object" &&
      packet.payload.requestEnvelope &&
      typeof (packet.payload.requestEnvelope as Record<string, unknown>).routeProfileId === "string"
        ? String((packet.payload.requestEnvelope as Record<string, unknown>).routeProfileId)
        : null,
    signalId: result.signalId,
    status: result.runState === "stub_blocked" ? "warning" : "ready",
    requestBody: result.requestBody,
    responseBody: result.responseBody,
    occurredAt: result.attemptedAt,
  });

  return {
    ok: true as const,
    result,
  };
}

async function requestTradovateAccessToken() {
  const config = getTradovateAuthConfig();
  const metadata = getTradovateEnvironmentMetadata(config.environment);
  const oauthConfig = getTradovateOAuthConfig();
  const oauthConnection = readStoredTradovateOAuthConnectionSync();

  if (oauthConnection?.accessToken) {
    const oauthMetadata = getTradovateEnvironmentMetadata(oauthConnection.environment);
    const expiresAtMs = oauthConnection.expiresAt ? Date.parse(oauthConnection.expiresAt) : Number.NaN;
    const now = Date.now();
    const isStillFresh = Number.isFinite(expiresAtMs) ? expiresAtMs - now > 5 * 60 * 1000 : true;

    if (isStillFresh) {
      return {
        ok: true as const,
        config,
        metadata: oauthMetadata,
        accessToken: oauthConnection.accessToken,
        authMode: "oauth" as const,
      };
    }

    const renewResponse = await fetch(`${oauthMetadata.apiBase}/auth/renewaccesstoken`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${oauthConnection.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const renewJson = await renewResponse.json().catch(() => null);
    const renewedToken =
      typeof renewJson?.accessToken === "string"
        ? renewJson.accessToken
        : typeof renewJson?.access_token === "string"
          ? renewJson.access_token
          : null;

    if (renewResponse.ok && renewedToken) {
      const expiresIn =
        typeof renewJson?.expirationTime === "number"
          ? renewJson.expirationTime
          : typeof renewJson?.expires_in === "number"
            ? renewJson.expires_in
            : typeof renewJson?.expiresIn === "number"
              ? renewJson.expiresIn
              : 90 * 60;
      const refreshedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      await saveStoredTradovateOAuthConnection({
        ...oauthConnection,
        accessToken: renewedToken,
        mdAccessToken:
          typeof renewJson?.mdAccessToken === "string"
            ? renewJson.mdAccessToken
            : typeof renewJson?.md_access_token === "string"
              ? renewJson.md_access_token
              : oauthConnection.mdAccessToken,
        expiresAt,
        receivedAt: refreshedAt,
      });

      return {
        ok: true as const,
        config,
        metadata: oauthMetadata,
        accessToken: renewedToken,
        authMode: "oauth" as const,
      };
    }

    await clearStoredTradovateOAuthConnection();
    return {
      ok: false as const,
      config,
      metadata: oauthMetadata,
      error:
        typeof renewJson?.error_description === "string"
          ? renewJson.error_description
          : typeof renewJson?.errorText === "string"
            ? renewJson.errorText
            : `Tradovate OAuth token could not be renewed. Reconnect the broker from the futures page.`,
    };
  }

  const runtime = getTradovateRuntimeStatus();
  if (runtime.missingFields.length) {
    return {
      ok: false as const,
      config,
      metadata,
      error: runtime.lastAuthDetail,
    };
  }

  const authResponse = await fetch(`${metadata.apiBase}/auth/accesstokenrequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: config.username,
      password: config.password,
      appId: config.appId,
      appVersion: config.appVersion,
      cid: Number(config.cid),
      sec: config.secret,
    }),
    cache: "no-store",
  });
  const authJson = await authResponse.json().catch(() => null);

  if (!authResponse.ok || !authJson?.accessToken) {
    return {
      ok: false as const,
      config,
      metadata,
      error:
        authJson?.errorText ||
        authJson?.error ||
        `Tradovate access token request failed with HTTP ${authResponse.status}.`,
    };
  }

  return {
    ok: true as const,
    config,
    metadata,
    accessToken: String(authJson.accessToken),
    authMode: "direct_api" as const,
  };
}

export async function saveTradovateConnectionConfig(payload: {
  environment?: string;
  username?: string;
  password?: string;
  appId?: string;
  appVersion?: string;
  cid?: string;
  secret?: string;
  accountIdOverride?: string;
  accountNameOverride?: string;
}) {
  const current = readStoredTradovateConnectionConfigSync();
  const envDefaults = getTradovateEnvAuthConfig();
  const next = await saveStoredTradovateConnectionConfig({
    environment:
      payload.environment === "live" || payload.environment === "staging" || payload.environment === "demo"
        ? payload.environment
        : current?.environment ?? envDefaults.environment,
    username: String(payload.username ?? current?.username ?? envDefaults.username).trim(),
    password:
      typeof payload.password === "string" && payload.password.length > 0
        ? payload.password
        : current?.password ?? envDefaults.password,
    appId: String(payload.appId ?? current?.appId ?? envDefaults.appId).trim(),
    appVersion: String(payload.appVersion ?? current?.appVersion ?? envDefaults.appVersion).trim() || "1.0.0",
    cid: String(payload.cid ?? current?.cid ?? envDefaults.cid).trim(),
    secret:
      typeof payload.secret === "string" && payload.secret.length > 0
        ? payload.secret
        : current?.secret ?? envDefaults.secret,
    accountIdOverride: String(
      payload.accountIdOverride ?? current?.accountIdOverride ?? envDefaults.accountIdOverride
    ).trim(),
    accountNameOverride: String(
      payload.accountNameOverride ?? current?.accountNameOverride ?? envDefaults.accountNameOverride
    ).trim(),
  });

  globalForFutures.__kwantifyTradovateLastAuthTest = {
    ...getTradovateRuntimeStatus(),
    authStatus: getTradovateConnectionConfigSummary().missingFields.length ? "missing_config" : "configured",
    lastAuthTestAt: null,
    lastAuthDetail: "Tradovate connection details saved. Run Test Auth to verify the lane.",
  };

  const summary = getTradovateConnectionConfigSummary();

  await appendFuturesJournalEntry({
    category: "config",
    venue: "tradovate",
    title: "Tradovate connection saved",
    detail: `Saved Tradovate ${summary.selectedEnvironment} connection for ${summary.username || "configured user"}.`,
    accountId: null,
    routeProfileId: null,
    signalId: null,
    status: summary.missingFields.length ? "warning" : "ready",
    requestBody: {
      environment: next.environment,
      username: next.username,
      appId: next.appId,
      appVersion: next.appVersion,
      cid: next.cid,
      accountIdOverride: next.accountIdOverride || null,
      accountNameOverride: next.accountNameOverride || null,
      passwordSaved: Boolean(next.password),
      secretSaved: Boolean(next.secret),
    },
    responseBody: {
      source: summary.source,
      storageLocation: summary.storageLocation,
      missingFields: summary.missingFields,
      updatedAt: summary.updatedAt,
    },
  });

  return summary;
}

export async function clearTradovateConnectionConfig() {
  await clearStoredTradovateConnectionConfig();

  const summary = getTradovateConnectionConfigSummary();
  globalForFutures.__kwantifyTradovateLastAuthTest = {
    ...getTradovateRuntimeStatus(),
    authStatus: summary.missingFields.length ? "missing_config" : "configured",
    lastAuthTestAt: null,
    lastAuthDetail:
      summary.source === "env"
        ? "Saved Tradovate connection cleared. Env credentials are still available on this server."
        : "Saved Tradovate connection cleared. Add credentials again or rely on env fallback if configured.",
  };

  await appendFuturesJournalEntry({
    category: "config",
    venue: "tradovate",
    title: "Tradovate connection cleared",
    detail:
      summary.source === "env"
        ? "Removed the saved Tradovate connection and fell back to server env credentials."
        : "Removed the saved Tradovate connection profile from local server storage.",
    accountId: null,
    routeProfileId: null,
    signalId: null,
    status: "info",
    requestBody: null,
    responseBody: {
      source: summary.source,
      storageLocation: summary.storageLocation,
      missingFields: summary.missingFields,
      updatedAt: summary.updatedAt,
    },
  });

  return summary;
}

export async function startTradovateRetailOAuthConnect(options?: {
  redirectTo?: string | null;
  source?: string | null;
}) {
  const retail = getTradovateRetailConnectStatus();
  const authorizationUrl = buildTradovateOAuthAuthorizationUrl({
    redirectTo: options?.redirectTo ?? null,
    source: options?.source ?? null,
  });
  if (!retail.oauthConfigured || !authorizationUrl) {
    return {
      ok: false as const,
      error:
        retail.missingFields.length > 0
          ? `Tradovate retail OAuth is not configured on this server yet. Missing: ${retail.missingFields.join(", ")}`
          : "Tradovate retail OAuth authorization URL could not be built.",
    };
  }

  await appendFuturesJournalEntry({
    category: "config",
    venue: "tradovate",
    title: "Tradovate retail connect started",
    detail:
      options?.source === "trade_syncer"
        ? "Operator started the Tradovate OAuth broker-connect flow from Trade Syncer."
        : "Operator started the Tradovate OAuth broker-connect flow from the futures page.",
    accountId: null,
    routeProfileId: null,
    signalId: null,
    status: "info",
    requestBody: {
      authorizationUrl,
      environment: retail.selectedEnvironment,
      redirectTo: options?.redirectTo ?? null,
      source: options?.source ?? null,
    },
    responseBody: null,
  });

  return {
    ok: true as const,
    authorizationUrl,
  };
}

export async function handleTradovateRetailOAuthCallback(args: {
  code?: string | null;
  error?: string | null;
  state?: string | null;
}) {
  const state = decodeTradovateOAuthState(args.state);
  if (args.error) {
    return {
      ok: false as const,
      error: `Tradovate OAuth returned an error: ${args.error}`,
      redirectTo: state?.redirectTo ?? null,
    };
  }

  if (!args.code) {
    return {
      ok: false as const,
      error: "Tradovate OAuth callback did not include an authorization code.",
      redirectTo: state?.redirectTo ?? null,
    };
  }

  const oauth = getTradovateOAuthConfig();
  const retail = getTradovateRetailConnectStatus();
  if (!retail.oauthConfigured) {
    return {
      ok: false as const,
      error: `Tradovate retail OAuth is not configured on this server yet. Missing: ${retail.missingFields.join(", ")}`,
      redirectTo: state?.redirectTo ?? null,
    };
  }

  const metadata = getTradovateEnvironmentMetadata(oauth.environment);
  const exchangeResponse = await fetch(`${metadata.apiBase}/auth/oauthtoken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: args.code,
      redirect_uri: oauth.redirectUri,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
    }),
    cache: "no-store",
  });
  const exchangeJson = await exchangeResponse.json().catch(() => null);
  const accessToken =
    typeof exchangeJson?.accessToken === "string"
      ? exchangeJson.accessToken
      : typeof exchangeJson?.access_token === "string"
        ? exchangeJson.access_token
        : null;

  if (!exchangeResponse.ok || !accessToken) {
    return {
      ok: false as const,
      error:
        typeof exchangeJson?.error_description === "string"
          ? exchangeJson.error_description
          : typeof exchangeJson?.errorText === "string"
            ? exchangeJson.errorText
            : typeof exchangeJson?.error === "string"
              ? exchangeJson.error
              : `Tradovate OAuth token exchange failed with HTTP ${exchangeResponse.status}.`,
      redirectTo: state?.redirectTo ?? null,
    };
  }

  const meResponse = await fetch(`${metadata.apiBase}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const meJson = await meResponse.json().catch(() => null);
  const now = new Date().toISOString();
  const expiresIn =
    typeof exchangeJson?.expirationTime === "number"
      ? exchangeJson.expirationTime
      : typeof exchangeJson?.expires_in === "number"
        ? exchangeJson.expires_in
        : typeof exchangeJson?.expiresIn === "number"
          ? exchangeJson.expiresIn
          : 90 * 60;

  const stored = await saveStoredTradovateOAuthConnection({
    environment: oauth.environment,
    accessToken,
    mdAccessToken:
      typeof exchangeJson?.mdAccessToken === "string"
        ? exchangeJson.mdAccessToken
        : typeof exchangeJson?.md_access_token === "string"
          ? exchangeJson.md_access_token
          : null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    receivedAt: now,
    connectedAt: now,
    user:
      meJson && typeof meJson === "object"
        ? {
            userId:
              typeof (meJson as Record<string, unknown>).userId === "number"
                ? String((meJson as Record<string, unknown>).userId)
                : typeof (meJson as Record<string, unknown>).userId === "string"
                  ? String((meJson as Record<string, unknown>).userId)
                  : null,
            name:
              typeof (meJson as Record<string, unknown>).fullName === "string"
                ? String((meJson as Record<string, unknown>).fullName)
                : null,
            userName:
              typeof (meJson as Record<string, unknown>).userName === "string"
                ? String((meJson as Record<string, unknown>).userName)
                : null,
          }
        : null,
  });

  globalForFutures.__kwantifyTradovateLastAuthTest = {
    ...getTradovateRuntimeStatus(),
    authStatus: "configured",
    lastAuthTestAt: now,
    lastAuthDetail: `Tradovate retail broker connect linked ${stored.user?.userName ?? stored.user?.name ?? "the current user"} successfully.`,
  };

  await appendFuturesJournalEntry({
    category: "config",
    venue: "tradovate",
    title: "Tradovate retail connect linked",
    detail:
      state?.source === "trade_syncer"
        ? `Tradovate OAuth linked ${stored.user?.userName ?? stored.user?.name ?? "the current user"} from Trade Syncer and stored broker tokens for the futures workspace.`
        : `Tradovate OAuth linked ${stored.user?.userName ?? stored.user?.name ?? "the current user"} and stored broker tokens for the futures workspace.`,
    accountId: null,
    routeProfileId: null,
    signalId: null,
    status: "ready",
    requestBody: {
      environment: oauth.environment,
      redirectUri: oauth.redirectUri,
    },
    responseBody: {
      connectedAt: stored.connectedAt,
      expiresAt: stored.expiresAt,
      user: stored.user,
      storageLocation: getTradovateOAuthStoreLocation(),
    },
    occurredAt: now,
  });

  return {
    ok: true as const,
    redirectTo: state?.redirectTo ?? null,
    connectedUserName: stored.user?.userName ?? stored.user?.name ?? null,
  };
}

export async function clearTradovateRetailOAuthConnection() {
  await clearStoredTradovateOAuthConnection();

  await appendFuturesJournalEntry({
    category: "config",
    venue: "tradovate",
    title: "Tradovate retail connect cleared",
    detail: "Removed the stored Tradovate OAuth broker connection from the futures workspace.",
    accountId: null,
    routeProfileId: null,
    signalId: null,
    status: "info",
    requestBody: null,
    responseBody: {
      storageLocation: getTradovateOAuthStoreLocation(),
    },
    occurredAt: new Date().toISOString(),
  });
}

function normalizeFuturesConnectorSignal(payload: unknown): FuturesConnectorSignalIntent {
  const body = payload as Partial<FuturesConnectorSignalIntent>;
  return {
    schemaVersion: FUTURES_CONNECTOR_SCHEMA_VERSION,
    signalId: String(body.signalId ?? "").trim(),
    strategyId: String(body.strategyId ?? "").trim(),
    versionId: String(body.versionId ?? "").trim(),
    venue: body.venue === "rithmic" ? "rithmic" : body.venue === "cqg" ? "cqg" : "tradovate",
    accountId: String(body.accountId ?? "").trim(),
    symbol: String(body.symbol ?? "").trim(),
    side: body.side === "sell" ? "sell" : "buy",
    quantityMode: body.quantityMode ?? "fixed_contracts",
    quantity: Number(body.quantity ?? 0),
    orderType: body.orderType ?? "market",
    limitPrice: body.limitPrice ?? null,
    stopPrice: body.stopPrice ?? null,
    tif: body.tif ?? "day",
    stopLoss: {
      mode: body.stopLoss?.mode ?? "none",
      value: body.stopLoss?.value ?? null,
    },
    takeProfit: {
      mode: body.takeProfit?.mode ?? "none",
      value: body.takeProfit?.value ?? null,
    },
    trail: body.trail
      ? {
          trigger: body.trail.trigger ?? null,
          distance: body.trail.distance ?? null,
          step: body.trail.step ?? null,
        }
      : undefined,
    timestamp: String(body.timestamp ?? new Date().toISOString()),
    comment: body.comment ? String(body.comment) : undefined,
  };
}

async function validateFuturesConnectorSignal(normalized: FuturesConnectorSignalIntent) {
  if (!normalized.signalId || !normalized.strategyId || !normalized.versionId || !normalized.accountId || !normalized.symbol) {
    return { ok: false as const, error: "signalId, strategyId, versionId, accountId, and symbol are required." };
  }
  if (!Number.isFinite(normalized.quantity) || normalized.quantity <= 0) {
    return { ok: false as const, error: "quantity must be a positive number." };
  }

  const managedProfiles = await getManagedFuturesProfiles();
  const account = managedProfiles.accounts.find((item) => item.id === normalized.accountId && item.venue === normalized.venue);
  if (!account) {
    return { ok: false as const, error: "Unknown futures account for the selected venue." };
  }

  const route = managedProfiles.routingProfiles.find((item) => item.id === account.routeProfileIds[0]);
  const risk = futuresRiskProfiles.find((item) => item.id === account.riskProfileId);

  if (!route || !risk) {
    return { ok: false as const, error: "Futures route profile or risk profile is missing." };
  }
  if (!route.allowedOrderTypes.includes(normalized.orderType)) {
    return { ok: false as const, error: `Order type ${normalized.orderType} is not allowed for ${route.label}.` };
  }
  if (!route.allowedTif.includes(normalized.tif)) {
    return { ok: false as const, error: `Time in force ${normalized.tif} is not allowed for ${route.label}.` };
  }
  if (normalized.quantity > risk.maxContractsPerOrder) {
    return { ok: false as const, error: `Quantity exceeds max contracts per order for ${risk.label}.` };
  }
  if (
    (normalized.stopLoss.mode !== "none" && normalized.stopLoss.value == null) ||
    (normalized.takeProfit.mode !== "none" && normalized.takeProfit.value == null)
  ) {
    return { ok: false as const, error: "Protection modes that are enabled must include numeric values." };
  }

  return {
    ok: true as const,
    normalized,
    account,
    route,
    risk,
  };
}

export async function testTradovateAuth() {
  const config = getTradovateAuthConfig();
  const runtime = getTradovateRuntimeStatus();

  if (runtime.missingFields.length) {
    globalForFutures.__kwantifyTradovateLastAuthTest = runtime;
    return runtime;
  }

  try {
    const tokenResult = await requestTradovateAccessToken();
    if (!tokenResult.ok) {
      const failed: FuturesAdapterRuntimeStatus = {
        ...runtime,
        authStatus: "auth_failed",
        lastAuthTestAt: new Date().toISOString(),
        lastAuthDetail: tokenResult.error,
      };
      globalForFutures.__kwantifyTradovateLastAuthTest = failed;
      return failed;
    }

    const meResponse = await fetch(`${tokenResult.metadata.apiBase}/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const meJson = await meResponse.json().catch(() => null);

    const ok: FuturesAdapterRuntimeStatus = {
      ...runtime,
      authStatus: meResponse.ok ? "auth_ok" : "auth_failed",
      lastAuthTestAt: new Date().toISOString(),
      lastAuthDetail: meResponse.ok
        ? `Tradovate auth succeeded for ${meJson?.name || meJson?.userName || "configured user"}.`
        : meJson?.errorText || meJson?.error || `Tradovate /auth/me failed with HTTP ${meResponse.status}.`,
    };
    globalForFutures.__kwantifyTradovateLastAuthTest = ok;
    return ok;
  } catch (error) {
    const failed: FuturesAdapterRuntimeStatus = {
      ...runtime,
      authStatus: "auth_failed",
      lastAuthTestAt: new Date().toISOString(),
      lastAuthDetail: error instanceof Error ? error.message : "Unknown Tradovate auth failure.",
    };
    globalForFutures.__kwantifyTradovateLastAuthTest = failed;
    return failed;
  }
}

export async function discoverTradovateSession(): Promise<TradovateSessionDiscovery> {
  const config = getTradovateAuthConfig();
  const runtime = getTradovateRuntimeStatus();
  const metadata = getTradovateEnvironmentMetadata(config.environment);

  if (runtime.missingFields.length) {
    return {
      adapterId: "tradovate-direct",
      authStatus: "missing_config",
      selectedEnvironment: config.environment,
      apiBase: metadata.apiBase,
      userWebsocket: metadata.userWebsocket,
      marketDataWebsocket: metadata.marketDataWebsocket,
      clientAccess: metadata.clientAccess,
      adminDashboard: metadata.adminDashboard,
      accountManagementScope: "Tradovate partner account/session discovery is blocked until the required env vars are configured.",
      authenticatedUser: null,
      notes: [
        "Tradovate partner docs start with auth/accesstokenrequest, then /auth/me, before moving into account and user management.",
        "Production account management stays gated by partner access and conformance requirements.",
      ],
      testedAt: null,
      error: runtime.lastAuthDetail,
    };
  }

  try {
    const tokenResult = await requestTradovateAccessToken();
    if (!tokenResult.ok) {
      return {
        adapterId: "tradovate-direct",
        authStatus: "auth_failed",
        selectedEnvironment: config.environment,
        apiBase: metadata.apiBase,
        userWebsocket: metadata.userWebsocket,
        marketDataWebsocket: metadata.marketDataWebsocket,
        clientAccess: metadata.clientAccess,
        adminDashboard: metadata.adminDashboard,
        accountManagementScope: "Access token request failed before authenticated account discovery could begin.",
        authenticatedUser: null,
        notes: [
          "Account discovery for Tradovate depends on successful partner auth first.",
          "The official quickstart path is auth/accesstokenrequest -> auth/me before any broader account or risk operations.",
        ],
        testedAt: new Date().toISOString(),
        error: tokenResult.error,
      };
    }

    const meResponse = await fetch(`${metadata.apiBase}/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const meJson = await meResponse.json().catch(() => null);

    return {
      adapterId: "tradovate-direct",
      authStatus: meResponse.ok ? "auth_ok" : "auth_failed",
      selectedEnvironment: config.environment,
      apiBase: metadata.apiBase,
      userWebsocket: metadata.userWebsocket,
      marketDataWebsocket: metadata.marketDataWebsocket,
      clientAccess: metadata.clientAccess,
      adminDashboard: metadata.adminDashboard,
      accountManagementScope: meResponse.ok
        ? "Authenticated session is valid. Next build step is real account discovery / route sync using the authenticated partner lane."
        : "Authenticated profile fetch failed, so account discovery is still blocked.",
      authenticatedUser: meResponse.ok
        ? {
            userId: meJson?.userId != null ? String(meJson.userId) : null,
            name: meJson?.name ? String(meJson.name) : null,
            userName: meJson?.userName ? String(meJson.userName) : null,
          }
        : null,
      notes: [
        "Official environments docs separate user WebSocket and market-data WebSocket endpoints.",
        "Tradovate partner docs emphasize account and risk management after authenticated session establishment.",
      ],
      testedAt: new Date().toISOString(),
      error: meResponse.ok
        ? null
        : meJson?.errorText || meJson?.error || `Tradovate /auth/me failed with HTTP ${meResponse.status}.`,
    };
  } catch (error) {
    return {
      adapterId: "tradovate-direct",
      authStatus: "auth_failed",
      selectedEnvironment: config.environment,
      apiBase: metadata.apiBase,
      userWebsocket: metadata.userWebsocket,
      marketDataWebsocket: metadata.marketDataWebsocket,
      clientAccess: metadata.clientAccess,
      adminDashboard: metadata.adminDashboard,
      accountManagementScope: "Session discovery threw before account discovery could begin.",
      authenticatedUser: null,
      notes: [
        "This flow is intentionally limited to the official quickstart/authenticated-session layer until we wire explicit account discovery endpoints.",
      ],
      testedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown Tradovate session discovery failure.",
    };
  }
}

export async function discoverTradovateAccounts(): Promise<TradovateAccountDiscovery> {
  const config = getTradovateAuthConfig();
  const metadata = getTradovateEnvironmentMetadata(config.environment);
  const runtime = getTradovateRuntimeStatus();

  if (runtime.missingFields.length) {
    return {
      adapterId: "tradovate-direct",
      authStatus: "missing_config",
      selectedEnvironment: config.environment,
      accountCount: 0,
      accounts: [],
      notes: [
        "Tradovate account discovery starts from the official /account/list endpoint after bearer auth succeeds.",
        "The account id returned here becomes the key bridge field for order submission and route binding.",
      ],
      testedAt: null,
      error: runtime.lastAuthDetail,
    };
  }

  try {
    const tokenResult = await requestTradovateAccessToken();
    if (!tokenResult.ok) {
      return {
        adapterId: "tradovate-direct",
        authStatus: "auth_failed",
        selectedEnvironment: config.environment,
        accountCount: 0,
        accounts: [],
        notes: [
          "Tradovate /account/list is blocked until partner auth succeeds.",
          "We should only trust account inventory once the same access token flow works against the selected environment.",
        ],
        testedAt: new Date().toISOString(),
        error: tokenResult.error,
      };
    }

    const accountResponse = await fetch(`${metadata.apiBase}/account/list`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const accountJson = await accountResponse.json().catch(() => null);

    if (!accountResponse.ok || !Array.isArray(accountJson)) {
      return {
        adapterId: "tradovate-direct",
        authStatus: "auth_failed",
        selectedEnvironment: config.environment,
        accountCount: 0,
        accounts: [],
        notes: [
          "Tradovate account discovery uses the official /account/list endpoint.",
          "The next binding layer should marry these discovered account ids to kwantify futures route profiles.",
        ],
        testedAt: new Date().toISOString(),
        error:
          accountJson?.errorText ||
          accountJson?.error ||
          `Tradovate /account/list failed with HTTP ${accountResponse.status}.`,
      };
    }

    return {
      adapterId: "tradovate-direct",
      authStatus: "auth_ok",
      selectedEnvironment: config.environment,
      accountCount: accountJson.length,
      accounts: accountJson.map((item: Record<string, unknown>) => ({
        id: item.id != null ? String(item.id) : "",
        name: item.name ? String(item.name) : null,
        accountType: item.accountType ? String(item.accountType) : null,
        active: typeof item.active === "boolean" ? item.active : null,
        riskCategoryId: item.riskCategoryId != null ? String(item.riskCategoryId) : null,
        autoLiqProfileId: item.autoLiqProfileId != null ? String(item.autoLiqProfileId) : null,
        clearingHouseId: item.clearingHouseId != null ? String(item.clearingHouseId) : null,
        evaluationSize: typeof item.evaluationSize === "number" ? item.evaluationSize : null,
        readonly: typeof item.readonly === "boolean" ? item.readonly : null,
      })),
      notes: [
        "These account ids are the real Tradovate entity ids we should bind to kwantify route profiles.",
        "Next build step is to promote one discovered account into a live route binding and submit path.",
      ],
      testedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    return {
      adapterId: "tradovate-direct",
      authStatus: "auth_failed",
      selectedEnvironment: config.environment,
      accountCount: 0,
      accounts: [],
      notes: [
        "Tradovate account discovery threw before account inventory could be normalized.",
      ],
      testedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown Tradovate account discovery failure.",
    };
  }
}

export async function resolveTradovateRouteBinding(args: {
  route: FuturesRoutingProfile;
  account: FuturesAccountRecord;
}): Promise<TradovateRouteBinding> {
  const { route, account } = args;
  const config = getTradovateAuthConfig();
  const overrideAccountId = config.accountIdOverride?.trim() ?? "";
  const overrideAccountName = config.accountNameOverride?.trim() ?? "";
  const managedBrokerAccountRef = account.brokerAccountRef?.trim() ?? "";
  const accountDiscovery = await discoverTradovateAccounts();
  const sessionDiscovery = await discoverTradovateSession();

  if (accountDiscovery.authStatus !== "auth_ok") {
    return {
      adapterId: "tradovate-direct",
      routeProfileId: route.id,
      accountId: account.id,
      selectedEnvironment: config.environment,
      brokerAccountRef: managedBrokerAccountRef || null,
      resolvedTradovateAccountId: null,
      resolvedTradovateAccountName: null,
      accountSpec: sessionDiscovery.authenticatedUser?.userName ?? null,
      resolutionSource: "unresolved",
      managedAccountLabel: account.label,
      managedRouteLabel: route.label,
      managedRiskProfileLabel:
        futuresRiskProfiles.find((item) => item.id === account.riskProfileId)?.label ?? null,
      notes: [
        "Tradovate route binding is blocked until partner auth and account discovery succeed.",
      ],
      error: accountDiscovery.error ?? "Tradovate account discovery is not ready.",
    };
  }

  const accounts = accountDiscovery.accounts;
  const byManagedRef = managedBrokerAccountRef
    ? accounts.find((item) => item.id === managedBrokerAccountRef)
    : null;
  const byOverrideId = overrideAccountId ? accounts.find((item) => item.id === overrideAccountId) : null;
  const byOverrideName = overrideAccountName
    ? accounts.find((item) => (item.name ?? "").trim().toLowerCase() === overrideAccountName.toLowerCase())
    : null;
  const firstActive = accounts.find((item) => item.active !== false && item.readonly !== true) ?? accounts[0] ?? null;
  const resolved = byManagedRef ?? byOverrideId ?? byOverrideName ?? firstActive;
  const resolutionSource: TradovateRouteBinding["resolutionSource"] = byManagedRef
    ? "managed_account_ref"
    : byOverrideId
    ? "connection_account_id"
    : byOverrideName
      ? "connection_account_name"
      : resolved
        ? "first_active_account"
        : "unresolved";

  return {
    adapterId: "tradovate-direct",
    routeProfileId: route.id,
    accountId: account.id,
    selectedEnvironment: config.environment,
    brokerAccountRef: managedBrokerAccountRef || resolved?.id || null,
    resolvedTradovateAccountId: resolved?.id ?? null,
    resolvedTradovateAccountName: resolved?.name ?? null,
    accountSpec: sessionDiscovery.authenticatedUser?.userName ?? null,
    resolutionSource,
    managedAccountLabel: account.label,
    managedRouteLabel: route.label,
    managedRiskProfileLabel:
      futuresRiskProfiles.find((item) => item.id === account.riskProfileId)?.label ?? null,
    notes: [
      byManagedRef
        ? "Using the managed brokerAccountRef stored on this futures account binding."
        : overrideAccountId
        ? "Using the saved Tradovate account id override for deterministic route binding."
        : overrideAccountName
          ? "Using the saved Tradovate account name override for deterministic route binding."
          : "No explicit account override provided; binding to the first active non-readonly discovered account.",
      "This binding should eventually move into first-class route/account connector policy instead of simple account override selection.",
    ],
    error:
      resolved && sessionDiscovery.authenticatedUser?.userName
        ? null
        : !resolved
          ? "No Tradovate account could be resolved from the discovered inventory."
          : "Authenticated Tradovate user name is unavailable for accountSpec binding.",
  };
}

export async function discoverTradovateBrokerState(): Promise<TradovateBrokerState> {
  const config = getTradovateAuthConfig();
  const runtime = getTradovateRuntimeStatus();

  if (runtime.missingFields.length) {
    return {
      adapterId: "tradovate-direct",
      selectedEnvironment: config.environment,
      authStatus: "missing_config",
      positions: [],
      workingOrders: [],
      fetchedAt: null,
      notes: [
        "Tradovate broker-state discovery depends on successful partner auth first.",
        "The first useful state pull is positions plus working orders so we can reconcile submit results against broker truth.",
      ],
      error: runtime.lastAuthDetail,
    };
  }

  const tokenResult = await requestTradovateAccessToken();
  if (!tokenResult.ok) {
    return {
      adapterId: "tradovate-direct",
      selectedEnvironment: config.environment,
      authStatus: "auth_failed",
      positions: [],
      workingOrders: [],
      fetchedAt: new Date().toISOString(),
      notes: [
        "Tradovate broker-state discovery is blocked until bearer auth succeeds.",
      ],
      error: tokenResult.error,
    };
  }

  try {
    const [positionsResponse, ordersResponse] = await Promise.all([
      fetch(`${tokenResult.metadata.apiBase}/position/list`, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }),
      fetch(`${tokenResult.metadata.apiBase}/order/list`, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }),
    ]);

    const positionsJson = await positionsResponse.json().catch(() => null);
    const ordersJson = await ordersResponse.json().catch(() => null);

    if (!positionsResponse.ok || !ordersResponse.ok) {
      return {
        adapterId: "tradovate-direct",
        selectedEnvironment: config.environment,
        authStatus: "auth_failed",
        positions: [],
        workingOrders: [],
        fetchedAt: new Date().toISOString(),
        notes: [
          "Tradovate broker-state discovery pulls from the official /position/list and /order/list endpoints.",
        ],
        error:
          (positionsJson as Record<string, unknown> | null)?.errorText?.toString() ||
          (ordersJson as Record<string, unknown> | null)?.errorText?.toString() ||
          `Tradovate broker-state discovery failed with HTTP ${positionsResponse.status}/${ordersResponse.status}.`,
      };
    }

    return {
      adapterId: "tradovate-direct",
      selectedEnvironment: config.environment,
      authStatus: "auth_ok",
      positions: Array.isArray(positionsJson)
        ? positionsJson.map((item: Record<string, unknown>) => ({
            id: item.id != null ? String(item.id) : "",
            accountId: item.accountId != null ? String(item.accountId) : "",
            contractId: item.contractId != null ? String(item.contractId) : null,
            netPos: typeof item.netPos === "number" ? item.netPos : null,
            netPrice: typeof item.netPrice === "number" ? item.netPrice : null,
            bought: typeof item.bought === "number" ? item.bought : null,
            sold: typeof item.sold === "number" ? item.sold : null,
            timestamp: item.timestamp ? String(item.timestamp) : null,
          }))
        : [],
      workingOrders: Array.isArray(ordersJson)
        ? ordersJson
            .map((item: Record<string, unknown>) => ({
              id: item.id != null ? String(item.id) : "",
              accountId: item.accountId != null ? String(item.accountId) : null,
              contractId: item.contractId != null ? String(item.contractId) : null,
              symbol: item.symbol ? String(item.symbol) : null,
              action: item.action ? String(item.action) : null,
              orderType: item.orderType ? String(item.orderType) : null,
              orderQty: typeof item.orderQty === "number" ? item.orderQty : null,
              price: typeof item.price === "number" ? item.price : null,
              stopPrice: typeof item.stopPrice === "number" ? item.stopPrice : null,
              isAutomated: typeof item.isAutomated === "boolean" ? item.isAutomated : null,
              status: item.ordStatus ? String(item.ordStatus) : item.status ? String(item.status) : null,
            }))
            .filter((item) => item.status !== "Filled" && item.status !== "Canceled" && item.status !== "Rejected")
        : [],
      fetchedAt: new Date().toISOString(),
      notes: [
        "Tradovate order/list is useful for working-order reconciliation after submit and for showing whether server-side brackets are now resting.",
        "Tradovate position/list gives the first real broker-state truth we can compare against kwantify route and journal state.",
      ],
      error: null,
    };
  } catch (error) {
    return {
      adapterId: "tradovate-direct",
      selectedEnvironment: config.environment,
      authStatus: "auth_failed",
      positions: [],
      workingOrders: [],
      fetchedAt: new Date().toISOString(),
      notes: [
        "Broker-state discovery threw before positions and working orders could be normalized.",
      ],
      error: error instanceof Error ? error.message : "Unknown Tradovate broker-state discovery failure.",
    };
  }
}

export async function ingestFuturesConnectorSignal(payload: unknown) {
  const validated = await validateFuturesConnectorSignal(normalizeFuturesConnectorSignal(payload));
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const state = getFuturesState();
  const now = new Date().toISOString();
  const queued: FuturesQueuedCommand = {
    id: `fut_cmd_${crypto.randomUUID()}`,
    adapterId: validated.route.adapterId,
    routeProfileId: validated.route.id,
    accountId: validated.account.id,
    signal: validated.normalized,
    createdAt: now,
    status: "queued",
  };

  state.signalInbox.unshift({
    id: `evt_fut_${crypto.randomUUID()}`,
    venue: validated.normalized.venue,
    accountId: validated.account.id,
    signalId: validated.normalized.signalId,
    stage: "queued",
    detail: `Queued futures signal for ${validated.normalized.symbol} on ${validated.route.label}.`,
    occurredAt: now,
  });
  state.queuedCommands.unshift(queued);

  await appendFuturesJournalEntry({
    category: "signal",
    venue: validated.normalized.venue,
    title: "Futures signal queued",
    detail: `Queued ${validated.normalized.side} ${validated.normalized.symbol} for route ${validated.route.label}.`,
    accountId: validated.account.id,
    routeProfileId: validated.route.id,
    signalId: validated.normalized.signalId,
    status: "ready",
    requestBody: queued.signal as unknown as Record<string, unknown>,
    responseBody: {
      commandId: queued.id,
      adapterId: queued.adapterId,
      status: queued.status,
    },
  });

  return {
    ok: true,
    command: queued,
    route: validated.route,
    risk: validated.risk,
  };
}

export async function previewTradovateOrder(payload: unknown) {
  const validated = await validateFuturesConnectorSignal(normalizeFuturesConnectorSignal(payload));
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }
  if (validated.route.adapterId !== "tradovate-direct") {
    return { ok: false, error: "Tradovate order preview requires a Tradovate-routed account and route." };
  }

  return {
    ok: true,
    preview: buildTradovateOrderPreview({
      signal: validated.normalized,
      route: validated.route,
      account: validated.account,
    }),
  };
}

export async function submitTradovateOrder(payload: unknown) {
  const validated = await validateFuturesConnectorSignal(normalizeFuturesConnectorSignal(payload));
  if (!validated.ok) {
    return { ok: false as const, error: validated.error };
  }
  if (validated.route.adapterId !== "tradovate-direct") {
    return { ok: false as const, error: "Tradovate submit requires a Tradovate-routed account and route." };
  }

  const tokenResult = await requestTradovateAccessToken();
  if (!tokenResult.ok) {
    return { ok: false as const, error: tokenResult.error };
  }

  const binding = await resolveTradovateRouteBinding({
    route: validated.route,
    account: validated.account,
  });
  if (binding.error || !binding.accountSpec || !binding.resolvedTradovateAccountId) {
    return {
      ok: false as const,
      error: binding.error ?? "Tradovate route binding could not resolve accountSpec and accountId.",
      binding,
    };
  }

  const request = buildTradovateOrderRequest({
    signal: validated.normalized,
    route: validated.route,
    account: validated.account,
    binding,
  });
  const submittedAt = new Date().toISOString();

  const response = await fetch(`${tokenResult.metadata.apiBase}${request.endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request.body),
    cache: "no-store",
  });
  const responseJson = await response.json().catch(() => null);
  const responseBody =
    responseJson && typeof responseJson === "object" && !Array.isArray(responseJson)
      ? (responseJson as Record<string, unknown>)
      : null;

  const failureReason =
    typeof responseBody?.failureReason === "string"
      ? responseBody.failureReason
      : response.ok
        ? null
        : `HTTP_${response.status}`;
  const failureText =
    typeof responseBody?.failureText === "string"
      ? responseBody.failureText
      : typeof responseBody?.errorText === "string"
        ? responseBody.errorText
        : typeof responseBody?.error === "string"
          ? responseBody.error
          : null;
  const brokerAccepted = response.ok && (!failureReason || failureReason === "Success");
  const verdict = normalizeTradovateOperatorVerdict(failureReason, failureText, response.status, brokerAccepted);

  const result: TradovateSubmitResult = {
    adapterId: "tradovate-direct",
    routeProfileId: validated.route.id,
    accountId: validated.account.id,
    signalId: validated.normalized.signalId,
    endpoint: request.endpoint,
    selectedEnvironment: tokenResult.config.environment,
    binding,
    requestBody: request.body,
    responseStatus: response.status,
    ok: response.ok,
    brokerAccepted,
    failureReason,
    failureText,
    operatorVerdict: verdict.operatorVerdict,
    operatorMessage: verdict.operatorMessage,
    responseBody,
    submittedAt,
  };

  globalForFutures.__kwantifyTradovateLastSubmit = result;

  const state = getFuturesState();
  const existingCommand = state.queuedCommands.find((item) => item.signal.signalId === validated.normalized.signalId);
  if (existingCommand) {
    existingCommand.status = brokerAccepted ? "submitted" : "done";
  }
  state.signalInbox.unshift({
    id: `evt_fut_${crypto.randomUUID()}`,
    venue: validated.normalized.venue,
    accountId: validated.account.id,
    signalId: validated.normalized.signalId,
    stage: brokerAccepted ? "accepted" : "rejected",
    detail: brokerAccepted
      ? `Tradovate accepted ${request.endpoint} for ${validated.normalized.symbol}.`
      : `Tradovate rejected ${validated.normalized.symbol}: ${verdict.operatorMessage}`,
    occurredAt: submittedAt,
  });

  await appendFuturesJournalEntry({
    category: "execution",
    venue: validated.normalized.venue,
    title: brokerAccepted ? "Tradovate order accepted" : "Tradovate order rejected",
    detail: brokerAccepted
      ? `Tradovate accepted ${validated.normalized.side} ${validated.normalized.symbol} on ${validated.route.label}.`
      : `Tradovate rejected ${validated.normalized.symbol}: ${verdict.operatorMessage}`,
    accountId: validated.account.id,
    routeProfileId: validated.route.id,
    signalId: validated.normalized.signalId,
    status: brokerAccepted ? "ready" : "warning",
    requestBody: request.body,
    responseBody: responseBody,
    occurredAt: submittedAt,
  });

  return {
    ok: true as const,
    submit: result,
  };
}

export async function cancelTradovateOrder(payload: unknown) {
  const body = (payload ?? {}) as { orderId?: string | number | null };
  const orderId = body.orderId != null ? String(body.orderId).trim() : "";
  if (!orderId) {
    return { ok: false as const, error: "orderId is required." };
  }

  const tokenResult = await requestTradovateAccessToken();
  if (!tokenResult.ok) {
    return { ok: false as const, error: tokenResult.error };
  }
  const brokerState = await discoverTradovateBrokerState();
  const order = brokerState.workingOrders.find((item) => item.id === orderId);
  const managedContext = await resolveManagedTradovateBindingContext({
    brokerAccountRef: order?.accountId ?? null,
  });

  const requestBody = {
    orderId: Number(orderId),
    isAutomated: true,
    customTag50: "KWANTIFY_CANCEL",
  };
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${tokenResult.metadata.apiBase}/order/cancelorder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });
  const responseJson = await response.json().catch(() => null);
  const responseBody =
    responseJson && typeof responseJson === "object" && !Array.isArray(responseJson)
      ? (responseJson as Record<string, unknown>)
      : null;
  const failureReason =
    typeof responseBody?.failureReason === "string"
      ? responseBody.failureReason
      : response.ok
        ? null
        : `HTTP_${response.status}`;
  const failureText =
    typeof responseBody?.failureText === "string"
      ? responseBody.failureText
      : typeof responseBody?.errorText === "string"
        ? responseBody.errorText
        : typeof responseBody?.error === "string"
          ? responseBody.error
          : null;
  const brokerAccepted = response.ok && (!failureReason || failureReason === "Success");
  const verdict = normalizeTradovateOperatorVerdict(failureReason, failureText, response.status, brokerAccepted);

  const result: TradovateControlResult = {
    adapterId: "tradovate-direct",
    action: "cancel_order",
    selectedEnvironment: tokenResult.config.environment,
    targetId: orderId,
    requestBody,
    responseStatus: response.status,
    ok: response.ok,
    brokerAccepted,
    failureReason,
    failureText,
    operatorVerdict: verdict.operatorVerdict,
    operatorMessage: verdict.operatorMessage,
    binding: {
      ...managedContext,
      brokerAccountRef: order?.accountId ?? null,
    },
    responseBody,
    occurredAt,
  };

  globalForFutures.__kwantifyTradovateLastControl = result;
  getFuturesState().signalInbox.unshift({
    id: `evt_fut_${crypto.randomUUID()}`,
    venue: "tradovate",
    accountId: "tradovate-control",
    signalId: `cancel_order_${orderId}`,
    stage: brokerAccepted ? "cancelled" : "rejected",
    detail: brokerAccepted
      ? `Tradovate accepted cancel for order ${orderId}.`
      : `Tradovate cancel rejected for order ${orderId}: ${verdict.operatorMessage}`,
    occurredAt,
  });

  await appendFuturesJournalEntry({
    category: "control",
    venue: "tradovate",
    title: brokerAccepted ? "Tradovate cancel accepted" : "Tradovate cancel rejected",
    detail: brokerAccepted
      ? `Tradovate accepted cancel for order ${orderId}.`
      : `Tradovate cancel rejected for order ${orderId}: ${verdict.operatorMessage}`,
    accountId: managedContext.managedAccountId,
    routeProfileId: null,
    signalId: `cancel_order_${orderId}`,
    status: brokerAccepted ? "ready" : "warning",
    requestBody,
    responseBody,
    occurredAt,
  });

  return { ok: true as const, control: result };
}

export async function liquidateTradovatePosition(payload: unknown) {
  const body = (payload ?? {}) as { positionId?: string | number | null };
  const positionId = body.positionId != null ? String(body.positionId).trim() : "";
  if (!positionId) {
    return { ok: false as const, error: "positionId is required." };
  }

  const tokenResult = await requestTradovateAccessToken();
  if (!tokenResult.ok) {
    return { ok: false as const, error: tokenResult.error };
  }

  const brokerState = await discoverTradovateBrokerState();
  const position = brokerState.positions.find((item) => item.id === positionId);
  if (!position?.accountId || !position.contractId) {
    return { ok: false as const, error: "Tradovate position could not be resolved into accountId and contractId." };
  }
  const managedContext = await resolveManagedTradovateBindingContext({
    brokerAccountRef: position.accountId,
  });

  const requestBody = {
    accountId: Number(position.accountId),
    contractId: Number(position.contractId),
    admin: false,
    customTag50: "KWANTIFY_FLATTEN",
  };
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${tokenResult.metadata.apiBase}/order/liquidateposition`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });
  const responseJson = await response.json().catch(() => null);
  const responseBody =
    responseJson && typeof responseJson === "object" && !Array.isArray(responseJson)
      ? (responseJson as Record<string, unknown>)
      : null;
  const failureReason =
    typeof responseBody?.failureReason === "string"
      ? responseBody.failureReason
      : response.ok
        ? null
        : `HTTP_${response.status}`;
  const failureText =
    typeof responseBody?.failureText === "string"
      ? responseBody.failureText
      : typeof responseBody?.errorText === "string"
        ? responseBody.errorText
        : typeof responseBody?.error === "string"
          ? responseBody.error
          : null;
  const brokerAccepted = response.ok && (!failureReason || failureReason === "Success");
  const verdict = normalizeTradovateOperatorVerdict(failureReason, failureText, response.status, brokerAccepted);

  const result: TradovateControlResult = {
    adapterId: "tradovate-direct",
    action: "liquidate_position",
    selectedEnvironment: tokenResult.config.environment,
    targetId: positionId,
    requestBody,
    responseStatus: response.status,
    ok: response.ok,
    brokerAccepted,
    failureReason,
    failureText,
    operatorVerdict: verdict.operatorVerdict,
    operatorMessage: verdict.operatorMessage,
    binding: {
      ...managedContext,
      brokerAccountRef: position.accountId,
    },
    responseBody,
    occurredAt,
  };

  globalForFutures.__kwantifyTradovateLastControl = result;
  getFuturesState().signalInbox.unshift({
    id: `evt_fut_${crypto.randomUUID()}`,
    venue: "tradovate",
    accountId: position.accountId,
    signalId: `liquidate_position_${positionId}`,
    stage: brokerAccepted ? "flat" : "rejected",
    detail: brokerAccepted
      ? `Tradovate accepted liquidate request for position ${positionId}.`
      : `Tradovate liquidate rejected for position ${positionId}: ${verdict.operatorMessage}`,
    occurredAt,
  });

  await appendFuturesJournalEntry({
    category: "control",
    venue: "tradovate",
    title: brokerAccepted ? "Tradovate flatten accepted" : "Tradovate flatten rejected",
    detail: brokerAccepted
      ? `Tradovate accepted liquidate for position ${positionId}.`
      : `Tradovate liquidate rejected for position ${positionId}: ${verdict.operatorMessage}`,
    accountId: managedContext.managedAccountId,
    routeProfileId: null,
    signalId: `liquidate_position_${positionId}`,
    status: brokerAccepted ? "ready" : "warning",
    requestBody,
    responseBody,
    occurredAt,
  });

  return { ok: true as const, control: result };
}

export async function getFuturesConnectorOverview(): Promise<FuturesConnectorOverview> {
  const state = getFuturesState();
  const managedProfileStore = await getManagedFuturesProfiles();
  const sampleRoute =
    managedProfileStore.routingProfiles.find((item) => item.id === "tradovate-prop-demo") ??
    managedProfileStore.routingProfiles[0];
  const sampleAccount =
    managedProfileStore.accounts.find((item) => item.id === "tradovate-demo-sim-001") ??
    managedProfileStore.accounts[0];
  const tradovateSessionDiscovery = await discoverTradovateSession();
  const tradovateAccountDiscovery = await discoverTradovateAccounts();
  const tradovateBrokerState = await discoverTradovateBrokerState();
  const rithmicSessionBlueprint = await discoverRithmicSessionBlueprint();
  const rithmicAccountDiscovery = await discoverRithmicAccounts();
  const rithmicExecutionBlueprint = await discoverRithmicExecutionBlueprint();
  const tradovateRouteBinding = await resolveTradovateRouteBinding({
    route: sampleRoute,
    account: sampleAccount,
  });
  const sampleRithmicRoute =
    managedProfileStore.routingProfiles.find((item) => item.id === "rithmic-prop-live") ??
    managedProfileStore.routingProfiles.find((item) => item.venue === "rithmic") ??
    managedProfileStore.routingProfiles[0];
  const sampleRithmicAccount =
    managedProfileStore.accounts.find((item) => item.id === "rithmic-live-prop-001") ??
    managedProfileStore.accounts.find((item) => item.venue === "rithmic") ??
    managedProfileStore.accounts[0];
  const rithmicRouteBinding = await resolveRithmicRouteBinding({
    route: sampleRithmicRoute,
    account: sampleRithmicAccount,
  });
  const rithmicOrderPreview = buildRithmicOrderPreview({
    signal: {
      ...sampleSignal,
      venue: "rithmic",
      accountId: sampleRithmicAccount.id,
    },
    route: sampleRithmicRoute,
    account: sampleRithmicAccount,
    binding: rithmicRouteBinding,
  });
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: FUTURES_CONNECTOR_SCHEMA_VERSION,
    managedProfileStore,
    recentJournal: managedProfileStore.journal.slice(0, 16),
    adapters: futuresAdapters,
    accounts: managedProfileStore.accounts,
    riskProfiles: futuresRiskProfiles,
    routingProfiles: managedProfileStore.routingProfiles,
    sampleSignal,
    queuedCommands: state.queuedCommands,
    signalInbox: state.signalInbox,
    executionJournalPreview,
    adapterRuntime: [getTradovateRuntimeStatus(), getRithmicRuntimeStatus()],
    tradovateConnectionConfig: getTradovateConnectionConfigSummary(),
    tradovateRetailConnect: getTradovateRetailConnectStatus(),
    tradovateSessionDiscovery,
    tradovateAccountDiscovery,
    tradovateBrokerState,
    tradovateRouteBinding,
    tradovateOrderPreview: buildTradovateOrderPreview({
      signal: sampleSignal,
      route: sampleRoute,
      account: sampleAccount,
    }),
    tradovateLastSubmit: globalForFutures.__kwantifyTradovateLastSubmit ?? null,
    tradovateLastControl: globalForFutures.__kwantifyTradovateLastControl ?? null,
    rithmicSessionBlueprint,
    rithmicAccountDiscovery,
    rithmicRouteBinding,
    rithmicExecutionBlueprint,
    rithmicOrderPreview,
    rithmicLastSubmitAttempt: globalForFutures.__kwantifyRithmicLastSubmitAttempt ?? null,
    rithmicLiveSubmitHandoff: getRithmicLiveSubmitHandoff(),
    rithmicAdapterBoundary: getRithmicAdapterBoundary(),
    rithmicLastDispatchAttempt: globalForFutures.__kwantifyRithmicLastDispatchAttempt ?? null,
    rithmicTransportPacket: getRithmicTransportPacket(),
    rithmicLastTransportAttempt: globalForFutures.__kwantifyRithmicLastTransportAttempt ?? null,
    rithmicProtocolServiceConfig: getRithmicProtocolServiceRunner(),
    rithmicLastProtocolServiceAttempt: globalForFutures.__kwantifyRithmicLastProtocolServiceAttempt ?? null,
    rithmicLatestLifecycleScenario: getLatestRithmicLifecycleScenario(),
    rithmicSimulatedLifecycle: getRithmicSimulatedLifecycle().slice(0, 12),
    rithmicLastProtocolStubAttempt: globalForFutures.__kwantifyRithmicLastProtocolStubAttempt ?? null,
    strategicRecommendation: {
      buildFirst: "Tradovate Direct",
      buildNext: "Rithmic Direct",
      why: [
        "Tradovate has the cleanest documented direct path for getting futures execution architecture operational quickly.",
        "Rithmic is the strategically important second adapter for serious prop-firm reach and server-side execution features.",
        "Front-end terminals should be treated as ecosystem references or later compatibility targets, not the first execution spine.",
      ],
    },
  };
}
