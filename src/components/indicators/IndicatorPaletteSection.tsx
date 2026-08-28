"use client";

import ChartColorField from "@/components/ChartColorField";
import {
  INDICATOR_GRADIENTS,
  INDICATOR_GRADIENT_KEY,
  INDICATOR_GRADIENT_OFF,
  indicatorColorRoles,
  type IndicatorPaletteTheme,
} from "@/lib/indicatorPalettes";
import { isVolumeProfileGradientActive } from "@/lib/volumeProfileGradients";

/** What an indicator's settings dialog is allowed to persist. */
type IndicatorSettingValue = string | number | boolean;

/**
 * The Colours section, for any indicator that declares colour roles.
 *
 * The volume profile and the footprint each carry a hand-written version of
 * this inside the settings dialog, against their own option names. This is the
 * same control driven by `INDICATOR_COLOR_ROLES` instead, so an indicator gains
 * one-click schemes by declaring what it paints rather than by someone writing
 * another block of JSX and spelling every key correctly.
 *
 * It is deliberately the same markup and the same scheme list as the profiles'.
 * Two colour pickers that behaved differently in the same dialog would be worse
 * than one of them not existing.
 */
export default function IndicatorPaletteSection({
  indicatorId,
  settings,
  theme,
  onChange,
}: {
  indicatorId: string;
  settings: Record<string, IndicatorSettingValue>;
  theme: IndicatorPaletteTheme;
  onChange: (next: Record<string, IndicatorSettingValue>) => void;
}) {
  const roles = indicatorColorRoles(indicatorId);
  if (!roles.length) return null;

  const active = isVolumeProfileGradientActive(settings[INDICATOR_GRADIENT_KEY]);
  const set = (patch: Record<string, IndicatorSettingValue>) => onChange({ ...settings, ...patch });

  return (
    <div data-settings-section="Colours" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
      <div>
        <span className="block text-[11px] font-medium text-foreground">Colour scheme</span>
        <span className="mt-0.5 block text-[9px] leading-4 text-muted">
          One click recolours the whole indicator. While a scheme is on it owns every colour here, so
          the individual pickers are locked.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <button
          type="button"
          aria-pressed={!active}
          onClick={() => set({ [INDICATOR_GRADIENT_KEY]: INDICATOR_GRADIENT_OFF })}
          className={`h-9 border px-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
            active
              ? "border-border bg-background text-muted hover:border-primary/25 hover:text-foreground"
              : "border-primary/55 bg-primary/10 text-primary"
          }`}
        >
          Off
        </button>
        {INDICATOR_GRADIENTS.map((gradient) => {
          const chosen = String(settings[INDICATOR_GRADIENT_KEY] ?? "") === gradient.id;
          return (
            <button
              key={gradient.id}
              type="button"
              aria-pressed={chosen}
              title={gradient.label}
              onClick={() => set({ [INDICATOR_GRADIENT_KEY]: gradient.id })}
              className={`relative h-9 overflow-hidden border text-[9px] font-semibold transition-colors ${
                chosen ? "border-primary" : "border-border hover:border-primary/35"
              }`}
            >
              <span
                aria-hidden
                className="absolute inset-0"
                style={{ background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})` }}
              />
              <span className="relative z-10 px-1 text-[8px] uppercase tracking-[0.08em] text-white mix-blend-difference">
                {gradient.label}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        * The pickers still render while a scheme is on, greyed rather than
        * hidden. A control that vanishes reads as a bug; one that is visibly
        * locked says the scheme is what is deciding.
        */}
      <div className="space-y-2">
        {roles.map((role) => (
          <label
            key={role.key}
            className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/30 px-3 py-2 ${
              active ? "opacity-40" : ""
            }`}
          >
            <span className="text-[10px] text-muted">{role.label}</span>
            <ChartColorField
              ariaLabel={role.label}
              title={role.label}
              // Disabled by the control's own API rather than by covering it,
              // so it is unreachable by keyboard too while a scheme owns it.
              disabled={active}
              // The theme value when nothing is chosen, so an untouched picker
              // shows what is actually painted rather than an empty swatch.
              value={String(settings[role.key] ?? role.fallback(theme))}
              onChange={(next) => set({ [role.key]: next })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
