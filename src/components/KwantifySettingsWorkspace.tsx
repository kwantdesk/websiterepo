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
  CreditCard,
  FlaskConical,
  Globe,
  KeyRound,
  Laptop,
  Phone,
  QrCode,
  Repeat,
  Settings,
  Store,
  Trophy,
  User,
  Video,
  Wallet,
} from "lucide-react";
import { defaultTheme, resetTheme, saveTheme as saveAppTheme, type ThemeColors } from "@/lib/theme";
import { defaultChartSettings, extractUserChartSettings, loadStoredChartSettings, mergeChartSettingsIntoTheme, saveStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import { createClient } from "@/lib/supabase";
import { usagePlans } from "@/lib/usagePlans";

type SettingsTab =
  | "Public profile"
  | "Privacy preferences"
  | "Account settings"
  | "Active sessions"
  | "Theme & Colors"
  | "Chart defaults"
  | "Subscriptions"
  | "Payment methods"
  | "Billing history"
  | "Alerts delivery"
  | "Email subscriptions";

const navSections: { title: string; items: SettingsTab[] }[] = [
  { title: "Profile and Privacy", items: ["Public profile", "Privacy preferences"] },
  { title: "Account and Security", items: ["Account settings", "Active sessions"] },
  { title: "Appearance", items: ["Theme & Colors", "Chart defaults"] },
  { title: "Billing", items: ["Subscriptions", "Payment methods", "Billing history"] },
  { title: "Notifications", items: ["Alerts delivery", "Email subscriptions"] },
];

const presetColors = ["#00F5A0", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#06B6D4", "#FFFFFF", "#71717A", "#000000"];

const themePresets: { name: string; colors: ThemeColors }[] = [
  { name: "Default Dark", colors: defaultTheme },
  { name: "Midnight Blue", colors: { ...defaultTheme, background: "#0A0F1A", primary: "#3B82F6", panel: "#0F1729", surface: "#1A2332", chartBackground: "#0A0F1A", candleUp: "#3B82F6" } },
  { name: "Emerald", colors: defaultTheme },
  { name: "Purple Haze", colors: { ...defaultTheme, background: "#0D0A12", primary: "#A855F7", panel: "#110E18", surface: "#1A1525", chartBackground: "#0D0A12", candleUp: "#A855F7" } },
  { name: "Crimson", colors: { ...defaultTheme, background: "#0F0A0A", primary: "#EF4444", panel: "#140E0E", surface: "#1F1818", chartBackground: "#0F0A0A", candleUp: "#EF4444" } },
  { name: "Ocean", colors: { ...defaultTheme, background: "#0A0F14", primary: "#06B6D4", panel: "#0E151C", surface: "#182028", chartBackground: "#0A0F14", candleUp: "#06B6D4" } },
  { name: "Monochrome", colors: { ...defaultTheme, background: "#0A0A0A", foreground: "#FFFFFF", primary: "#FFFFFF", panel: "#111111", surface: "#1A1A1A", chartBackground: "#0A0A0A", candleUp: "#FFFFFF", candleDown: "#71717A" } },
  { name: "Sunset", colors: { background: "#0F0A07", foreground: "#FAFAFA", primary: "#F59E0B", secondary: "#F97316", accent: "#EF4444", muted: "#78716C", border: "#2C2520", card: "#151008", danger: "#EF4444", panel: "#0D0905", surface: "#1F1810", chartBackground: "#0E0906", gridColor: "#2A2318", crosshairColor: "rgba(245, 158, 11, 0.3)", candleUp: "#F59E0B", candleDown: "#EF4444" } },
  { name: "Matrix", colors: { background: "#000000", foreground: "#00FF41", primary: "#00FF41", secondary: "#00CC33", accent: "#00FF41", muted: "#005500", border: "#003300", card: "#001100", danger: "#FF0000", panel: "#000800", surface: "#001A00", chartBackground: "#000000", gridColor: "#002200", crosshairColor: "rgba(0, 255, 65, 0.2)", candleUp: "#00FF41", candleDown: "#FF0000" } },
  { name: "Arctic", colors: { background: "#0B1120", foreground: "#E2E8F0", primary: "#38BDF8", secondary: "#818CF8", accent: "#A78BFA", muted: "#64748B", border: "#1E293B", card: "#0F172A", danger: "#FB7185", panel: "#0D1424", surface: "#1E293B", chartBackground: "#0B1120", gridColor: "#1E293B", crosshairColor: "rgba(56, 189, 248, 0.3)", candleUp: "#38BDF8", candleDown: "#FB7185" } },
  { name: "Rose Gold", colors: { background: "#0F0A0C", foreground: "#FAFAFA", primary: "#F472B6", secondary: "#E879F9", accent: "#C084FC", muted: "#78716C", border: "#2D2226", card: "#150D10", danger: "#FB7185", panel: "#0D090B", surface: "#1F1518", chartBackground: "#0E090B", gridColor: "#2A1F23", crosshairColor: "rgba(244, 114, 182, 0.3)", candleUp: "#F472B6", candleDown: "#FB7185" } },
  { name: "Stealth", colors: { background: "#050505", foreground: "#A3A3A3", primary: "#737373", secondary: "#525252", accent: "#737373", muted: "#404040", border: "#1A1A1A", card: "#0A0A0A", danger: "#8B0000", panel: "#080808", surface: "#141414", chartBackground: "#050505", gridColor: "#141414", crosshairColor: "rgba(115, 115, 115, 0.2)", candleUp: "#A3A3A3", candleDown: "#525252" } },
];

const appColorFields: { key: keyof ThemeColors; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "panel", label: "Panel" },
  { key: "surface", label: "Surface" },
  { key: "card", label: "Card" },
  { key: "border", label: "Border" },
  { key: "foreground", label: "Foreground" },
  { key: "muted", label: "Muted" },
  { key: "primary", label: "Primary" },
  { key: "danger", label: "Danger" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
];

const chartColorFields: { key: keyof ChartSettings; label: string }[] = [
  { key: "backgroundColor", label: "Chart Background" },
  { key: "gridColor", label: "Grid Lines" },
  { key: "upColor", label: "Body Up" },
  { key: "downColor", label: "Body Down" },
  { key: "borderUpColor", label: "Border Up" },
  { key: "borderDownColor", label: "Border Down" },
  { key: "wickUpColor", label: "Wick Up" },
  { key: "wickDownColor", label: "Wick Down" },
];

function Sidebar() {
  return <AppSidebar activeItem="settings" />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button onClick={onChange} className={`h-5 w-10 rounded-full transition-all ${checked ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} /></button>;
}

function normalizeHex(value: string) {
  const clean = value.replace("#", "").trim();
  return /^[0-9A-Fa-f]{6}$/.test(clean) ? `#${clean.toUpperCase()}` : null;
}

function hexToRgb(value: string) {
  const normalized = normalizeHex(value) ?? "#00F5A0";
  return { r: parseInt(normalized.slice(1, 3), 16), g: parseInt(normalized.slice(3, 5), 16), b: parseInt(normalized.slice(5, 7), 16) };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function rgbToHsv(value: string) {
  const { r, g, b } = hexToRgb(value);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }
  return { h: Math.round((h * 60 + 360) % 360), s: max === 0 ? 0 : Math.round((delta / max) * 100), v: Math.round(max * 100) };
}

function hsvToHex(h: number, s: number, v: number) {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = value - chroma;
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => rgbToHsv(value));
  const [hex, setHex] = useState((normalizeHex(value) ?? "#00F5A0").replace("#", ""));
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("olisa-recent-colors");
    return saved ? JSON.parse(saved) : [];
  });
  const hueColor = hsvToHex(hsv.h, 100, 100);

  function applyColor(color: string) {
    const normalized = normalizeHex(color);
    if (!normalized) return;
    onChange(normalized);
    setHex(normalized.replace("#", ""));
    setHsv(rgbToHsv(normalized));
    const next = [normalized, ...recentColors.filter((item) => item !== normalized)].slice(0, 12);
    setRecentColors(next);
    localStorage.setItem("olisa-recent-colors", JSON.stringify(next));
  }

  function updateGradient(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = { ...hsv, s: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)), v: Math.min(100, Math.max(0, 100 - ((event.clientY - rect.top) / rect.height) * 100)) };
    setHsv(next);
    applyColor(hsvToHex(next.h, next.s, next.v));
  }

  return (
    <div className="relative flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] text-muted">{value}</span>
        <button onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }} className="h-8 w-8 rounded-lg border border-border" style={{ backgroundColor: value }} />
      </div>
      {open && (
        <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-50 w-[260px] rounded-2xl border border-border bg-panel p-4 shadow-2xl">
          <div onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateGradient(event); }} onPointerMove={(event) => { if (event.buttons === 1) updateGradient(event); }} className="relative mb-3 h-[140px] cursor-crosshair rounded-xl border border-border" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}>
            <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.7)]" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
          </div>
          <input type="range" min="0" max="360" value={hsv.h} onChange={(event) => { const next = { ...hsv, h: Number(event.target.value) }; setHsv(next); applyColor(hsvToHex(next.h, next.s, next.v)); }} className="mb-3 h-2 w-full cursor-pointer appearance-none rounded-full" style={{ background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }} />
          <div className="mb-3 flex items-center gap-3"><div className="h-8 w-8 rounded-lg border border-border" style={{ backgroundColor: value }} /><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-muted">#</span><input value={hex} onChange={(event) => { setHex(event.target.value); if (normalizeHex(event.target.value)) applyColor(event.target.value); }} className="w-full rounded-lg border border-border bg-surface py-1.5 pl-7 pr-3 font-mono text-[13px] outline-none focus:border-primary/40" /></div></div>
          <div className="mb-3 grid grid-cols-6 gap-2">{presetColors.map((color) => <button key={color} onClick={() => applyColor(color)} className="h-6 w-6 rounded-lg border border-border" style={{ backgroundColor: color }} />)}</div>
          {recentColors.length > 0 && <div><div className="mb-2 text-[11px] text-muted">Recent</div><div className="flex flex-wrap gap-2">{recentColors.map((color) => <button key={color} onClick={() => applyColor(color)} className="h-6 w-6 cursor-pointer rounded-lg border border-border" style={{ backgroundColor: color }} />)}</div></div>}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>("Public profile");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    online: true,
    chat: true,
    authApp: false,
    sms: false,
    suspicious: true,
    grid: true,
    volume: true,
    inApp: true,
    email: true,
    weekly: true,
    performance: true,
    features: true,
    community: false,
    promo: false,
  });
  const [themeSettings, setThemeSettings] = useState<ThemeColors>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const saved = localStorage.getItem("olisa-theme");
    return saved ? { ...defaultTheme, ...JSON.parse(saved) } : defaultTheme;
  });
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => loadStoredChartSettings());
  const [fontSize, setFontSize] = useState("Default");
  const [chartDefaults, setChartDefaults] = useState(() => ({
    type: "Candles",
    timeframe: "5m",
    instrument: "NAS100",
    crosshair: "Normal",
  }));

  useEffect(() => {
    const savedDefaults = localStorage.getItem("olisa-chart-defaults");
    if (savedDefaults) setChartDefaults(JSON.parse(savedDefaults));
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const loadProfile = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        setProfileName("");
        setProfileEmail("");
        setProfileUsername("");
        return;
      }
      setProfileName(
        (user.user_metadata?.display_name as string | undefined) ??
          (user.user_metadata?.full_name as string | undefined) ??
          ""
      );
      setProfileEmail(user.email ?? "");
      setProfileUsername((user.user_metadata?.username as string | undefined) ?? "");
      const profileChartSettings = extractUserChartSettings(user);
      if (profileChartSettings) {
        setChartSettings(profileChartSettings);
        setThemeSettings((current) => mergeChartSettingsIntoTheme(current, profileChartSettings));
        saveStoredChartSettings(profileChartSettings);
      }
    };

    loadProfile();
  }, [supabase]);

  useEffect(() => {
    saveAppTheme(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    saveStoredChartSettings(chartSettings);
  }, [chartSettings]);

  useEffect(() => {
    setThemeSettings((current) => mergeChartSettingsIntoTheme(current, chartSettings));
  }, [chartSettings]);

  function toggle(key: string) {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateThemeColor(key: keyof ThemeColors, color: string) {
    setThemeSettings((current) => ({ ...current, [key]: color }));
  }

  function updateChartColor(key: keyof ChartSettings, color: string) {
    setChartSettings((current) => {
      const next = { ...current, [key]: color };
      setThemeSettings((theme) => mergeChartSettingsIntoTheme(theme, next));
      return next;
    });
  }

  function applyThemePreset(theme: ThemeColors) {
    setThemeSettings(theme);
    setChartSettings((current) => ({
      ...current,
      backgroundColor: theme.chartBackground,
      gridColor: theme.gridColor,
      upColor: theme.candleUp,
      downColor: theme.candleDown,
      borderUpColor: theme.candleUp,
      borderDownColor: theme.candleDown,
      wickUpColor: theme.candleUp,
      wickDownColor: theme.candleDown,
    }));
    saveAppTheme(theme);
  }

  async function persistChartSettings(settings: ChartSettings) {
    if (!supabase) return;
    await supabase.auth.updateUser({
      data: {
        chartSettings: settings,
        chart_settings: settings,
      },
    });
  }

  async function saveThemeSettings() {
    const syncedTheme = mergeChartSettingsIntoTheme(themeSettings, chartSettings);
    setThemeSettings(syncedTheme);
    saveAppTheme(syncedTheme);
    saveStoredChartSettings(chartSettings);
    await persistChartSettings(chartSettings);
  }

  function resetThemeSettings() {
    resetTheme();
    const syncedTheme = mergeChartSettingsIntoTheme(defaultTheme, defaultChartSettings);
    setThemeSettings(syncedTheme);
    setChartSettings(defaultChartSettings);
    saveStoredChartSettings(defaultChartSettings);
  }

  function saveChartDefaults() {
    localStorage.setItem("olisa-chart-defaults", JSON.stringify({ ...chartDefaults, showVolume: toggles.volume, showGrid: toggles.grid }));
  }

  const input = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[13px] outline-none focus:border-primary/40";
  const secondaryButton = "rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted hover:text-foreground";
  const sectionTitle = "mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted";

  return (
    <main className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-border bg-panel p-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">{section.title}</div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button key={item} onClick={() => setActiveTab(item)} className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] ${activeTab === item ? "border-l-2 border-primary bg-surface font-medium text-foreground" : "text-muted hover:text-foreground"}`}>{item}</button>
              ))}
            </div>
          </div>
        ))}
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-semibold">{activeTab}</h1>
          <p className="mt-2 text-[13px] text-muted">Manage your Kwantify account, appearance, billing, and notifications.</p>

          {activeTab === "Public profile" && (
            <div className="mt-8 space-y-8">
              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className="mb-5 text-lg font-semibold">Picture and username</h2>
                <div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-semibold text-primary">{(profileName || profileUsername).charAt(0).toUpperCase() || <User className="h-7 w-7" />}</div><div><button className={secondaryButton}>Upload photo</button><p className="mt-2 text-[12px] text-muted">JPG, GIF, or PNG. Max 700KB, 4000px for any dimension.</p></div></div>
                <div className="mt-6 space-y-2 border-t border-border pt-5"><div className="text-[13px] text-muted">Username</div><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span><input className={`${input} pl-8`} placeholder="Enter your username" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} /></div></div>
              </section>
              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className="mb-5 text-lg font-semibold">Social and website links</h2>
                <div className="grid gap-3 md:grid-cols-2"><div className="relative"><span className="absolute left-4 top-3 text-[13px] text-muted">X</span><input className={`${input} pl-10`} placeholder="X profile" /></div><div className="relative"><Video className="absolute left-4 top-3 h-4 w-4 text-muted" /><input className={`${input} pl-10`} placeholder="YouTube channel" /></div><div className="relative"><span className="absolute left-4 top-3 text-[13px] text-muted">◎</span><input className={`${input} pl-10`} placeholder="Instagram profile" /></div><div className="relative"><Globe className="absolute left-4 top-3 h-4 w-4 text-muted" /><input className={`${input} pl-10`} placeholder="Website URL" /></div></div>
                <button className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-background">Save links</button>
              </section>
            </div>
          )}

          {activeTab === "Privacy preferences" && (
            <div className="mt-8 rounded-2xl border border-border bg-panel p-6">
              {[["Anyone can see your online status", "Others can view if you're online or your last activity.", "online"], ["Anyone can start a private chat with you", "Others can text you directly, even if you've never chatted before.", "chat"]].map(([title, helper, key]) => <div key={key} className="flex items-center justify-between border-b border-border py-5 first:pt-0"><div><div className="font-medium">{title}</div><p className="mt-1 text-[12px] text-muted">{helper}</p></div><Toggle checked={toggles[key]} onChange={() => toggle(key)} /></div>)}
              <div className="flex items-center justify-between pt-5"><div><div className="font-medium">Blocked users list</div><p className="mt-1 text-[12px] text-muted">Users from this list can't comment on your posts or message you.</p></div><button className={secondaryButton}>Show list</button></div>
            </div>
          )}

          {activeTab === "Account settings" && (
            <div className="mt-8 space-y-6">
              <section className="rounded-2xl border border-border bg-panel p-6"><h2 className={sectionTitle}>Sign-in credentials</h2><div className="space-y-4"><label className="block space-y-2"><span className="text-[13px] text-muted">Name</span><input className={input} placeholder="Enter your name" value={profileName} onChange={(e) => setProfileName(e.target.value)} /></label><label className="block space-y-2"><span className="text-[13px] text-muted">Email</span><input type="email" className={input} placeholder="Enter your email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} /></label><label className="block space-y-2"><span className="text-[13px] text-muted">Password</span><input type="password" className={input} placeholder="••••••••" value="" /></label></div></section>
              <section className="rounded-2xl border border-border bg-panel p-6"><h2 className={sectionTitle}>Two-factor authentication</h2><div className="space-y-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><QrCode className="h-4 w-4 text-muted" /><div><div>Authentication app</div><div className="text-[12px] text-muted">Google Authenticator, Authy</div></div></div><Toggle checked={toggles.authApp} onChange={() => toggle("authApp")} /></div><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted" />Text message</div><Toggle checked={toggles.sms} onChange={() => toggle("sms")} /></div><div className="flex items-center justify-between"><div className="flex items-center gap-3"><KeyRound className="h-4 w-4 text-muted" />Backup codes</div><button className={secondaryButton}>Generate new codes</button></div></div></section>
              <section className="rounded-2xl border border-border bg-panel p-6"><h2 className={sectionTitle}>Linked external accounts</h2>{["Google", "Apple", "Facebook"].map((name, index) => <div key={name} className="flex items-center justify-between border-b border-border py-4 last:border-0"><span>{name}</span><button className={secondaryButton}>{index === 0 ? "Remove" : "Connect"}</button></div>)}</section>
              <section className="rounded-2xl border border-danger/20 bg-panel p-6"><h2 className={sectionTitle}>Account deletion</h2><p className="text-[13px] text-muted">Deleting your account starts a 30 day process. You can cancel during that period.</p><button className="mt-4 text-[13px] font-semibold text-danger">Delete account</button></section>
            </div>
          )}

          {activeTab === "Active sessions" && (
            <div className="mt-8 rounded-2xl border border-border bg-panel p-6">
              <div className="mb-5 flex items-center justify-between"><div><div className="font-medium">Notifications about suspicious sign-ins</div><p className="mt-1 text-[12px] text-muted">Get notified when a new device signs in.</p></div><Toggle checked={toggles.suspicious} onChange={() => toggle("suspicious")} /></div>
              {[["PC, Windows 10", "May 18, 2026", "Sydney, AU", "192.168.1.12", "Chrome", true], ["Mac, Mac OS X", "May 15, 2026", "Melbourne, AU", "10.0.0.44", "Safari", false]].map(([device, date, location, ip, browser, current]) => <div key={String(device)} className="flex items-center justify-between border-t border-border py-4"><div className="flex items-center gap-3"><Laptop className="h-5 w-5 text-muted" /><div><div className="font-medium">{device}</div><div className="text-[12px] text-muted">{date} · {location} · {ip} · {browser}</div></div></div>{current ? <span className="rounded-lg bg-primary/10 px-2 py-1 text-[12px] text-primary">Active now</span> : <button className={secondaryButton}>Log out</button>}</div>)}
              <button className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-4 py-2 text-[13px] text-danger">Log out everywhere</button>
            </div>
          )}

          {activeTab === "Theme & Colors" && (
            <div className="mt-8 space-y-6">
              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className={sectionTitle}>Preset Themes</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  {themePresets.map((preset) => (
                    <button key={preset.name} onClick={() => applyThemePreset(preset.colors)} className="rounded-2xl border border-border bg-surface/40 p-4 text-left transition hover:border-primary/50">
                      <div className="mb-3 flex overflow-hidden rounded-lg border border-border">
                        {[preset.colors.background, preset.colors.panel, preset.colors.surface, preset.colors.primary, preset.colors.danger].map((color, i) => <span key={i} className="h-6 flex-1" style={{ backgroundColor: color }} />)}
                      </div>
                      <div className="text-[13px] font-medium">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className={sectionTitle}>App Colors</h2>
                <div className="space-y-4">
                  {appColorFields.map((field) => <ColorPicker key={field.key} label={field.label} value={themeSettings[field.key]} onChange={(color) => updateThemeColor(field.key, color)} />)}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className={sectionTitle}>Chart Colors</h2>
                <div className="space-y-4">
                  {chartColorFields.map((field) => <ColorPicker key={field.key} label={field.label} value={chartSettings[field.key] as string} onChange={(color) => updateChartColor(field.key, color)} />)}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3 text-[13px]">
                  <span className="text-muted">Show grid lines</span>
                  <Toggle checked={chartSettings.gridLines} onChange={() => setChartSettings((current) => ({ ...current, gridLines: !current.gridLines }))} />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className={sectionTitle}>Live Preview</h2>
                <div className="rounded-xl border border-border bg-background p-4">
                  <button className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-background">Primary button</button>
                  <button className="ml-3 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-foreground">Secondary button</button>
                  <span className="ml-4 text-[13px] text-primary">Preview link</span>
                  <span className="ml-4 text-[13px] text-danger">Loss -$42.00</span>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className={sectionTitle}>Font Size</h2>
                <div className="flex gap-2">{["Small", "Default", "Large"].map((size) => <button key={size} onClick={() => setFontSize(size)} className={`rounded-xl border px-4 py-2 text-[13px] ${fontSize === size ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>{size}</button>)}</div>
              </section>

              <div className="flex gap-3">
                <button onClick={saveThemeSettings} className="rounded-xl bg-primary px-6 py-3 text-[13px] font-semibold text-background">Save</button>
                <button onClick={resetThemeSettings} className={secondaryButton}>Reset to defaults</button>
              </div>
            </div>
          )}

          {activeTab === "Chart defaults" && (
            <div className="mt-8 rounded-2xl border border-border bg-panel p-6"><div className="grid gap-4 md:grid-cols-2">{[["Default chart type", "type", ["Candles", "Bars", "Line", "Area", "Heikin Ashi"]], ["Default timeframe", "timeframe", ["1m", "5m", "15m", "1h", "4h", "1D"]], ["Default instrument", "instrument", ["NAS100", "XAUUSD", "BTCUSD", "EURUSD"]], ["Crosshair style", "crosshair", ["Normal", "Magnet"]]].map(([label, key, options]) => <label key={String(key)} className="space-y-2 text-[13px] text-muted">{label}<select value={chartDefaults[key as keyof typeof chartDefaults]} onChange={(event) => setChartDefaults((current) => ({ ...current, [key as string]: event.target.value }))} className={input}>{(options as string[]).map((option) => <option key={option}>{option}</option>)}</select></label>)}</div><div className="mt-5 space-y-4"><div className="flex items-center justify-between"><span>Show volume</span><Toggle checked={toggles.volume} onChange={() => toggle("volume")} /></div><div className="flex items-center justify-between"><span>Show grid</span><Toggle checked={toggles.grid} onChange={() => toggle("grid")} /></div></div><button onClick={saveChartDefaults} className="mt-6 rounded-xl bg-primary px-6 py-3 text-[13px] font-semibold text-background">Save defaults</button></div>
          )}

          {activeTab === "Subscriptions" && (
            <div className="mt-8 space-y-6"><section className="rounded-2xl border border-primary bg-primary/10 p-6"><div className="text-[13px] text-muted">Current plan</div><h2 className="mt-1 text-2xl font-semibold">Free</h2><p className="mt-2 text-[13px] text-muted">AI builder usage is measured on 5-hour and monthly credit windows.</p><button className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-background">Upgrade now</button></section><div className="grid gap-4 md:grid-cols-4">{Object.values(usagePlans).map((plan) => <div key={plan.id} className={`rounded-2xl border bg-panel p-6 ${plan.id === "free" ? "border-primary" : "border-border"}`}><h3 className="text-lg font-semibold">{plan.name}</h3><p className="mt-2 min-h-[42px] text-[13px] leading-6 text-muted">{plan.description}</p><div className="mt-4 space-y-2 border-t border-border pt-4 text-[12px] text-muted"><div className="flex justify-between"><span>5hr credits</span><span className="font-mono text-foreground">{plan.limits.ai_builder.fiveHour}</span></div><div className="flex justify-between"><span>Monthly credits</span><span className="font-mono text-foreground">{plan.limits.ai_builder.monthly}</span></div></div></div>)}</div></div>
          )}

          {activeTab === "Payment methods" && <div className="mt-8 rounded-2xl border border-border bg-panel p-8 text-center"><CreditCard className="mx-auto mb-3 h-8 w-8 text-muted" /><h2 className="font-semibold">No saved payment methods</h2><p className="mt-2 text-[13px] text-muted">Accepts credit card and debit card. Stripe integration placeholder.</p><button className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-background">Add payment method</button></div>}
          {activeTab === "Billing history" && <div className="mt-8 rounded-2xl border border-border bg-panel p-8 text-center text-[13px] text-muted">No billing history yet</div>}
          {activeTab === "Alerts delivery" && <div className="mt-8 rounded-2xl border border-border bg-panel p-6"><div className="space-y-4"><div className="flex items-center justify-between"><span>In-app notifications</span><Toggle checked={toggles.inApp} onChange={() => toggle("inApp")} /></div><div className="flex items-center justify-between"><span>Email notifications</span><Toggle checked={toggles.email} onChange={() => toggle("email")} /></div><div className="flex items-center justify-between"><span>Telegram</span><Link href="/alerts" className={secondaryButton}>Setup AI Briefings</Link></div><input className={input} placeholder="Webhook URL" /></div></div>}
          {activeTab === "Email subscriptions" && <div className="mt-8 rounded-2xl border border-border bg-panel p-6"><div className="space-y-4">{[["Weekly market digest", "weekly"], ["Strategy performance updates", "performance"], ["New features and updates", "features"], ["Community activity", "community"], ["Promotional offers", "promo"]].map(([label, key]) => <div key={key} className="flex items-center justify-between"><span>{label}</span><Toggle checked={toggles[key]} onChange={() => toggle(key)} /></div>)}<button className="pt-3 text-[13px] font-semibold text-danger">Unsubscribe from all</button></div></div>}
        </div>
      </section>
    </main>
  );
}
