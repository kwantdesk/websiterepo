"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import { readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

type LiquidityMapReplayControl = {
  tradingDate: string;
  timestampMs: number;
};

type LiquidityMapWorkspaceProps = {
  instrument: string;
  onInstrumentChange?: (instrument: string) => void;
  onActivate?: () => void;
  embedded?: boolean;
  active?: boolean;
  // GEX Vue session replay: when set, the map leaves the live stream and
  // renders the collector's archived book for this session up to this clock.
  replay?: LiquidityMapReplayControl | null;
};

function liquidityMapInstrument(root: unknown) {
  const normalized = typeof root === "string" ? root.trim().toUpperCase() : "";
  return /^[A-Z0-9]{1,4}$/.test(normalized) ? `${normalized}.v.0` : null;
}

function LiquidityMapWorkspace({
  instrument,
  onInstrumentChange,
  onActivate,
  embedded = false,
  active = true,
  replay = null,
}: LiquidityMapWorkspaceProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const styleCheckTimerRef = useRef<number | null>(null);
  const stylesReadyRef = useRef(false);
  const marketFrameReadyRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [replayStatus, setReplayStatus] = useState<{ state: string; detail: string } | null>(null);
  const lastReplayPostAtRef = useRef(0);
  const replayPostTimerRef = useRef<number | null>(null);
  const syncReadyState = useCallback(() => {
    setIsReady(stylesReadyRef.current && marketFrameReadyRef.current);
  }, []);
  const syncInstrument = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "kwantdesk:liquidity-map-symbol", symbol: instrument },
      window.location.origin,
    );
  }, [instrument]);
  const syncTheme = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "kwantdesk:liquidity-map-theme", theme: readStoredTheme() },
      window.location.origin,
    );
  }, []);
  const syncPerformancePriority = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "kwantdesk:liquidity-map-performance",
        embedded,
        active,
      },
      window.location.origin,
    );
  }, [active, embedded]);

  useEffect(() => {
    if (isReady) syncInstrument();
  }, [isReady, syncInstrument]);

  // Forward the replay clock, coalesced to at most one message per second —
  // the map's archive frames are 2s columns, so a faster drip is pure waste.
  useEffect(() => {
    const post = (payload: { active: boolean; tradingDate?: string; timestampMs?: number }) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "kwantdesk:liquidity-map-replay", ...payload },
        window.location.origin,
      );
    };
    if (!replay) {
      if (replayPostTimerRef.current !== null) {
        window.clearTimeout(replayPostTimerRef.current);
        replayPostTimerRef.current = null;
      }
      setReplayStatus(null);
      if (isReady) post({ active: false });
      return;
    }
    if (!isReady) return;
    const send = () => {
      lastReplayPostAtRef.current = Date.now();
      post({ active: true, tradingDate: replay.tradingDate, timestampMs: replay.timestampMs });
    };
    const elapsed = Date.now() - lastReplayPostAtRef.current;
    if (elapsed >= 1_000) {
      send();
      return;
    }
    if (replayPostTimerRef.current !== null) window.clearTimeout(replayPostTimerRef.current);
    replayPostTimerRef.current = window.setTimeout(() => {
      replayPostTimerRef.current = null;
      send();
    }, 1_000 - elapsed);
    return () => {
      if (replayPostTimerRef.current !== null) {
        window.clearTimeout(replayPostTimerRef.current);
        replayPostTimerRef.current = null;
      }
    };
  }, [isReady, replay]);

  useEffect(() => {
    syncPerformancePriority();
  }, [syncPerformancePriority]);

  useEffect(() => {
    const handleThemeChange = () => syncTheme();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) syncTheme();
    };
    window.addEventListener("kwantdesk:theme-change", handleThemeChange);
    window.addEventListener("storage", handleStorage);
    syncTheme();
    return () => {
      window.removeEventListener("kwantdesk:theme-change", handleThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncTheme]);

  useEffect(() => {
    const clearStyleCheck = () => {
      if (styleCheckTimerRef.current !== null) {
        window.clearTimeout(styleCheckTimerRef.current);
        styleCheckTimerRef.current = null;
      }
    };
    const revealWhenStyled = (attempt = 0) => {
      const iframeDocument = iframeRef.current?.contentDocument;
      const loadedStyleSheets = Array.from(iframeDocument?.styleSheets ?? [])
        .filter((sheet) => {
          try {
            return sheet.cssRules.length > 0;
          } catch {
            return false;
          }
        })
        .map((sheet) => sheet.href ?? "");
      const styled = loadedStyleSheets.some((href) => href.includes("/heatmap-app/styles.css"))
        && loadedStyleSheets.some((href) => href.includes("/heatmap-app/embed.css"));
      if (styled) {
        clearStyleCheck();
        stylesReadyRef.current = true;
        syncReadyState();
        return;
      }
      if (attempt < 80) {
        styleCheckTimerRef.current = window.setTimeout(() => revealWhenStyled(attempt + 1), 50);
      }
    };
    const handleMapReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "kwantdesk:liquidity-map-focus") {
        onActivate?.();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-theme-request") {
        syncTheme();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-replay-status") {
        setReplayStatus({
          state: String(event.data.state || ""),
          detail: String(event.data.detail || ""),
        });
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-styles-pending") {
        stylesReadyRef.current = false;
        syncReadyState();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-styles-ready") {
        clearStyleCheck();
        stylesReadyRef.current = true;
        syncReadyState();
        syncTheme();
        syncInstrument();
        syncPerformancePriority();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-data-ready") {
        marketFrameReadyRef.current = true;
        syncReadyState();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-ready") {
        const activeSymbol = typeof event.data.symbol === "string"
          ? event.data.symbol.trim().toUpperCase()
          : "";
        const nextInstrument = liquidityMapInstrument(activeSymbol);
        if (nextInstrument) {
          if (nextInstrument !== instrument) {
            writeProtectedItem("kwantdesk:liquidity-map-instrument:v1", nextInstrument);
            onInstrumentChange?.(nextInstrument);
          }
        }
        // The iframe installs its message listener asynchronously. Always
        // repeat the current account theme as part of the ready handshake so
        // an early onLoad message cannot leave Automatic Website Colours on
        // the map's fallback palette.
        syncTheme();
        syncPerformancePriority();
        clearStyleCheck();
        revealWhenStyled();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-preferences-changed") {
        const activeSymbol = typeof event.data.active === "string"
          ? event.data.active.trim().toUpperCase()
          : "";
        const nextInstrument = liquidityMapInstrument(activeSymbol);
        if (nextInstrument) {
          if (nextInstrument !== instrument) {
            writeProtectedItem("kwantdesk:liquidity-map-instrument:v1", nextInstrument);
            onInstrumentChange?.(nextInstrument);
          }
        }
        window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
      }
    };

    window.addEventListener("message", handleMapReady);
    return () => {
      clearStyleCheck();
      window.removeEventListener("message", handleMapReady);
    };
  }, [instrument, onActivate, onInstrumentChange, syncInstrument, syncPerformancePriority, syncReadyState, syncTheme]);

  return (
    <div className="relative isolate h-full min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-chart-background [contain:layout_paint_size]">
      <iframe
        ref={iframeRef}
        className="block h-full min-w-0 w-full max-w-full border-0 bg-chart-background"
        src="/heatmap-app/index.html"
        title="Kwant Desk liquidity heatmap"
        onLoad={() => {
          iframeRef.current?.contentDocument?.documentElement.setAttribute(
            "data-workspace-map",
            "true",
          );
          stylesReadyRef.current = false;
          marketFrameReadyRef.current = false;
          syncReadyState();
          syncTheme();
          syncPerformancePriority();
        }}
      />
      {!isReady ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          <KwantLoader
            title="Loading LIQ MAP"
            detail="Restoring live depth and recent liquidity history."
            className="h-full w-full bg-chart-background"
          />
        </div>
      ) : null}
      {replay && replayStatus && replayStatus.state !== "ready" ? (
        <div className={`pointer-events-none absolute left-2 top-2 z-10 border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] ${
          replayStatus.state === "unavailable"
            ? "border-danger/50 bg-panel/90 text-danger"
            : "border-warning/50 bg-panel/90 text-warning"
        }`}
        >
          {replayStatus.state === "building"
            ? `Replay pack building from the session archive · ${replayStatus.detail || "preparing"}`
            : replayStatus.state === "unavailable"
              ? `Replay unavailable · ${replayStatus.detail || "no recorded archive for this session"}`
              : "Loading recorded session…"}
        </div>
      ) : null}
      {replay && replayStatus?.state === "ready" ? (
        <div className="pointer-events-none absolute left-2 top-2 z-10 border border-primary/40 bg-panel/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary">
          Replay · recorded L3
        </div>
      ) : null}
    </div>
  );
}

export default memo(
  LiquidityMapWorkspace,
  (previous, next) => previous.instrument === next.instrument
    && previous.embedded === next.embedded
    && previous.active === next.active
    && previous.onInstrumentChange === next.onInstrumentChange
    && previous.replay?.tradingDate === next.replay?.tradingDate
    && previous.replay?.timestampMs === next.replay?.timestampMs,
);
