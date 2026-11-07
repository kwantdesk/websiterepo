import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Chart from "@/components/Chart";
import Control from "@/components/ChartIndicatorsControl";
import { defaultChartSettings } from "@/lib/chartSettings";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "@/lib/chartIndicatorConfig";
const candles = Array.from({ length: 320 }, (_, i) => ({ timestamp: 1793700000000 + i * 60000,
  open: 28000 + i % 25, close: 28000 + i % 33, high: 28040 + i % 37, low: 27950 + i % 21, volume: 100 + i }));
function Fixture() {
  const [instance, setInstance] = useState({ instanceId: "study", indicatorId: "relative-strength-index-rsi", enabled: false,
    settings: defaultIndicatorSettings("relative-strength-index-rsi") });
  const [request, setRequest] = useState(0);
  (window as any).setMomentumFixture = (id: string, area: string, enabled = true) => setInstance({ instanceId: "study", indicatorId: id, enabled,
    settings: { ...defaultIndicatorSettings(id), chartArea: area } });
  (window as any).momentumFixtureState = instance;
  return <>
    <button onClick={() => setRequest(v => v + 1)}>Study settings</button>
    <Control instrument="NQ" broker="Paper Trading" timeframe="1m" indicators={[instance]} chartSettings={defaultChartSettings}
      settingsOpenRequest={request ? { instanceId: "study", requestId: request } : undefined}
      onChange={next => setInstance(normalizeStoredIndicator(next[0]) as typeof instance)} />
    <div style={{ width: 1100, height: 650, position: "relative" }}>
      <Chart instrument="NQ" chartInstanceId="momentum-isolated" candles={candles} settings={defaultChartSettings}
        timeframe="1m" orderFlowHistoryReady={true} marketIsActive={false} indicators={[instance]} />
    </div>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
