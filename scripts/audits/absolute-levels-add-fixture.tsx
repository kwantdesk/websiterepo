import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Chart from "@/components/Chart";
import Control from "@/components/ChartIndicatorsControl";
import { defaultChartSettings } from "@/lib/chartSettings";
import { normalizeStoredIndicator } from "@/lib/chartIndicatorConfig";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
const candles = Array.from({ length: 120 }, (_, i) => ({ timestamp: 1793700000000 + i * 60000,
  open: 28000, close: 28000.25, high: 28001, low: 27999, volume: 100 }));
function Fixture() {
  const [instances, setInstances] = useState<ChartIndicatorInstance[]>([]);
  (window as any).absoluteFixtureState = instances;
  return <>
    <Control chartInstanceId="absolute-test" instrument="NQ" broker="Paper Trading" timeframe="1m"
      indicators={instances} chartSettings={defaultChartSettings} onChange={next => setInstances(next.map(normalizeStoredIndicator))} />
    <div style={{ width: 1100, height: 650, position: "relative" }}>
      <Chart instrument="NQ" chartInstanceId="absolute-test" candles={candles} settings={defaultChartSettings}
        timeframe="1m" orderFlowHistoryReady={true} marketIsActive={false} indicators={instances} />
    </div>
    {/* A different instrument beside the active chart must not seed its levels. */}
    <div style={{ width: 500, height: 200, position: "relative" }}>
      <Chart instrument="ES" chartInstanceId="other-chart" candles={candles.map(c=>({...c,close:5500,high:5501,low:5499,open:5500}))}
        settings={defaultChartSettings} timeframe="1m" marketIsActive={false} indicators={[]} />
    </div>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
