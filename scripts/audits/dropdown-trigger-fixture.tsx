import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Workspace from "@/components/KwantifyWorkspace";
import KwantSelect from "@/components/ui/KwantSelect";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import { GexMapDropdown } from "@/components/gex-map/GexMapSettingsDialog";
localStorage.setItem("olisa-chart-workspace-layout", "single");
localStorage.setItem("olisa-chart-workspace-panes", JSON.stringify([
  { id: "pane-1", symbol: "NQ.v.0", broker: "Databento", timeframe: "1m", period: "5D", watchlistKey: "Databento:NQ.v.0", content: "charts", locked: false },
]));
function Fixture() {
  const [choice, setChoice] = useState("one");
  const [zone, setZone] = useState("UTC");
  return <>
    <div style={{ height: 500 }}><Workspace section="charts" embedded /></div>
    <div style={{ display: "flex", gap: 20, padding: 16 }}>
      <KwantSelect aria-label="Fixture choice" value={choice} onChange={e => setChoice(e.target.value)} className="h-10 w-40 border border-border bg-surface px-3">
        <option value="one">One</option><option value="two">Two</option>
      </KwantSelect>
      <div data-timezone><TimeZoneSelect value={zone} onChange={setZone} /></div>
      <GexMapDropdown ariaLabel="Fixture Map choice" value={choice} onChange={setChoice} menuLabel="Fixture Map" menuWidth={220} options={[{ value: "one", label: "One" }, { value: "two", label: "Two" }]} />
      <button data-toggle aria-pressed="true" style={{ background: "rgb(40, 60, 90)", boxShadow: "0 0 12px red" }}>Selected toggle</button>
    </div>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
