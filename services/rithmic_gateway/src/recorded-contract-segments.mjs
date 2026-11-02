import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = symbol => String(symbol).replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "");
// One continuous root uses one captured contract at each minute. A newer
// captured contract starts a new segment, retaining the earlier session prefix.
export function recordedContractSegments(dir, date, exchange, symbol) {
  const rows = [];
  try { for (const name of readdirSync(join(dir,"bars",date))) {
    const match = name.match(/^([A-Z0-9]+)-([A-Z0-9]+)\.json$/);
    if (!match || match[1] !== exchange || root(match[2]) !== root(symbol)) continue;
    try { const value = JSON.parse(readFileSync(join(dir,"bars",date,name),"utf8"));
      if (value.source !== "VPS recorded live trades" || !value.bars?.length) continue;
      rows.push({symbol:match[2],first:Math.min(...value.bars.map(b=>b[0])),volume:value.bars.reduce((n,b)=>n+Number(b[5]||0),0)});
    } catch {}
  }} catch {}
  const concrete=rows.some(row=>row.symbol!==root(symbol));
  const ordered=rows.filter(row=>!concrete||row.symbol!==root(symbol)).sort((a,b)=>a.first-b.first||a.volume-b.volume||a.symbol.localeCompare(b.symbol));
  return ordered.map((row,i)=>({symbol:row.symbol,start:i?row.first:-Infinity,end:ordered[i+1]?.first??Infinity}));
}
