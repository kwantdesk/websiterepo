"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Cable,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Radio,
  TimerReset,
  Wrench,
} from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { CFD_DEFAULT_PORTAL_BASE_URL, connectorToneClasses, type CfdConnectorOverview } from "@/lib/connectors";
import { cfdSemanticRules } from "@/lib/connectorContractDocs";

type CfdSignalResponse = Pick<CfdConnectorOverview, "samplePayload" | "signalInbox" | "generatedAt">;
type CfdOverviewResponse = CfdConnectorOverview & {
  viewer: {
    userId: string;
    label: string;
    mode: "supabase" | "local-dev";
  } | null;
};
type OwnershipFilter = "all" | "active" | "unused";
type ValidationStatus = "passed" | "needs_work";

function parseValidationEventDetail(detail: string) {
  const matched = detail.match(/^Validation (passed|needs work): (.+?)(?: - (.+))?$/i);
  if (!matched) return null;

  return {
    outcome: matched[1].toLowerCase() === "passed" ? ("passed" as const) : ("needs_work" as const),
    checkTitle: matched[2].trim(),
    note: matched[3]?.trim() ?? null,
  };
}

function getSeatValidationSummary({
  kwantId,
  adminEvents,
}: {
  kwantId: string;
  adminEvents: CfdConnectorOverview["adminEvents"];
}) {
  const latestByTitle = new Map<
    string,
    {
      outcome: ValidationStatus;
      occurredAt: string;
      note: string | null;
    }
  >();

  for (const event of adminEvents) {
    if (event.kwantId !== kwantId || event.action !== "validation_update") continue;
    const parsed = parseValidationEventDetail(event.detail);
    if (!parsed) continue;
    if (!latestByTitle.has(parsed.checkTitle)) {
      latestByTitle.set(parsed.checkTitle, {
        outcome: parsed.outcome,
        occurredAt: event.occurredAt,
        note: parsed.note,
      });
    }
  }

  const checks = Array.from(latestByTitle.values());
  const passed = checks.filter((item) => item.outcome === "passed").length;
  const needsWork = checks.filter((item) => item.outcome === "needs_work").length;
  const completed = checks.length;
  const total = 5;

  return {
    passed,
    needsWork,
    completed,
    total,
    ready: passed === total && needsWork === 0,
    latest:
      checks
        .slice()
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0] ?? null,
  };
}

function findCatalogEntry(overview: CfdConnectorOverview | null, code: string | null | undefined) {
  if (!overview || !code) return null;
  return overview.errorCatalog.find((item) => item.code === code) ?? null;
}

function getSeatSetupProgress({
  session,
  latestConnectionTest,
  latestSignalTest,
}: {
  session: CfdConnectorOverview["licenseSlots"][number]["sessions"][number] | undefined;
  latestConnectionTest: CfdConnectorOverview["adminEvents"][number] | undefined;
  latestSignalTest: CfdConnectorOverview["adminEvents"][number] | undefined;
}) {
  if (!session) {
    return {
      completed: 0,
      total: 5,
      ready: false,
    };
  }

  const checks = [
    session.pairingStatus === "paired",
    session.status !== "Auth refresh required" && Boolean(session.lastAuthenticatedAt),
    session.heartbeatState === "healthy",
    Boolean(latestConnectionTest),
    Boolean(latestSignalTest),
  ];

  return {
    completed: checks.filter(Boolean).length,
    total: checks.length,
    ready: checks.every(Boolean),
  };
}

function buildSeatDetailHref({
  kwantId,
  ownershipState,
  pairingStatus,
  status,
  heartbeatState,
  hasDeadLetters,
  latestExecutionIssueCode,
}: {
  kwantId: string;
  ownershipState?: "available" | "owned_by_viewer" | "owned_by_other";
  pairingStatus?: string;
  status?: string;
  heartbeatState?: string;
  hasDeadLetters: boolean;
  latestExecutionIssueCode?: string | null;
}) {
  const params = new URLSearchParams();

  if (ownershipState === "owned_by_other") {
    params.set("focus", "audit");
    params.set("lane", "admin");
  } else if (ownershipState === "available") {
    params.set("focus", "verification");
    params.set("lane", "verification");
  } else if (pairingStatus === "revoked") {
    params.set("focus", "troubleshooting");
    params.set("lane", "admin");
  } else if (status === "Auth refresh required") {
    params.set("focus", "troubleshooting");
    params.set("lane", "verification");
  } else if (heartbeatState && heartbeatState !== "healthy") {
    params.set("focus", "troubleshooting");
    params.set("lane", "verification");
  } else if (hasDeadLetters) {
    params.set("focus", "recovery");
    params.set("lane", "admin");
  } else if (latestExecutionIssueCode) {
    params.set("focus", "errors");
    params.set("lane", "execution");
  } else {
    params.set("focus", "verification");
    params.set("lane", "verification");
  }

  const suffix = params.toString();
  return suffix ? `/connector/cfds/${kwantId}?${suffix}` : `/connector/cfds/${kwantId}`;
}

function getSeatVisualState({
  session,
  hasDeadLetters,
  latestExecutionIssueCode,
}: {
  session?: CfdConnectorOverview["licenseSlots"][number]["sessions"][number];
  hasDeadLetters: boolean;
  latestExecutionIssueCode?: string | null;
}) {
  if (!session) {
    return {
      label: "Inactive",
      detail: "Code is unused and ready to connect",
      dotClass: "bg-danger",
      pillClass: "border-danger/25 bg-danger/10 text-danger",
    };
  }

  const ready =
    session.pairingStatus === "paired" &&
    session.heartbeatState === "healthy" &&
    session.status !== "Auth refresh required" &&
    !hasDeadLetters &&
    !latestExecutionIssueCode;

  if (ready) {
    return {
      label: "Ready",
      detail: "Connected and good to trade",
      dotClass: "bg-primary",
      pillClass: "border-primary/25 bg-primary/10 text-primary",
    };
  }

  return {
    label: "Attention",
    detail: "Connected, but something needs a check",
    dotClass: "bg-warning",
    pillClass: "border-warning/25 bg-warning/10 text-warning",
  };
}

const connectorSupportPlaybooks = [
  {
    title: "Allowed URL Missing",
    detail:
      "If MT5 never heartbeats or test connection keeps failing, the connector host is often missing from the WebRequest allow-list.",
    action: "Open MT5 Options, add the kwantify connector URL under Expert Advisors, then rerun Test Connection.",
  },
  {
    title: "Algo Trading Disabled",
    detail:
      "A seat can pair successfully and still reject live or synthetic orders because MT5 algo trading is turned off.",
    action: "Enable Algo Trading globally, confirm the EA is attached to the chart, and send a synthetic test signal again.",
  },
  {
    title: "Symbol Map Or Lot Step Wrong",
    detail:
      "Many broker rejections come from suffix mismatches or using a volume that does not align with the broker's lot-step rules.",
    action: "Check the route symbol, terminal symbol, min lot, lot step, and max lot before retrying the order.",
  },
  {
    title: "Stops Too Close",
    detail:
      "Indices and metals frequently reject stops or targets that violate freeze distance or broker minimum stop rules.",
    action: "Widen the stop/target distance, confirm the route uses the right points mode, and rerun the seat test.",
  },
];

const connectorOnboardingSteps = [
  {
    step: "01",
    title: "Copy a code",
    detail: "Paste the KWANT ID into the MT5 EA so the terminal knows exactly which seat it belongs to.",
  },
  {
    step: "02",
    title: "Install the EA",
    detail: "Drop the compiled EA into MT5, attach it to the chart, and keep Algo Trading enabled.",
  },
  {
    step: "03",
    title: "Whitelist kwantify",
    detail: "Add the connector URL to the MT5 WebRequest allow-list so heartbeat and claim calls can work.",
  },
  {
    step: "04",
    title: "Pair the seat",
    detail: "Let the terminal authenticate and start heartbeating against the right code.",
  },
  {
    step: "05",
    title: "Send one test trade",
    detail: "If it places and reports back cleanly, the seat is ready. Only open advanced detail if it does not.",
  },
];

const retailSyntaxExamples = [
  "88763665614933,buy,NAS100,risk=1,sl=20,tp=32",
  "88763665614933,sell,US30,vol_lots=0.2,sl_pips=80,tp_pips=140",
  "88763665614933,buylimit,EURUSD,vol_lots=0.5,entry_price=1.0825,sl_price=1.0795,tp_price=1.0885",
  "88763665614933,closelong,NAS100",
  "88763665614933,closelongpct,NAS100,partial_close_pct=50",
  "88763665614933,newsltplong,NAS100,sl_pips=25,tp_pips=50",
];

const retailFeatureBullets = [
  "One code per MT5 connection",
  "One-click test trade",
  "One-package buy / sell / pending / close syntax",
  "Broker SL/TP or Shadow Targets",
  "Recent signals and clear rejection reasons",
  "Advanced diagnostics only when you ask for them",
];

const DEFAULT_CONNECTION_CODES = [
  "KW88763665614931",
  "KW88763665614932",
  "KW88763665614933",
  "KW88763665614934",
  "KW88763665614935",
  "KW88763665614936",
  "KW88763665614937",
  "KW88763665614938",
  "KW88763665614939",
  "KW88763665614940",
];

export default function ConnectorCfdsPage() {
  const [overview, setOverview] = useState<CfdOverviewResponse | null>(null);
  const [signalData, setSignalData] = useState<CfdSignalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [showAdvancedOverview, setShowAdvancedOverview] = useState(false);
  const [selectedSeatKwantId, setSelectedSeatKwantId] = useState<string | null>(null);
  const [browserOrigin, setBrowserOrigin] = useState(CFD_DEFAULT_PORTAL_BASE_URL);
  const [modalAction, setModalAction] = useState<"test_signal" | null>(null);
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState("");
  const [copiedSeatCode, setCopiedSeatCode] = useState<string | null>(null);
  const [copyFallbackCode, setCopyFallbackCode] = useState<string | null>(null);

  const liveRegistryHref = `${CFD_DEFAULT_PORTAL_BASE_URL}/connector/cfds`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBrowserOrigin(window.location.origin);
    }
  }, []);

  async function copySeatCode(code: string) {
    setCopiedSeatCode(code);
    setCopyFallbackCode(null);

    window.setTimeout(() => {
      setCopiedSeatCode((current) => (current === code ? null : current));
    }, 2000);

    try {
      let copied = false;

      if (!copied && typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, code.length);

        try {
          copied = document.execCommand("copy");
        } catch {
          copied = false;
        } finally {
          document.body.removeChild(textarea);
        }
      }

      if (!copied && navigator.clipboard?.writeText) {
        try {
          copied = await Promise.race([
            navigator.clipboard.writeText(code).then(() => true).catch(() => false),
            new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 400)),
          ]);
        } catch {
          copied = false;
        }
      }

      if (!copied) {
        setCopiedSeatCode(null);
        setCopyFallbackCode(code);
        return;
      }
    } catch {
      setCopiedSeatCode(null);
      setCopyFallbackCode(code);
    }
  }

  async function runModalTestSignal(slot: NonNullable<typeof selectedSlot>) {
    const session = slot.sessions[0];
    if (!session) return;

    try {
      setModalAction("test_signal");
      setModalError("");
      setModalMessage("");

      const response = await fetch("/api/connector/cfds/test-signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectorId: session.id,
          kwantId: slot.kwantId,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.error || "Failed to send test trade.");
      }

      setModalMessage(
        json?.signalId
          ? `Test trade sent for ${slot.kwantId}. Signal ${json.signalId} is now in the bridge flow.`
          : `Test trade sent for ${slot.kwantId}.`
      );

      await load();
    } catch (nextError) {
      setModalError((nextError as Error).message);
    } finally {
      setModalAction(null);
    }
  }

  async function load(cancelled = false) {
    try {
      setLoading(true);
      setError("");

      const [overviewResponse, signalResponse] = await Promise.all([
        fetch("/api/connector/cfds", { cache: "no-store" }),
        fetch("/api/connector/cfds/signals", { cache: "no-store" }),
      ]);

      const overviewJson = await overviewResponse.json();
      const signalJson = await signalResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(overviewJson?.error || "Failed to load CFD connector overview.");
      }

      if (!signalResponse.ok) {
        throw new Error(signalJson?.error || "Failed to load CFD signal inbox.");
      }

      if (!cancelled) {
        setOverview(overviewJson);
        setSignalData(signalJson);
      }
    } catch (nextError) {
      if (!cancelled) {
        setError((nextError as Error).message);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    void load(cancelled);

    return () => {
      cancelled = true;
    };
  }, []);

  const routeProfiles = overview?.routeProfiles ?? [];
  const mappings = overview?.symbolMappings ?? [];
  const inbox = signalData?.signalInbox ?? overview?.signalInbox ?? [];
  const deadLetters = overview?.deadLetterCommands ?? [];
  const samplePayload = signalData?.samplePayload ?? overview?.samplePayload;
  const slots =
    overview?.licenseSlots ??
    DEFAULT_CONNECTION_CODES.map((kwantId, index) => ({
      id: `fallback-license-slot-${index + 1}`,
      kwantId,
      activeConnections: 0,
      maxConnections: 10,
      sessions: [],
      history: [],
    }));
  const adminEvents = overview?.adminEvents ?? [];
  const executionReports = overview?.executionReports ?? [];
  const totalActive = useMemo(() => slots.filter((slot) => Boolean(slot.sessions[0])).length, [slots]);
  const unusedInventorySeats = useMemo(() => slots.filter((slot) => !slot.sessions[0]).length, [slots]);

  const filteredSlots = useMemo(() => {
    const base = slots.filter((slot) => {
      const session = slot.sessions[0];
      if (ownershipFilter === "all") return true;
      if (ownershipFilter === "unused") return !session;
      return Boolean(session);
    });

    return [...base].sort((left, right) => {
      const leftSession = left.sessions[0];
      const rightSession = right.sessions[0];

      const leftReady = leftSession?.heartbeatState === "healthy" ? 0 : 1;
      const rightReady = rightSession?.heartbeatState === "healthy" ? 0 : 1;
      if (leftReady !== rightReady) return leftReady - rightReady;

      return left.kwantId.localeCompare(right.kwantId);
    });
  }, [ownershipFilter, slots]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.kwantId === selectedSeatKwantId) ?? null,
    [selectedSeatKwantId, slots]
  );

  if (error && !overview) {
    return (
      <div className="space-y-6">
        <SectionCard eyebrow="Connections" title="MT5 Connection Codes">
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-4 text-[13px] text-danger">
            {error}
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {browserOrigin !== CFD_DEFAULT_PORTAL_BASE_URL ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-[12px] text-primary">
          This CFD page is running on <span className="font-semibold">{browserOrigin}</span>, but MT5 seats poll and
          execute against <span className="font-semibold">{CFD_DEFAULT_PORTAL_BASE_URL}</span>.
          <div className="mt-3">
            <Link
              href={liveRegistryHref}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
            >
              Open Live CFD Seats
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12px] text-danger">{error}</div>
      ) : null}

      <SectionCard eyebrow="Connections" title="MT5 Connection Codes">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 px-4 py-3">
          <div>
            <div className="text-[15px] font-semibold text-foreground">Copy a code, connect MT5, then open the seat popup.</div>
            <div className="mt-1 text-[12px] text-muted">Green is ready. Orange needs attention. Red is still unused.</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-[12px] text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Syncing live seats
              </div>
            ) : null}
            <a
              href="/downloads/mt5/KwantifyConnectorMT5-DragDrop.zip"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-[12px] text-muted transition-colors hover:text-foreground"
            >
              Drag-And-Drop Pack
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="/downloads/mt5/KwantifyConnectorPack.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-[12px] text-muted transition-colors hover:text-foreground"
            >
              Install Guide
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <div className="rounded-full border border-border bg-panel px-3 py-1 text-[12px] text-muted">
              {totalActive} / {slots.length} In Use
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: "all", label: `All (${slots.length})` },
            { key: "active", label: `Active (${totalActive})` },
            { key: "unused", label: `Unused (${unusedInventorySeats})` },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setOwnershipFilter(item.key as OwnershipFilter)}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                ownershipFilter === item.key
                  ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                  : "border-border bg-panel text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredSlots.map((slot) => {
            const session = slot.sessions[0];
            const seatHasDeadLetters = deadLetters.some((command) => command.kwantId === slot.kwantId);
            const latestConnectionTest = adminEvents.find(
              (event) => event.kwantId === slot.kwantId && event.action === "test_connection"
            );
            const latestSignalTest = adminEvents.find(
              (event) => event.kwantId === slot.kwantId && event.action === "test_signal"
            );
            const latestExecutionIssue = executionReports.find(
              (report) => report.kwantId === slot.kwantId && report.status === "rejected"
            );
            const latestExecution = executionReports.find((report) => report.kwantId === slot.kwantId);
            const visualState = getSeatVisualState({
              session,
              hasDeadLetters: seatHasDeadLetters,
              latestExecutionIssueCode: latestExecutionIssue?.errorCode,
            });

            const ownershipState =
              !session?.ownerUserId
                ? "available"
                : overview?.viewer && session.ownerUserId === overview.viewer.userId
                  ? "owned_by_viewer"
                  : "owned_by_other";

            const detailHref = buildSeatDetailHref({
              kwantId: slot.kwantId,
              ownershipState,
              pairingStatus: session?.pairingStatus,
              status: session?.status,
              heartbeatState: session?.heartbeatState,
              hasDeadLetters: seatHasDeadLetters,
              latestExecutionIssueCode: latestExecutionIssue?.errorCode,
            });

            return (
              <div
                key={slot.id}
                className="rounded-2xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40 hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${visualState.dotClass}`} />
                      <div className="text-[18px] font-semibold text-foreground">{slot.kwantId}</div>
                    </div>
                    <div className="mt-1 text-[12px] text-muted">
                      {session
                        ? `${session.broker} - ${session.accountNumber} - ${session.mode === "demo" ? "Demo" : "Live"}`
                        : "Ready for a new MT5 terminal"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void copySeatCode(slot.kwantId);
                    }}
                    className="relative z-10 inline-flex items-center gap-1 rounded-full border border-border bg-panel px-3 py-1 text-[11px] text-muted transition-colors hover:text-foreground"
                  >
                    {copiedSeatCode === slot.kwantId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" />
                        Copied
                      </>
                    ) : copyFallbackCode === slot.kwantId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-warning" />
                        Select Below
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {copyFallbackCode === slot.kwantId ? (
                  <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-warning">Manual Copy</div>
                    <input
                      readOnly
                      value={slot.kwantId}
                      onFocus={(event) => event.currentTarget.select()}
                      onClick={(event) => event.currentTarget.select()}
                      className="mt-2 w-full rounded-lg border border-warning/30 bg-background/80 px-3 py-2 font-mono text-[13px] text-foreground outline-none"
                    />
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setSelectedSeatKwantId(slot.kwantId)}
                  className="mt-3 block w-full rounded-xl text-left"
                >
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${visualState.pillClass}`}>
                    {visualState.label}
                  </span>
                  {session ? (
                    <>
                      <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {session.chartSymbol}
                      </span>
                      <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                        {session.eaVersion ?? "EA pending"}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                      Unused
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-2 text-[12px] text-muted">
                  <div className="flex items-center justify-between gap-3">
                    <span>Status</span>
                    <span className="truncate text-right text-foreground">{visualState.detail}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Last signal</span>
                    <span className="truncate text-right text-foreground">
                      {latestExecution
                        ? `${latestExecution.status}${latestExecution.orderTicket ? ` - #${latestExecution.orderTicket}` : ""}`
                        : latestSignalTest
                          ? "Test sent"
                          : "No signals yet"}
                    </span>
                  </div>
                </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[12px] text-muted">
                      <Radio className={`h-4 w-4 ${session ? connectorToneClasses(session.tone) : "text-muted"}`} />
                      <span>{session ? "Open quick seat detail" : "Open setup detail"}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {filteredSlots.length === 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-panel/60 px-3 py-3 text-[12px] text-muted">
            No seats match the current filter.
          </div>
        ) : null}
      </SectionCard>

      {selectedSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-border bg-panel p-6 shadow-2xl">
            {(() => {
              const session = selectedSlot.sessions[0];
              const ownershipState =
                !session?.ownerUserId
                  ? "available"
                  : overview?.viewer && session.ownerUserId === overview.viewer.userId
                    ? "owned_by_viewer"
                    : "owned_by_other";
              const detailHref = buildSeatDetailHref({
                kwantId: selectedSlot.kwantId,
                ownershipState,
                pairingStatus: session?.pairingStatus,
                status: session?.status,
                heartbeatState: session?.heartbeatState,
                hasDeadLetters: deadLetters.some((command) => command.kwantId === selectedSlot.kwantId),
                latestExecutionIssueCode: executionReports.find(
                  (report) => report.kwantId === selectedSlot.kwantId && report.status === "rejected"
                )?.errorCode,
              });
              const routeProfile = routeProfiles.find((profile) => profile.connectorId === session?.id) ?? null;
              const recentSignals = inbox.filter((entry) => entry.connectorId === session?.id).slice(0, 4);
              const latestExecution = executionReports.find((report) => report.kwantId === selectedSlot.kwantId);
              const statusPill = getSeatVisualState({
                session,
                hasDeadLetters: deadLetters.some((command) => command.kwantId === selectedSlot.kwantId),
                latestExecutionIssueCode: executionReports.find(
                  (report) => report.kwantId === selectedSlot.kwantId && report.status === "rejected"
                )?.errorCode,
              });
              const activityHref = `/connector/cfds/${selectedSlot.kwantId}?focus=activity&lane=all`;

              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                    <div>
                      <div className="text-[30px] font-semibold tracking-tight text-foreground">
                        {session?.accountLabel ?? selectedSlot.kwantId}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-muted">
                        {session ? (
                          <>
                            <span>{session.accountNumber}</span>
                            <span className="text-border">,</span>
                            <span>{session.mode === "demo" ? "Demo" : "Live"}</span>
                            <span className="text-border">,</span>
                            <span>{session.broker}</span>
                          </>
                        ) : (
                          <span>Unused connector code</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSeatKwantId(null)}
                      className="rounded-2xl border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-muted transition-colors hover:text-foreground"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
                    <div className="text-[18px] font-semibold text-foreground">
                      Main Trading Account
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void runModalTestSignal(selectedSlot)}
                        disabled={!session || modalAction === "test_signal"}
                        className="rounded-2xl border border-border bg-surface px-5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {modalAction === "test_signal" ? "Sending Test Trade..." : "Send Test Trade"}
                      </button>
                      <Link
                        href={activityHref}
                        className="rounded-2xl border border-border bg-surface px-5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        Open Log
                      </Link>
                      <Link
                        href={detailHref}
                        className="rounded-2xl bg-primary px-5 py-3 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
                      >
                        Open Full Seat
                      </Link>
                    </div>
                  </div>

                  {modalMessage ? (
                    <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-[12px] text-primary">
                      {modalMessage}
                    </div>
                  ) : null}
                  {modalError ? (
                    <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                      {modalError}
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-foreground">
                        <Wrench className="h-4 w-4 text-primary" />
                        <span>EA Settings</span>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="grid gap-4 sm:grid-cols-2 text-[13px]">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Pyramiding</div>
                          <div className="mt-1 font-semibold text-foreground">
                            {routeProfile ? (routeProfile.maxOpenPositions > 1 ? "On" : "Off") : "Off"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Close On Reverse</div>
                          <div className="mt-1 font-semibold text-foreground">
                            {routeProfile ? (routeProfile.sidePolicy === "long_short" ? "On" : "Off") : "Off"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Partial Close</div>
                          <div className="mt-1 font-semibold text-foreground">
                            {routeProfile?.reductionPolicy === "hedging_only" ? "On" : "Off"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Max Open Positions</div>
                          <div className="mt-1 font-semibold text-foreground">{routeProfile?.maxOpenPositions ?? 1}</div>
                        </div>
                      </div>
                    </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-foreground">
                        <Activity className="h-4 w-4 text-primary" />
                        <span>Activity Log</span>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface/60 p-4">
                        <div className="text-[15px] font-semibold text-foreground">Recent Signals</div>
                        <div className="mt-4 space-y-3">
                          {recentSignals.length > 0 ? (
                            recentSignals.map((entry) => (
                              <div key={entry.id} className="border-l border-border pl-3">
                                <div className="text-[11px] text-muted">{new Date(entry.occurredAt).toLocaleString()}</div>
                                <div className="mt-1 text-[13px] text-foreground">{entry.detail}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-[12px] text-muted">No recent signals yet.</div>
                          )}
                        </div>
                        <div className="mt-4">
                          <Link href={activityHref} className="text-[13px] font-semibold text-primary">
                            View full log
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-foreground">
                        <Cable className="h-4 w-4 text-primary" />
                        <span>Terminal Info</span>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="grid gap-4 sm:grid-cols-2 text-[13px]">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">EA Attached To</div>
                          <div className="mt-1 font-semibold text-foreground">{session?.chartSymbol ?? "Not paired"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">EA Version</div>
                          <div className="mt-1 font-semibold text-foreground">{session?.eaVersion ?? "Not paired"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Heartbeat</div>
                          <div className="mt-1 font-semibold text-foreground">{session?.heartbeatState ?? "Not paired"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Latest Ticket</div>
                          <div className="mt-1 font-semibold text-foreground">{latestExecution?.orderTicket ?? "-"}</div>
                        </div>
                      </div>
                    </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-foreground">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <span>Resources</span>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="grid gap-4 sm:grid-cols-2 text-[13px]">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">MT5 Guide</div>
                          <a
                            href="/downloads/mt5/KwantifyConnectorPack.md"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block font-semibold text-primary"
                          >
                            EA Guide
                          </a>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">Syntax Reference</div>
                          <a
                            href="/downloads/mt5/KwantifyConnectorValidationRunbook.md"
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block font-semibold text-primary"
                          >
                            Syntax Guide
                          </a>
                        </div>
                      </div>
                    </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void copySeatCode(selectedSlot.kwantId)}
                        className="rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] font-semibold text-muted transition-colors hover:text-foreground"
                      >
                        Copy Code
                      </button>
                      <Link
                        href={detailHref}
                        className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/10"
                      >
                        Disconnect / Manage
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] text-muted">
                        {session?.lastHeartbeatAt
                          ? `Updated ${new Date(session.lastHeartbeatAt).toLocaleString()}`
                          : "Waiting for terminal heartbeat"}
                      </span>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
                        Bridge: {statusPill.label}
                      </span>
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
                        EA Paired: {session?.pairingStatus === "paired" ? "On" : "Off"}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          onClick={() => setShowAdvancedOverview((current) => !current)}
          className="rounded-2xl border border-border bg-surface px-5 py-3 text-[14px] font-semibold text-muted"
        >
          {showAdvancedOverview ? "Hide Advanced Connector Detail" : "Show Advanced Connector Detail"}
        </button>
      </div>

      {showAdvancedOverview ? (
        <>
          <SectionCard eyebrow="Get Started" title="MT5 Setup In Five Steps">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {connectorOnboardingSteps.map((item) => (
                <div key={item.step} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{item.step}</div>
                  <div className="mt-2 text-[15px] font-semibold text-foreground">{item.title}</div>
                  <div className="mt-2 text-[12px] leading-6 text-muted">{item.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard eyebrow="Alert Syntax" title="Trader-Friendly Signal Format">
              <div className="rounded-2xl border border-border bg-panel/70 p-4">
                <div className="text-[12px] text-muted">
                  Keep the alert readable for the trader. The connector should accept PineConnector-style strings and
                  translate them into MT5 execution without the user needing to think in payload contracts.
                </div>
                <div className="mt-4 space-y-2">
                  {retailSyntaxExamples.map((example) => (
                    <div
                      key={example}
                      className="rounded-xl border border-border bg-background/80 px-3 py-2 font-mono text-[12px] text-foreground"
                    >
                      {example}
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {retailFeatureBullets.map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-surface/60 px-3 py-2 text-[12px] text-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Downloads" title="What The Trader Actually Needs">
              <div className="grid gap-3">
                {[
                  {
                    title: "MT5 Drag-And-Drop Pack",
                    detail: "Compiled EA pack for normal MT5 install.",
                    href: "/downloads/mt5/KwantifyConnectorMT5-DragDrop.zip",
                  },
                  {
                    title: "Install Guide",
                    detail: "Simple MT5 setup guide for the trader.",
                    href: "/downloads/mt5/KwantifyConnectorPack.md",
                  },
                  {
                    title: "Validation + Syntax Notes",
                    detail: "Signal examples, settings, and connector behavior notes.",
                    href: "/downloads/mt5/KwantifyConnectorValidationRunbook.md",
                  },
                ].map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-border bg-surface/60 p-4 transition-colors hover:border-primary/40 hover:bg-surface"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold text-foreground">{item.title}</div>
                        <div className="mt-1 text-[12px] text-muted">{item.detail}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </a>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <SectionCard eyebrow="Routing" title="Route Profiles and Symbol Maps">
              <div className="space-y-3">
                {routeProfiles.map((profile) => {
                  const mapping = mappings.find(
                    (item) => item.connectorId === profile.connectorId && item.platformSymbol === profile.symbol
                  );
                  return (
                    <div key={profile.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold text-foreground">{profile.name}</div>
                          <div className="mt-1 text-[12px] text-muted">
                            {profile.strategyScope} {"->"} {profile.symbol} / {profile.terminalSymbol}
                          </div>
                        </div>
                        <div className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] font-medium text-muted">
                          {profile.sizingMode === "fixed_lots"
                            ? `${profile.sizingValue} lots`
                            : `${profile.sizingValue}% risk`}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          `Sides: ${profile.sidePolicy.replace("_", " ")}`,
                          `Dedup: ${profile.duplicateWindowSeconds}s`,
                          `Max positions: ${profile.maxOpenPositions}`,
                          `Stops: ${profile.stopMode}`,
                          `Targets: ${profile.targetMode}`,
                          mapping ? `Lots: ${mapping.minLot}-${mapping.maxLot} step ${mapping.lotStep}` : "Mapping missing",
                        ].map((pill) => (
                          <span key={pill} className="rounded-full border border-border bg-panel px-2.5 py-1 text-[11px] text-muted">
                            {pill}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Errors" title="Error Center">
              <div className="space-y-3">
                {overview?.errorCatalog.map((item) => (
                  <div key={item.code} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
                      <Wrench className="h-4 w-4 text-primary" />
                      {item.scope} · {item.code}
                    </div>
                    <div className="mt-2 text-[13px] text-foreground">{item.title}</div>
                    <div className="mt-1 text-[12px] text-muted">{item.detail}</div>
                    <div className="mt-2 text-[11px] text-muted">Operator action: {item.operatorAction}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard eyebrow="Inbox" title="Signal Journal">
              <div className="space-y-3">
                {inbox.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">
                          {entry.strategyId} · {entry.signalId}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">{entry.detail}</div>
                      </div>
                      <div className={`text-[11px] font-medium uppercase tracking-[0.2em] ${connectorToneClasses(entry.tone)}`}>
                        {entry.stage}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-muted">
                      {entry.connectorId} · {new Date(entry.occurredAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard eyebrow="Mailbox" title="Pending Commands And Reports">
              <div className="space-y-3">
                {(overview?.pendingCommands ?? []).map((command) => (
                  <div key={command.id} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">
                          {command.signal.strategyId} · {command.terminalSymbol}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">
                          {command.signal.side} {command.signal.quantity} · retries {command.retryCount}
                        </div>
                      </div>
                      <div className="rounded-full border border-border bg-panel px-3 py-1 text-[11px] text-muted">
                        {command.claimedAt ? "Claimed" : "Waiting for EA"}
                      </div>
                    </div>
                  </div>
                ))}

                {executionReports.slice(0, 6).map((report, index) => (
                  <div key={`${report.signalId}-${index}`} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">
                          {report.signalId} · {report.status.toUpperCase()}
                        </div>
                        <div className="mt-1 text-[12px] text-muted">
                          {report.terminalSymbol}
                          {report.executedPrice != null ? ` at ${report.executedPrice}` : ""}
                          {report.orderTicket ? ` · ticket ${report.orderTicket}` : ""}
                        </div>
                      </div>
                      <div
                        className={`text-[11px] font-medium uppercase tracking-[0.2em] ${connectorToneClasses(
                          report.status === "rejected" ? "error" : report.status === "closed" ? "ready" : "warning"
                        )}`}
                      >
                        {report.status}
                      </div>
                    </div>
                  </div>
                ))}

                {deadLetters.length > 0 ? (
                  <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-[12px] text-danger">
                    {deadLetters.length} command{deadLetters.length === 1 ? "" : "s"} currently need recovery review.
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard eyebrow="Schema" title="Signal Contract">
              <div className="rounded-2xl border border-border bg-panel/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[12px] text-muted">
                    This is the platform-native payload the CFD connector accepts before an MT5 EA claims the command.
                  </div>
                  <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                    {overview?.schemaVersion ?? "kwantify-cfd-connector/v1.2"}
                  </div>
                </div>
                <pre className="overflow-x-auto rounded-xl border border-border bg-background/80 p-4 text-[12px] leading-6 text-foreground">
                  {JSON.stringify(samplePayload, null, 2)}
                </pre>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {cfdSemanticRules.map((rule) => (
                    <div key={rule.title} className="rounded-xl border border-border/70 bg-surface/60 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{rule.title}</div>
                      <div className="mt-2 text-[12px] leading-6 text-muted">{rule.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard eyebrow="Support" title="Troubleshooting Playbooks">
              <div className="space-y-3">
                {connectorSupportPlaybooks.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                    <div className="text-[13px] font-semibold text-foreground">{item.title}</div>
                    <div className="mt-1 text-[12px] leading-6 text-muted">{item.detail}</div>
                    <div className="mt-2 text-[11px] text-muted">First move: {item.action}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard eyebrow="What Ships" title="Connector Foundations">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  icon: KeyRound,
                  title: "Connector Credentials",
                  detail: "Per-terminal auth, connector secret, environment mode, and account binding are formalized.",
                },
                {
                  icon: TimerReset,
                  title: "Heartbeat Monitor",
                  detail: "The EA heartbeat route lets the backend track stale and offline MT5 terminals.",
                },
                {
                  icon: Cable,
                  title: "Symbol Mapping Desk",
                  detail: "Per-broker prefix/suffix translation and lot constraints live in the backend contract.",
                },
                {
                  icon: Activity,
                  title: "Signal + Execution Log",
                  detail: "Signal intake validates and journals every command stage before the EA touches the trade.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="flex items-center gap-2 text-muted">
                    <item.icon className="h-4 w-4 text-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">{item.title}</span>
                  </div>
                  <div className="mt-3 text-[13px] text-foreground">{item.detail}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
