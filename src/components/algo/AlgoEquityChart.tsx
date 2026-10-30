"use client";

import { useState } from "react";
import type { AlgoEquityPoint } from "@/lib/algoWorkspace";

export const algoMoney = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function AlgoEquityChart({ points, drawdown = false, timeZone, onSelect }: {
  points: AlgoEquityPoint[]; drawdown?: boolean; timeZone: string; onSelect?: (timestamp: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map((p) => drawdown ? -p.drawdownPercent : p.equity);
  const low = drawdown ? Math.min(-.1, ...values) : Math.min(...values);
  const high = drawdown ? 0 : Math.max(...values);
  const span = Math.max(drawdown ? .1 : 1, high - low);
  const min = low - span * .08, max = drawdown ? 0 : high + span * .08;
  const x = (i: number) => 70 + i / Math.max(1, points.length - 1) * 905;
  const y = (value: number) => 16 + (max - value) / (max - min) * 140;
  const path = values.map((value, i) => x(i) + "," + y(value)).join(" ");
  const first = points[0], last = points[points.length - 1];
  const date = (t: number) => new Date(t).toLocaleDateString("en-GB", { timeZone, day: "2-digit", month: "short" });
  const active = hover === null ? null : points[hover];
  return <div className="algo-equity-plot">
    <div className="algo-plot-heading"><span>{drawdown ? "Underwater · drawdown" : "Equity curve"}</span>
      <span className="algo-plot-value">{active ? date(active.timestamp) + " · " + (drawdown ? (-active.drawdownPercent).toFixed(2) + "%" : algoMoney(active.equity)) : drawdown ? "Peak-to-trough %" : "Closed equity · USD"}</span>
    </div>
    <svg viewBox="0 0 1000 185" role="img" aria-label={drawdown ? "Drawdown chart" : "Equity curve"}
      onPointerMove={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const fraction = ((e.clientX - bounds.left) / bounds.width * 1000 - 70) / 905;
        setHover(Math.max(0, Math.min(points.length - 1, Math.round(fraction * (points.length - 1)))));
      }} onPointerLeave={() => setHover(null)}
      onClick={() => { if (active) onSelect?.(active.timestamp); }}>
      {[0, 1, 2, 3].map((i) => {
        const v = min + (max - min) * i / 3;
        return <g key={i}><line x1="70" x2="975" y1={y(v)} y2={y(v)} className="algo-grid-line" />
          <text x="60" y={y(v) + 4} textAnchor="end">{drawdown ? v.toFixed(1) + "%" : algoMoney(v)}</text></g>;
      })}
      <polygon points={"70," + (drawdown ? y(0) : 156) + " " + path + " 975," + (drawdown ? y(0) : 156)} className={drawdown ? "algo-dd-area" : "algo-equity-area"} />
      <polyline points={path} fill="none" className={drawdown ? "algo-dd-line" : "algo-equity-line"} vectorEffect="non-scaling-stroke" />
      {hover !== null && <><line x1={x(hover)} x2={x(hover)} y1="12" y2="160" className="algo-hover-line" />
        <circle cx={x(hover)} cy={y(values[hover])} r="4" className="algo-equity-dot" /></>}
      <text x="70" y="180">{date(first.timestamp)}</text><text x="975" y="180" textAnchor="end">{date(last.timestamp)}</text>
    </svg>
  </div>;
}
