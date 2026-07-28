import fs from "node:fs/promises";
import path from "node:path";

import type {
  CfdConnectorAdminEvent,
  CfdConnectorAdminEventRow,
  CfdConnectionHistoryRow,
  CfdConnectorHeartbeatRow,
  CfdConnectorMailboxCommandRow,
  CfdConnectorNormalizedState,
  CfdConnectorRouteProfileRow,
  CfdConnectorRuntimeState,
  CfdConnectorSeatRow,
  CfdConnectorSecretRow,
  CfdConnectorSymbolMappingRow,
  CfdConnectorExecutionReportRow,
  CfdConnectorSignalEventRow,
  CfdConnectorDeadLetterCommandRow,
  CfdLicenseSlot,
} from "@/lib/connectors";

export type CfdConnectorStoreDescriptor =
  | {
      kind: "file_json";
      location: string;
    }
  | {
      kind: "supabase_snapshot";
      location: string;
      namespace: string;
      table: string;
    };

const CFD_STATE_DIRECTORY = path.join(process.cwd(), "data-cache");
const CFD_STATE_FILE = path.join(CFD_STATE_DIRECTORY, "cfd-connector-state.json");
const CFD_SUPABASE_TABLE = process.env.CFD_CONNECTOR_SUPABASE_TABLE?.trim() || "connector_runtime_snapshots";
const CFD_SUPABASE_NAMESPACE = process.env.CFD_CONNECTOR_SUPABASE_NAMESPACE?.trim() || "cfd-mt5";
const CFD_NORMALIZED_SYNC_ENABLED = process.env.CFD_CONNECTOR_NORMALIZED_SYNC?.trim().toLowerCase() !== "off";
type SupabaseSnapshotConfig = NonNullable<ReturnType<typeof getSupabaseSnapshotConfig>>;

function getSupabaseSnapshotConfig() {
  const mode = process.env.CFD_CONNECTOR_STORE_MODE?.trim().toLowerCase();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (mode !== "supabase" || !supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    table: CFD_SUPABASE_TABLE,
    namespace: CFD_SUPABASE_NAMESPACE,
  };
}

async function ensurePersistenceDirectory() {
  await fs.mkdir(CFD_STATE_DIRECTORY, { recursive: true });
}

async function writeFileSnapshot(state: CfdConnectorRuntimeState) {
  await ensurePersistenceDirectory();
  await fs.writeFile(CFD_STATE_FILE, JSON.stringify(state, null, 2));
}

async function readFileSnapshot(): Promise<Partial<CfdConnectorRuntimeState> | null> {
  try {
    const raw = await fs.readFile(CFD_STATE_FILE, "utf8");
    return JSON.parse(raw) as Partial<CfdConnectorRuntimeState>;
  } catch {
    return null;
  }
}

async function readSupabaseSnapshot(config: SupabaseSnapshotConfig) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/${config.table}?select=payload&namespace=eq.${encodeURIComponent(config.namespace)}&limit=1`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase CFD store read failed with ${response.status}.`);
  }

  const rows = (await response.json()) as Array<{ payload?: Partial<CfdConnectorRuntimeState> | null }>;
  return rows[0]?.payload ?? null;
}

async function writeSupabaseSnapshot(config: SupabaseSnapshotConfig, state: CfdConnectorRuntimeState) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.table}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([
      {
        namespace: config.namespace,
        payload: state,
      },
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase CFD store write failed with ${response.status}.`);
  }
}

async function upsertSupabaseRows(config: SupabaseSnapshotConfig, table: string, rows: unknown[]) {
  if (!rows.length) return;

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase CFD normalized sync for ${table} failed with ${response.status}.`);
  }
}

async function readSupabaseRows<T>(
  config: SupabaseSnapshotConfig,
  table: string,
  query = "select=*"
): Promise<T[]> {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase CFD normalized read for ${table} failed with ${response.status}.`);
  }

  return (await response.json()) as T[];
}

function mapSeatRow(row: {
  connector_id: string;
  kwant_id: string;
  owner_user_id: string | null;
  owner_label: string | null;
  label: string;
  broker: string;
  server: string;
  account_label: string;
  account_number: string;
  mode: "demo" | "live";
  status: string;
  tone: CfdConnectorSeatRow["tone"];
  transport: "webrequest_pull";
  heartbeat_state: CfdConnectorSeatRow["heartbeatState"];
  last_heartbeat_at: string | null;
  poll_interval_ms: number;
  ea_version: string;
  chart_symbol: string;
  pending_signals: number;
  detail: string;
  pairing_status: CfdConnectorSeatRow["pairingStatus"];
  auth_mode: CfdConnectorSeatRow["authMode"];
  terminal_instance_id: string | null;
  terminal_alias: string | null;
  pairing_code: string;
  secret_hint: string;
  last_paired_at: string | null;
  last_authenticated_at: string | null;
}): CfdConnectorSeatRow {
  return {
    connectorId: row.connector_id,
    kwantId: row.kwant_id,
    ownerUserId: row.owner_user_id,
    ownerLabel: row.owner_label,
    label: row.label,
    broker: row.broker,
    server: row.server,
    accountLabel: row.account_label,
    accountNumber: row.account_number,
    mode: row.mode,
    status: row.status,
    tone: row.tone,
    transport: row.transport,
    heartbeatState: row.heartbeat_state,
    lastHeartbeatAt: row.last_heartbeat_at,
    pollIntervalMs: row.poll_interval_ms,
    eaVersion: row.ea_version,
    chartSymbol: row.chart_symbol,
    pendingSignals: row.pending_signals,
    detail: row.detail,
    pairingStatus: row.pairing_status,
    authMode: row.auth_mode,
    terminalInstanceId: row.terminal_instance_id,
    terminalAlias: row.terminal_alias,
    pairingCode: row.pairing_code,
    secretHint: row.secret_hint,
    lastPairedAt: row.last_paired_at,
    lastAuthenticatedAt: row.last_authenticated_at,
  };
}

function mapRouteProfileRow(row: {
  id: string;
  connector_id: string;
  name: string;
  strategy_scope: string;
  source: "kwantify";
  symbol: string;
  terminal_symbol: string;
  side_policy: CfdConnectorRouteProfileRow["sidePolicy"];
  sizing_mode: CfdConnectorRouteProfileRow["sizingMode"];
  sizing_value: number;
  duplicate_window_seconds: number;
  max_open_positions: number;
  reduction_policy: CfdConnectorRouteProfileRow["reductionPolicy"];
  min_reduction_lot: number | null;
  min_remaining_lot: number | null;
  stop_mode: CfdConnectorRouteProfileRow["stopMode"];
  target_mode: CfdConnectorRouteProfileRow["targetMode"];
}): CfdConnectorRouteProfileRow {
  return {
    id: row.id,
    connectorId: row.connector_id,
    name: row.name,
    strategyScope: row.strategy_scope,
    source: row.source,
    symbol: row.symbol,
    terminalSymbol: row.terminal_symbol,
    sidePolicy: row.side_policy,
    sizingMode: row.sizing_mode,
    sizingValue: Number(row.sizing_value),
    duplicateWindowSeconds: row.duplicate_window_seconds,
    maxOpenPositions: row.max_open_positions,
    reductionPolicy: row.reduction_policy,
    minReductionLot: row.min_reduction_lot,
    minRemainingLot: row.min_remaining_lot,
    stopMode: row.stop_mode,
    targetMode: row.target_mode,
  };
}

function mapSymbolMappingRow(row: {
  id: string;
  connector_id: string;
  platform_symbol: string;
  terminal_symbol: string;
  min_lot: number;
  lot_step: number;
  max_lot: number;
  note: string;
}): CfdConnectorSymbolMappingRow {
  return {
    id: row.id,
    connectorId: row.connector_id,
    platformSymbol: row.platform_symbol,
    terminalSymbol: row.terminal_symbol,
    minLot: Number(row.min_lot),
    lotStep: Number(row.lot_step),
    maxLot: Number(row.max_lot),
    note: row.note,
  };
}

function mapHeartbeatRow(row: {
  id: string;
  connector_id: string;
  kwant_id: string;
  occurred_at: string;
  latency_ms: number;
  terminal_status: CfdConnectorHeartbeatRow["terminalStatus"];
  chart_symbol: string;
  ea_version: string;
  pending_signals: number;
  last_error_code: string | null;
  last_error_message: string | null;
}): CfdConnectorHeartbeatRow {
  return {
    heartbeatId: row.id,
    connectorId: row.connector_id,
    kwantId: row.kwant_id,
    authToken: "",
    occurredAt: row.occurred_at,
    latencyMs: row.latency_ms,
    terminalStatus: row.terminal_status,
    chartSymbol: row.chart_symbol,
    eaVersion: row.ea_version,
    pendingSignals: row.pending_signals,
    lastErrorCode: row.last_error_code ?? undefined,
    lastErrorMessage: row.last_error_message ?? undefined,
  };
}

function mapMailboxCommandRow(row: {
  id: string;
  schema_version: string;
  connector_id: string;
  kwant_id: string;
  route_profile_id: string;
  signal: CfdConnectorMailboxCommandRow["signal"];
  action: CfdConnectorMailboxCommandRow["action"];
  terminal_symbol: string;
  command_name: CfdConnectorMailboxCommandRow["commandName"] | null;
  entry_instruction: CfdConnectorMailboxCommandRow["entryInstruction"] | null;
  quantity_mode: CfdConnectorMailboxCommandRow["quantityMode"];
  normalized_quantity: number;
  volume_interpretation: CfdConnectorMailboxCommandRow["volumeInterpretation"] | null;
  risk_value: number | null;
  sizing_mode: CfdConnectorMailboxCommandRow["sizingMode"];
  sizing_value: number;
  stop_mode: CfdConnectorMailboxCommandRow["stopMode"];
  target_mode: CfdConnectorMailboxCommandRow["targetMode"];
  stop_instruction: CfdConnectorMailboxCommandRow["stopInstruction"];
  target_instruction: CfdConnectorMailboxCommandRow["targetInstruction"];
  duplicate_window_seconds: number;
  max_open_positions: number;
  reduction_policy: CfdConnectorMailboxCommandRow["reductionPolicy"];
  min_reduction_lot: number | null;
  min_remaining_lot: number | null;
  magic: number;
  comment: string;
  created_at: string;
  claimed_at: string | null;
  claim_token: string | null;
  claim_expires_at: string | null;
  acknowledged_at: string | null;
  retry_count: number;
}): CfdConnectorMailboxCommandRow {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    connectorId: row.connector_id,
    kwantId: row.kwant_id,
    routeProfileId: row.route_profile_id,
    signal: row.signal,
    action: row.action,
    terminalSymbol: row.terminal_symbol,
    commandName: row.command_name ?? row.signal.command,
    entryInstruction: row.entry_instruction ?? { mode: "points", value: null },
    quantityMode: row.quantity_mode,
    normalizedQuantity: Number(row.normalized_quantity),
    volumeInterpretation: row.volume_interpretation ?? row.signal.volumeInterpretation ?? "lots",
    riskValue: row.risk_value,
    sizingMode: row.sizing_mode,
    sizingValue: Number(row.sizing_value),
    stopMode: row.stop_mode,
    targetMode: row.target_mode,
    stopInstruction: row.stop_instruction,
    targetInstruction: row.target_instruction,
    duplicateWindowSeconds: row.duplicate_window_seconds,
    maxOpenPositions: row.max_open_positions,
    reductionPolicy: row.reduction_policy,
    minReductionLot: row.min_reduction_lot,
    minRemainingLot: row.min_remaining_lot,
    magic: row.magic,
    comment: row.comment,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    claimToken: row.claim_token,
    claimExpiresAt: row.claim_expires_at,
    acknowledgedAt: row.acknowledged_at,
    retryCount: row.retry_count,
  };
}

function mapExecutionReportRow(row: {
  report_id: string;
  connector_id: string;
  kwant_id: string;
  signal_id: string;
  status: CfdConnectorExecutionReportRow["status"];
  occurred_at: string;
  terminal_symbol: string;
  order_ticket: string | null;
  position_ticket: string | null;
  executed_price: number | null;
  remaining_volume: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  error_code: string | null;
  error_message: string | null;
  terminal_comment: string | null;
}): CfdConnectorExecutionReportRow {
  return {
    reportId: row.report_id,
    connectorId: row.connector_id,
    kwantId: row.kwant_id,
    authToken: "",
    signalId: row.signal_id,
    status: row.status,
    occurredAt: row.occurred_at,
    terminalSymbol: row.terminal_symbol,
    orderTicket: row.order_ticket ?? undefined,
    positionTicket: row.position_ticket ?? undefined,
    executedPrice: row.executed_price ?? undefined,
    remainingVolume: row.remaining_volume ?? undefined,
    stopLoss: row.stop_loss ?? undefined,
    takeProfit: row.take_profit ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    terminalComment: row.terminal_comment ?? undefined,
  };
}

function mapSignalEventRow(row: {
  id: string;
  signal_id: string;
  connector_id: string;
  strategy_id: string;
  stage: CfdConnectorSignalEventRow["stage"];
  tone: CfdConnectorSignalEventRow["tone"];
  detail: string;
  occurred_at: string;
}): CfdConnectorSignalEventRow {
  return {
    id: row.id,
    signalId: row.signal_id,
    connectorId: row.connector_id,
    strategyId: row.strategy_id,
    stage: row.stage,
    tone: row.tone,
    detail: row.detail,
    occurredAt: row.occurred_at,
  };
}

function mapDeadLetterCommandRow(row: {
  id: string;
  connector_id: string;
  signal_id: string;
  payload: CfdConnectorDeadLetterCommandRow;
  dead_lettered_at: string;
  dead_letter_reason: string;
}): CfdConnectorDeadLetterCommandRow {
  return {
    ...row.payload,
    id: row.id,
    connectorId: row.connector_id,
    deadLetteredAt: row.dead_lettered_at,
    deadLetterReason: row.dead_letter_reason,
  };
}

function mapConnectionHistoryRow(row: {
  id: string;
  kwant_id: string;
  account_number: string;
  broker: string;
  account_type: CfdConnectionHistoryRow["accountType"];
  platform: CfdConnectionHistoryRow["platform"];
  ea_version: string;
  connected_from: string;
  connected_to: string | null;
  status: CfdConnectionHistoryRow["status"];
}): CfdConnectionHistoryRow {
  return {
    id: row.id,
    kwantId: row.kwant_id,
    accountNumber: row.account_number,
    broker: row.broker,
    accountType: row.account_type,
    platform: row.platform,
    eaVersion: row.ea_version,
    connectedFrom: row.connected_from,
    connectedTo: row.connected_to,
    status: row.status,
  };
}

function buildNormalizedLicenseSlots(connectionHistory: CfdConnectionHistoryRow[]): CfdLicenseSlot[] {
  const kwantIds = [
    "KW88763665614933",
    "KW88763665614931",
    "KW88763665614932",
    "KW88763665614934",
    "KW88763665614935",
    "KW88763665614936",
    "KW88763665614937",
    "KW88763665614938",
    "KW88763665614939",
    "88763665614940",
  ];

  return kwantIds.map((kwantId, index) => {
    const history = connectionHistory
      .filter((row) => row.kwantId === kwantId)
      .sort((a, b) => +new Date(b.connectedFrom) - +new Date(a.connectedFrom));

    return {
      id: `license-slot-${index + 1}`,
      kwantId,
      activeConnections: history.filter((row) => row.status === "active").length,
      maxConnections: 10,
      sessions: [],
      history,
    };
  });
}

function mapAdminEventRow(row: {
  id: string;
  connector_id: string;
  kwant_id: string;
  action: CfdConnectorAdminEvent["action"];
  detail: string;
  actor: string;
  occurred_at: string;
}): CfdConnectorAdminEventRow {
  return {
    id: row.id,
    connectorId: row.connector_id,
    kwantId: row.kwant_id,
    action: row.action,
    detail: row.detail,
    actor: row.actor,
    occurredAt: row.occurred_at,
  };
}

function mapSecretRow(row: { connector_id: string; secret: string }): CfdConnectorSecretRow {
  return {
    connectorId: row.connector_id,
    secret: row.secret,
  };
}

async function readSupabaseNormalizedState(
  config: SupabaseSnapshotConfig
): Promise<Partial<CfdConnectorRuntimeState> | null> {
  const [
    seatRows,
    routeProfileRows,
    symbolMappingRows,
    signalEventRows,
    heartbeatRows,
    mailboxCommandRows,
    deadLetterCommandRows,
    executionReportRows,
    adminEventRows,
    connectionHistoryRows,
    secretRows,
  ] = await Promise.all([
    readSupabaseRows(config, "cfd_connector_seats"),
    readSupabaseRows(config, "cfd_connector_route_profiles"),
    readSupabaseRows(config, "cfd_connector_symbol_mappings"),
    readSupabaseRows(config, "cfd_connector_signal_events"),
    readSupabaseRows(config, "cfd_connector_heartbeats"),
    readSupabaseRows(config, "cfd_connector_mailbox_commands"),
    readSupabaseRows(config, "cfd_connector_dead_letter_commands"),
    readSupabaseRows(config, "cfd_connector_execution_reports"),
    readSupabaseRows(config, "cfd_connector_admin_events"),
    readSupabaseRows(config, "cfd_connector_connection_history"),
    readSupabaseRows(config, "cfd_connector_secrets"),
  ]);

  if (
      !seatRows.length &&
      !routeProfileRows.length &&
      !symbolMappingRows.length &&
      !signalEventRows.length &&
      !heartbeatRows.length &&
      !mailboxCommandRows.length &&
      !deadLetterCommandRows.length &&
      !executionReportRows.length &&
      !adminEventRows.length &&
      !connectionHistoryRows.length &&
      !secretRows.length
  ) {
    return null;
  }

  const connectorSecrets = Object.fromEntries(
    (secretRows as Array<{ connector_id: string; secret: string }>).map((row) => [row.connector_id, row.secret])
  );
  const connectionHistory = (connectionHistoryRows as Array<Parameters<typeof mapConnectionHistoryRow>[0]>).map(
    mapConnectionHistoryRow
  );

  return {
    connectors: (seatRows as Array<Parameters<typeof mapSeatRow>[0]>).map(mapSeatRow).map((seat) => ({
      id: seat.connectorId,
      kwantId: seat.kwantId,
      ownerUserId: seat.ownerUserId,
      ownerLabel: seat.ownerLabel,
      label: seat.label,
      broker: seat.broker,
      server: seat.server,
      accountLabel: seat.accountLabel,
      accountNumber: seat.accountNumber,
      mode: seat.mode,
      status: seat.status,
      tone: seat.tone,
      transport: seat.transport,
      heartbeatState: seat.heartbeatState,
      lastHeartbeatAt: seat.lastHeartbeatAt,
      pollIntervalMs: seat.pollIntervalMs,
      eaVersion: seat.eaVersion,
      chartSymbol: seat.chartSymbol,
      pendingSignals: seat.pendingSignals,
      detail: seat.detail,
      pairingStatus: seat.pairingStatus,
      authMode: seat.authMode,
      terminalInstanceId: seat.terminalInstanceId,
      terminalAlias: seat.terminalAlias,
      pairingCode: seat.pairingCode,
      secretHint: seat.secretHint,
      lastPairedAt: seat.lastPairedAt,
      lastAuthenticatedAt: seat.lastAuthenticatedAt,
      healthChecks: [],
    })),
    routeProfiles: (routeProfileRows as Array<Parameters<typeof mapRouteProfileRow>[0]>).map(mapRouteProfileRow),
    symbolMappings: (symbolMappingRows as Array<Parameters<typeof mapSymbolMappingRow>[0]>).map(mapSymbolMappingRow),
    signalInbox: (signalEventRows as Array<Parameters<typeof mapSignalEventRow>[0]>).map(mapSignalEventRow),
    heartbeatEvents: (heartbeatRows as Array<Parameters<typeof mapHeartbeatRow>[0]>).map(mapHeartbeatRow),
    pendingCommands: (mailboxCommandRows as Array<Parameters<typeof mapMailboxCommandRow>[0]>).map(mapMailboxCommandRow),
    deadLetterCommands: (deadLetterCommandRows as Array<Parameters<typeof mapDeadLetterCommandRow>[0]>).map(
      mapDeadLetterCommandRow
    ),
    executionReports: (executionReportRows as Array<Parameters<typeof mapExecutionReportRow>[0]>).map(mapExecutionReportRow),
    adminEvents: (adminEventRows as Array<Parameters<typeof mapAdminEventRow>[0]>).map(mapAdminEventRow),
    licenseSlots: buildNormalizedLicenseSlots(connectionHistory),
    connectorSecrets,
  };
}

export function getCfdConnectorStoreDescriptor(): CfdConnectorStoreDescriptor {
  const supabaseConfig = getSupabaseSnapshotConfig();
  if (supabaseConfig) {
    return {
      kind: "supabase_snapshot",
      location: `${supabaseConfig.supabaseUrl}/rest/v1/${supabaseConfig.table}`,
      namespace: supabaseConfig.namespace,
      table: supabaseConfig.table,
    };
  }

  return {
    kind: "file_json",
    location: CFD_STATE_FILE,
  };
}

export async function writePersistedCfdConnectorState(state: CfdConnectorRuntimeState) {
  const supabaseConfig = getSupabaseSnapshotConfig();
  if (supabaseConfig) {
    await writeSupabaseSnapshot(supabaseConfig, state);
    try {
      await syncNormalizedCfdConnectorRows(state, supabaseConfig);
    } catch (error) {
      console.warn(
        "[cfdConnectorStore] Snapshot write succeeded, but normalized CFD sync failed. Continuing with snapshot state.",
        error
      );
    }
    return;
  }

  await writeFileSnapshot(state);
}

export async function readPersistedCfdConnectorState(): Promise<Partial<CfdConnectorRuntimeState> | null> {
  const supabaseConfig = getSupabaseSnapshotConfig();
  if (supabaseConfig) {
    try {
      const snapshot = await readSupabaseSnapshot(supabaseConfig);
      let normalized: Partial<CfdConnectorRuntimeState> | null = null;

      if (CFD_NORMALIZED_SYNC_ENABLED) {
        try {
          normalized = await readSupabaseNormalizedState(supabaseConfig);
        } catch (error) {
          console.warn(
            "[cfdConnectorStore] Falling back to snapshot-only read because normalized Supabase tables were unavailable.",
            error
          );
        }
      }

      if (snapshot) {
        return snapshot;
      }

      return normalized;
    } catch (error) {
      console.warn(
        "[cfdConnectorStore] Falling back to local/file state because Supabase snapshot read failed.",
        error
      );
    }
  }

  return readFileSnapshot();
}

export async function resetPersistedCfdConnectorState(state: CfdConnectorRuntimeState) {
  await writePersistedCfdConnectorState(state);
}

export function projectCfdRuntimeStateToNormalizedRows(
  state: CfdConnectorRuntimeState
): CfdConnectorNormalizedState {
  return {
    seats: state.connectors.map((connector) => ({
      connectorId: connector.id,
      kwantId: connector.kwantId,
      ownerUserId: connector.ownerUserId,
      ownerLabel: connector.ownerLabel,
      label: connector.label,
      broker: connector.broker,
      server: connector.server,
      accountLabel: connector.accountLabel,
      accountNumber: connector.accountNumber,
      mode: connector.mode,
      status: connector.status,
      tone: connector.tone,
      transport: connector.transport,
      heartbeatState: connector.heartbeatState,
      lastHeartbeatAt: connector.lastHeartbeatAt,
      pollIntervalMs: connector.pollIntervalMs,
      eaVersion: connector.eaVersion,
      chartSymbol: connector.chartSymbol,
      pendingSignals: connector.pendingSignals,
      detail: connector.detail,
      pairingStatus: connector.pairingStatus,
      authMode: connector.authMode,
      terminalInstanceId: connector.terminalInstanceId,
      terminalAlias: connector.terminalAlias,
      pairingCode: connector.pairingCode,
      secretHint: connector.secretHint,
      lastPairedAt: connector.lastPairedAt,
      lastAuthenticatedAt: connector.lastAuthenticatedAt,
    })),
    routeProfiles: state.routeProfiles.map((profile) => ({ ...profile })),
    symbolMappings: state.symbolMappings.map((mapping) => ({ ...mapping })),
    signalEvents: state.signalInbox.map((entry) => ({ ...entry })),
    heartbeats: state.heartbeatEvents.map((heartbeat) => ({
      ...heartbeat,
      heartbeatId: [
        heartbeat.connectorId,
        heartbeat.occurredAt,
        heartbeat.terminalStatus,
      ].join(":"),
    })),
    mailboxCommands: state.pendingCommands.map((command) => ({ ...command })),
    deadLetterCommands: state.deadLetterCommands.map((command) => ({ ...command })),
    executionReports: state.executionReports.map((report) => ({
      ...report,
      reportId: [
        report.connectorId,
        report.signalId,
        report.status,
        report.occurredAt,
      ].join(":"),
    })),
    adminEvents: state.adminEvents.map((event) => ({ ...event })),
    connectionHistory: state.licenseSlots.flatMap((slot) => slot.history.map((row) => ({ ...row }))),
    connectorSecrets: Object.entries(state.connectorSecrets).map(([connectorId, secret]) => ({
      connectorId,
      secret,
    })),
  };
}

export async function syncNormalizedCfdConnectorRows(
  state: CfdConnectorRuntimeState,
  supabaseConfig = getSupabaseSnapshotConfig()
) {
  if (!CFD_NORMALIZED_SYNC_ENABLED || !supabaseConfig) {
    return;
  }

  const normalized = projectCfdRuntimeStateToNormalizedRows(state);

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_seats",
    normalized.seats.map((seat) => ({
      connector_id: seat.connectorId,
      kwant_id: seat.kwantId,
      owner_user_id: seat.ownerUserId,
      owner_label: seat.ownerLabel,
      label: seat.label,
      broker: seat.broker,
      server: seat.server,
      account_label: seat.accountLabel,
      account_number: seat.accountNumber,
      mode: seat.mode,
      status: seat.status,
      tone: seat.tone,
      transport: seat.transport,
      heartbeat_state: seat.heartbeatState,
      last_heartbeat_at: seat.lastHeartbeatAt,
      poll_interval_ms: seat.pollIntervalMs,
      ea_version: seat.eaVersion,
      chart_symbol: seat.chartSymbol,
      pending_signals: seat.pendingSignals,
      detail: seat.detail,
      pairing_status: seat.pairingStatus,
      auth_mode: seat.authMode,
      terminal_instance_id: seat.terminalInstanceId,
      terminal_alias: seat.terminalAlias,
      pairing_code: seat.pairingCode,
      secret_hint: seat.secretHint,
      last_paired_at: seat.lastPairedAt,
      last_authenticated_at: seat.lastAuthenticatedAt,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_admin_events",
    normalized.adminEvents.map((event) => ({
      id: event.id,
      connector_id: event.connectorId,
      kwant_id: event.kwantId,
      action: event.action,
      detail: event.detail,
      actor: event.actor,
      occurred_at: event.occurredAt,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_route_profiles",
    normalized.routeProfiles.map((profile) => ({
      id: profile.id,
      connector_id: profile.connectorId,
      name: profile.name,
      strategy_scope: profile.strategyScope,
      source: profile.source,
      symbol: profile.symbol,
      terminal_symbol: profile.terminalSymbol,
      side_policy: profile.sidePolicy,
      sizing_mode: profile.sizingMode,
      sizing_value: profile.sizingValue,
      duplicate_window_seconds: profile.duplicateWindowSeconds,
      max_open_positions: profile.maxOpenPositions,
      reduction_policy: profile.reductionPolicy,
      min_reduction_lot: profile.minReductionLot,
      min_remaining_lot: profile.minRemainingLot,
      stop_mode: profile.stopMode,
      target_mode: profile.targetMode,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_signal_events",
    normalized.signalEvents.map((event) => ({
      id: event.id,
      signal_id: event.signalId,
      connector_id: event.connectorId,
      strategy_id: event.strategyId,
      stage: event.stage,
      tone: event.tone,
      detail: event.detail,
      occurred_at: event.occurredAt,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_symbol_mappings",
    normalized.symbolMappings.map((mapping) => ({
      id: mapping.id,
      connector_id: mapping.connectorId,
      platform_symbol: mapping.platformSymbol,
      terminal_symbol: mapping.terminalSymbol,
      min_lot: mapping.minLot,
      lot_step: mapping.lotStep,
      max_lot: mapping.maxLot,
      note: mapping.note,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_mailbox_commands",
    normalized.mailboxCommands.map((command) => ({
      id: command.id,
      schema_version: command.schemaVersion,
      connector_id: command.connectorId,
      kwant_id: command.kwantId,
      route_profile_id: command.routeProfileId,
      signal: command.signal,
      action: command.action,
      terminal_symbol: command.terminalSymbol,
      command_name: command.commandName,
      entry_instruction: command.entryInstruction,
      quantity_mode: command.quantityMode,
      normalized_quantity: command.normalizedQuantity,
      volume_interpretation: command.volumeInterpretation,
      risk_value: command.riskValue,
      sizing_mode: command.sizingMode,
      sizing_value: command.sizingValue,
      stop_mode: command.stopMode,
      target_mode: command.targetMode,
      stop_instruction: command.stopInstruction,
      target_instruction: command.targetInstruction,
      duplicate_window_seconds: command.duplicateWindowSeconds,
      max_open_positions: command.maxOpenPositions,
      reduction_policy: command.reductionPolicy,
      min_reduction_lot: command.minReductionLot,
      min_remaining_lot: command.minRemainingLot,
      magic: command.magic,
      comment: command.comment,
      created_at: command.createdAt,
      claimed_at: command.claimedAt,
      claim_token: command.claimToken,
      claim_expires_at: command.claimExpiresAt,
      acknowledged_at: command.acknowledgedAt,
      retry_count: command.retryCount,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_dead_letter_commands",
    normalized.deadLetterCommands.map((command) => ({
      id: command.id,
      connector_id: command.connectorId,
      signal_id: command.signal.signalId,
      payload: command,
      dead_lettered_at: command.deadLetteredAt,
      dead_letter_reason: command.deadLetterReason,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_connection_history",
    normalized.connectionHistory.map((row) => ({
      id: row.id,
      kwant_id: row.kwantId,
      account_number: row.accountNumber,
      broker: row.broker,
      account_type: row.accountType,
      platform: row.platform,
      ea_version: row.eaVersion,
      connected_from: row.connectedFrom,
      connected_to: row.connectedTo,
      status: row.status,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_heartbeats",
    normalized.heartbeats.map((heartbeat) => ({
      id: heartbeat.heartbeatId,
      connector_id: heartbeat.connectorId,
      kwant_id: heartbeat.kwantId,
      occurred_at: heartbeat.occurredAt,
      latency_ms: heartbeat.latencyMs,
      terminal_status: heartbeat.terminalStatus,
      chart_symbol: heartbeat.chartSymbol,
      ea_version: heartbeat.eaVersion,
      pending_signals: heartbeat.pendingSignals,
      last_error_code: heartbeat.lastErrorCode ?? null,
      last_error_message: heartbeat.lastErrorMessage ?? null,
    }))
  );

  await upsertSupabaseRows(
    supabaseConfig,
    "cfd_connector_execution_reports",
    normalized.executionReports.map((report) => ({
      report_id: report.reportId,
      connector_id: report.connectorId,
      kwant_id: report.kwantId,
      signal_id: report.signalId,
      status: report.status,
      occurred_at: report.occurredAt,
      terminal_symbol: report.terminalSymbol,
      order_ticket: report.orderTicket ?? null,
      position_ticket: report.positionTicket ?? null,
      executed_price: report.executedPrice ?? null,
      remaining_volume: report.remainingVolume ?? null,
      stop_loss: report.stopLoss ?? null,
      take_profit: report.takeProfit ?? null,
      error_code: report.errorCode ?? null,
      error_message: report.errorMessage ?? null,
      terminal_comment: report.terminalComment ?? null,
    }))
  );
}

