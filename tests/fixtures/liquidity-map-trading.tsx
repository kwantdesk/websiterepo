// Isolated synthetic paper ledger: no account storage, broker calls or market feed.
import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import LiquidityMapTrading from "../../src/components/liquidity-map/LiquidityMapTrading";
import { createPaperTradingAccount } from "../../src/lib/paperAccounts";
import { emptyPaperTradingLedger, placePaperOrder, updatePaperProtection, updatePaperOrderPrice } from "../../src/lib/paperTrading";
const account = createPaperTradingAccount({ name: "ISOLATED TEST", balance: 100000, leverage: "1:30", instrument: "All CME Futures" });
const placed = placePaperOrder(emptyPaperTradingLedger(), [account], { accountId: account.id, symbol: "NQ", side: "buy", type: "market", quantity: 1, stopLoss: 29990, takeProfits: [{ price: 30010, quantity: 1 }] }, { bid: 30000, ask: 30000.25, timestamp: Date.now() });
const iframeHtml = `<style>html,body{margin:0;background:#08090c;color:#ddd;font:14px sans-serif;height:100%}div{padding:16px;border-bottom:1px solid #30343b}canvas{display:block;width:100%;height:520px;background:repeating-linear-gradient(#08090c 0px,#08090c 51px,#20242a 52px)}</style><div>ISOLATED LIQ MAP · synthetic price range 29,980–30,020</div><canvas></canvas><script>let scope='';function plot(){parent.postMessage({type:'kwantdesk:liquidity-map-plot',symbol:'NQ',left:0,top:49,width:innerWidth,height:520,topPrice:30020,bottomPrice:29980},parent.location.origin)}addEventListener('message',e=>{if(e.data.type==='kwantdesk:liquidity-map-trading'){scope=e.data.scope;plot()}});addEventListener('resize',plot);parent.postMessage({type:'kwantdesk:liquidity-map-ready'},parent.location.origin);plot();<\/script>`;
function Fixture() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ledger, setLedger] = useState(placed.ledger), [ticket, setTicket] = useState(false), [normal, setNormal] = useState(false), [dragging, setDragging] = useState(false), [replay, setReplay] = useState(false);
  const position = ledger.accounts[account.id].positions[0];
  return <main style={{ padding: 20, color: "var(--foreground)", background: "var(--background)", minHeight: "100vh" }}>
    <h1>LIQ MAP trading — isolated paper-trade test</h1><p>No live account or orders. Edits share the same in-memory ledger.</p>
    <button onClick={() => setNormal(!normal)}>Switch to {normal ? "LIQ MAP" : "normal chart mirror"}</button>{" "}
    <button onClick={() => setReplay(!replay)}>Replay {replay ? "ON" : "OFF"}</button>
    <p role="status">Shared ledger: SL {position.stopLoss} · TP {position.takeProfits[0]?.price} · dragging {String(dragging)}</p>
    {normal ? <section><h2>Normal chart ledger mirror</h2><p>Entry {position.entryPrice} · SL {position.stopLoss} · TP {position.takeProfits[0]?.price}</p></section> : <section style={{ position: "relative", width: ticket ? "70%" : "100%", height: 600 }}>
      <iframe title="Synthetic liquidity map" ref={iframeRef} srcDoc={iframeHtml} style={{ width: "100%", height: "100%", border: "1px solid #30343b" }}/>
      <LiquidityMapTrading iframeRef={iframeRef} instrument="NQ.v.0" active replay={replay} trading={{ paneId: "isolated", accountId: account.id, enabled: true, positions: ledger.accounts[account.id].positions, orders: ledger.accounts[account.id].orders, armedOrder: null,
        onOpenTicket: () => setTicket(true), onPick() {}, onCancelPick() {}, onQuote() {}, onDrag: (_, value) => setDragging(value),
        onProtection: (id, owner, update) => setLedger(current => updatePaperProtection(current, id, owner, update).ledger),
        onOrderPrice: (id, owner, price) => setLedger(current => updatePaperOrderPrice(current, id, owner, price)), onClose() {}, onCancelOrder() {},
      }}/>
    </section>}
    {ticket && <aside style={{ position: "absolute", top: 160, right: 20, width: "25%", border: "1px solid #30343b", padding: 15 }}><h2>Shared order ticket</h2><p>NQ · ISOLATED TEST</p><p>SL {position.stopLoss} · TP {position.takeProfits[0]?.price}</p></aside>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
