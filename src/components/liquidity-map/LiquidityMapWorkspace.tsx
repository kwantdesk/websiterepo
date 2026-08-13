"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import { readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";

type LiquidityMapWorkspaceProps = {
  instrument: string;
  onInstrumentChange?: (instrument: string) => void;
  onActivate?: () => void;
};

function liquidityMapInstrument(root: unknown) {
  const normalized = typeof root === "string" ? root.trim().toUpperCase() : "";
  return /^[A-Z0-9]{1,4}$/.test(normalized) ? `${normalized}.v.0` : null;
}

export default function LiquidityMapWorkspace({ instrument, onInstrumentChange, onActivate }: LiquidityMapWorkspaceProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const styleCheckTimerRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
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

  useEffect(() => {
    if (isReady) syncInstrument();
  }, [isReady, syncInstrument]);

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
        setIsReady(true);
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
      if (event.data?.type === "kwantdesk:liquidity-map-styles-pending") {
        setIsReady(false);
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-styles-ready") {
        clearStyleCheck();
        setIsReady(true);
        syncTheme();
        syncInstrument();
        return;
      }
      if (event.data?.type === "kwantdesk:liquidity-map-ready") {
        const activeSymbol = typeof event.data.symbol === "string"
          ? event.data.symbol.trim().toUpperCase()
          : "";
        const nextInstrument = liquidityMapInstrument(activeSymbol);
        if (nextInstrument) {
          if (nextInstrument !== instrument) {
            window.localStorage.setItem("kwantdesk:liquidity-map-instrument:v1", nextInstrument);
            onInstrumentChange?.(nextInstrument);
          }
        }
        // The iframe installs its message listener asynchronously. Always
        // repeat the current account theme as part of the ready handshake so
        // an early onLoad message cannot leave Automatic Website Colours on
        // the map's fallback palette.
        syncTheme();
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
            window.localStorage.setItem("kwantdesk:liquidity-map-instrument:v1", nextInstrument);
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
  }, [instrument, onActivate, onInstrumentChange, syncInstrument, syncTheme]);

  return (
    <div className="relative isolate h-full min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-chart-background [contain:layout_paint_size]">
      <iframe
        ref={iframeRef}
        className="block h-full min-w-0 w-full max-w-full border-0 bg-chart-background"
        src="/heatmap-app/index.html"
        title="Kwant Desk liquidity heatmap"
        onLoad={() => {
          setIsReady(false);
          syncTheme();
        }}
      />
      {!isReady ? (
        <KwantLoader
          title="Loading LIQ MAP"
          detail="Restoring live depth and recent liquidity history."
          className="absolute inset-0 z-10 h-full w-full bg-chart-background"
        />
      ) : null}
    </div>
  );
}
