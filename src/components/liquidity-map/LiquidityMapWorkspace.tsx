"use client";

import { useCallback, useEffect, useRef } from "react";

type LiquidityMapWorkspaceProps = {
  instrument: string;
};

export default function LiquidityMapWorkspace({ instrument }: LiquidityMapWorkspaceProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const syncInstrument = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "kwantdesk:liquidity-map-symbol", symbol: instrument },
      window.location.origin,
    );
  }, [instrument]);

  useEffect(() => {
    syncInstrument();
  }, [syncInstrument]);

  return (
    <div className="h-full min-h-0 w-full overflow-hidden bg-chart-background">
      <iframe
        ref={iframeRef}
        className="block h-full w-full border-0 bg-chart-background"
        src="/heatmap-app/index.html"
        title="Kwant Desk liquidity heatmap"
        onLoad={syncInstrument}
      />
    </div>
  );
}
