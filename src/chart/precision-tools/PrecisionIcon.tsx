import type { SVGProps } from "react";
import type { PrecisionToolGroupId, PrecisionToolId } from "./types";

type IconName = PrecisionToolId | PrecisionToolGroupId | "select" | "crosshair" | "global" | "hand" | "zoom" | "snap" | "objects" | "settings" | "import";

function anchors(points: Array<[number, number]>) {
  return points.map(([cx, cy], index) => <circle key={`${cx}-${cy}-${index}`} cx={cx} cy={cy} r="1.35" fill="currentColor" stroke="none" />);
}

export default function PrecisionIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.35, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let art: React.ReactNode;
  switch (name) {
    case "precision-line": art = <><path d="M4 18 20 6" {...shared}/>{anchors([[4,18],[20,6]])}</>; break;
    case "precision-ray": art = <><path d="m4 18 14-11" {...shared}/><path d="m16 5 4 1-1 4" {...shared}/>{anchors([[4,18],[16,9]])}</>; break;
    case "precision-horizontal-line": art = <><path d="M3 12h18" {...shared}/>{anchors([[7,12],[17,12]])}</>; break;
    case "precision-vertical-line": art = <><path d="M12 3v18" {...shared}/>{anchors([[12,7],[12,17]])}</>; break;
    case "precision-parallel-line": art = <><path d="M4 15 15 5M8 20 20 9" {...shared}/>{anchors([[4,15],[15,5],[8,20]])}</>; break;
    case "precision-rectangle": art = <><rect x="4" y="5" width="16" height="14" rx=".5" {...shared}/>{anchors([[4,5],[20,5],[4,19],[20,19]])}</>; break;
    case "precision-ellipse": art = <><ellipse cx="12" cy="12" rx="8" ry="6" {...shared}/>{anchors([[4,12],[20,12],[12,6],[12,18]])}</>; break;
    case "precision-text": art = <><path d="M5 6h14M12 6v13M8 19h8" {...shared}/>{anchors([[5,6],[19,6]])}</>; break;
    case "precision-pencil": art = <><path d="M4 18c3-8 4-11 7-8 2 2-3 5 0 7 3 2 4-8 6-6 2 2-1 5 3 5" {...shared}/>{anchors([[4,18],[20,16]])}</>; break;
    case "precision-fibonacci-retracement": art = <><path d="M4 5h16M4 9h16M4 14h16M4 19h16" {...shared}/>{anchors([[4,5],[20,19]])}</>; break;
    case "precision-fibonacci-projection": art = <><path d="m4 18 6-9 4 5 6-10M7 17h13M9 13h11M12 9h8" {...shared}/>{anchors([[4,18],[10,9],[14,14]])}</>; break;
    case "precision-fibonacci-fan": art = <><path d="M4 19 20 5M4 19l16-7M4 19l16 0" {...shared}/>{anchors([[4,19],[20,5]])}</>; break;
    case "precision-ruler": art = <><path d="m5 17 12-12 3 3L8 20Z" {...shared}/><path d="m10 14 2 2m1-5 2 2m1-5 2 2" {...shared}/>{anchors([[5,17],[17,5]])}</>; break;
    case "precision-volume-profile": art = <><path d="M5 4v16M5 6h8M5 9h13M5 12h10M5 15h15M5 18h7" {...shared}/>{anchors([[5,4],[5,20]])}</>; break;
    case "precision-anchored-vwap": art = <><path d="M4 17c4-2 5-9 9-7 3 1 3 6 7 4" {...shared}/><path d="M4 12c4-2 6-7 9-6 3 1 4 5 7 4" opacity=".45" {...shared}/>{anchors([[4,17]])}</>; break;
    case "precision-buy-calculator": art = <><path d="M5 19V9h14v10M8 9l4-5 4 5M5 14h14" {...shared}/>{anchors([[5,14],[12,9],[19,14]])}</>; break;
    case "precision-sell-calculator": art = <><path d="M5 5v10h14V5M8 15l4 5 4-5M5 10h14" {...shared}/>{anchors([[5,10],[12,15],[19,10]])}</>; break;
    case "geometry": art = <><path d="M4 18 20 6M4 9h9" {...shared}/>{anchors([[4,18],[20,6],[4,9]])}</>; break;
    case "shapes-notes": art = <><rect x="4" y="5" width="10" height="10" {...shared}/><ellipse cx="16" cy="15" rx="4" ry="4" {...shared}/>{anchors([[4,5],[14,15]])}</>; break;
    case "fibonacci": art = <><path d="M4 5h16M4 9h13M4 13h10M4 17h7" {...shared}/>{anchors([[4,5],[20,5]])}</>; break;
    case "analysis": art = <><path d="M4 18 9 12l4 3 7-10" {...shared}/><path d="M4 20h16" opacity=".4" {...shared}/>{anchors([[4,18],[20,5]])}</>; break;
    case "trade-calculators": art = <><path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5" {...shared}/>{anchors([[12,8],[12,16]])}</>; break;
    case "select": art = <><path d="m6 4 11 8-6 1 3 6-2 1-3-6-4 4Z" {...shared}/></>; break;
    case "crosshair": art = <><circle cx="12" cy="12" r="5" {...shared}/><path d="M12 2v5m0 10v5M2 12h5m10 0h5" {...shared}/></>; break;
    case "global": art = <><circle cx="12" cy="12" r="8" {...shared}/><path d="M4 12h16M12 4v16" {...shared}/></>; break;
    case "hand": art = <><path d="M7 12V7a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-3 6-7 6-3 0-5-2-7-5l-2-3a1.5 1.5 0 0 1 2-2Z" {...shared}/></>; break;
    case "zoom": art = <><rect x="4" y="5" width="12" height="11" {...shared}/><path d="m15 15 5 5" {...shared}/>{anchors([[4,5],[16,16]])}</>; break;
    case "snap": art = <><path d="M7 4v9a5 5 0 0 0 10 0V4M7 8h4m2 0h4" {...shared}/>{anchors([[7,4],[17,4]])}</>; break;
    case "objects": art = <><path d="m4 7 8-4 8 4-8 4Zm0 5 8 4 8-4M4 17l8 4 8-4" {...shared}/></>; break;
    case "settings": art = <><circle cx="12" cy="12" r="3" {...shared}/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" {...shared}/></>; break;
    default: art = <><path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5" {...shared}/></>; break;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>{art}</svg>;
}
