"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  History,
  KeyRound,
  Loader2,
  ScrollText,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { CFD_DEFAULT_PORTAL_BASE_URL, connectorToneClasses, type CfdConnectionHistoryRow, type CfdConnectorAdminEvent, type CfdConnectorOverview, type CfdExecutionReportPayload, type CfdLicenseSlot, type CfdSignalLogEntry } from "@/lib/connectors";
import { cfdClaimedCommandFieldDocs, cfdEaMql5Guardrails, cfdEaPollingLoop, cfdEaSetupChecklist, cfdLifecycleRules, cfdPairingFieldDocs, cfdPayloadFieldDocs, cfdSemanticRules } from "@/lib/connectorContractDocs";
import { MT5_CONNECTOR_RELEASE } from "@/lib/mt5ConnectorRelease";
import { createClient } from "@/lib/supabase";

type CfdDetailResponse = {
  generatedAt: string;
  schemaVersion: string;
  store: CfdConnectorOverview["store"];
  slot: CfdLicenseSlot;
  viewer: {
    userId: string;
    label: string;
    mode: "supabase" | "local-dev";
  } | null;
  seatAccess: {
    ownershipState: "available" | "owned_by_viewer" | "owned_by_other";
    canManageSeat: boolean;
    restrictionReason: string | null;
  };
  samplePayload: CfdConnectorOverview["samplePayload"];
  pendingCommands: CfdConnectorOverview["pendingCommands"];
  deadLetterCommands: CfdConnectorOverview["deadLetterCommands"];
  executionReports: CfdExecutionReportPayload[];
  signalInbox: CfdSignalLogEntry[];
  adminEvents: CfdConnectorAdminEvent[];
  errorCatalog: CfdConnectorOverview["errorCatalog"];
};

type SeatTimelineFilter = "all" | "signal" | "execution" | "admin" | "verification" | "error";
type SeatFocusSection = "verification" | "troubleshooting" | "errors" | "activity" | "recovery" | "security" | "audit";
type ValidationStatus = "passed" | "needs_work";

const seatFocusSections: SeatFocusSection[] = [
  "verification",
  "troubleshooting",
  "errors",
  "activity",
  "recovery",
  "security",
  "audit",
];

function isSeatTimelineFilter(value: string | null): value is SeatTimelineFilter {
  return (
    value === "all" ||
    value === "signal" ||
    value === "execution" ||
    value === "admin" ||
    value === "verification" ||
    value === "error"
  );
}

function isSeatFocusSection(value: string | null): value is SeatFocusSection {
  return value != null && seatFocusSections.includes(value as SeatFocusSection);
}

function sectionFocusClass(isFocused: boolean) {
  return isFocused
    ? "rounded-[18px] ring-1 ring-primary/35 shadow-[0_0_0_1px_rgba(217,119,6,0.18)]"
    : "";
}

function payloadExamples(samplePayload: CfdDetailResponse["samplePayload"], slot: CfdLicenseSlot) {
  const session = slot.sessions[0];
  const kwantId = slot.kwantId;

  return {
    heartbeat: {
      connectorId: session?.id ?? "mt5-demo-main",
      kwantId,
      authToken: "kwsec_***",
      occurredAt: new Date().toISOString(),
      latencyMs: 180,
      terminalStatus: "ready",
      chartSymbol: session?.chartSymbol ?? "NAS100",
      eaVersion: session?.eaVersion ?? "kwant-ea/0.1.0",
      pendingSignals: session?.pendingSignals ?? 0,
    },
    claim: {
      connectorId: session?.id ?? "mt5-demo-main",
      kwantId,
      authToken: "kwsec_***",
      maxCommands: 1,
    },
    ack: {
      connectorId: session?.id ?? "mt5-demo-main",
      kwantId,
      authToken: "kwsec_***",
      signalId: samplePayload.signalId,
      claimToken: "claim_***",
    },
    report: {
      connectorId: session?.id ?? "mt5-demo-main",
      kwantId,
      authToken: "kwsec_***",
      signalId: samplePayload.signalId,
      status: "filled",
      occurredAt: new Date().toISOString(),
      terminalSymbol: session?.chartSymbol ? `${session.chartSymbol}.cash` : "NAS100.cash",
      orderTicket: "5481029",
      positionTicket: "5481029",
      executedPrice: 29476.2,
      stopLoss: 29436.2,
      takeProfit: 29556.2,
      terminalComment: samplePayload.comment,
    },
  };
}

const seatSupportPlaybooks = [
  {
    title: "Heartbeat Not Moving",
    detail: "If the seat stays stale or offline, the real problem is often local MT5 setup rather than the connector API.",
    firstMove: "Check the WebRequest allow-list, confirm the EA is still attached to the chart, and make sure the terminal can reach the kwantify host.",
  },
  {
    title: "Synthetic Signal Rejected",
    detail: "A rejected test order usually means the broker rejected symbol, volume, stop distance, or trade permissions.",
    firstMove: "Compare the route symbol map and lot step with the MT5 contract spec, then retry after fixing the mismatch.",
  },
  {
    title: "Auth Refresh Required",
    detail: "When the backend rotates a secret, the MT5 seat keeps looking paired but can no longer heartbeat or claim cleanly.",
    firstMove: "Paste the new shared secret into the EA settings, reload the seat if needed, and rerun Test Connection.",
  },
  {
    title: "Dead-Letter Commands Growing",
    detail: "If the dead-letter queue grows, the seat is probably claiming commands without finishing the lifecycle cleanly.",
    firstMove: "Review the local terminal, confirm recovered-command auto-clear is working, then intentionally retry only after you trust the seat again.",
  },
];

const brokerRejectionExamples = [
  {
    code: "invalid_stops",
    example: "NAS100 or XAUUSD stop/target is too close to market or violates freeze distance.",
  },
  {
    code: "invalid_volume",
    example: "Requested lots do not align with the broker's min lot or step size for the mapped symbol.",
  },
  {
    code: "market_closed",
    example: "The CFD symbol is outside tradable session hours even though the connector seat is healthy.",
  },
  {
    code: "no_prices",
    example: "The chart is open but the broker feed is stale or the symbol is not actively quoting.",
  },
  {
    code: "trade_disabled",
    example: "Broker or account permissions do not allow this symbol to trade from the current seat.",
  },
];

const retailSignalExamples = [
  "88763665614933,buy,NAS100,risk=1,sl=20,tp=32",
  "88763665614933,sell,US30,vol_lots=0.2,sl_pips=80,tp_pips=140",
  "88763665614933,buystop,GBPUSD,vol_lots=0.5,entry_pips=15,sl_pips=25,tp_pips=45",
  "88763665614933,closelong,NAS100",
  "88763665614933,closelongpct,NAS100,partial_close_pct=50",
  "88763665614933,newsltplong,NAS100,sl_pips=25,tp_pips=50",
];

const liveValidationChecklist = [
  {
    title: "Pair And Authenticate",
    detail: "Confirm the seat pairs cleanly, receives the shared secret, and shows a healthy heartbeat with the right chart symbol and EA version.",
  },
  {
    title: "Run Connection Test",
    detail: "Use the seat page test action and make sure the result is not just successful, but also sensible for the configured route and symbol mappings.",
  },
  {
    title: "Run Synthetic Test Signal",
    detail: "Verify the signal enters the mailbox, gets claimed, acknowledged, and returns a real terminal lifecycle report instead of stalling silently.",
  },
  {
    title: "Validate Broker Mechanics",
    detail: "Check the real demo broker for symbol suffixes, lot step, min lot, stop distance, freeze level, and session-hours behavior.",
  },
  {
    title: "Exercise Recovery Paths",
    detail: "Deliberately test restart recovery and at least one dead-letter path so the seat proves it can fail honestly and recover intentionally.",
  },
];

function parseValidationEventDetail(detail: string) {
  const matched = detail.match(/^Validation (passed|needs work): (.+?)(?: - (.+))?$/i);
  if (!matched) return null;

  return {
    outcome: matched[1].toLowerCase() === "passed" ? ("passed" as const) : ("needs_work" as const),
    checkTitle: matched[2].trim(),
    note: matched[3]?.trim() ?? null,
  };
}

function buildValidationSummary(adminEvents: CfdConnectorAdminEvent[]) {
  const latestByTitle = new Map<
    string,
    {
      outcome: ValidationStatus;
      occurredAt: string;
      note: string | null;
      actor: string;
    }
  >();

  for (const event of adminEvents) {
    if (event.action !== "validation_update") continue;
    const parsed = parseValidationEventDetail(event.detail);
    if (!parsed) continue;
    if (!latestByTitle.has(parsed.checkTitle)) {
      latestByTitle.set(parsed.checkTitle, {
        outcome: parsed.outcome,
        occurredAt: event.occurredAt,
        note: parsed.note,
        actor: event.actor,
      });
    }
  }

  const checks = liveValidationChecklist.map((item) => {
    const latest = latestByTitle.get(item.title) ?? null;
    return {
      ...item,
      latest,
    };
  });

  const passed = checks.filter((item) => item.latest?.outcome === "passed").length;
  const needsWork = checks.filter((item) => item.latest?.outcome === "needs_work").length;
  const completed = checks.filter((item) => item.latest).length;

  return {
    checks,
    passed,
    needsWork,
    completed,
    total: liveValidationChecklist.length,
    ready: passed === liveValidationChecklist.length && needsWork === 0,
    latest:
      checks
        .map((item) => item.latest)
        .filter(Boolean)
        .sort((left, right) => new Date(right!.occurredAt).getTime() - new Date(left!.occurredAt).getTime())[0] ?? null,
  };
}

export default function CfdConnectorDetailPage() {
  const params = useParams<{ kwantId: string }>();
  const searchParams = useSearchParams();
  const kwantId = params.kwantId;
  const [data, setData] = useState<CfdDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [securityAction, setSecurityAction] = useState<"rotate" | "revoke" | null>(null);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [recoveryAction, setRecoveryAction] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [testAction, setTestAction] = useState<"connection" | "signal" | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testError, setTestError] = useState("");
  const [showOperatorChecks, setShowOperatorChecks] = useState(false);
  const [validationAction, setValidationAction] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [timelineFilter, setTimelineFilter] = useState<SeatTimelineFilter>("all");
  const [expandedActivityRow, setExpandedActivityRow] = useState<string | null>(null);
  const [browserOrigin, setBrowserOrigin] = useState(CFD_DEFAULT_PORTAL_BASE_URL);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const focusRefs = useRef<Record<SeatFocusSection, HTMLDivElement | null>>({
    verification: null,
    troubleshooting: null,
    errors: null,
    activity: null,
    recovery: null,
    security: null,
    audit: null,
  });
  const supabase = useMemo(() => createClient(), []);
  const SYNTHETIC_SIGNAL_RECONCILE_WINDOW_MS = 45_000;

  async function getAuthHeaders() {
    if (!supabase) return {} as Record<string, string>;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : ({} as Record<string, string>);
  }

  async function loadConnectorDetail(targetKwantId: string, cancelled = false) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/connector/cfds/${targetKwantId}`, {
        cache: "no-store",
        headers: await getAuthHeaders(),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to load CFD connector detail.");
      }

      if (!cancelled) {
        setData(json);
      }

      return json as CfdDetailResponse;
    } catch (nextError) {
      if (!cancelled) {
        setError((nextError as Error).message);
      }

      return null;
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  function buildSyntheticSignalStatusMessage(detail: CfdDetailResponse | null, signalId: string) {
    if (!detail) return null;
    const matchingSignalEntries = detail.signalInbox.filter((entry) => entry.signalId === signalId);
    const pendingCommand = detail.pendingCommands.find((command) => command.signal.signalId === signalId);
    const executionReport = detail.executionReports.find((report) => report.signalId === signalId);
    const matchingAdminEvent = detail.adminEvents.find(
      (event) => event.action === "test_signal" && event.detail.includes(signalId)
    );
    const terminalSymbol =
      pendingCommand?.terminalSymbol ??
      executionReport?.terminalSymbol ??
      detail.slot.sessions[0]?.chartSymbol ??
      "the MT5 seat";

    if (executionReport) {
      if (executionReport.status === "filled") {
        return `Synthetic test signal ${signalId} was claimed and filled on ${terminalSymbol}.`;
      }

      if (executionReport.status === "shadow_armed") {
        return `Synthetic test signal ${signalId} was filled on ${terminalSymbol} and shadow protection is armed.`;
      }

      if (executionReport.status === "shadow_triggered") {
        return `Synthetic test signal ${signalId} hit its shadow protection on ${terminalSymbol}.`;
      }

      if (executionReport.status === "modified") {
        return `Synthetic test signal ${signalId} was filled and its MT5 protections were attached on ${terminalSymbol}.`;
      }

      if (executionReport.status === "accepted") {
        return `Synthetic test signal ${signalId} was claimed and accepted on ${terminalSymbol}.`;
      }

      if (executionReport.status === "rejected") {
        return executionReport.errorMessage
          ? `Synthetic test signal ${signalId} was rejected on ${terminalSymbol}: ${executionReport.errorMessage}`
          : `Synthetic test signal ${signalId} was rejected on ${terminalSymbol}.`;
      }

      return `Synthetic test signal ${signalId} reached ${executionReport.status} on ${terminalSymbol}.`;
    }

    if (pendingCommand) {
      return `Synthetic test signal ${signalId} is queued for ${terminalSymbol}.`;
    }

    const newestSignalEntry = matchingSignalEntries[0] ?? null;
    if (!newestSignalEntry) {
      if (matchingAdminEvent) {
        return `Synthetic test signal ${signalId} was accepted by the website and queued for ${terminalSymbol}. Live seat state is still catching up.`;
      }

      return null;
    }

    if (newestSignalEntry.stage === "rejected") {
      return `Synthetic test signal ${signalId} was rejected before it reached the MT5 mailbox: ${newestSignalEntry.detail}`;
    }

    return `Synthetic test signal ${signalId} reached the ${newestSignalEntry.stage} stage for ${terminalSymbol}.`;
  }

  useEffect(() => {
    let cancelled = false;

    loadConnectorDetail(kwantId, cancelled);

    return () => {
      cancelled = true;
    };
  }, [kwantId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBrowserOrigin(window.location.origin);
    }
  }, []);

  const laneParam = searchParams.get("lane");
  const focusParam = searchParams.get("focus");
  const requestedTimelineFilter: SeatTimelineFilter | null = isSeatTimelineFilter(laneParam) ? laneParam : null;
  const requestedFocusSection: SeatFocusSection | null = isSeatFocusSection(focusParam) ? focusParam : null;
  const currentSeatPath = useMemo(() => {
    const query = searchParams.toString();
    return `/connector/cfds/${kwantId}${query ? `?${query}` : ""}`;
  }, [kwantId, searchParams]);
  const seatPortalBaseUrl = CFD_DEFAULT_PORTAL_BASE_URL;
  const loginHref = useMemo(() => `/login?returnTo=${encodeURIComponent(currentSeatPath)}`, [currentSeatPath]);
  const liveSeatHref = useMemo(() => `${CFD_DEFAULT_PORTAL_BASE_URL}${currentSeatPath}`, [currentSeatPath]);
  const signInActionHref = browserOrigin !== seatPortalBaseUrl ? liveSeatHref : loginHref;
  const signInActionLabel = browserOrigin !== seatPortalBaseUrl ? "Open Live Seat" : "Sign In To Send Test Trade";

  useEffect(() => {
    if (requestedTimelineFilter) {
      setTimelineFilter(requestedTimelineFilter);
    }
  }, [requestedTimelineFilter]);

  useEffect(() => {
    if (!requestedFocusSection || loading) return;

    const target = focusRefs.current[requestedFocusSection];
    if (!target) return;

    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => cancelAnimationFrame(frame);
  }, [loading, requestedFocusSection]);

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => {
        setCopiedField((current) => (current === label ? null : current));
      }, 1600);
    } catch {
      setCopiedField(null);
    }
  }

  async function runSecurityAction(action: "rotate" | "revoke") {
    if (!session) return;

    const endpoint = action === "rotate" ? "/api/connector/cfds/rotate-secret" : "/api/connector/cfds/revoke";
    const successMessage =
      action === "rotate"
        ? "Shared secret rotated. The MT5 side now needs to authenticate with the new secret."
        : "Connector revoked. A fresh pairing code is now active for re-onboarding this seat.";

    try {
      setSecurityAction(action);
      setSecurityError("");
      setSecurityMessage("");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          connectorId: session.id,
          kwantId: slot?.kwantId ?? kwantId,
        }),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || `Failed to ${action === "rotate" ? "rotate the secret" : "revoke the connector"}.`);
      }

      setSecurityMessage(successMessage);
      await loadConnectorDetail(kwantId);
    } catch (nextError) {
      setSecurityError((nextError as Error).message);
    } finally {
      setSecurityAction(null);
    }
  }

  async function runDeadLetterAction(commandId: string, action: "retry" | "dismiss") {
    if (!session || !slot) return;

    const endpoint =
      action === "retry" ? "/api/connector/cfds/dead-letter/retry" : "/api/connector/cfds/dead-letter/dismiss";

    try {
      setRecoveryAction(`${action}:${commandId}`);
      setRecoveryError("");
      setRecoveryMessage("");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          connectorId: session.id,
          kwantId: slot.kwantId,
          commandId,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || `Failed to ${action} dead-letter command.`);
      }

      setRecoveryMessage(
        action === "retry"
          ? "Dead-letter command re-queued for intentional retry."
          : "Dead-letter command dismissed after operator review."
      );
      await loadConnectorDetail(kwantId);
    } catch (nextError) {
      setRecoveryError((nextError as Error).message);
    } finally {
      setRecoveryAction(null);
    }
  }

  async function runSeatTest(action: "connection" | "signal") {
    if (!session || !slot) return;

    const endpoint =
      action === "connection" ? "/api/connector/cfds/test-connection" : "/api/connector/cfds/test-signal";
    try {
      if (productionStoreMisconfigured) {
        setTestError(
          "The production CFD connector is still using a local file store, so queued MT5 test trades are not reliable across server instances yet. Switch this seat to the shared Supabase store before using Send Test Trade."
        );
        return;
      }

      setTestAction(action);
      setTestError("");
      setTestMessage("");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          connectorId: session.id,
          kwantId: slot.kwantId,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          json?.error ||
            (action === "connection" ? "Failed to run connector health test." : "Failed to queue test signal.")
        );
      }

      if (action === "connection") {
        setTestMessage(`Connection test ${json.outcome}: ${json.detail}`);
        await loadConnectorDetail(kwantId);
        return;
      }

      const signalId = typeof json?.signalId === "string" ? json.signalId : "";
      const refreshedDetail = await loadConnectorDetail(kwantId);
      const verifiedMessage = signalId ? buildSyntheticSignalStatusMessage(refreshedDetail, signalId) : null;

      if (verifiedMessage) {
        setTestMessage(verifiedMessage);
        return;
      }

      throw new Error(
        signalId
          ? `The website received a success response for ${signalId}, but the live CFD seat state does not show that signal yet.`
          : "The website received a success response, but did not get a signalId back to verify."
      );
    } catch (nextError) {
      setTestError((nextError as Error).message);
    } finally {
      setTestAction(null);
    }
  }

  async function recordValidationOutcome(checkTitle: string, outcome: "passed" | "needs_work") {
    if (!session || !slot) return;

    try {
      setValidationAction(`${outcome}:${checkTitle}`);
      setValidationError("");
      setValidationMessage("");

      const response = await fetch("/api/connector/cfds/validation-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          connectorId: session.id,
          kwantId: slot.kwantId,
          checkTitle,
          outcome,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || "Failed to record validation outcome.");
      }

      setValidationMessage(
        outcome === "passed"
          ? `Logged as passed: ${checkTitle}`
          : `Logged as needs work: ${checkTitle}`
      );
      await loadConnectorDetail(kwantId);
    } catch (nextError) {
      setValidationError((nextError as Error).message);
    } finally {
      setValidationAction(null);
    }
  }

  const slot = data?.slot;
  const session = slot?.sessions[0];
  const productionStoreMisconfigured = Boolean(
    data?.store.kind === "file_json" && seatPortalBaseUrl.startsWith("https://www.kwantify.co")
  );
  const viewer = data?.viewer ?? null;
  const seatAccess = data?.seatAccess;
  const canManageSeat = seatAccess?.canManageSeat ?? false;
  const ownershipState = seatAccess?.ownershipState ?? "available";
  const needsViewerSignIn = !viewer;
  const examples = useMemo(() => (slot && data ? payloadExamples(data.samplePayload, slot) : null), [data, slot]);
  const claimedCommandExample = data?.pendingCommands[0] ?? null;
  const recentSignals = data?.signalInbox.slice(0, 3) ?? [];
  const history = slot?.history ?? [];
  const adminEvents = data?.adminEvents ?? [];
  const deadLetters = data?.deadLetterCommands ?? [];
  const latestConnectionTest = adminEvents.find((event) => event.action === "test_connection");
  const latestSignalTest = adminEvents.find((event) => event.action === "test_signal");
  const latestExecutionReport = data?.executionReports[0] ?? null;
  const latestSyntheticExpiryReport =
    data?.executionReports.find(
      (report) => report.errorCode === "command_expired" && report.signalId.startsWith("test_")
    ) ?? null;
  const activeSyntheticPendingCommand =
    data?.pendingCommands.find((command) => command.signal.strategyId === "connector_test") ?? null;
  const activeSyntheticCommandAgeMs = activeSyntheticPendingCommand
    ? Date.now() - new Date(activeSyntheticPendingCommand.signal.timestamp).getTime()
    : null;
  const claimLoopLooksStalled = Boolean(
    activeSyntheticPendingCommand &&
      !activeSyntheticPendingCommand.claimedAt &&
      activeSyntheticCommandAgeMs != null &&
      activeSyntheticCommandAgeMs > SYNTHETIC_SIGNAL_RECONCILE_WINDOW_MS
  );
  const validationSummary = useMemo(() => buildValidationSummary(adminEvents), [adminEvents]);
  const verificationHistory = useMemo(
    () =>
      adminEvents
        .filter((event) => event.action === "test_connection" || event.action === "test_signal")
        .slice(0, 6),
    [adminEvents]
  );
  const activityTimeline = useMemo(() => {
    const signalEntries = (data?.signalInbox ?? []).slice(0, 8).map((entry) => ({
      id: `signal-${entry.id}`,
      occurredAt: entry.occurredAt,
      lane: "Signal",
      title: `${entry.stage.toUpperCase()} - ${entry.strategyId}`,
      detail: entry.detail,
      tone: entry.tone,
    }));

    const executionEntries = (data?.executionReports ?? []).slice(0, 8).map((report, index) => ({
      id: `report-${report.signalId}-${index}`,
      occurredAt: report.occurredAt,
      lane: "Execution",
      title: `${report.status.toUpperCase()} - ${report.terminalSymbol}`,
      detail:
        report.errorMessage ??
        `${report.signalId}${report.executedPrice != null ? ` at ${report.executedPrice}` : ""}${
          report.orderTicket ? ` - ticket ${report.orderTicket}` : ""
        }`,
      tone: report.status === "rejected" ? ("error" as const) : report.status === "filled" || report.status === "closed" ? ("ready" as const) : ("warning" as const),
    }));

    const adminTimelineEntries = adminEvents
      .filter((event) => event.action !== "test_connection" && event.action !== "test_signal")
      .slice(0, 8)
      .map((event) => ({
        id: `admin-${event.id}`,
        occurredAt: event.occurredAt,
        lane: "Admin",
        title: `${event.action.replace("_", " ").toUpperCase()} - ${event.actor}`,
        detail: event.detail,
        tone: event.action === "revoked" ? ("error" as const) : ("warning" as const),
      }));

    const verificationTimelineEntries = verificationHistory.map((event) => ({
      id: `verification-${event.id}`,
      occurredAt: event.occurredAt,
      lane: "Verification",
      title: `${event.action.replace("_", " ").toUpperCase()} - ${event.actor}`,
      detail: event.detail,
      tone: "ready" as const,
    }));

    return [...signalEntries, ...executionEntries, ...adminTimelineEntries, ...verificationTimelineEntries]
      .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
      .slice(0, 12);
  }, [adminEvents, data?.executionReports, data?.signalInbox, verificationHistory]);
  const filteredActivityTimeline = useMemo(() => {
    if (timelineFilter === "all") return activityTimeline;
    if (timelineFilter === "error") return activityTimeline.filter((item) => item.tone === "error");

    const laneMap = {
      signal: "Signal",
      execution: "Execution",
      admin: "Admin",
      verification: "Verification",
    } as const;

    return activityTimeline.filter((item) => item.lane === laneMap[timelineFilter]);
  }, [activityTimeline, timelineFilter]);
  const bridgeLogRows = useMemo(() => {
    const signalRows = (data?.signalInbox ?? []).slice(0, 24).map((entry) => ({
      id: `signal-${entry.id}`,
      source: "signal" as const,
      occurredAt: entry.occurredAt,
      signalId: entry.signalId,
      symbol: null as string | null,
      actionLabel: entry.strategyId === "connector_test" ? "Test Signal" : entry.strategyId,
      statusLabel: entry.stage.replace(/_/g, " ").toUpperCase(),
      detail: entry.detail,
      tone: entry.tone,
    }));

    const executionRows = (data?.executionReports ?? []).slice(0, 24).map((report, index) => ({
      id: `execution-${report.signalId}-${index}`,
      source: "execution" as const,
      occurredAt: report.occurredAt,
      signalId: report.signalId,
      symbol: report.terminalSymbol,
      actionLabel: report.status === "modified" ? "Protections Updated" : report.status.replace(/_/g, " "),
      statusLabel: report.status.replace(/_/g, " ").toUpperCase(),
      detail:
        report.errorMessage ??
        [
          report.executedPrice != null ? `Filled ${report.terminalSymbol} at ${report.executedPrice}` : null,
          report.stopLoss != null || report.takeProfit != null
            ? `SL ${report.stopLoss ?? "—"} • TP ${report.takeProfit ?? "—"}`
            : null,
          report.orderTicket ? `Ticket ${report.orderTicket}` : null,
        ]
          .filter(Boolean)
          .join(" • "),
      tone:
        report.status === "rejected"
          ? ("error" as const)
          : report.status === "filled" || report.status === "modified" || report.status === "shadow_armed"
            ? ("ready" as const)
            : ("warning" as const),
    }));

    const allRows = [...signalRows, ...executionRows]
      .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
      .slice(0, 30);

    if (timelineFilter === "all") return allRows;
    if (timelineFilter === "signal") return allRows.filter((row) => row.source === "signal");
    if (timelineFilter === "execution") return allRows.filter((row) => row.source === "execution");
    if (timelineFilter === "error") return allRows.filter((row) => row.tone === "error");

    return allRows;
  }, [data?.executionReports, data?.signalInbox, timelineFilter]);
  const troubleshootingEntries = useMemo(() => {
    if (!session || !data) return [];
    const entries = [];

    if (session.pairingStatus === "revoked") {
      const match = data.errorCatalog.find((item) => item.code === "connector_missing");
      entries.push({
        title: "Seat revoked",
        detail: "This connector seat has been revoked. Re-pair it before expecting MT5 to heartbeat, claim, or report.",
        action: "Use Revoke And Re-Pair only when you are intentionally resetting this seat.",
      });
    }

    if (session.status === "Auth refresh required") {
      entries.push({
        title: "Secret refresh needed",
        detail: "The backend rotated the shared secret and the MT5 terminal has not authenticated with the new one yet.",
        action: "Copy the fresh secret into the EA side, then run Test Connection again.",
      });
    }

    if (session.heartbeatState !== "healthy") {
      const match = data.errorCatalog.find((item) => item.code === "heartbeat_stale");
      entries.push({
        title: match?.title ?? "Heartbeat unhealthy",
        detail: match?.detail ?? "Terminal heartbeat is stale or offline.",
        action: match?.operatorAction ?? "Inspect the MT5 terminal and whitelist configuration.",
      });
    }

    if (latestExecutionReport?.status === "rejected") {
      const match = latestExecutionReport.errorCode
        ? data.errorCatalog.find((item) => item.code === latestExecutionReport.errorCode)
        : null;
      entries.push({
        title: match?.title ?? "Latest execution was rejected",
        detail: latestExecutionReport.errorMessage ?? match?.detail ?? "The last command was rejected by the terminal or broker.",
        action: match?.operatorAction ?? "Review the latest execution report and broker constraints before retrying.",
      });
    }

    if (claimLoopLooksStalled) {
      entries.push({
        title: "MT5 is not claiming queued test trades",
        detail:
          latestSyntheticExpiryReport?.errorMessage ??
          "Kwantify queued the synthetic test trade, but this MT5 seat has not claimed it within the normal mailbox window.",
        action:
          "Reload the chart with the latest downloaded EA build, then rerun one test trade. If the terminal still never claims, check the MT5 Experts log for claim-loop messages instead of retrying the website button repeatedly.",
      });
    }

    if (deadLetters.length > 0) {
      entries.push({
        title: "Dead-letter queue has items",
        detail: `${deadLetters.length} command${deadLetters.length === 1 ? "" : "s"} exhausted claim retries for this seat.`,
        action: "Review the dead-letter section below and decide whether to retry intentionally or dismiss after inspection.",
      });
    }

    return entries.slice(0, 4);
  }, [claimLoopLooksStalled, data, deadLetters.length, latestExecutionReport, latestSyntheticExpiryReport, session]);
  const relevantErrors = useMemo(() => {
    if (!data || !session) return [];

    const picks = [];
    if (session.pairingStatus === "revoked") {
      const revoked = data.errorCatalog.find((item) => item.code === "connector_missing");
      if (revoked) picks.push(revoked);
    }
    if (session.status === "Auth refresh required") {
      const authRefresh = data.errorCatalog.find((item) => item.code === "auth_refresh_required");
      if (authRefresh) picks.push(authRefresh);
    }
    if (session.heartbeatState !== "healthy") {
      const heartbeat = data.errorCatalog.find((item) => item.code === "heartbeat_stale");
      if (heartbeat) picks.push(heartbeat);
    }
    if (latestExecutionReport?.errorCode) {
      const latest = data.errorCatalog.find((item) => item.code === latestExecutionReport.errorCode);
      if (latest) picks.push(latest);
    }
    if (deadLetters.length > 0) {
      const deadLetter = data.errorCatalog.find((item) => item.code === "dead_letter_queue");
      if (deadLetter) picks.push(deadLetter);
    }

    const seen = new Set<string>();
    return picks.filter((item) => {
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    });
  }, [data, deadLetters.length, latestExecutionReport, session]);
  const pairingExample = session
    ? {
        connectorId: session.id,
        kwantId: slot.kwantId,
        pairingCode: session.pairingCode,
        terminalInstanceId: session.terminalInstanceId ?? "mt5-host-demo-01",
        terminalAlias: session.terminalAlias ?? "Karen NAS100 Demo",
        eaVersion: session.eaVersion,
        chartSymbol: session.chartSymbol,
      }
    : null;
  const seatSetupChecklist = session
    ? [
        { label: "KWANT ID", value: slot.kwantId, detail: "Paste this into the EA seat identity field." },
        { label: "Pairing Code", value: session.pairingCode, detail: "Use this when the terminal binds for the first time or after revoke and re-pair." },
        { label: "Allowed URL", value: seatPortalBaseUrl, detail: browserOrigin !== seatPortalBaseUrl ? `This seat polls ${seatPortalBaseUrl}, not ${browserOrigin}. Add the backend target to MT5 WebRequest settings.` : "Add this backend target to MT5 WebRequest settings before heartbeat or claim can work." },
        { label: "Chart Symbol", value: session.chartSymbol, detail: "Attach the EA to the CFD chart intended for this seat." },
        { label: "Transport", value: "WebRequest Pull", detail: "This starter bridge polls from MT5 instead of receiving pushed commands." },
      ]
    : [];
  const setupProgress = session
    ? [
        {
          label: "Seat paired",
          done: session.pairingStatus === "paired",
          detail: session.pairingStatus === "paired" ? "Connector seat is paired to an MT5 lane." : "Pair this seat before anything else.",
        },
        {
          label: "Auth current",
          done: session.status !== "Auth refresh required" && Boolean(session.lastAuthenticatedAt),
          detail:
            session.status !== "Auth refresh required" && session.lastAuthenticatedAt
              ? `Last authenticated ${new Date(session.lastAuthenticatedAt).toLocaleString()}.`
              : "Refresh the MT5 secret if this seat is waiting on auth.",
        },
        {
          label: "Heartbeat healthy",
          done: session.heartbeatState === "healthy",
          detail: session.heartbeatState === "healthy" ? "Terminal is heartbeating inside the expected window." : "The EA has not checked in cleanly yet.",
        },
        {
          label: "Connection test passed",
          done: Boolean(latestConnectionTest),
          detail: latestConnectionTest ? latestConnectionTest.detail : "Run Test Connection from this seat page.",
        },
        {
          label: "Synthetic signal run",
          done: Boolean(latestSignalTest),
          detail: latestSignalTest ? latestSignalTest.detail : "Queue a test signal before trusting live order flow.",
        },
      ]
    : [];
  const activityFocusMode = requestedFocusSection === "activity";

  if (slot && activityFocusMode) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/connector/cfds"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back To CFD Seats
          </Link>
          {loading ? (
            <div className="inline-flex items-center gap-2 text-[12px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading bridge log
            </div>
          ) : data ? (
            <div className="text-[12px] text-muted">Updated {new Date(data.generatedAt).toLocaleString()}</div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">{error}</div>
        ) : null}

        <SectionCard eyebrow="Bridge" title="Activity Log">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-[28px] font-semibold tracking-tight text-foreground">{session?.accountLabel ?? slot.kwantId}</div>
              <div className="mt-2 text-[14px] text-muted">
                {session
                  ? `${session.accountNumber}, ${session.mode === "demo" ? "Demo" : "Live"}, ${session.chartSymbol}`
                  : "Unused connector seat"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] ${connectorToneClasses(session?.tone ?? "warning")}`}>
                  {session?.heartbeatState === "healthy" ? "EA Running" : "EA Check Needed"}
                </span>
                {latestExecutionReport ? (
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${connectorToneClasses(latestExecutionReport.status === "rejected" ? "error" : "ready")}`}>
                    {latestExecutionReport.status}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {session && needsViewerSignIn ? (
                <Link
                  href={signInActionHref}
                  className="rounded-2xl bg-primary px-5 py-3 text-[14px] font-semibold text-background"
                >
                  {signInActionLabel}
                </Link>
              ) : (
                <button
                  onClick={() => void runSeatTest("signal")}
                  disabled={!session || !canManageSeat || testAction !== null || productionStoreMisconfigured}
                  className="rounded-2xl bg-primary px-5 py-3 text-[14px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testAction === "signal" ? "Sending Test Trade..." : "Send Test Trade"}
                </button>
              )}
              <Link
                href={`/connector/cfds/${kwantId}?focus=verification&lane=verification`}
                className="rounded-2xl border border-border bg-surface px-5 py-3 text-[14px] font-semibold text-muted transition-colors hover:text-foreground"
              >
                Open Seat
              </Link>
            </div>
          </div>

          {testMessage ? (
            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
              {testMessage}
            </div>
          ) : null}
          {testError ? (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {testError}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard eyebrow="Logs" title="Bridge Log">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "signal", label: "Signals" },
                  { key: "execution", label: "Execution" },
                  { key: "error", label: "Errors" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setTimelineFilter(filter.key as SeatTimelineFilter)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                      timelineFilter === filter.key
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-panel text-muted hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="text-[12px] text-muted">
                {bridgeLogRows.length > 0 ? `${bridgeLogRows.length} recent log ${bridgeLogRows.length === 1 ? "entry" : "entries"}` : "No log entries yet"}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
              <div className="hidden grid-cols-[180px_minmax(0,1.4fr)_140px_150px_40px] gap-4 border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted md:grid">
                <div>Timestamp</div>
                <div>Signal</div>
                <div>Action</div>
                <div>Status</div>
                <div />
              </div>

              {bridgeLogRows.length > 0 ? (
                bridgeLogRows.map((row) => {
                  const isExpanded = expandedActivityRow === row.id;

                  return (
                    <div key={row.id} className="border-t border-border first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setExpandedActivityRow(isExpanded ? null : row.id)}
                        className="grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[180px_minmax(0,1.4fr)_140px_150px_40px] md:items-center md:gap-4"
                      >
                        <div className="text-[12px] text-muted">{new Date(row.occurredAt).toLocaleString()}</div>
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[12px] text-foreground">{row.signalId}</div>
                          {row.symbol ? <div className="mt-1 text-[12px] text-muted">{row.symbol}</div> : null}
                        </div>
                        <div className="text-[13px] font-medium text-foreground">{row.actionLabel}</div>
                        <div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${connectorToneClasses(row.tone)}`}>
                            {row.statusLabel}
                          </span>
                        </div>
                        <div className="text-right text-[18px] text-muted">{isExpanded ? "-" : "+"}</div>
                      </button>

                      {isExpanded ? (
                        <div className="border-t border-border bg-panel/40 px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">What happened</div>
                              <div className="mt-2 text-[13px] leading-6 text-foreground">{row.detail || "No extra detail was recorded for this row."}</div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Signal ID</div>
                                <div className="mt-2 break-all font-mono text-[12px] text-foreground">{row.signalId}</div>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Route</div>
                                <div className="mt-2 text-[13px] text-foreground">{row.symbol ?? session?.chartSymbol ?? "Seat route"}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-[13px] text-muted">No bridge events match this filter yet.</div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/connector/cfds"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back To CFD Seats
        </Link>
        {loading ? (
          <div className="inline-flex items-center gap-2 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading connector
          </div>
        ) : data ? (
          <div className="flex items-center gap-3 text-[12px] text-muted">
            <span>Updated {new Date(data.generatedAt).toLocaleTimeString()}</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
              {data.schemaVersion}
            </span>
          </div>
        ) : null}
      </div>

      {error ? <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">{error}</div> : null}
      {browserOrigin !== seatPortalBaseUrl ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-[12px] text-primary">
          This operator page is running on <span className="font-semibold">{browserOrigin}</span>, but this MT5 seat polls and executes against <span className="font-semibold">{seatPortalBaseUrl}</span>. Connection tests, synthetic signals, and seat actions from this localhost shell are forwarded to the live backend target so the UI matches what the terminal is actually doing.
          <div className="mt-3">
            <Link
              href={liveSeatHref}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
            >
              Open Live Seat
            </Link>
          </div>
        </div>
      ) : null}

      {slot ? (
        <>
          <SectionCard eyebrow="Connection" title={session?.broker ?? "KWANT MT5 Connection"}>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="text-[30px] font-semibold tracking-tight text-foreground">{slot.kwantId}</div>
                <div className="mt-2 text-[15px] text-muted">
                  {session ? `${session.accountNumber}, ${session.mode === "demo" ? "Demo" : "Live"}, ${session.chartSymbol}` : "Unused connector seat"}
                </div>
                {session ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                        ownershipState === "owned_by_other"
                          ? "border-danger/25 bg-danger/10 text-danger"
                          : ownershipState === "owned_by_viewer"
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-border bg-panel text-muted"
                      }`}
                    >
                      {ownershipState === "owned_by_other"
                        ? `Locked by ${session.ownerLabel ?? "another operator"}`
                        : ownershipState === "owned_by_viewer"
                          ? "Owned by you"
                          : "Available"}
                    </span>
                    {viewer ? (
                      <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        Viewer: {viewer.label}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                {session && needsViewerSignIn ? (
                  <Link
                    href={signInActionHref}
                    className="rounded-2xl bg-primary px-5 py-3 text-[14px] font-semibold text-background"
                  >
                    {signInActionLabel}
                  </Link>
                ) : (
                  <button
                    onClick={() => void runSeatTest("signal")}
                    disabled={!session || !canManageSeat || testAction !== null || productionStoreMisconfigured}
                    className="rounded-2xl bg-primary px-5 py-3 text-[14px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {testAction === "signal" ? "Sending Test Trade..." : "Send Test Trade"}
                  </button>
                )}
                <button
                  onClick={() => setShowOperatorChecks((current) => !current)}
                  className="rounded-2xl border border-border bg-surface px-5 py-3 text-[14px] font-semibold text-muted"
                >
                  {showOperatorChecks ? "Hide Advanced" : "Show Advanced"}
                </button>
              </div>
            </div>
            {session && canManageSeat ? (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-[12px] text-muted">
                Normal flow: attach the EA, paste the seat code, and send one test trade. The connector accepts one-package Pine-style intent. In broker-protection mode it places first and then attaches live MT5 protections; with Shadow Targets enabled it arms local hidden protection instead. If it places, you are done. If it fails, use Operator Checks below to inspect the bridge.
              </div>
            ) : null}
            {session ? (
              <div className="mt-4 rounded-xl border border-border bg-panel px-3 py-3 text-[12px] text-muted">
                Latest MT5 EA release: <span className="font-semibold text-foreground">{MT5_CONNECTOR_RELEASE.eaVersion}</span> (
                <span className="font-semibold text-foreground">{MT5_CONNECTOR_RELEASE.releaseTag}</span>).
              </div>
            ) : null}
            {session && productionStoreMisconfigured ? (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-3 text-[12px] text-danger">
                Production CFD routing is currently misconfigured: this seat is still using a local file store instead of the shared Supabase connector store. Website requests and MT5 claim polls can hit different server instances, which makes queued test trades unreliable. Switch this seat to the shared Supabase store before trusting Send Test Trade.
              </div>
            ) : null}
            {session && claimLoopLooksStalled ? (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-3 text-[12px] text-danger">
                Kwantify is queueing the MT5 test trade, but this terminal is not claiming it before the mailbox expires it. That usually means the chart is still running an older EA build or a stuck claim loop. Re-download the latest EA from this page, replace it in MT5, reload the chart, then run one fresh test trade.
              </div>
            ) : null}
            {needsViewerSignIn ? (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-3 text-[12px] text-primary">
                You are viewing the CFD operator page without an authenticated operator session. Sign in first and we will bring you straight back to this exact seat so you can send the MT5 test trade without extra steps.
                <div className="mt-3">
                  <Link
                    href={signInActionHref}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
                  >
                    {browserOrigin !== seatPortalBaseUrl ? "Open Live Seat" : "Open Login To This Seat"}
                  </Link>
                </div>
              </div>
            ) : null}
            {session && !canManageSeat && seatAccess?.restrictionReason ? (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {needsViewerSignIn ? "Sign in to manage this MT5 seat." : seatAccess.restrictionReason}{" "}
                {needsViewerSignIn
                  ? "Sign in first to unlock protected MT5 actions."
                  : ownershipState === "available"
                  ? "This seat will link itself to your operator profile automatically when the first protected MT5 action runs."
                  : "Restricted actions are locked until the current owner releases this seat."}
              </div>
            ) : null}
            {testMessage ? (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                {testMessage}
              </div>
            ) : null}
            {testError ? (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {testError}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard eyebrow="Quick Start" title="Link MT5 And Send One Test Trade">
            {session ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {setupProgress.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-primary" : "text-muted"}`} />
                        {item.label}
                      </div>
                      <div className={`mt-2 text-[13px] font-semibold ${item.done ? "text-foreground" : "text-muted"}`}>
                        {item.done ? "Ready" : "Pending"}
                      </div>
                      <div className="mt-2 text-[12px] leading-6 text-muted">{item.detail}</div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="space-y-3">
                  {seatSetupChecklist.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{item.label}</div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void copyValue(item.label, item.value);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-panel px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedField === item.label ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="mt-2 break-all rounded-xl border border-border bg-background/70 px-3 py-2 text-[13px] font-semibold text-foreground">
                        {item.value}
                      </div>
                      <div className="mt-2 text-[12px] leading-6 text-muted">{item.detail}</div>
                    </div>
                  ))}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Fastest path</div>
                      <div className="mt-3 space-y-2 text-[12px] leading-6 text-muted">
                        <div>1. Download the MT5 drag-and-drop package from this seat page.</div>
                        <div>2. Copy `KwantifyConnectorEA.ex5` / `{MT5_CONNECTOR_RELEASE.compiledEaFilename}` into `MQL5/Experts`, then restart MT5 or refresh Navigator.</div>
                        <div>3. Attach the EA to the chart you want to trade.</div>
                        <div>4. Paste the KWANT ID and pairing values shown here.</div>
                        <div>5. Enable Algo Trading, allow WebRequest, and whitelist the connector URL.</div>
                        <div>6. Send one test trade. If it places, the bridge is working. If it fails, use the operator checks below.</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Starter pack files</div>
                      <div className="mt-3 space-y-2 text-[12px] leading-6 text-muted">
                        <div><code>KwantifyConnectorMT5-DragDrop.zip</code> / <code>{MT5_CONNECTOR_RELEASE.dragDropPackageFilename}</code> {"->"} <code>unzip and copy the compiled EA into MQL5/Experts</code></div>
                        <div><code>KwantifyConnectorEA.ex5</code> / <code>{MT5_CONNECTOR_RELEASE.compiledEaFilename}</code> {"->"} <code>MQL5/Experts</code></div>
                        <div><code>KwantifyConnectorMT5-Source.zip</code> / <code>{MT5_CONNECTOR_RELEASE.sourcePackageFilename}</code> {"->"} <code>advanced source only</code></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <a
                          href="/downloads/mt5/KwantifyConnectorMT5-DragDrop.zip"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[13px] font-semibold text-background"
                        >
                          Download Drag-And-Drop Pack
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <a
                          href="/downloads/mt5/KwantifyConnectorPack.md"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-muted"
                        >
                          Open Install Guide
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      <div className="mt-3 text-[12px] text-muted">
                        The compiled drag-and-drop pack now ships the ready EA directly, so a normal MT5 install does not require source compilation first.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[13px] leading-6 text-muted">
                This seat has not been paired yet. Once a terminal claims it, this setup kit will show the exact identity and onboarding values that MT5 needs.
              </div>
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard eyebrow="Recent Signals" title="What The Trader Cares About">
              <div className="space-y-3">
                {latestExecutionReport ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Latest MT5 outcome</div>
                    <div className="mt-2 text-[14px] font-semibold text-foreground">
                      {latestExecutionReport.status.toUpperCase()} on {latestExecutionReport.terminalSymbol}
                    </div>
                    <div className="mt-2 text-[12px] text-muted">
                      {latestExecutionReport.executedPrice != null ? `Filled at ${latestExecutionReport.executedPrice}` : "Execution reported by MT5"}
                      {latestExecutionReport.orderTicket ? ` • Ticket ${latestExecutionReport.orderTicket}` : ""}
                    </div>
                    {(latestExecutionReport.stopLoss != null || latestExecutionReport.takeProfit != null) ? (
                      <div className="mt-2 text-[12px] text-muted">
                        SL {latestExecutionReport.stopLoss ?? "—"} • TP {latestExecutionReport.takeProfit ?? "—"}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {recentSignals.length > 0 ? (
                  recentSignals.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-[12px] text-foreground">{entry.signalId}</div>
                          <div className="mt-1 text-[12px] text-muted">{entry.detail}</div>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${connectorToneClasses(entry.tone)}`}>
                          {entry.stage}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                    No recent signals yet. Once the seat starts receiving alerts, the latest few will show here.
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Signal Syntax" title="Pine-Style Alert Examples">
              <div className="rounded-2xl border border-border bg-panel/70 p-4">
                <div className="text-[12px] text-muted">
                  Keep alerts readable and compact. The trader should be able to understand the command at a glance without learning backend payloads.
                </div>
                <div className="mt-4 space-y-2">
                  {retailSignalExamples.map((example) => (
                    <div key={example} className="rounded-xl border border-border bg-background/80 px-3 py-2 font-mono text-[12px] text-foreground">
                      {example}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    "Target Type: Pips / Price / Percentage",
                    "Volume Type: Lots / Dollar / Percent",
                    "Pending orders: supported",
                    "Close / partial close / modify: supported",
                    "Shadow Targets: available",
                    "Advanced troubleshooting: hidden below",
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-surface/60 px-3 py-2 text-[12px] text-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          {showOperatorChecks ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div
              ref={(node) => {
                focusRefs.current.verification = node;
              }}
              className={sectionFocusClass(requestedFocusSection === "verification")}
            >
            <SectionCard eyebrow="Operator Checks" title="Bridge Diagnostics">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Advanced Bridge Check</div>
                      <div className="mt-2 text-[12px] leading-6 text-muted">
                        This does not place a trade. It only checks pairing, auth, heartbeat, route coverage, and mapping coverage.
                      </div>
                    </div>
                    <button
                      onClick={() => void runSeatTest("connection")}
                      disabled={!session || !canManageSeat || testAction !== null || productionStoreMisconfigured}
                      className="rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {testAction === "connection" ? "Checking Bridge..." : "Check Bridge Only"}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Latest Connection Test
                  </div>
                  <div className="mt-3 text-[14px] font-semibold text-foreground">
                    {latestConnectionTest ? latestConnectionTest.detail : "No connection test has been run for this seat yet."}
                  </div>
                  {latestConnectionTest ? (
                    <div className="mt-2 text-[12px] text-muted">{new Date(latestConnectionTest.occurredAt).toLocaleString()}</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    <Workflow className="h-4 w-4 text-primary" />
                    Latest Synthetic Test Signal
                  </div>
                  <div className="mt-3 text-[14px] font-semibold text-foreground">
                    {latestSignalTest ? latestSignalTest.detail : "No synthetic test signal has been queued for this seat yet."}
                  </div>
                  {latestSignalTest ? (
                    <div className="mt-2 text-[12px] text-muted">{new Date(latestSignalTest.occurredAt).toLocaleString()}</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    <Server className="h-4 w-4 text-primary" />
                    Latest Terminal Report
                  </div>
                  <div className="mt-3 text-[14px] font-semibold text-foreground">
                    {latestExecutionReport
                      ? `${latestExecutionReport.status.toUpperCase()} on ${latestExecutionReport.terminalSymbol}`
                      : "No terminal execution report recorded yet for this seat."}
                  </div>
                  {latestExecutionReport ? (
                    <div className="mt-2 text-[12px] text-muted">
                      {new Date(latestExecutionReport.occurredAt).toLocaleString()}
                      {latestExecutionReport.errorCode ? ` · ${latestExecutionReport.errorCode}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>
            </div>

            <div
              ref={(node) => {
                focusRefs.current.troubleshooting = node;
              }}
              className={sectionFocusClass(requestedFocusSection === "troubleshooting")}
            >
            <SectionCard eyebrow="Troubleshooting" title="What Needs Attention">
              <div className="space-y-4">
                {troubleshootingEntries.length > 0 ? (
                  troubleshootingEntries.map((entry) => (
                    <div key={entry.title} className="rounded-2xl border border-danger/20 bg-danger/10 p-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-danger">
                        <AlertTriangle className="h-4 w-4" />
                        {entry.title}
                      </div>
                      <div className="mt-3 text-[13px] leading-6 text-foreground">{entry.detail}</div>
                      <div className="mt-2 text-[12px] text-muted">{entry.action}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-muted">
                    This seat does not currently show any major warning conditions. Pairing, heartbeat, retry pressure, and latest execution outcome all look calm from the connector side.
                  </div>
                )}
              </div>
            </SectionCard>
            </div>
          </div>
          ) : null}

          {showOperatorChecks ? (
          <SectionCard eyebrow="Live Validation" title="Real MT5 Demo Validation Path">
            <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Validation Progress</div>
                    <div className="mt-2 text-[20px] font-semibold text-foreground">
                      {validationSummary.passed}/{validationSummary.total}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {validationSummary.completed === 0
                        ? "No live validation checks recorded yet"
                        : `${validationSummary.completed}/${validationSummary.total} checks logged`}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Seat Verdict</div>
                    <div
                      className={`mt-2 text-[20px] font-semibold ${
                        validationSummary.ready
                          ? "text-primary"
                          : validationSummary.needsWork > 0
                            ? "text-danger"
                            : "text-foreground"
                      }`}
                    >
                      {validationSummary.ready
                        ? "Validated"
                        : validationSummary.needsWork > 0
                          ? "Needs Work"
                          : "In Progress"}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {validationSummary.needsWork > 0
                        ? `${validationSummary.needsWork} check${validationSummary.needsWork === 1 ? "" : "s"} still needs work`
                        : validationSummary.ready
                          ? "All MT5 demo checks are currently marked passed"
                          : "Finish the checklist before trusting this seat repeatedly"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Latest Validation</div>
                    <div className="mt-2 text-[14px] font-semibold text-foreground">
                      {validationSummary.latest ? validationSummary.latest.actor : "No evidence yet"}
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {validationSummary.latest
                        ? new Date(validationSummary.latest.occurredAt).toLocaleString()
                        : "Record each MT5 demo step here as you work through the runbook"}
                    </div>
                  </div>
                </div>
                {validationMessage ? (
                  <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                    {validationMessage}
                  </div>
                ) : null}
                {validationError ? (
                  <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                    {validationError}
                  </div>
                ) : null}
                {validationSummary.checks.map((item, index) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-[12px] font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-[15px] font-semibold text-foreground">{item.title}</div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              item.latest?.outcome === "passed"
                                ? "bg-primary/15 text-primary"
                                : item.latest?.outcome === "needs_work"
                                  ? "bg-danger/10 text-danger"
                                  : "bg-panel text-muted"
                            }`}
                          >
                            {item.latest?.outcome === "passed"
                              ? "Passed"
                              : item.latest?.outcome === "needs_work"
                                ? "Needs Work"
                                : "Pending"}
                          </span>
                        </div>
                        <div className="mt-2 text-[13px] leading-6 text-muted">{item.detail}</div>
                        <div className="mt-2 text-[12px] text-muted">
                          {item.latest
                            ? `${item.latest.outcome === "passed" ? "Last passed" : "Last marked needs work"} by ${item.latest.actor} on ${new Date(item.latest.occurredAt).toLocaleString()}${item.latest.note ? ` - ${item.latest.note}` : ""}`
                            : "No validation evidence logged for this check yet"}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            onClick={() => void recordValidationOutcome(item.title, "passed")}
                            disabled={!canManageSeat || validationAction !== null}
                            className="rounded-2xl bg-primary px-3 py-2 text-[12px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {validationAction === `passed:${item.title}` ? "Logging..." : "Mark Passed"}
                          </button>
                          <button
                            onClick={() => void recordValidationOutcome(item.title, "needs_work")}
                            disabled={!canManageSeat || validationAction !== null}
                            className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {validationAction === `needs_work:${item.title}` ? "Logging..." : "Needs Work"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Validation Pack</div>
                <div className="mt-3 text-[13px] leading-6 text-muted">
                  This runbook is for the first real MT5 demo-terminal validation pass. It turns the next live connector check into a repeatable checklist instead of a memory test.
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="/downloads/mt5/KwantifyConnectorValidationRunbook.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[13px] font-semibold text-background"
                  >
                    Open Validation Runbook
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <div className="mt-4 text-[12px] text-muted">
                  Use it after the seat is paired and before you call the connector ready for repeatable live demo use.
                </div>
              </div>
            </div>
          </SectionCard>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div
              ref={(node) => {
                focusRefs.current.errors = node;
              }}
              className={sectionFocusClass(requestedFocusSection === "errors")}
            >
            <SectionCard eyebrow="Error Center" title="Seat-Specific Fix Guidance">
              <div className="space-y-3">
                {relevantErrors.length > 0 ? (
                  relevantErrors.map((item) => (
                    <div key={item.code} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                        {item.scope} · {item.code}
                      </div>
                      <div className="mt-2 text-[14px] font-semibold text-foreground">{item.title}</div>
                      <div className="mt-2 text-[12px] leading-6 text-muted">{item.detail}</div>
                      <div className="mt-2 text-[12px] text-muted">Operator action: {item.operatorAction}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-muted">
                    No specific error-center articles are being pulled forward for this seat right now. If a heartbeat goes stale or a broker rejection lands, the matching fix guidance will show up here automatically.
                  </div>
                )}
              </div>
            </SectionCard>
            </div>

            <SectionCard eyebrow="Support" title="Common MT5 Fix Playbooks">
              <div className="space-y-3">
                {seatSupportPlaybooks.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[14px] font-semibold text-foreground">{item.title}</div>
                    <div className="mt-2 text-[12px] leading-6 text-muted">{item.detail}</div>
                    <div className="mt-2 text-[12px] text-muted">First move: {item.firstMove}</div>
                  </div>
                ))}
                {filteredActivityTimeline.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                    No timeline events match this filter yet.
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Examples" title="Broker Rejection Examples">
              <div className="space-y-3">
                {brokerRejectionExamples.map((item) => {
                  const match = data.errorCatalog.find((entry) => entry.code === item.code);
                  return (
                    <div key={item.code} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{item.code}</div>
                      <div className="mt-2 text-[14px] font-semibold text-foreground">{match?.title ?? item.code}</div>
                      <div className="mt-2 text-[12px] leading-6 text-muted">{item.example}</div>
                      {match ? (
                        <div className="mt-2 text-[12px] text-muted">Operator action: {match.operatorAction}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Settings" title="EA Settings">
              {session ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { label: "KWANT ID", value: slot.kwantId },
                      { label: "Pairing", value: session.pairingStatus },
                      { label: "Target Type", value: "Pips / Price / Percentage" },
                      { label: "Volume Type", value: "Lots / Dollar / Percent" },
                      { label: "Pending Entry", value: "Pips / Price / Percentage" },
                      { label: "Close On Reverse", value: "Off" },
                      { label: "Shadow Targets", value: "Available" },
                      { label: "Partial Close %", value: "25%" },
                      { label: "Max Open Positions", value: "5" },
                      { label: "Transport", value: "WebRequest Pull" },
                      { label: "Auth Mode", value: session.authMode.replace("_", " ") },
                    ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</div>
                      <div className="mt-2 text-[22px] font-semibold text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] text-muted">This code has not been paired with an MT5 terminal yet.</div>
              )}
            </SectionCard>

            <div
              ref={(node) => {
                focusRefs.current.activity = node;
              }}
              className={sectionFocusClass(requestedFocusSection === "activity")}
            >
            <SectionCard eyebrow="Activity" title="Seat Activity Timeline">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {["all", "signal", "execution", "admin", "verification"].map((filterKey) => (
                    <button
                      key={filterKey}
                      onClick={() => setTimelineFilter(filterKey as SeatTimelineFilter)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                        timelineFilter === filterKey
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-panel text-muted hover:text-foreground"
                      }`}
                    >
                      {filterKey === "all" ? "All" : filterKey}
                    </button>
                  ))}
                </div>
                {filteredActivityTimeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[12px] text-muted">{new Date(item.occurredAt).toLocaleString()}</div>
                        <div className="mt-2 text-[15px] font-semibold text-foreground">{item.title}</div>
                        <div className="mt-2 text-[12px] leading-6 text-muted">{item.detail}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{item.lane}</div>
                        <div className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${connectorToneClasses(item.tone)}`}>
                          {item.tone}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredActivityTimeline.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                    No timeline events match this filter yet.
                  </div>
                ) : null}
              </div>
            </SectionCard>
            </div>
          </div>

          <SectionCard eyebrow="Verification History" title="Connection And Test Runs">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {verificationHistory.length > 0 ? (
                verificationHistory.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      <Activity className="h-4 w-4 text-primary" />
                      {event.action.replace("_", " ")}
                    </div>
                    <div className="mt-2 text-[14px] font-semibold text-foreground">{event.detail}</div>
                    <div className="mt-2 text-[12px] text-muted">{new Date(event.occurredAt).toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                  No seat verification history has been recorded yet.
                </div>
              )}
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard eyebrow="Terminal" title="Terminal Info">
              {session ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { label: "EA Attached To", value: session.chartSymbol },
                      { label: "EA Version", value: session.eaVersion },
                      { label: "Seat Owner", value: session.ownerLabel ?? "Available" },
                      { label: "Terminal Alias", value: session.terminalAlias ?? "Unpaired" },
                      { label: "Server", value: session.server },
                      { label: "Instance ID", value: session.terminalInstanceId ?? "Pending pair" },
                      { label: "Poll Interval", value: `${session.pollIntervalMs}ms` },
                      { label: "Last Auth", value: session.lastAuthenticatedAt ? new Date(session.lastAuthenticatedAt).toLocaleString() : "Never" },
                    ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</div>
                      <div className="mt-2 text-[22px] font-semibold text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </SectionCard>

            <SectionCard eyebrow="Resources" title="Resources">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: `MT5 Drag-And-Drop Pack (${MT5_CONNECTOR_RELEASE.releaseTag})`, value: "Download .zip", href: "/downloads/mt5/KwantifyConnectorMT5-DragDrop.zip" },
                  { label: `Compiled MT5 EA (${MT5_CONNECTOR_RELEASE.releaseTag})`, value: "Download .ex5", href: "/downloads/mt5/KwantifyConnectorEA.ex5" },
                  { label: "Connector Pack", value: "Download Guide", href: "/downloads/mt5/KwantifyConnectorPack.md" },
                  { label: "Validation Runbook", value: "Download Runbook", href: "/downloads/mt5/KwantifyConnectorValidationRunbook.md" },
                  { label: `MT5 Source Pack (${MT5_CONNECTOR_RELEASE.releaseTag})`, value: "Download .zip", href: "/downloads/mt5/KwantifyConnectorMT5-Source.zip" },
                  { label: "Bridge Source", value: "Download .mq5", href: "/downloads/mt5/KwantifyConnectorBridge.mq5" },
                  { label: "JSON Helper", value: "Download .mqh", href: "/downloads/mt5/KwantifyConnectorJson.mqh" },
                  { label: "State Helper", value: "Download .mqh", href: "/downloads/mt5/KwantifyConnectorState.mqh" },
                  { label: "Command Helper", value: "Download .mqh", href: "/downloads/mt5/KwantifyConnectorCommand.mqh" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</div>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-[16px] font-semibold text-primary"
                    >
                      {item.value}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div
            ref={(node) => {
              focusRefs.current.security = node;
            }}
            className={sectionFocusClass(requestedFocusSection === "security")}
          >
          <SectionCard eyebrow="Security" title="Pairing And Secret Control">
            {session ? (
              <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Pairing Code", value: session.pairingCode },
                    { label: "Secret Hint", value: session.secretHint },
                    { label: "Last Paired", value: session.lastPairedAt ? new Date(session.lastPairedAt).toLocaleString() : "Never" },
                    { label: "Last Authenticated", value: session.lastAuthenticatedAt ? new Date(session.lastAuthenticatedAt).toLocaleString() : "Never" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</div>
                      <div className="mt-2 break-all text-[16px] font-semibold text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 rounded-2xl border border-border bg-surface/60 p-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Connector Actions</div>
                    <div className="mt-2 text-[13px] leading-6 text-muted">
                      Pair the MT5 seat once, rotate the shared secret when needed, or revoke the connector and force a fresh onboarding cycle. Signed-in operators no longer need a separate claim step; the first protected action links the seat automatically.
                    </div>
                  </div>
                  {securityMessage ? (
                    <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                      {securityMessage}
                    </div>
                  ) : null}
                  {securityError ? (
                    <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                      {securityError}
                    </div>
                  ) : null}
                  {!canManageSeat && seatAccess?.restrictionReason ? (
                    <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                      {needsViewerSignIn ? "Sign in to manage this MT5 seat." : seatAccess.restrictionReason}{" "}
                      {ownershipState === "available"
                        ? "Sign in to manage this seat. Once signed in, the first protected MT5 action will link it to your operator profile automatically."
                        : "Only the current owner can rotate secrets, revoke the seat, or run protected MT5 tests from here."}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    {ownershipState === "available" && needsViewerSignIn ? (
                      <Link
                        href={signInActionHref}
                        className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-[13px] font-semibold text-primary"
                      >
                        {browserOrigin !== seatPortalBaseUrl ? "Open Live Seat" : "Sign In To Manage"}
                      </Link>
                    ) : null}
                    <button
                      onClick={() => void runSecurityAction("rotate")}
                      disabled={!canManageSeat || securityAction !== null}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {securityAction === "rotate" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Rotate Secret
                    </button>
                    <button
                      onClick={() => void runSecurityAction("revoke")}
                      disabled={!canManageSeat || securityAction !== null}
                      className="inline-flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {securityAction === "revoke" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Revoke And Re-Pair
                    </button>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/50 p-3 text-[12px] text-muted">
                    <div className="font-medium text-foreground">Security endpoints</div>
                    <div className="mt-2 space-y-1 font-mono text-[11px] text-foreground">
                      <div>POST /api/connector/cfds/pair</div>
                      <div>POST /api/connector/cfds/rotate-secret</div>
                      <div>POST /api/connector/cfds/revoke</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </SectionCard>
          </div>

          <SectionCard eyebrow="Payloads" title="Exact MT5 EA Payload Contract">
            {examples ? (
              <div className="space-y-6">
                {pairingExample ? (
                  <div className="rounded-2xl border border-border bg-surface/60 p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Pairing Request Payload</span>
                      </div>
                      <div className="mt-3 text-[12px] text-muted">
                        First-time pairing call for an MT5 terminal before it is allowed to heartbeat, claim, or report.
                      </div>
                    </div>
                    <div className="text-[12px] text-muted">POST /api/connector/cfds/pair</div>
                    <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                      {JSON.stringify(pairingExample, null, 2)}
                    </pre>
                    <div className="overflow-hidden rounded-xl border border-border/80">
                      <table className="w-full text-[12px]">
                        <thead className="border-b border-border bg-panel/70 text-[10px] uppercase tracking-[0.18em] text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Field</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-3 py-2 text-left font-medium">Rule</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cfdPairingFieldDocs.map(([field, type, rule, detail]) => (
                            <tr key={field} className="border-b border-border/60 last:border-0 align-top">
                              <td className="px-3 py-3 font-semibold text-foreground">{field}</td>
                              <td className="px-3 py-3 text-muted">{type}</td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{rule}</div>
                                <div className="mt-1 text-muted">{detail}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-3">
                {[
                  {
                    key: "heartbeat" as const,
                    title: "Heartbeat Payload",
                    icon: Server,
                    body: examples.heartbeat,
                    endpoint: "POST /api/connector/cfds/heartbeat",
                  },
                  {
                    key: "claim" as const,
                    title: "Claim Request Payload",
                    icon: ScrollText,
                    body: examples.claim,
                    endpoint: "POST /api/connector/cfds/claim",
                  },
                  {
                    key: "ack" as const,
                    title: "Claim Ack Payload",
                    icon: ClipboardList,
                    body: examples.ack,
                    endpoint: "POST /api/connector/cfds/ack",
                  },
                  {
                    key: "report" as const,
                    title: "Execution Report Payload",
                    icon: CheckCircle2,
                    body: examples.report,
                    endpoint: "POST /api/connector/cfds/reports",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted">
                        <item.icon className="h-4 w-4 text-primary" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{item.title}</span>
                      </div>
                      <div className="mt-3 text-[12px] text-muted">{item.endpoint}</div>
                    </div>
                    <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                      {JSON.stringify(item.body, null, 2)}
                    </pre>
                    <div className="overflow-hidden rounded-xl border border-border/80">
                      <table className="w-full text-[12px]">
                        <thead className="border-b border-border bg-panel/70 text-[10px] uppercase tracking-[0.18em] text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Field</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-3 py-2 text-left font-medium">Rule</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cfdPayloadFieldDocs[item.key].map(([field, type, rule, detail]) => (
                            <tr key={field} className="border-b border-border/60 last:border-0 align-top">
                              <td className="px-3 py-3 font-semibold text-foreground">{field}</td>
                              <td className="px-3 py-3 text-muted">{type}</td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{rule}</div>
                                <div className="mt-1 text-muted">{detail}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] text-muted">
                  Contract rule: the MT5 EA should implement these payloads exactly as the first supported bridge shape.
                  If we later add socket transport, richer bracket instructions, or partial-close plans, that should create a new schema version rather than silently mutating this one.
                </div>

                {claimedCommandExample ? (
                  <div className="rounded-2xl border border-border bg-surface/60 p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-muted">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Claim Response Command</span>
                      </div>
                      <div className="mt-3 text-[12px] text-muted">
                        Object returned inside the claim response for the EA to execute locally in MT5.
                      </div>
                    </div>
                    <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                      {JSON.stringify(claimedCommandExample, null, 2)}
                    </pre>
                    <div className="overflow-hidden rounded-xl border border-border/80">
                      <table className="w-full text-[12px]">
                        <thead className="border-b border-border bg-panel/70 text-[10px] uppercase tracking-[0.18em] text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Field</th>
                            <th className="px-3 py-2 text-left font-medium">Type</th>
                            <th className="px-3 py-2 text-left font-medium">Rule</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cfdClaimedCommandFieldDocs.map(([field, type, rule, detail]) => (
                            <tr key={field} className="border-b border-border/60 last:border-0 align-top">
                              <td className="px-3 py-3 font-semibold text-foreground">{field}</td>
                              <td className="px-3 py-3 text-muted">{type}</td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-foreground">{rule}</div>
                                <div className="mt-1 text-muted">{detail}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard eyebrow="Bridge Behavior" title="MT5 EA Lifecycle Rules">
              <div className="space-y-4">
                {cfdLifecycleRules.map((rule, index) => (
                  <div key={rule.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-[12px] font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold text-foreground">{rule.title}</div>
                        <div className="mt-2 text-[13px] leading-6 text-muted">{rule.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Build Checklist" title="EA Implementation Priorities">
              <div className="space-y-4">
                {[
                  {
                    title: "Pair by KWANT ID",
                    body: "The EA should treat `kwantId` as its seat identity and reject commands for any other connector.",
                    icon: ShieldCheck,
                  },
                  {
                    title: "Authenticate every bridge call",
                    body: "Pair once, store the shared-secret token, and include it on heartbeat, claim, and report routes so the backend can trust the terminal.",
                    icon: KeyRound,
                  },
                  {
                    title: "Claim one command at a time",
                    body: "Start with a conservative one-command pull loop so duplicate fills stay hard to create while we validate the bridge.",
                    icon: ClipboardList,
                  },
                  {
                    title: "Report every terminal truth",
                    body: "Accepted, filled, rejected, and closed all need to return through the report route so the operator journal never goes blind.",
                    icon: CheckCircle2,
                  },
                  {
                    title: "Prefer MT5 trade events for final truth",
                    body: "The starter pack now begins using `OnTradeTransaction` for final fill and close confirmation so the bridge does not rely only on the immediate `CTrade` return path.",
                    icon: Workflow,
                  },
                  {
                    title: "Respect hedging vs netting mode",
                    body: "The starter pack now detects MT5 account mode and uses different close-selection behavior for netting versus hedging so ticket and position truth stays closer to the terminal’s actual rules.",
                    icon: Server,
                  },
                  {
                    title: "Treat partial reduction as its own lifecycle",
                    body: "Bridge v1.2 now distinguishes a partial reduction from a full close. The starter pack reports `reduced` separately and currently treats partial-close support as hedging-first instead of faking parity across all MT5 account modes.",
                    icon: ScrollText,
                  },
                  {
                    title: "Reduction is route-controlled",
                    body: "Partial reduction is no longer just implied by the signal side. CFD routes now need an explicit reduction policy so connectors can disable reduce flows or keep them hedging-first on purpose.",
                    icon: ShieldCheck,
                  },
                  {
                    title: "Reduction guardrails are split honestly",
                    body: "The platform can enforce minimum reduction size at intake, but minimum remaining size still depends on real terminal position state. That remaining-volume truth stays an MT5-side responsibility until deeper live reconciliation lands.",
                    icon: CheckCircle2,
                  },
                  {
                    title: "MT5 now enforces minimum remaining size",
                    body: "The starter EA now reads route-provided reduction guardrails and rejects partial reductions that would leave too little live volume before it ever reports a successful `reduced` lifecycle event.",
                    icon: ClipboardList,
                  },
                  {
                    title: "Trade events now own reduction truth",
                    body: "When lifecycle mode is enabled, the starter no longer treats an immediately visible post-partial position as a failure. `OnTradeTransaction` now decides whether the outcome is a valid `reduced` state, a full `closed` state, or a reduction warning if the remaining size came back materially different from the route expectation.",
                    icon: Workflow,
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      <item.icon className="h-4 w-4 text-primary" />
                      {item.title}
                    </div>
                    <div className="mt-3 text-[13px] leading-6 text-muted">{item.body}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard eyebrow="Implementation Pack" title="MT5 EA Build Path">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Setup Checklist
                </div>
                {cfdEaSetupChecklist.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[15px] font-semibold text-foreground">{item.title}</div>
                    <div className="mt-2 text-[13px] leading-6 text-muted">{item.detail}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <Workflow className="h-4 w-4 text-primary" />
                  Polling Loop
                </div>
                {cfdEaPollingLoop.map((item) => (
                  <div key={item.step} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-[12px] font-semibold text-primary">
                        {item.step}
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold text-foreground">{item.title}</div>
                        <div className="mt-2 text-[13px] leading-6 text-muted">{item.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {cfdEaMql5Guardrails.map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{item.title}</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">{item.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard eyebrow="Semantics" title="Bridge Schema And Command Rules">
            <div className="grid gap-4 xl:grid-cols-2">
              {cfdSemanticRules.map((rule) => (
                <div key={rule.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[15px] font-semibold text-foreground">{rule.title}</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">{rule.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div
            ref={(node) => {
              focusRefs.current.recovery = node;
            }}
            className={sectionFocusClass(requestedFocusSection === "recovery")}
          >
          <SectionCard eyebrow="Recovery" title="Recovered And Dead-Letter Operator Flow">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[13px] leading-6 text-muted">
                If MT5 restarts with an unreconciled in-flight command, the downloadable EA still protects against duplicate execution,
                but it now asks kwantify whether that old signal is still live before freezing the seat indefinitely.
                If the backend no longer has a live in-flight copy, or if the command has safely recycled back into the mailbox,
                the EA auto-clears the stale local latch and resumes polling on its own.
                Dead-letter commands below are the matching website-side review lane for commands that exhausted claim retries.
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-muted">
                Starter-pack operator path:
                <span className="block mt-2">
                  1. Leave <span className="font-semibold text-foreground">RecoverCommandOnStartup</span> on so the EA can first try reconciling against real MT5 position state and then fall back to the new server recovery check.
                </span>
                <span className="block mt-1">
                  2. Leave <span className="font-semibold text-foreground">ClearRecoveredCommandOnStartup</span> off during normal use. It is now just an explicit operator override, not the everyday path.
                </span>
                <span className="block mt-1">
                  3. Keep <span className="font-semibold text-foreground">ReportRecoveredCommandClear</span> on if you want manual startup clears to show up explicitly in kwantify when you intentionally discard a checkpoint.
                </span>
              </div>

              {recoveryMessage ? (
                <div className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                  {recoveryMessage}
                </div>
              ) : null}
              {recoveryError ? (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                  {recoveryError}
                </div>
              ) : null}

              {deadLetters.length > 0 ? (
                deadLetters.map((command) => (
                  <div key={command.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-[15px] font-semibold text-foreground">
                          {command.terminalSymbol} | {command.signal.signalId}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">{command.deadLetterReason}</div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted">
                          {command.action.replace("_", " ")} | retries {command.retryCount} | {new Date(command.deadLetteredAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => void runDeadLetterAction(command.id, "retry")}
                          disabled={!canManageSeat || recoveryAction !== null}
                          className="rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {recoveryAction === `retry:${command.id}` ? "Retrying..." : "Retry Intentionally"}
                        </button>
                        <button
                          onClick={() => void runDeadLetterAction(command.id, "dismiss")}
                          disabled={!canManageSeat || recoveryAction !== null}
                          className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {recoveryAction === `dismiss:${command.id}` ? "Dismissing..." : "Dismiss"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                  No dead-letter commands need review for this connector seat right now.
                </div>
              )}
            </div>
          </SectionCard>
          </div>

          <SectionCard eyebrow="History" title="Connection History">
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="border-b border-border bg-surface/70 text-[11px] uppercase tracking-[0.2em] text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Account</th>
                    <th className="px-4 py-3 text-left font-medium">Broker</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">EA Version</th>
                    <th className="px-4 py-3 text-left font-medium">Connected From</th>
                    <th className="px-4 py-3 text-left font-medium">Connected To</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row: CfdConnectionHistoryRow) => (
                    <tr key={row.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-4 font-semibold text-foreground">{row.accountNumber}</td>
                      <td className="px-4 py-4 text-muted">{row.broker}</td>
                      <td className="px-4 py-4 text-muted">{row.accountType}</td>
                      <td className="px-4 py-4 text-muted">{row.eaVersion}</td>
                      <td className="px-4 py-4 text-muted">{new Date(row.connectedFrom).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        {row.status === "active" ? (
                          <span className="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">Active</span>
                        ) : (
                          <span className="text-muted">{row.connectedTo ? new Date(row.connectedTo).toLocaleString() : "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div
            ref={(node) => {
              focusRefs.current.audit = node;
            }}
            className={sectionFocusClass(requestedFocusSection === "audit")}
          >
          <SectionCard eyebrow="Audit" title="Connector Admin History">
            <div className="space-y-3">
              {adminEvents.length > 0 ? (
                adminEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          <History className="h-4 w-4 text-primary" />
                          {event.action.replace("_", " ")}
                        </div>
                        <div className="mt-2 text-[14px] font-semibold text-foreground">{event.detail}</div>
                        <div className="mt-1 text-[12px] text-muted">Actor: {event.actor}</div>
                      </div>
                      <div className="text-[12px] text-muted">{new Date(event.occurredAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-surface/60 p-4 text-[12px] text-muted">
                  No admin events recorded yet for this MT5 seat.
                </div>
              )}
            </div>
          </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

