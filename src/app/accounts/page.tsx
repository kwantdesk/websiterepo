"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import { loadSavedStrategiesRaw } from "@/lib/automation";
import {
  createPaperTradingAccount,
  formatMoney,
  loadPaperTradingAccounts,
  parseMoney,
  savePaperTradingAccounts,
  type PaperTradingAccountRecord,
} from "@/lib/paperAccounts";
import {
  emptyPaperTradingLedger,
  ensurePaperAccountLedger,
  loadPaperTradingLedger,
  PAPER_TRADING_LEDGER_EVENT,
  PAPER_TRADING_LEDGER_STORAGE_KEY,
  savePaperTradingLedger,
  summarizePaperAccount,
  type PaperTradingLedger,
} from "@/lib/paperTrading";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  DollarSign,
  FlaskConical,
  Info,
  Link as LinkIcon,
  Pause,
  Play,
  Plus,
  Repeat,
  Settings,
  Store,
  Trash2,
  Trophy,
  User,
  Wallet,
  X,
} from "lucide-react";

type Tab = "demo" | "brokers" | "router";
type SavedStrategy = { name?: string; title?: string };

type DemoAccount = PaperTradingAccountRecord & {
  winRate: string;
};

const brokers: Array<{
  name: string;
  logo: string;
  desc: string;
  soon?: boolean;
  info?: string;
  note?: string;
  connected?: boolean;
}> = [
  { name: "Tradovate", logo: "T", desc: "CME futures accounts and order routing", soon: true, info: "Connector scaffold ready" },
  { name: "Rithmic Direct", logo: "R", desc: "CME futures through an approved Rithmic API connection", soon: true, info: "Requires broker and API approval" },
  { name: "Interactive Brokers", logo: "IB", desc: "Futures and multi-asset accounts", soon: true, info: "Connector scaffold ready" },
  { name: "NinjaTrader", logo: "NT", desc: "Futures accounts and execution", soon: true, info: "Connector scaffold ready" },
];

const connectedAccounts: string[][] = [];

const routes: {
  strategy: string;
  accounts: string[];
  status: string;
  statusClass: string;
  sizing: string[];
  signal: string;
}[] = [];

const executionLog: string[][] = [];

function Sidebar() {
  return <AppSidebar activeItem="accounts" orientation="horizontal" />;
}

function Sparkline({ points, positive = true }: { points: string; positive?: boolean }) {
  return (
    <svg viewBox="0 0 120 52" className="h-14 w-full">
      <polyline points={points} fill="none" stroke={positive ? "#00F5A0" : "#EF4444"} strokeWidth="2" />
      <line x1="0" x2="120" y1="44" y2="44" stroke="#27272A" />
    </svg>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-panel p-6 shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>("demo");
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [connectBroker, setConnectBroker] = useState<string | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [paperLedger, setPaperLedger] = useState<PaperTradingLedger>(() =>
    typeof window === "undefined" ? emptyPaperTradingLedger() : loadPaperTradingLedger());
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("$10,000");
  const [newAccountInstrument, setNewAccountInstrument] = useState("All CME Futures");
  const [newAccountLeverage, setNewAccountLeverage] = useState("1:30");
  const [newAccountStrategy, setNewAccountStrategy] = useState("Manual / No Strategy");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAccountId, setAdjustAccountId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [toast, setToast] = useState("");
  const [strategies, setStrategies] = useState<string[]>([]);
  const adjustAccount = accounts.find((account) => account.id === adjustAccountId);
  const adjustAccountSummary = adjustAccount ? summarizePaperAccount(paperLedger, adjustAccount) : null;
  const currentBalance = adjustAccountSummary?.balance ?? (adjustAccount ? parseMoney(adjustAccount.balance) : 0);
  const parsedAdjustAmount = Number(adjustAmount) || 0;
  const previewBalance = Math.min(1000000, Math.max(0, currentBalance + parsedAdjustAmount));

  /** Whether the saved accounts have been read yet. Until they have, nothing is written back. */
  const paperAccountsHydratedRef = useRef(false);

  useEffect(() => {
    const saved = loadPaperTradingAccounts();
    // Marked read even when nothing was stored: an empty store is a real
    // answer, and the save below must be allowed to record the first account
    // the trader creates.
    paperAccountsHydratedRef.current = true;
    if (!saved.length) return;
    setAccounts(saved.map((account) => ({ ...account, winRate: "0%" })));
    const reconciledLedger = saved.reduce(
      (ledger, account) => ensurePaperAccountLedger(ledger, account),
      loadPaperTradingLedger(),
    );
    savePaperTradingLedger(reconciledLedger);
    setPaperLedger(reconciledLedger);
  }, []);

  useEffect(() => {
    const syncLedger = () => setPaperLedger(loadPaperTradingLedger());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PAPER_TRADING_LEDGER_STORAGE_KEY) syncLedger();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(PAPER_TRADING_LEDGER_EVENT, syncLedger);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(PAPER_TRADING_LEDGER_EVENT, syncLedger);
    };
  }, []);

  useEffect(() => {
    // The same ordering trap as the charts workspace: this effect runs on
    // mount with the state as it was BEFORE the load effect's setState lands,
    // so without the guard it saves that starting value over the accounts on
    // disk.
    if (!paperAccountsHydratedRef.current) return;
    savePaperTradingAccounts(
      accounts.map(({ winRate: _winRate, ...account }) => account),
    );
  }, [accounts]);

  function openAdjustBalance(accountId: string) {
    setAdjustAccountId(accountId);
    setAdjustAmount("");
    setShowAdjustModal(true);
  }

  function applyBalanceAdjustment() {
    if (!adjustAccount) return;
    const nextBalance = Math.min(1000000, Math.max(0, currentBalance + parsedAdjustAmount));
    setAccounts((current) =>
      current.map((account) =>
        account.id === adjustAccount.id
          ? { ...account, balance: formatMoney(nextBalance), equity: formatMoney(nextBalance) }
          : account,
      ),
    );
    setPaperLedger((current) => {
      const ensured = ensurePaperAccountLedger(current, adjustAccount);
      const ledgerAccount = ensured.accounts[adjustAccount.id];
      const actualAdjustment = nextBalance - currentBalance;
      const next = {
        ...ensured,
        accounts: {
          ...ensured.accounts,
          [adjustAccount.id]: {
            ...ledgerAccount,
            startingBalance: Math.max(0, ledgerAccount.startingBalance + actualAdjustment),
            cashBalance: Math.max(0, ledgerAccount.cashBalance + actualAdjustment),
            updatedAt: Date.now(),
          },
        },
      };
      savePaperTradingLedger(next);
      return next;
    });
    setShowAdjustModal(false);
    setToast(`Balance updated to ${formatMoney(nextBalance)}`);
    window.setTimeout(() => setToast(""), 1800);
  }

  function handleCreateDemoAccount() {
    const trimmedName = newAccountName.trim();
    if (!trimmedName) return;
    const account = createPaperTradingAccount({
      name: trimmedName,
      balance: parseMoney(newAccountBalance),
      leverage: newAccountLeverage,
      instrument: newAccountInstrument,
      strategy: newAccountStrategy,
    });
    setAccounts((current) => [{ ...account, winRate: "0%" }, ...current]);
    setPaperLedger((current) => {
      const next = ensurePaperAccountLedger(current, account);
      savePaperTradingLedger(next);
      return next;
    });
    setShowDemoModal(false);
    setNewAccountName("");
    setNewAccountBalance("$10,000");
    setNewAccountInstrument("All CME Futures");
    setNewAccountLeverage("1:30");
    setNewAccountStrategy("Manual / No Strategy");
    setToast(`${account.name} created`);
    window.setTimeout(() => setToast(""), 1800);
  }

  useEffect(() => {
    const raw = loadSavedStrategiesRaw();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedStrategy[];
      const names = parsed.map((strategy) => strategy.name ?? strategy.title).filter(Boolean) as string[];
      if (names.length > 0) setStrategies(names);
    } catch {
      // Demo defaults are fine if local strategy storage is unavailable.
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></div>
            <div><h1 className="text-[20px] font-semibold">Accounts & Execution</h1><p className="text-[13px] text-muted">Manage accounts, forward test & connect brokers</p></div>
          </div>
          <button onClick={() => setShowDemoModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background"><Plus className="h-4 w-4" />New Demo Account</button>
          <button onClick={() => setTab("brokers")} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground"><LinkIcon className="h-4 w-4" />Connect Broker</button>
        </header>

        <div className="border-b border-border px-6 pt-5">
          <div className="flex gap-2">{(["demo", "brokers", "router"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-t-xl px-4 py-2 text-[13px] font-medium ${tab === item ? "border border-b-0 border-border bg-panel text-foreground" : "text-muted hover:text-foreground"}`}>{item === "demo" ? "Demo Accounts" : item === "brokers" ? "Connected Brokers" : "Strategy Router"}</button>)}</div>
        </div>

        <div className="space-y-6 p-6">
          {tab === "demo" && (
            <>
              <section className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-surface/30 p-3 text-[12px] text-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Adjust your demo account balance anytime. Use the Adjust Balance button to deposit or withdraw funds. Example: enter -2000 to simulate a withdrawal of $2,000.</span>
              </section>
              <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] text-muted">Forward test your strategies risk-free with up to 10 demo accounts. Each account simulates real market conditions with live price data. <button className="ml-2 text-primary hover:underline">Learn more</button></section>
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-24 text-center">
                  <Wallet className="mb-4 h-10 w-10 text-muted" />
                  <p className="max-w-md text-[15px] text-muted">Connect your first broker account.</p>
                </div>
              ) : (
              <section className="grid gap-4 xl:grid-cols-2">
                {accounts.map((account) => {
                  const summary = summarizePaperAccount(paperLedger, account);
                  const totalChange = summary.equity - summary.startingBalance;
                  const changePercent = summary.startingBalance > 0 ? totalChange / summary.startingBalance * 100 : 0;
                  const positive = totalChange >= 0;
                  return (
                    <div key={account.name} className="rounded-2xl border border-border bg-panel p-6 transition-colors hover:border-primary/20">
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div><h2 className="font-semibold">{account.name}</h2><div className="mt-2 flex items-center gap-2 text-[12px] text-muted"><span className={`h-2 w-2 rounded-full ${account.running ? "bg-primary" : "bg-zinc-500"}`} />{account.running ? "Running" : "Idle"} - {account.strategy}</div></div>
                        <span className="rounded-lg bg-surface px-2 py-1 text-[11px] text-primary">{account.instrument}</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-xl bg-background/40 p-3"><div className="text-[11px] text-muted">Starting balance</div><div className="font-mono text-lg">{formatMoney(summary.startingBalance)}</div></div>
                        <div className="rounded-xl bg-background/40 p-3"><div className="text-[11px] text-muted">Current balance</div><div className="font-mono text-lg">{formatMoney(summary.balance)}</div></div>
                        <div className="rounded-xl bg-background/40 p-3"><div className="text-[11px] text-muted">Equity</div><div className="font-mono text-lg">{formatMoney(summary.equity)} <span className={positive ? "text-primary" : "text-red-400"}>{changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%</span></div></div>
                        <div className="rounded-xl bg-background/40 p-3"><div className="text-[11px] text-muted">Open P&amp;L</div><div className={`font-mono ${summary.unrealizedPnl >= 0 ? "text-primary" : "text-red-400"}`}>{formatMoney(summary.unrealizedPnl)}</div><div className="text-[11px] text-muted">{summary.openPositions} open / {summary.workingOrders} working</div></div>
                        <div className="rounded-xl bg-background/40 p-3"><div className="text-[11px] text-muted">Closed P&amp;L</div><div className={`font-mono ${summary.realizedPnl >= 0 ? "text-primary" : "text-red-400"}`}>{formatMoney(summary.realizedPnl)}</div><div className="text-[11px] text-muted">{summary.closedTrades} exits</div></div>
                        <div className="rounded-xl bg-background/40 p-3"><div className="text-[11px] text-muted">Available funds</div><div className="font-mono">{formatMoney(summary.availableFunds)}</div><div className="text-[11px] text-muted">Margin {formatMoney(summary.marginUsed)}</div></div>
                      </div>
                      <div className="mt-4"><Sparkline points={account.points} positive={positive} /></div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-muted"><span className="rounded-lg bg-surface px-2 py-1">Win rate {summary.winRate.toFixed(1)}%</span><span className="rounded-lg bg-surface px-2 py-1">{summary.closedTrades} closed trades</span><span className="rounded-lg bg-surface px-2 py-1">Leverage {account.leverage}</span><span className="rounded-lg bg-surface px-2 py-1">Created {account.created}</span></div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {account.running ? ["View Trades", "Pause", "Settings", "Delete"].map((action) => <button key={action} className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted hover:text-foreground">{action}</button>) : <button className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-background">Assign Strategy</button>}
                        <button onClick={() => openAdjustBalance(account.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-muted hover:text-foreground"><DollarSign className="h-3.5 w-3.5 text-primary" />Adjust Balance</button>
                      </div>
                    </div>
                  );
                })}
              </section>
              )}
            </>
          )}

          {tab === "brokers" && (
            <>
              <section className="grid gap-4 lg:grid-cols-3">
                {brokers.map((broker) => (
                  <div key={broker.name} className={`rounded-2xl border border-border bg-panel p-6 text-center ${broker.soon ? "opacity-50" : ""}`}>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 font-mono text-lg text-primary">{broker.logo}</div>
                    <h2 className="font-semibold">{broker.name}</h2>
                    <p className="mt-2 min-h-10 text-[13px] text-muted">{broker.desc}</p>
                    {broker.note && <p className="mt-2 text-[12px] text-primary">{broker.note}</p>}
                    {broker.connected ? <div className="mt-4 space-y-3"><span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2 py-1 text-[12px] text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Connected</span><p className="text-[12px] text-muted">{broker.info}</p><button className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground">Disconnect</button></div> : broker.soon ? <span className="mt-4 inline-flex rounded-lg bg-surface px-3 py-2 text-[12px] text-muted">Coming Soon</span> : <button onClick={() => setConnectBroker(broker.name)} className="mt-4 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Connect</button>}
                  </div>
                ))}
              </section>
              <section className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Connected Accounts</h2><div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-[13px]"><thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><tr>{["Broker", "Account ID", "Balance", "Equity", "Leverage", "Status", "Actions"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium">{head}</th>)}</tr></thead><tbody>{connectedAccounts.map((row) => <tr key={row[1]} className="border-b border-border/60 last:border-0">{row.map((cell) => <td key={cell} className="px-4 py-3 font-mono">{cell}</td>)}<td className="px-4 py-3 text-primary"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary" />Connected</td><td className="px-4 py-3"><div className="flex gap-2"><button className="text-muted hover:text-foreground">View</button><button className="text-muted hover:text-foreground">Sync Trades</button><button className="text-red-400">Disconnect</button></div></td></tr>)}</tbody></table></div></section>
            </>
          )}

          {tab === "router" && (
            <>
              <section className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Route your strategies to multiple accounts simultaneously</h2><p className="mt-1 text-[13px] text-muted">PickMyTrade-style routing with per-account risk controls and execution status.</p></div><button onClick={() => setShowRouteModal(true)} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">New Route</button></section>
              {routes.length === 0 && executionLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-24 text-center">
                  <p className="max-w-md text-[15px] text-muted">No strategy routes yet. Create a route to forward signals to your accounts.</p>
                </div>
              ) : null}
              <section className="space-y-4">{routes.map((route) => <div key={route.strategy} className="rounded-2xl border border-border bg-panel p-5"><div className="flex flex-wrap items-center gap-3"><span className="rounded-xl bg-primary/10 px-3 py-2 text-[13px] text-primary">{route.strategy}</span><span className="text-primary">to</span><div className="flex flex-wrap gap-2">{route.accounts.map((account) => <span key={account} className="rounded-xl bg-surface px-3 py-2 text-[13px] text-foreground">{account}</span>)}</div><span className={`ml-auto rounded-lg px-2 py-1 text-[12px] ${route.statusClass}`}>{route.status}</span></div><div className="mt-4 grid gap-2 md:grid-cols-3">{route.sizing.map((item) => <div key={item} className="rounded-xl bg-background/40 p-3 text-[12px] text-muted">{item}</div>)}</div><div className="mt-4 text-[13px] text-muted">Last signal: <span className="text-foreground">{route.signal}</span></div><div className="mt-4 flex gap-2">{["Edit", "Pause", "Delete"].map((action) => <button key={action} className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-muted hover:text-foreground">{action}</button>)}</div></div>)}</section>
              <section className="rounded-2xl border border-border bg-panel p-5"><h2 className="mb-4 font-semibold">Execution Log</h2><div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-[13px]"><thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><tr>{["Time", "Strategy", "Signal", "Direction", "Instrument", "Accounts", "Status"].map((head) => <th key={head} className="px-4 py-3 text-left font-medium">{head}</th>)}</tr></thead><tbody>{executionLog.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b border-border/60 last:border-0">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`px-4 py-3 ${cellIndex === 6 ? cell === "Failed" ? "text-red-400" : cell === "Partial" ? "text-orange-400" : "text-primary" : cellIndex > 3 ? "font-mono" : ""}`}>{cellIndex === 6 && cell === "Executed" ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />{cell}</span> : cellIndex === 6 && cell === "Failed" ? <span className="inline-flex items-center gap-1"><X className="h-3.5 w-3.5" />{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div></section>
            </>
          )}
        </div>
      </main>

      {showDemoModal && <Modal title="New Demo Account" onClose={() => setShowDemoModal(false)}><div className="space-y-3"><input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none" placeholder="Account name" /><select value={newAccountBalance} onChange={(event) => setNewAccountBalance(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]"><option>$10,000</option><option>$1,000</option><option>$5,000</option><option>$25,000</option><option>$50,000</option><option>$100,000</option><option>$150,000</option><option>$250,000</option></select><select value={newAccountInstrument} onChange={(event) => setNewAccountInstrument(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]"><option>All CME Futures</option><option>NQ / MNQ</option><option>ES / MES</option><option>RTY / M2K</option><option>YM / MYM</option><option>GC / MGC</option><option>CL / MCL</option><option>BTC / MBT</option><option>ETH / MET</option></select><select value={newAccountLeverage} onChange={(event) => setNewAccountLeverage(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]"><option>1:30</option><option>1:1</option><option>1:10</option><option>1:20</option><option>1:50</option><option>1:100</option></select><select value={newAccountStrategy} onChange={(event) => setNewAccountStrategy(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]"><option>Manual / No Strategy</option>{strategies.map((strategy) => <option key={strategy}>{strategy}</option>)}</select><button onClick={handleCreateDemoAccount} disabled={!newAccountName.trim()} className="w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">Create Account</button></div></Modal>}

      {showAdjustModal && adjustAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-[400px] rounded-2xl border border-border bg-panel p-6 shadow-2xl shadow-black/50">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">Adjust Balance</h2></div>
                <p className="mt-1 text-[13px] text-muted">{adjustAccount.name}</p>
              </div>
              <button onClick={() => setShowAdjustModal(false)} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-5 rounded-xl bg-background/40 p-4 text-center">
              <div className="text-[11px] uppercase tracking-wider text-muted">Current balance</div>
              <div className="mt-1 font-mono text-xl font-semibold">{formatMoney(currentBalance)}</div>
            </div>
            <label className="mb-2 block text-[12px] text-muted">Amount</label>
            <input
              value={adjustAmount}
              onChange={(event) => setAdjustAmount(event.target.value)}
              type="number"
              max={1000000}
              min={-currentBalance}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center font-mono text-[16px] outline-none focus:border-primary/40"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {[1000, 5000, 10000, 25000, -1000, -5000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setAdjustAmount(String(amount))}
                  className={`rounded-full border px-3 py-1.5 text-[12px] ${amount > 0 ? "border-primary/20 text-primary" : "border-danger/20 text-danger"}`}
                >
                  {amount > 0 ? "+" : "-"}${Math.abs(amount).toLocaleString()}
                </button>
              ))}
            </div>
            <div className={`mt-5 rounded-xl border border-border bg-background/40 p-3 text-center text-[13px] ${parsedAdjustAmount < 0 ? "text-danger" : "text-primary"}`}>
              New Balance: <span className="font-mono font-semibold">{formatMoney(previewBalance)}</span>
            </div>
            <div className="mt-4 rounded-xl bg-surface/50 p-3 text-[11px] leading-5 text-muted">Enter a positive amount to deposit or a negative amount to withdraw. Example: type 5000 to add $5,000 or -2000 to remove $2,000. Maximum balance: $1,000,000.</div>
            <div className="mt-5 space-y-2">
              <button onClick={applyBalanceAdjustment} className="w-full rounded-xl bg-primary py-2.5 font-semibold text-background">Apply</button>
              <button onClick={() => setShowAdjustModal(false)} className="w-full py-2 text-[13px] text-muted hover:text-foreground">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {connectBroker && <Modal title={`Connect ${connectBroker}`} onClose={() => setConnectBroker(null)}><div className="space-y-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-mono text-primary">{connectBroker.slice(0, 2)}</div><div><div className="font-semibold">{connectBroker}</div><p className="text-[12px] text-muted">Follow the steps below, test the connection, then connect.</p></div></div><ol className="space-y-2 text-[13px] text-muted"><li>1. Open your broker API or platform settings.</li><li>2. Generate credentials with read, trade, and account permissions.</li><li>3. Paste credentials below and run a test connection.</li></ol>{connectBroker === "Capital.com" && <><input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="API Key" /><div className="flex rounded-xl border border-border bg-surface p-1"><button className="flex-1 rounded-lg bg-panel py-2 text-[13px]">Demo</button><button className="flex-1 rounded-lg py-2 text-[13px] text-muted">Live</button></div></>}{connectBroker === "Tradovate" && <><input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="Username" /><input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="Password" type="password" /><p className="text-[12px] text-primary">Connected through Kwantify - no API fees</p></>}{connectBroker === "MetaTrader 5" && <><input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="Server" /><input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="Login" /><input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="Password" type="password" /></>} {!["Capital.com", "Tradovate", "MetaTrader 5"].includes(connectBroker) && <input className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]" placeholder="API credentials" />}<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[12px] text-primary">Connection status: Ready to test</div><div className="flex gap-2"><button className="flex-1 rounded-xl border border-border bg-surface py-3 text-[13px] text-muted">Test Connection</button><button className="flex-1 rounded-xl bg-primary py-3 text-[13px] font-semibold text-background">Connect</button></div></div></Modal>}

      {showRouteModal && <Modal title="New Strategy Route" onClose={() => setShowRouteModal(false)}><div className="space-y-4"><select className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px]">{strategies.map((strategy) => <option key={strategy}>{strategy}</option>)}</select><div className="space-y-2">{["NAS100 Demo ($10K)", "Gold Demo ($5K)", "BTC Demo ($25K)", "Capital.com Live", "Tradovate Demo"].map((account) => <label key={account} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-[13px]"><input type="checkbox" />{account}<select className="ml-auto rounded-lg border border-border bg-panel px-2 py-1 text-[12px]"><option>% of balance</option><option>fixed lots</option><option>fixed $</option></select><input className="w-16 rounded-lg border border-border bg-panel px-2 py-1 text-[12px]" placeholder="0.5" /></label>)}</div><div className="flex rounded-xl border border-border bg-surface p-1"><button className="flex-1 rounded-lg bg-panel py-2 text-[13px]">Immediate</button><button className="flex-1 rounded-lg py-2 text-[13px] text-muted">Confirm</button></div><button className="w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background">Create Route</button></div></Modal>}
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-primary/20 bg-panel px-4 py-3 text-[13px] text-primary shadow-2xl shadow-black/40">{toast}</div>}
    </div>
  );
}
