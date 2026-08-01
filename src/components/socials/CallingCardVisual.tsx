"use client";

import type { CSSProperties } from "react";
import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import type { CallingCardDefinition } from "@/lib/socials";

const PALETTES: Record<CallingCardDefinition["accent"], { primary: string; secondary: string; haze: string }> = {
  green: { primary: "#B6FF00", secondary: "#37D4FF", haze: "rgba(182,255,0,.18)" },
  gold: { primary: "#D6B45F", secondary: "#FFF0B5", haze: "rgba(214,180,95,.2)" },
  blue: { primary: "#5C86FF", secondary: "#51E5FF", haze: "rgba(81,229,255,.16)" },
  violet: { primary: "#A978FF", secondary: "#EEB7FF", haze: "rgba(169,120,255,.2)" },
  red: { primary: "#FF526D", secondary: "#FFB05C", haze: "rgba(255,82,109,.2)" },
  white: { primary: "#F5F7FA", secondary: "#9DA7B3", haze: "rgba(245,247,250,.14)" },
};

const MOTIF_CODES: Record<CallingCardDefinition["motif"], string> = {
  origin: "01",
  record: "R1",
  permission: "PX",
  streak: "V5",
  architecture: "A20",
  consistency: "Q30",
  review: "R10",
  steel: "TS",
  decay: "0α",
  cartography: "M50",
};

export default function CallingCardVisual({
  definition,
  ownerName = "Kwant Trader",
  locked = false,
  earnedLabel = "",
  banner = false,
  className = "",
}: {
  definition: CallingCardDefinition;
  ownerName?: string;
  locked?: boolean;
  earnedLabel?: string;
  banner?: boolean;
  className?: string;
}) {
  const palette = PALETTES[definition.accent];
  const style = {
    "--calling-primary": palette.primary,
    "--calling-secondary": palette.secondary,
    "--calling-haze": palette.haze,
  } as CSSProperties;

  return (
    <div className={`calling-card ${banner ? "calling-card--banner" : ""} ${locked ? "calling-card--locked" : ""} ${className}`} style={style}>
      <div className="calling-card__plane">
        {definition.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={definition.artworkUrl} alt="" className="calling-card__art" />
        ) : null}
        <div className="calling-card__grid" />
        <div className="calling-card__haze calling-card__haze--one" />
        <div className="calling-card__haze calling-card__haze--two" />
        <div className="calling-card__circuit calling-card__circuit--one" />
        <div className="calling-card__circuit calling-card__circuit--two" />
        <div className="calling-card__core" aria-hidden="true">
          <span className="calling-card__orbit calling-card__orbit--one" />
          <span className="calling-card__orbit calling-card__orbit--two" />
          <span className="calling-card__orbit calling-card__orbit--three" />
          <span className="calling-card__core-code">{MOTIF_CODES[definition.motif]}</span>
        </div>
        <div className="calling-card__scan" />
        <div className="calling-card__shine" />

        <div className="calling-card__content">
          <header className="calling-card__header">
            <span className="calling-card__brand"><Sparkles className="h-3 w-3" />KWANT DESK</span>
            <span className="calling-card__serial">{definition.tier} · {definition.code.toUpperCase()}</span>
          </header>

          <div className="calling-card__identity">
            <div className="calling-card__family">{definition.family} CALLING CARD</div>
            <div className="calling-card__name">{definition.name}</div>
            <div className="calling-card__tagline">{definition.tagline}</div>
          </div>

          <footer className="calling-card__footer">
            <span className="calling-card__owner"><ShieldCheck className="h-3 w-3" />{ownerName}</span>
            <span>{earnedLabel || (definition.starter ? "FOUNDING ISSUE" : definition.tier)}</span>
          </footer>
        </div>

        {locked ? (
          <div className="calling-card__lock">
            <span className="calling-card__lock-icon"><LockKeyhole className="h-5 w-5" /></span>
            <strong>LOCKED</strong>
            <span>{definition.requirement}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
