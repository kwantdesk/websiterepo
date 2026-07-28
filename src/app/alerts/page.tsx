"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  FlaskConical,
  Mail,
  Pencil,
  Plus,
  Repeat,
  Send,
  Settings,
  Store,
  Trash2,
  Trophy,
  User,
  Wallet,
  Webhook,
  X,
} from "lucide-react";
import { loadChartAlerts, saveChartAlerts, type ChartAlertRecord } from "@/lib/chartAlerts";

type Tab = "active" | "history" | "briefings";
type AlertType = "price" | "indicator" | "strategy" | "natural";

const instruments = ["NAS100", "XAUUSD", "BTCUSD", "EURUSD", "GER40", "UK100", "S&P500"];
const savedStrategies: string[] = [];

type Briefing = {
  title: string;
  schedule: string;
  content: string;
  preview: string;
};

function Sidebar() {
  return <AppSidebar activeItem="alerts" />;
}

function Toggle({ enabled, onClick }: { enabled: boolean; onClick?: () => void }) {
  return <button onClick={onClick} className={`h-5 w-10 rounded-full transition-all ${enabled ? "bg-primary" : "bg-surface border border-border"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} /></button>;
}

function DeliveryIcons({ delivery }: { delivery: string[] }) {
  return (
    <div className="flex items-center gap-1.5 text-muted">
      {delivery.includes("app") && <Bell className="h-3.5 w-3.5" />}
      {delivery.includes("email") && <Mail className="h-3.5 w-3.5" />}
      {delivery.includes("telegram") && <Send className="h-3.5 w-3.5" />}
      {delivery.includes("webhook") && <Webhook className="h-3.5 w-3.5" />}
    </div>
  );
}

export default function AlertsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [showCreate, setShowCreate] = useState(false);
  const [alertType, setAlertType] = useState<AlertType>("price");
  const [telegram, setTelegram] = useState(false);
  const [webhook, setWebhook] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [alerts, setAlerts] = useState<ChartAlertRecord[]>([]);
  const [history, setHistory] = useState<(string | boolean)[][]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [briefingOn, setBriefingOn] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAlerts(loadChartAlerts());
  }, []);

  const updateAlerts = (nextAlerts: ChartAlertRecord[]) => {
    setAlerts(nextAlerts);
    saveChartAlerts(nextAlerts);
  };

  const toggleAlert = (id: string) => {
    updateAlerts(
      alerts.map((alert) =>
        alert.id === id
          ? { ...alert, state: alert.state === "active" ? "paused" : "active", updatedAt: new Date().toISOString() }
          : alert,
      ),
    );
  };

  const deleteAlert = (id: string) => {
    updateAlerts(alerts.filter((alert) => alert.id !== id));
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div>
            <div>
              <h1 className="text-[20px] font-semibold">Alerts</h1>
              <p className="text-[13px] text-muted">Price alerts, trade notifications & AI briefings</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background"><Plus className="h-4 w-4" />Create Alert</button>
          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground"><Send className="h-4 w-4 text-primary" />Connect Telegram</button>
        </header>

        <div className="border-b border-border px-6 pt-5">
          <div className="flex gap-2">
            {(["active", "history", "briefings"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-t-xl px-4 py-2 text-[13px] font-medium ${tab === item ? "border border-b-0 border-border bg-panel text-foreground" : "text-muted hover:text-foreground"}`}>{item === "active" ? "Active Alerts" : item === "history" ? "Alert History" : "AI Briefings"}</button>)}
          </div>
        </div>

        <div className="p-6">
          {tab === "active" && (
            <section className="grid gap-3">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-24 text-center">
                  <Bell className="mb-4 h-10 w-10 text-muted" />
                  <p className="max-w-md text-[15px] text-muted">No alerts set. Create your first alert.</p>
                </div>
              ) : null}
              {alerts.map((alert) => {
                const stateClass = alert.state === "active" ? "border-l-primary" : alert.state === "paused" ? "border-l-muted" : "border-l-danger";
                const delivery = [
                  alert.delivery.inApp ? "app" : null,
                  alert.delivery.email ? "email" : null,
                  alert.delivery.webhook ? "webhook" : null,
                ].filter(Boolean) as string[];
                return (
                  <div key={alert.id} className={`rounded-2xl border border-l-4 border-border ${stateClass} bg-panel p-4`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 rounded-full ${alert.state === "active" ? "bg-primary" : alert.state === "paused" ? "bg-muted" : "bg-danger"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold text-foreground">{alert.instrument}</span>
                          <span className="text-[14px] font-medium">{alert.conditionLabel}</span>
                          <DeliveryIcons delivery={delivery} />
                        </div>
                        <div className="mt-3 text-[12px] text-muted">
                          {alert.timeframe} · {new Date(alert.createdAt).toLocaleString()} · {alert.state === "active" ? "Armed" : alert.state === "paused" ? "Paused" : "Triggered"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle enabled={alert.state === "active"} onClick={() => toggleAlert(alert.id)} />
                        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => deleteAlert(alert.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "history" && (
            history.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-24 text-center">
                <Bell className="mb-4 h-10 w-10 text-muted" />
                <p className="max-w-md text-[15px] text-muted">No alert history yet.</p>
              </div>
            ) : (
            <section className="overflow-hidden rounded-2xl border border-border bg-panel">
              <table className="w-full text-[13px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted"><tr>{["Date/Time", "Alert", "Condition", "Price When Triggered", "Delivery Status"].map((h) => <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>{history.map((row) => <tr key={String(row[0]) + String(row[1])} className="border-b border-border/60 hover:bg-surface/30"><td className="px-5 py-3 font-mono text-muted">{row[0]}</td><td className="px-5 py-3 font-medium">{row[1]}</td><td className="px-5 py-3 text-muted">{row[2]}</td><td className="px-5 py-3 font-mono">{row[3]}</td><td className="px-5 py-3">{row[4] ? <span className="inline-flex items-center gap-1 text-primary"><Check className="h-4 w-4" />Succeeded</span> : <span className="inline-flex items-center gap-1 text-danger"><X className="h-4 w-4" />Failed</span>}</td></tr>)}</tbody>
              </table>
            </section>
            )
          )}

          {tab === "briefings" && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-panel p-5">
                <div className="mb-4 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Connect Telegram</h2><span className={`rounded-lg px-2 py-1 text-[11px] ${telegram ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{telegram ? "Connected" : "Not Connected"}</span></div>
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-2 text-[13px] text-muted">
                    <p>1. Open Telegram and search for @KwantifyBot</p>
                    <p>2. Send /start to the bot</p>
                    <p>3. Copy your Chat ID and paste it below</p>
                    <div className="mt-4 flex gap-2"><input placeholder="Telegram Chat ID" className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[13px] outline-none" /><button onClick={() => setTelegram(true)} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Test Connection</button></div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-4 text-[13px] text-muted"><div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /><span className="font-semibold text-foreground">Kwantify</span></div>Test message from Kwantify. Telegram alerts are ready.</div>
                </div>
              </div>

              {briefings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-panel/40 px-8 py-16 text-center">
                  <p className="max-w-md text-[15px] text-muted">No AI briefings configured yet.</p>
                </div>
              ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {briefings.map((briefing) => {
                  const enabled = !!briefingOn[briefing.title];
                  return (
                    <div key={briefing.title} className="rounded-2xl border border-border bg-panel p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div><h3 className="text-[15px] font-semibold">{briefing.title}</h3><p className="mt-1 text-[12px] text-muted">{briefing.schedule}</p></div>
                        <Toggle enabled={enabled} onClick={() => setBriefingOn((current) => ({ ...current, [briefing.title]: !enabled }))} />
                      </div>
                      {briefing.title.includes("Morning") || briefing.title.includes("Evening") ? <input type="time" defaultValue={briefing.title.includes("Morning") ? "07:00" : "20:00"} className="mb-3 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-[12px] text-muted outline-none" /> : null}
                      {briefing.title === "Drawdown Alert" && <div className="mb-3 flex items-center gap-2 text-[13px] text-muted">Threshold <input defaultValue="3" className="w-16 rounded-lg border border-border bg-surface px-2 py-1 font-mono outline-none" />%</div>}
                      <p className="mb-4 text-[13px] leading-6 text-muted">{briefing.content}</p>
                      <div className="rounded-2xl border border-border bg-background/50 p-4 font-mono text-[12px] leading-6 text-muted">
                        <div className="mb-2 flex items-center gap-2 font-sans"><span className="h-2 w-2 rounded-full bg-primary" /><span className="font-semibold text-foreground">Kwantify</span></div>
                        <pre className="whitespace-pre-wrap">{briefing.preview}</pre>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </section>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="max-h-[88vh] w-[520px] overflow-y-auto rounded-2xl border border-border bg-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Create Alert</h2><button onClick={() => setShowCreate(false)} className="text-muted hover:text-foreground"><X className="h-5 w-5" /></button></div>
            <div className="mb-5 flex flex-wrap gap-2">{(["price", "indicator", "strategy", "natural"] as const).map((type) => <button key={type} onClick={() => setAlertType(type)} className={`rounded-xl px-3 py-1.5 text-[12px] capitalize ${alertType === type ? "bg-primary text-background" : "bg-surface text-muted hover:text-foreground"}`}>{type === "natural" ? "Natural Language" : type}</button>)}</div>

            {alertType === "price" && <div className="space-y-3"><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{instruments.map((i) => <option key={i}>{i}</option>)}</select><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{["Crossing", "Crossing Up", "Crossing Down", "Greater Than", "Less Than", "Entering Channel", "Exiting Channel", "Moving Up %", "Moving Down %"].map((i) => <option key={i}>{i}</option>)}</select><div className="grid grid-cols-2 gap-2"><input placeholder="Value / upper bound" className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[13px] outline-none" /><input placeholder="Lower bound / bars" className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[13px] outline-none" /></div></div>}
            {alertType === "indicator" && <div className="space-y-3"><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{instruments.map((i) => <option key={i}>{i}</option>)}</select><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{["EMA 20", "EMA 50", "EMA 200", "RSI 14", "ATR 14", "MACD"].map((i) => <option key={i}>{i}</option>)}</select><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{["Above", "Below", "Crossing Up", "Crossing Down"].map((i) => <option key={i}>{i}</option>)}</select><input placeholder="Value or another indicator" className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[13px] outline-none" /></div>}
            {alertType === "strategy" && <div className="space-y-3"><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{savedStrategies.map((i) => <option key={i}>{i}</option>)}</select><select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none">{["Entry Signal", "Exit Signal", "Both"].map((i) => <option key={i}>{i}</option>)}</select><label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" defaultChecked /> Include entry price, SL, TP and direction</label></div>}
            {alertType === "natural" && <div className="space-y-3"><textarea rows={5} placeholder="Describe your alert in plain English..." className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none" /><div className="space-y-1 text-[12px] text-muted"><p>Alert me when NAS100 breaks above yesterday's high during London session</p><p>Notify me if XAUUSD drops more than 1% in 30 minutes</p><p>Tell me when RSI on BTCUSD 15m goes below 30</p></div><button onClick={() => setParsed(true)} className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[13px] text-primary">Parse with AI</button>{parsed && <div className="rounded-xl border border-border bg-background/40 p-3 text-[12px] text-muted">Parsed: BTCUSD · RSI 14 · 15m · Below 30 · Once per bar</div>}</div>}

            <div className="mt-6 space-y-3 border-t border-border pt-5">
              <div className="grid grid-cols-2 gap-2 text-[13px] text-muted">{["In-App Notification", "Email", "Telegram", "Webhook"].map((item) => <label key={item} className="flex items-center gap-2"><input type="checkbox" onChange={(e) => { if (item === "Telegram") setTelegram(e.target.checked); if (item === "Webhook") setWebhook(e.target.checked); }} />{item}</label>)}</div>
              {telegram && <div className="rounded-lg bg-surface px-3 py-2 text-[12px] text-primary">Telegram: Connected</div>}
              {webhook && <input placeholder="Webhook URL" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none" />}
              <div className="grid grid-cols-2 gap-2"><select className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option>Once</option><option>Once Per Bar</option><option>Every Time</option></select><select className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none"><option>1 day</option><option>1 week</option><option>1 month</option><option>No expiry</option></select></div>
              <textarea rows={3} defaultValue="Alert triggered — check your chart for details" className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-[13px] outline-none" />
              <button onClick={() => setShowCreate(false)} className="w-full rounded-xl bg-primary py-3 text-[13px] font-semibold text-background">Create Alert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
