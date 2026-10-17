"use client";

import { Check, ChevronDown, LoaderCircle, WalletCards } from "lucide-react";
import { CALLING_CARD_CATALOG, type CallingCardDefinition, type SocialObject } from "@/lib/socials";
import CallingCardVisual from "@/components/socials/CallingCardVisual";

export default function ProfileCallingCardPicker({ userId, ownerName, cards, activeCode, savingCode, error, onEquip }: {
  userId: string;
  ownerName: string;
  cards: SocialObject[];
  activeCode: string;
  savingCode: string | null;
  error: string;
  onEquip: (definition: CallingCardDefinition) => Promise<void>;
}) {
  const earned = new Set(cards.filter(card => card.userId === userId && card.objectType === "card")
    .map(card => (card.payload as { code?: string }).code));
  const unlocked = CALLING_CARD_CATALOG.filter(card => card.starter || earned.has(card.code));

  return (
    <details className="mt-4 rounded-xl border border-border bg-background/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-[9px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <WalletCards className="h-4 w-4 text-primary" />Change calling card
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted" />
      </summary>
      <div className="border-t border-border p-3">
        <p className="mb-3 text-[8px] text-muted">Choose an unlocked card to activate it on your profile.</p>
        {error ? <p role="alert" className="mb-3 text-[9px] text-danger">{error}</p> : null}
        <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto p-1 sm:grid-cols-2 lg:grid-cols-3" aria-busy={savingCode !== null}>
          {unlocked.map(definition => {
            const active = definition.code === activeCode;
            const saving = definition.code === savingCode;
            return <button key={definition.code} type="button" aria-pressed={active}
              aria-label={`${active ? "Active calling card:" : "Activate calling card:"} ${definition.name}`}
              disabled={active || savingCode !== null} onClick={() => void onEquip(definition)}
              className={`overflow-hidden rounded-xl border text-left outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default ${active ? "border-primary bg-primary/10" : "border-border bg-panel hover:border-primary/50"}`}>
              <div className="pointer-events-none h-32 overflow-hidden" aria-hidden="true">
                <CallingCardVisual definition={definition} ownerName={ownerName} banner />
              </div>
              <span className="flex items-center gap-2 px-3 py-2.5 text-[9px] font-semibold">
                <span className="min-w-0 flex-1 truncate">{definition.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-[8px] text-primary">
                  {saving ? <LoaderCircle className="h-3 w-3 animate-spin" /> : active ? <Check className="h-3 w-3" /> : null}
                  {saving ? "Saving…" : active ? "Active" : "Activate"}
                </span>
              </span>
            </button>;
          })}
        </div>
      </div>
    </details>
  );
}
