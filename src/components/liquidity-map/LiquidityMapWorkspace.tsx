"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";

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

  useEffect(() => {
    setIsReady(false);
    syncInstrument();
  }, [syncInstrument]);

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
