"use client";

import KwantSelect from "@/components/ui/KwantSelect";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import UserAvatar from "@/components/socials/UserAvatar";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  FlaskConical,
  Globe,
  KeyRound,
  Laptop,
  Loader2,
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
import { defaultTheme, readStoredTheme, resetTheme, saveTheme as saveAppTheme, type ThemeColors } from "@/lib/theme";
import { defaultChartSettings, extractUserChartSettings, loadStoredChartSettings, mergeChartSettingsIntoTheme, saveStoredChartSettings, type ChartSettings } from "@/lib/chartSettings";
import { linkStoredPaneIndicatorsToTheme } from "@/lib/chartIndicatorConfig";
import { createClient } from "@/lib/supabase";
import { usagePlans } from "@/lib/usagePlans";
import { compactLegacyAuthPreferenceMetadata, hydrateUserPreferences } from "@/lib/userPreferences";
import { useAccountPreferenceSync } from "@/hooks/useAccountPreferenceSync";
import {
  PRESENCE_OPTIONS,
  presenceOption,
  type FriendsPayload,
  type PresenceStatus,
} from "@/lib/friends";
import { cacheProfileIdentity, readProfileIdentityCache } from "@/lib/profileIdentityCache";
import { isValidProfileHandle, PROFILE_HANDLE_REQUIREMENTS } from "@/lib/profileHandle";

type SettingsTab =
  | "Identity"
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

type HandleCheckState = {
  state: "idle" | "checking" | "available" | "taken" | "invalid" | "error";
  message: string;
};

function normalizeProfileHandle(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

const navSections: { title: string; items: SettingsTab[] }[] = [
  { title: "Profile and Privacy", items: ["Identity", "Public profile", "Privacy preferences"] },
  { title: "Account and Security", items: ["Account settings", "Active sessions"] },
  { title: "Appearance", items: ["Theme & Colors", "Chart defaults"] },
  { title: "Billing", items: ["Subscriptions", "Payment methods", "Billing history"] },
  { title: "Notifications", items: ["Alerts delivery", "Email subscriptions"] },
];

const presetColors = ["#B6FF00", "#4361FF", "#FFFFFF", "#00F5A0", "#22C55E", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#EAB308", "#71717A", "#000000"];

const makeTheme = (colors: Partial<ThemeColors>): ThemeColors => ({
  ...defaultTheme,
  ...colors,
  accent: colors.primary ?? defaultTheme.primary,
  chartBackground: colors.chartBackground ?? colors.background ?? defaultTheme.background,
  gridColor: colors.gridColor ?? colors.card ?? defaultTheme.card,
});

const themePresets: { name: string; colors: ThemeColors }[] = [
  { name: "Midnight Cockpit", colors: makeTheme({ background: "#020304", panel: "#050607", surface: "#0B0D10", card: "#07090B", foreground: "#DDE2E7", primary: "#FF1F78", secondary: "#16C7CE", accent: "#16C7CE", muted: "#707780", border: "#24282D", danger: "#FF1F78", chartBackground: "#020304", gridColor: "#11151A", crosshairColor: "rgba(255,31,120,.72)", candleUp: "#16C7CE", candleDown: "#FF1F78" }) },
  { name: "Kwant Desk", colors: makeTheme({ background: "#000000", panel: "#050506", surface: "#0B0C0E", card: "#07080A", foreground: "#FFFFFF", primary: "#B6FF00", secondary: "#4361FF", accent: "#4361FF", muted: "#7F858D", border: "#1A1D22", danger: "#4361FF", chartBackground: "#000000", gridColor: "#111318", crosshairColor: "rgba(182,255,0,.78)", candleUp: "#B6FF00", candleDown: "#FFFFFF" }) },
  { name: "Mr. Quant", colors: makeTheme({ background: "#000000", panel: "#050914", surface: "#0B1530", card: "#070D1D", foreground: "#F7FAFF", primary: "#47B7FF", secondary: "#91B9FF", accent: "#2E9FEA", muted: "#7E91B6", border: "#18315A", danger: "#FF4D67", chartBackground: "#000000", gridColor: "#0B172B", crosshairColor: "rgba(71,183,255,.78)", candleUp: "#47B7FF", candleDown: "#F7FAFF" }) },
  { name: "Kwant Gold", colors: makeTheme({ background: "#000000", panel: "#050505", surface: "#0D0D0D", card: "#080808", foreground: "#FFFFFF", primary: "#D6B45F", secondary: "#FFFFFF", accent: "#D6B45F", muted: "#85827A", border: "#242016", danger: "#FFFFFF", chartBackground: "#000000", gridColor: "#17140D", crosshairColor: "rgba(214,180,95,.72)", candleUp: "#D6B45F", candleDown: "#FFFFFF" }) },
  { name: "Onyx Gold", colors: makeTheme({ background: "#030304", panel: "#070708", surface: "#111113", card: "#0B0B0D", foreground: "#F4F1E8", primary: "#D6B45F", secondary: "#F0D58A", muted: "#79776F", border: "#1D1D20", danger: "#FF626C", crosshairColor: "rgba(214,180,95,.42)", candleUp: "#D6B45F", candleDown: "#FF626C" }) },
  { name: "Carbon Blue", colors: makeTheme({ background: "#02050A", panel: "#050A12", surface: "#0D1624", card: "#080E18", foreground: "#EEF4FF", primary: "#5791FF", secondary: "#91B7FF", muted: "#6F7C91", border: "#152238", danger: "#FF5F6D", crosshairColor: "rgba(87,145,255,.42)", candleUp: "#5791FF", candleDown: "#FF5F6D" }) },
  { name: "Black Emerald", colors: makeTheme({ background: "#020604", panel: "#050B08", surface: "#0C1711", card: "#07100B", foreground: "#EDF8F1", primary: "#39D98A", secondary: "#7CEFB0", muted: "#6D8175", border: "#14271C", danger: "#FF626C", crosshairColor: "rgba(57,217,138,.40)", candleUp: "#39D98A", candleDown: "#FF626C" }) },
  { name: "Noir Chrome", colors: makeTheme({ background: "#030303", panel: "#070707", surface: "#121214", card: "#0B0B0C", foreground: "#F4F5F7", primary: "#D9DEE7", secondary: "#FFFFFF", muted: "#767A82", border: "#202126", danger: "#FF606B", crosshairColor: "rgba(217,222,231,.35)", candleUp: "#D9DEE7", candleDown: "#FF606B" }) },
  { name: "Electric Violet", colors: makeTheme({ background: "#040207", panel: "#08050D", surface: "#150E20", card: "#0D0813", foreground: "#F6F0FF", primary: "#A578FF", secondary: "#C5A7FF", muted: "#7D718E", border: "#241735", danger: "#FF5F75", crosshairColor: "rgba(165,120,255,.42)", candleUp: "#A578FF", candleDown: "#FF5F75" }) },
  { name: "Black Cherry", colors: makeTheme({ background: "#050203", panel: "#0A0506", surface: "#190C10", card: "#100709", foreground: "#FFF1F3", primary: "#FF5274", secondary: "#FF8CA3", muted: "#8B7178", border: "#2A141A", danger: "#FF5B50", crosshairColor: "rgba(255,82,116,.42)", candleUp: "#FF5274", candleDown: "#FF5B50" }) },
  { name: "Abyss Cyan", colors: makeTheme({ background: "#010507", panel: "#040A0D", surface: "#0B171C", card: "#071015", foreground: "#ECFAFF", primary: "#27C9E8", secondary: "#75E6FA", muted: "#6C8188", border: "#14282F", danger: "#FF626C", crosshairColor: "rgba(39,201,232,.42)", candleUp: "#27C9E8", candleDown: "#FF626C" }) },
  { name: "Signal Lime", colors: makeTheme({ background: "#030502", panel: "#070A05", surface: "#12180C", card: "#0B0F08", foreground: "#F5FBEF", primary: "#A8E84C", secondary: "#CEF78D", muted: "#78836D", border: "#202A17", danger: "#FF636B", crosshairColor: "rgba(168,232,76,.38)", candleUp: "#A8E84C", candleDown: "#FF636B" }) },
  { name: "Royal Cobalt", colors: makeTheme({ background: "#020309", panel: "#050711", surface: "#0E1224", card: "#080B18", foreground: "#F0F2FF", primary: "#6678FF", secondary: "#9AA5FF", muted: "#70758C", border: "#1B2140", danger: "#FF6070", crosshairColor: "rgba(102,120,255,.42)", candleUp: "#6678FF", candleDown: "#FF6070" }) },
  { name: "Burnished Amber", colors: makeTheme({ background: "#050301", panel: "#0A0703", surface: "#191108", card: "#100B05", foreground: "#FFF6E9", primary: "#F5A43B", secondary: "#FFD07C", muted: "#897968", border: "#2B1D0F", danger: "#FF625D", crosshairColor: "rgba(245,164,59,.42)", candleUp: "#F5A43B", candleDown: "#FF625D" }) },
  { name: "Polar Night", colors: makeTheme({ background: "#020508", panel: "#050A0F", surface: "#0D1821", card: "#081119", foreground: "#F0F9FF", primary: "#74D7FF", secondary: "#AFE9FF", muted: "#70818C", border: "#172A36", danger: "#FF6371", crosshairColor: "rgba(116,215,255,.40)", candleUp: "#74D7FF", candleDown: "#FF6371" }) },
  { name: "Neon Rose", colors: makeTheme({ background: "#050205", panel: "#0A050A", surface: "#190E18", card: "#100910", foreground: "#FFF2FC", primary: "#FF70BE", secondary: "#FFA5D5", muted: "#887382", border: "#2B1728", danger: "#FF5B62", crosshairColor: "rgba(255,112,190,.42)", candleUp: "#FF70BE", candleDown: "#FF5B62" }) },
  { name: "Obsidian Pearl", colors: makeTheme({ background: "#020202", panel: "#060607", surface: "#101012", card: "#0A0A0B", foreground: "#F4F3F0", primary: "#D8D6D0", secondary: "#FFFFFF", muted: "#777670", border: "#1C1C1E", danger: "#D86464", crosshairColor: "rgba(216,214,208,.36)", candleUp: "#D8D6D0", candleDown: "#D86464" }) },
  { name: "Black Platinum", colors: makeTheme({ background: "#030405", panel: "#070809", surface: "#121416", card: "#0B0D0E", foreground: "#F1F3F4", primary: "#AEB7BF", secondary: "#DDE2E6", muted: "#70777D", border: "#202428", danger: "#D96970", crosshairColor: "rgba(174,183,191,.38)", candleUp: "#AEB7BF", candleDown: "#D96970" }) },
  { name: "Midnight Brass", colors: makeTheme({ background: "#030302", panel: "#080805", surface: "#14130D", card: "#0D0C08", foreground: "#F3F0E4", primary: "#BFA45A", secondary: "#DBC77F", muted: "#777264", border: "#242117", danger: "#D86561", crosshairColor: "rgba(191,164,90,.38)", candleUp: "#BFA45A", candleDown: "#D86561" }) },
  { name: "Slate Copper", colors: makeTheme({ background: "#030404", panel: "#070808", surface: "#121514", card: "#0B0D0C", foreground: "#F2F0EC", primary: "#C6815A", secondary: "#E0A27E", muted: "#77736F", border: "#24211F", danger: "#D95F66", crosshairColor: "rgba(198,129,90,.38)", candleUp: "#C6815A", candleDown: "#D95F66" }) },
  { name: "Ink Sapphire", colors: makeTheme({ background: "#020305", panel: "#05070B", surface: "#0D121B", card: "#080B11", foreground: "#EFF2F8", primary: "#6686C7", secondary: "#91A8D7", muted: "#6D7481", border: "#192131", danger: "#D96570", crosshairColor: "rgba(102,134,199,.40)", candleUp: "#6686C7", candleDown: "#D96570" }) },
  { name: "Forest Bronze", colors: makeTheme({ background: "#020403", panel: "#050806", surface: "#0E1510", card: "#080D0A", foreground: "#EFF3EC", primary: "#A98B55", secondary: "#C7AD77", muted: "#6C756C", border: "#19241C", danger: "#D86363", crosshairColor: "rgba(169,139,85,.38)", candleUp: "#A98B55", candleDown: "#D86363" }) },
  { name: "Graphite Ice", colors: makeTheme({ background: "#030405", panel: "#07090B", surface: "#11161A", card: "#0A0D0F", foreground: "#F0F5F7", primary: "#84B7C9", secondary: "#B2D5E0", muted: "#6F7B80", border: "#1D282D", danger: "#D9686E", crosshairColor: "rgba(132,183,201,.38)", candleUp: "#84B7C9", candleDown: "#D9686E" }) },
  { name: "Espresso Cream", colors: makeTheme({ background: "#040302", panel: "#090705", surface: "#17120E", card: "#0F0C09", foreground: "#F4EFE6", primary: "#D2B48C", secondary: "#E9D4B5", muted: "#7D7469", border: "#292018", danger: "#D96B61", crosshairColor: "rgba(210,180,140,.38)", candleUp: "#D2B48C", candleDown: "#D96B61" }) },
  { name: "Oxblood Noir", colors: makeTheme({ background: "#040202", panel: "#090505", surface: "#170D0E", card: "#0E0808", foreground: "#F5EDEE", primary: "#A84F5B", secondary: "#CF7781", muted: "#7A6C6E", border: "#281719", danger: "#E06B64", crosshairColor: "rgba(168,79,91,.40)", candleUp: "#C86B77", candleDown: "#E06B64" }) },
  { name: "Ivory Gold", colors: makeTheme({ background: "#F5F2EA", panel: "#FBF9F3", surface: "#ECE7DC", card: "#F8F5EE", foreground: "#201E19", primary: "#9A7928", secondary: "#745B20", muted: "#777164", border: "#D8D1C2", danger: "#B8474F", chartBackground: "#F5F2EA", gridColor: "#E3DDD0", crosshairColor: "rgba(91,71,24,.38)", candleUp: "#9A7928", candleDown: "#B8474F" }) },
  { name: "Porcelain Slate", colors: makeTheme({ background: "#F3F4F4", panel: "#FAFAFA", surface: "#E7E9EA", card: "#F7F8F8", foreground: "#1D2225", primary: "#53636D", secondary: "#35424A", muted: "#6F787D", border: "#D4D9DB", danger: "#B94B54", chartBackground: "#F3F4F4", gridColor: "#E0E4E5", crosshairColor: "rgba(53,66,74,.36)", candleUp: "#53636D", candleDown: "#B94B54" }) },
  { name: "Mist Blue", colors: makeTheme({ background: "#F1F4F6", panel: "#F8FAFB", surface: "#E4EAF0", card: "#F5F8FA", foreground: "#1A242C", primary: "#456F8C", secondary: "#2E526A", muted: "#687984", border: "#CFD9DF", danger: "#B84D58", chartBackground: "#F1F4F6", gridColor: "#DDE5EA", crosshairColor: "rgba(46,82,106,.36)", candleUp: "#456F8C", candleDown: "#B84D58" }) },
  { name: "Blush Pearl", colors: makeTheme({ background: "#FFF9FC", panel: "#FFFFFF", surface: "#F8EAF1", card: "#FFF3F8", foreground: "#31232C", primary: "#F2B6CE", secondary: "#AFC8F4", accent: "#C7B8EA", muted: "#8D7984", border: "#EBD4DF", danger: "#CF708B", chartBackground: "#FFF9FC", gridColor: "#F0DFE7", crosshairColor: "rgba(175,200,244,.62)", candleUp: "#AFC8F4", candleDown: "#F2B6CE" }) },
  { name: "Rosewater Mint", colors: makeTheme({ background: "#FFFAFB", panel: "#FFFFFF", surface: "#EEF8F4", card: "#FFF2F6", foreground: "#30272C", primary: "#F0B1C5", secondary: "#83CDB5", accent: "#A9DDCC", muted: "#81747A", border: "#E8D6DC", danger: "#C96E86", chartBackground: "#FFFAFB", gridColor: "#E4EEE9", crosshairColor: "rgba(131,205,181,.62)", candleUp: "#83CDB5", candleDown: "#F0B1C5" }) },
  { name: "Velvet Lavender", colors: makeTheme({ background: "#08070B", panel: "#0E0B12", surface: "#18121E", card: "#120E16", foreground: "#FFF3F8", primary: "#F2B4CC", secondary: "#9D91E8", accent: "#C5B8F4", muted: "#8B7D88", border: "#2D222D", danger: "#DE7E9A", chartBackground: "#08070B", gridColor: "#1D1722", crosshairColor: "rgba(197,184,244,.62)", candleUp: "#9D91E8", candleDown: "#F2B4CC" }) },
  { name: "Midnight Petal", colors: makeTheme({ background: "#05090D", panel: "#090F15", surface: "#111C24", card: "#0C141B", foreground: "#F7F7FB", primary: "#F3B5C8", secondary: "#69C5D4", accent: "#9ADDE5", muted: "#75848D", border: "#1B3039", danger: "#D97891", chartBackground: "#05090D", gridColor: "#10212A", crosshairColor: "rgba(105,197,212,.64)", candleUp: "#69C5D4", candleDown: "#F3B5C8" }) },
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button onClick={onChange} className={`h-5 w-10 rounded-full transition-all ${checked ? "bg-primary" : "border border-border bg-surface"}`}><span className={`block h-4 w-4 rounded-full bg-background transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} /></button>;
}

const defaultSettingsToggles: Record<string, boolean> = {
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
};

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
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window === "undefined") return "Identity";
    const saved = window.sessionStorage.getItem("kwantdesk-settings-active-tab");
    return navSections.some((section) => section.items.includes(saved as SettingsTab))
      ? saved as SettingsTab
      : "Identity";
  });
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>("online");
  const [presenceMessage, setPresenceMessage] = useState("");
  const [presenceLoading, setPresenceLoading] = useState(true);
  const [presenceSaving, setPresenceSaving] = useState(false);
  const [presenceSyncing, setPresenceSyncing] = useState(false);
  const [presenceNotice, setPresenceNotice] = useState("");
  const confirmedPresenceRef = useRef<PresenceStatus>("online");
  const presenceRevisionRef = useRef(0);
  const presenceWorkerRef = useRef(false);
  const pendingPresenceRef = useRef<{
    status: PresenceStatus;
    message: string;
    revision: number;
    previousConfirmedStatus: PresenceStatus;
  } | null>(null);
  const [savedHandle, setSavedHandle] = useState("");
  const [handleCheck, setHandleCheck] = useState<HandleCheckState>({ state: "idle", message: "" });
  const [preferenceUserId, setPreferenceUserId] = useState("");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return defaultSettingsToggles;
    try {
      const saved = JSON.parse(window.localStorage.getItem("kwantdesk-settings-toggles") ?? "{}");
      return { ...defaultSettingsToggles, ...(saved && typeof saved === "object" ? saved : {}) };
    } catch {
      return defaultSettingsToggles;
    }
  });
  const [themeSettings, setThemeSettings] = useState<ThemeColors>(() => {
    return readStoredTheme();
  });
  const [chartSettings, setChartSettings] = useState<ChartSettings>(() => loadStoredChartSettings());
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === "undefined") return "Default";
    const saved = window.localStorage.getItem("kwantdesk-settings-font-size");
    return saved === "Small" || saved === "Large" ? saved : "Default";
  });
  const [chartDefaults, setChartDefaults] = useState(() => ({
    type: "Candles",
    timeframe: "5m",
    instrument: "NAS100",
    crosshair: "Normal",
  }));

  useAccountPreferenceSync({
    supabase,
    userId: preferenceUserId,
    enabled: preferencesReady,
  });

  useEffect(() => {
    const savedDefaults = localStorage.getItem("olisa-chart-defaults");
    if (savedDefaults) setChartDefaults(JSON.parse(savedDefaults));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setPresenceLoading(false);
      return;
    }

    let active = true;
    const loadProfile = async () => {
      const sessionUser = (await supabase.auth.getSession()).data.session?.user ?? null;
      const user = sessionUser ?? (await supabase.auth.getUser()).data.user;
      if (!user) {
        if (!active) return;
        setProfileName("");
        setProfileEmail("");
        setProfileUsername("");
        setProfileAvatarUrl("");
        setPresenceLoading(false);
        return;
      }
      const cachedIdentity = readProfileIdentityCache(user.id);
      const authDisplayName =
        (user.user_metadata?.display_name as string | undefined) ??
          (user.user_metadata?.full_name as string | undefined) ??
          "";
      const authHandle = normalizeProfileHandle(
        (user.user_metadata?.username as string | undefined) ?? "",
      );
      const authAvatarUrl =
        (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          "";
      if (!active) return;
      setPreferenceUserId(user.id);
      setPreferencesReady(true);
      setProfileName(cachedIdentity?.displayName || authDisplayName);
      setProfileEmail(user.email ?? "");
      setProfileUsername(cachedIdentity?.handle || authHandle);
      setSavedHandle(cachedIdentity?.handle || authHandle);
      setProfileAvatarUrl(cachedIdentity?.avatarUrl || authAvatarUrl);
      setPresenceLoading(false);

      const profileLoadPresenceRevision = presenceRevisionRef.current;
      void (async () => {
        try {
          const friendsResponse = await fetch("/api/friends", { cache: "no-store" });
          if (!friendsResponse.ok) return;
          const friendsPayload = await friendsResponse.json() as FriendsPayload;
          if (!active || !friendsPayload.viewer) return;
          const storedName = friendsPayload.viewer.displayName || authDisplayName;
          const storedHandle = normalizeProfileHandle(friendsPayload.viewer.handle || authHandle);
          if (presenceRevisionRef.current === profileLoadPresenceRevision) {
            confirmedPresenceRef.current = friendsPayload.viewer.presenceStatus;
            setPresenceStatus(friendsPayload.viewer.presenceStatus);
          }
          setPresenceMessage(friendsPayload.viewer.presenceMessage);
          setProfileAvatarUrl(friendsPayload.viewer.avatarUrl || authAvatarUrl);
          setProfileName(storedName);
          setProfileUsername(storedHandle);
          setSavedHandle(storedHandle);
          cacheProfileIdentity(user.id, {
            avatarUrl: friendsPayload.viewer.avatarUrl || authAvatarUrl,
            displayName: storedName,
            handle: storedHandle,
          });
        } catch {
          // The cached identity remains visible during a transient profile refresh failure.
        }
      })();

      let hydrated: Awaited<ReturnType<typeof hydrateUserPreferences>> | null = null;
      try {
        hydrated = await hydrateUserPreferences(supabase, user);
        if (hydrated.changed) {
          setThemeSettings(readStoredTheme());
          setChartSettings(loadStoredChartSettings());
          try {
            const savedToggles = JSON.parse(window.localStorage.getItem("kwantdesk-settings-toggles") ?? "{}");
            setToggles({
              ...defaultSettingsToggles,
              ...(savedToggles && typeof savedToggles === "object" ? savedToggles : {}),
            });
          } catch {
            setToggles(defaultSettingsToggles);
          }
          const savedFontSize = window.localStorage.getItem("kwantdesk-settings-font-size");
          setFontSize(savedFontSize === "Small" || savedFontSize === "Large" ? savedFontSize : "Default");
          const savedDefaults = window.localStorage.getItem("olisa-chart-defaults");
          if (savedDefaults) {
            try {
              setChartDefaults(JSON.parse(savedDefaults));
            } catch {
              // Keep the current chart defaults if an old browser value is malformed.
            }
          }
          window.dispatchEvent(new CustomEvent("kwantdesk:preferences-hydrated"));
        }
        window.sessionStorage.removeItem(`kwantdesk:preference-hydration-reload:${user.id}`);
      } catch {
        // Authentication and local preferences remain usable during a transient sync failure.
      }
      if (!active) return;
      const hasStoredChartSettings = hydrated
        ? Object.prototype.hasOwnProperty.call(
            hydrated.snapshot.values,
            "olisa-chart-settings",
          )
        : false;
      const profileChartSettings = hasStoredChartSettings ? null : extractUserChartSettings(user);
      if (!hasStoredChartSettings && profileChartSettings) {
        setChartSettings(profileChartSettings);
        setThemeSettings((current) => mergeChartSettingsIntoTheme(current, profileChartSettings));
        saveStoredChartSettings(profileChartSettings);
      }
      void compactLegacyAuthPreferenceMetadata(supabase, user).catch(() => {
        // Retried on the next authenticated mount.
      });
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (presenceLoading) return;
    const handle = normalizeProfileHandle(profileUsername);
    if (!isValidProfileHandle(handle)) {
      setHandleCheck({
        state: "invalid",
        message: PROFILE_HANDLE_REQUIREMENTS,
      });
      return;
    }
    if (handle === savedHandle) {
      setHandleCheck({ state: "available", message: "This is your current handle." });
      return;
    }

    const controller = new AbortController();
    setHandleCheck({ state: "checking", message: "Checking availability..." });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/friends?handle=${encodeURIComponent(handle)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as {
          available?: boolean;
          reason?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Availability could not be checked.");
        setHandleCheck(result.available
          ? { state: "available", message: `@${handle} is available.` }
          : { state: "taken", message: result.reason || `@${handle} is already in use.` });
      } catch (reason) {
        if (controller.signal.aborted) return;
        setHandleCheck({
          state: "error",
          message: reason instanceof Error ? reason.message : "Availability could not be checked.",
        });
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [presenceLoading, profileUsername, savedHandle]);

  useEffect(() => {
    saveAppTheme(themeSettings);
  }, [themeSettings]);

  useEffect(() => {
    saveStoredChartSettings(chartSettings);
  }, [chartSettings]);

  useEffect(() => {
    setThemeSettings((current) => mergeChartSettingsIntoTheme(current, chartSettings));
  }, [chartSettings]);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk-settings-toggles", JSON.stringify(toggles));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [toggles]);

  useEffect(() => {
    window.localStorage.setItem("kwantdesk-settings-font-size", fontSize);
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [fontSize]);

  function toggle(key: string) {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  }

  function selectSettingsTab(tab: SettingsTab) {
    setActiveTab(tab);
    window.sessionStorage.setItem("kwantdesk-settings-active-tab", tab);
  }

  async function saveIdentity(nextStatus = presenceStatus) {
    setPresenceSaving(true);
    setPresenceNotice("");
    try {
      const fallbackName = profileEmail.includes("@") ? profileEmail.split("@")[0] : "Kwant Trader";
      const fallbackHandle = fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
      const displayName = profileName.trim().replace(/\s+/g, " ").slice(0, 60);
      const handle = normalizeProfileHandle(profileUsername || fallbackHandle);
      if (displayName.length < 2) throw new Error("Enter a trader name with at least 2 characters.");
      if (!isValidProfileHandle(handle)) {
        throw new Error(PROFILE_HANDLE_REQUIREMENTS);
      }
      if (handle !== savedHandle && handleCheck.state !== "available") {
        throw new Error(handleCheck.message || "Wait for the handle availability check to finish.");
      }
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "presence",
          presenceStatus: nextStatus,
          presenceMessage,
          displayName,
          handle,
        }),
      });
      const result = await response.json() as FriendsPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "Identity could not be saved.");
      const savedViewer = result.viewer;
      setProfileName(savedViewer?.displayName || displayName);
      setProfileUsername(savedViewer?.handle || handle);
      setSavedHandle(savedViewer?.handle || handle);
      confirmedPresenceRef.current = savedViewer?.presenceStatus || nextStatus;
      setPresenceStatus(confirmedPresenceRef.current);
      setPresenceMessage(savedViewer?.presenceMessage ?? presenceMessage);
      setHandleCheck({ state: "available", message: "This is your current handle." });
      window.dispatchEvent(new CustomEvent("kwantdesk:identity-updated", {
        detail: { displayName, handle },
      }));
      setPresenceNotice("Identity saved across your Kwant Desk account.");
      window.setTimeout(() => setPresenceNotice(""), 2_600);
    } catch (reason) {
      setPresenceNotice(reason instanceof Error ? reason.message : "Identity could not be saved.");
    } finally {
      setPresenceSaving(false);
    }
  }

  function savePresence(nextStatus: PresenceStatus) {
    if (nextStatus === presenceStatus) return;
    const requestRevision = ++presenceRevisionRef.current;
    setPresenceStatus(nextStatus);
    setPresenceSyncing(true);
    setPresenceNotice(`${presenceOption(nextStatus).label} selected · syncing…`);
    window.dispatchEvent(new CustomEvent("kwantdesk:presence-updated", {
      detail: { presenceStatus: nextStatus },
    }));
    pendingPresenceRef.current = {
      status: nextStatus,
      message: presenceMessage,
      revision: requestRevision,
      previousConfirmedStatus: confirmedPresenceRef.current,
    };
    void flushPresenceQueue();
  }

  async function flushPresenceQueue() {
    if (presenceWorkerRef.current) return;
    presenceWorkerRef.current = true;
    try {
      while (pendingPresenceRef.current) {
        const request = pendingPresenceRef.current;
        pendingPresenceRef.current = null;
        try {
          const response = await fetch("/api/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "status",
              presenceStatus: request.status,
              presenceMessage: request.message,
            }),
          });
          const result = await response.json() as {
            error?: string;
            viewer?: { presenceStatus?: PresenceStatus; presenceMessage?: string };
          };
          if (!response.ok) throw new Error(result.error || "Presence could not be saved.");
          const savedStatus = result.viewer?.presenceStatus || request.status;
          confirmedPresenceRef.current = savedStatus;
          if (request.revision !== presenceRevisionRef.current) continue;
          setPresenceStatus(savedStatus);
          setPresenceMessage(result.viewer?.presenceMessage ?? request.message);
          setPresenceNotice(`${presenceOption(savedStatus).label} status saved.`);
          window.dispatchEvent(new CustomEvent("kwantdesk:presence-updated", {
            detail: { presenceStatus: savedStatus },
          }));
          window.setTimeout(() => setPresenceNotice(""), 2_600);
        } catch (reason) {
          if (request.revision !== presenceRevisionRef.current || pendingPresenceRef.current) continue;
          setPresenceStatus(request.previousConfirmedStatus);
          window.dispatchEvent(new CustomEvent("kwantdesk:presence-updated", {
            detail: { presenceStatus: request.previousConfirmedStatus },
          }));
          setPresenceNotice(reason instanceof Error ? reason.message : "Presence could not be saved.");
        }
      }
    } finally {
      presenceWorkerRef.current = false;
      if (pendingPresenceRef.current) void flushPresenceQueue();
      else setPresenceSyncing(false);
    }
  }

  const identityCanSave =
    !presenceSaving
    && profileName.trim().length >= 2
    && isValidProfileHandle(normalizeProfileHandle(profileUsername))
    && (normalizeProfileHandle(profileUsername) === savedHandle || handleCheck.state === "available");

  function updateThemeColor(key: keyof ThemeColors, color: string) {
    linkStoredPaneIndicatorsToTheme();
    setThemeSettings((current) => ({
      ...current,
      [key]: color,
      ...(key === "background" ? { chartBackground: color } : {}),
      ...(key === "primary" ? { candleUp: color, crosshairColor: color } : {}),
      ...(key === "danger" ? { candleDown: color } : {}),
    }));
    if (key === "background" || key === "primary" || key === "danger") {
      setChartSettings((current) => ({
        ...current,
        ...(key === "background" ? { backgroundColor: color } : {}),
        ...(key === "primary" ? {
          upColor: color,
          borderUpColor: color,
          wickUpColor: color,
        } : {}),
        ...(key === "danger" ? {
          downColor: color,
          borderDownColor: color,
          wickDownColor: color,
        } : {}),
      }));
    }
  }

  function updateChartColor(key: keyof ChartSettings, color: string) {
    linkStoredPaneIndicatorsToTheme();
    setChartSettings((current) => {
      const next = { ...current, [key]: color };
      setThemeSettings((theme) => mergeChartSettingsIntoTheme(theme, next));
      return next;
    });
  }

  function applyThemePreset(theme: ThemeColors) {
    const nextChartSettings: ChartSettings = {
      ...chartSettings,
      backgroundColor: theme.chartBackground,
      gridColor: theme.gridColor,
      upColor: theme.candleUp,
      downColor: theme.candleDown,
      borderUpColor: theme.candleUp,
      borderDownColor: theme.candleDown,
      wickUpColor: theme.candleUp,
      wickDownColor: theme.candleDown,
    };
    setThemeSettings(theme);
    setChartSettings(nextChartSettings);
    linkStoredPaneIndicatorsToTheme();
    saveAppTheme(theme);
    saveStoredChartSettings(nextChartSettings);
  }

  async function saveThemeSettings() {
    const syncedTheme = mergeChartSettingsIntoTheme(themeSettings, chartSettings);
    setThemeSettings(syncedTheme);
    linkStoredPaneIndicatorsToTheme();
    saveAppTheme(syncedTheme);
    saveStoredChartSettings(chartSettings);
  }

  function resetThemeSettings() {
    resetTheme();
    linkStoredPaneIndicatorsToTheme();
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
    <main className="flex h-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      <AppSidebar activeItem="settings" orientation="horizontal" />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-[220px] shrink-0 overflow-y-auto border-r border-border bg-panel p-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">{section.title}</div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onPointerDown={(event) => {
                    if (event.button === 0) selectSettingsTab(item);
                  }}
                  onClick={() => selectSettingsTab(item)}
                  className={`w-full touch-manipulation cursor-pointer rounded-lg px-3 py-2 text-left text-[13px] ${activeTab === item ? "border-l-2 border-primary bg-surface font-medium text-foreground" : "text-muted hover:text-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-2xl font-semibold">{activeTab}</h1>
          <p className="mt-2 text-[13px] text-muted">Manage your Kwant Desk identity, appearance, billing, and notifications.</p>

          {activeTab === "Identity" && (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
              <section className="rounded-2xl border border-border bg-panel p-6">
                <div className="flex items-start gap-4">
                  <UserAvatar
                    label={profileName || profileUsername || profileEmail || "Kwant Trader"}
                    avatarUrl={profileAvatarUrl}
                    size="lg"
                    statusClassName={presenceOption(presenceStatus).dotClassName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-semibold">{profileName || profileUsername || "Kwant Trader"}</div>
                    <div className="mt-0.5 text-[12px] text-muted">@{profileUsername || profileEmail.split("@")[0] || "trader"}</div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px]">
                      <span className={`h-2 w-2 rounded-full ${presenceOption(presenceStatus).dotClassName}`} />
                      {presenceOption(presenceStatus).label}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-medium text-muted">Trader name</span>
                    <input
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value.slice(0, 60))}
                      className={input}
                      placeholder="Your display name"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-medium text-muted">Unique handle</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span>
                      <input
                        value={profileUsername}
                        onChange={(event) => setProfileUsername(
                          normalizeProfileHandle(event.target.value)
                            .replace(/[^a-z0-9_]/g, "")
                            .slice(0, 24),
                        )}
                        className={`${input} pl-8 pr-10`}
                        placeholder="kwantdesk_user"
                        aria-describedby="identity-handle-status"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        {handleCheck.state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
                        {handleCheck.state === "available" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        {(handleCheck.state === "taken" || handleCheck.state === "invalid" || handleCheck.state === "error") && <CircleAlert className="h-4 w-4 text-danger" />}
                      </span>
                    </div>
                    <span
                      id="identity-handle-status"
                      className={`mt-1.5 block text-[9px] ${
                        handleCheck.state === "available" ? "text-primary" :
                          handleCheck.state === "taken" || handleCheck.state === "invalid" || handleCheck.state === "error" ? "text-danger" :
                            "text-muted"
                      }`}
                    >
                      {handleCheck.message || "Used by friends to find you."}
                    </span>
                  </label>
                </div>

                <div className="mt-6 border-t border-border pt-5">
                  <div className={`${sectionTitle} flex items-center justify-between`}>
                    <span>Presence</span>
                    {presenceSyncing ? <span className="flex items-center gap-1.5 normal-case tracking-normal text-primary"><Loader2 className="h-3 w-3 animate-spin" />Syncing</span> : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PRESENCE_OPTIONS.map((option) => {
                      const active = presenceStatus === option.value;
                      return (
                        <button
                          key={option.value}
                          disabled={presenceLoading}
                          onClick={() => {
                            void savePresence(option.value);
                          }}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 active:scale-[0.99] ${
                            active
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-surface/40 hover:bg-surface"
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dotClassName}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium">{option.label}</span>
                            <span className="block truncate text-[9px] text-muted">{option.helper}</span>
                          </span>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-[11px] font-medium text-muted">Status note</label>
                  <div className="flex gap-2">
                    <input
                      value={presenceMessage}
                      onChange={(event) => setPresenceMessage(event.target.value.slice(0, 80))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveIdentity();
                      }}
                      className={input}
                      placeholder="e.g. Mapping the New York session"
                    />
                    <button
                      onClick={() => void saveIdentity()}
                      disabled={!identityCanSave}
                      className="flex min-w-24 items-center justify-center rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-background disabled:opacity-50"
                    >
                      {presenceSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] text-muted">
                    <span>{presenceNotice || "Friends see this beneath your name."}</span>
                    <span>{presenceMessage.length}/80</span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-panel p-6">
                <div className={sectionTitle}>How your identity travels</div>
                <div className="space-y-3">
                  {[
                    ["Right rail", "Friends see whether you are online, focused, away or sleeping."],
                    ["Private chat", "Messages and unread state stay with your account across devices."],
                    ["Desks", "Shared Desk memberships appear as compact context in conversations."],
                    ["Invisible mode", "You can continue using Kwant Desk while appearing offline."],
                  ].map(([title, helper]) => (
                    <div key={title} className="rounded-xl border border-border bg-surface/40 p-3.5">
                      <div className="text-[12px] font-medium">{title}</div>
                      <div className="mt-1 text-[10px] leading-5 text-muted">{helper}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => selectSettingsTab("Privacy preferences")}
                  className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[11px] text-muted hover:text-foreground"
                >
                  Open privacy controls
                </button>
              </section>
            </div>
          )}

          {activeTab === "Public profile" && (
            <div className="mt-8 space-y-8">
              <section className="rounded-2xl border border-border bg-panel p-6">
                <h2 className="mb-5 text-lg font-semibold">Picture and username</h2>
                <div className="flex items-center gap-4"><UserAvatar label={profileName || profileUsername || "Kwant Trader"} avatarUrl={profileAvatarUrl} size="lg" /><div><Link href={profileUsername ? `/socials/${encodeURIComponent(profileUsername)}` : "/socials"} className={secondaryButton}>Edit profile photo</Link><p className="mt-2 text-[12px] text-muted">Crop and save your account photo from your Socials profile.</p></div></div>
                <div className="mt-6 space-y-2 border-t border-border pt-5">
                  <div className="text-[13px] text-muted">Unique handle</div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span>
                    <input
                      className={`${input} pl-8 pr-10`}
                      placeholder="Enter your handle"
                      value={profileUsername}
                      onChange={(event) => setProfileUsername(
                        normalizeProfileHandle(event.target.value)
                          .replace(/[^a-z0-9_]/g, "")
                          .slice(0, 24),
                      )}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      {handleCheck.state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
                      {handleCheck.state === "available" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      {(handleCheck.state === "taken" || handleCheck.state === "invalid" || handleCheck.state === "error") && <CircleAlert className="h-4 w-4 text-danger" />}
                    </span>
                  </div>
                  <div className={`text-[10px] ${
                    handleCheck.state === "available" ? "text-primary" :
                      handleCheck.state === "taken" || handleCheck.state === "invalid" || handleCheck.state === "error" ? "text-danger" :
                        "text-muted"
                  }`}>{handleCheck.message || "Handles are unique across Kwant Desk."}</div>
                  <button
                    onClick={() => void saveIdentity()}
                    disabled={!identityCanSave}
                    className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-[12px] font-semibold text-background disabled:opacity-40"
                  >
                    {presenceSaving ? "Saving..." : "Save identity"}
                  </button>
                </div>
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
            <div className="mt-8 rounded-2xl border border-border bg-panel p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[["Default chart type", "type", ["Candles", "Bars", "Line", "Area", "Heikin Ashi"]], ["Default timeframe", "timeframe", ["1m", "5m", "15m", "1h", "4h", "1D"]], ["Default instrument", "instrument", ["NAS100", "XAUUSD", "BTCUSD", "EURUSD"]], ["Crosshair style", "crosshair", ["Normal", "Magnet"]]].map(([label, key, options]) => <label key={String(key)} className="space-y-2 text-[13px] text-muted">{label}<KwantSelect value={chartDefaults[key as keyof typeof chartDefaults]} onChange={(event) => setChartDefaults((current) => ({ ...current, [key as string]: event.target.value }))} className={input}>{(options as string[]).map((option) => <option key={option}>{option}</option>)}</KwantSelect></label>)}
                <label className="space-y-2 text-[13px] text-muted md:col-span-2">
                  Chart timezone
                  <TimeZoneSelect
                    value={chartSettings.timezone}
                    onChange={(timeZone) => setChartSettings((current) => ({ ...current, timezone: timeZone }))}
                    menuLabel="Chart timezone"
                  />
                </label>
              </div>
              <div className="mt-5 space-y-4"><div className="flex items-center justify-between"><span>Show volume</span><Toggle checked={toggles.volume} onChange={() => toggle("volume")} /></div><div className="flex items-center justify-between"><span>Show grid</span><Toggle checked={toggles.grid} onChange={() => toggle("grid")} /></div></div>
              <button onClick={saveChartDefaults} className="mt-6 rounded-xl bg-primary px-6 py-3 text-[13px] font-semibold text-background">Save defaults</button>
            </div>
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
      </div>
    </main>
  );
}
