"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import { readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";

type LiquidityMapWorkspaceProps = {
  instrument: string;
  onInstrumentChange?: (instrument: string) => void;
};

function liquidityMapInstrument(root: unknown) {
  const normalized = typeof root === "string" ? root.trim().toUpperCase() : "";
  return /^[A-Z0-9]{1,4}$/.test(normalized) ? `${normalized}.v.0` : null;
}

export default function LiquidityMapWorkspace({ instrument, onInstrumentChange }: LiquidityMapWorkspaceProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    const handleMapReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
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
        setIsReady(true);
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
    return () => window.removeEventListener("message", handleMapReady);
  }, [instrument, onInstrumentChange]);

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
