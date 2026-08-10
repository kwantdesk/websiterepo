"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import { readStoredTheme, THEME_STORAGE_KEY } from "@/lib/theme";

type LiquidityMapWorkspaceProps = {
  instrument: string;
};

export default function LiquidityMapWorkspace({ instrument }: LiquidityMapWorkspaceProps) {
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
    syncInstrument();
  }, [syncInstrument]);

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
      if (event.data?.type !== "kwantdesk:liquidity-map-ready") return;
      setIsReady(true);
    };

    window.addEventListener("message", handleMapReady);
    return () => window.removeEventListener("message", handleMapReady);
  }, []);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-chart-background">
      <iframe
        ref={iframeRef}
        className="block h-full w-full border-0 bg-chart-background"
        src="/heatmap-app/index.html"
        title="Kwant Desk liquidity heatmap"
        onLoad={() => {
          setIsReady(false);
          syncTheme();
          syncInstrument();
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
