"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { tradeSyncerConnectionLanes, tradeSyncerPremiumFeatures } from "@/lib/tradeSyncer";
import { TradeSyncerModal } from "@/components/trade-syncer/TradeSyncerControls";

function TradeSyncerIntegrationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const integration = searchParams.get("integration");
  const premium = searchParams.get("premium");
  const result = searchParams.get("result");
  const activeFeature = integration ?? premium;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-border bg-panel px-6 py-6">
        <div>
          <div className="text-[24px] font-semibold tracking-tight text-foreground">Integrations</div>
          <div className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Show the venues, infrastructure rails, and premium options that support the sync engine without mixing them into copier setup itself.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
          Dedicated infra and notification rails
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Supported Execution Lanes</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerConnectionLanes.map((lane) => (
              <div key={lane.venue} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-foreground">{lane.venue}</div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted">
                      {lane.status}
                    </span>
                    <Link
                      href={`/trade-syncer/integrations?integration=${encodeURIComponent(lane.venue)}`}
                      className="rounded-xl border border-border bg-panel px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      Open
                    </Link>
                  </div>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted">{lane.summary}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-panel p-6">
          <div className="text-[18px] font-semibold text-foreground">Premium and Notification Layer</div>
          <div className="mt-4 space-y-3">
            {tradeSyncerPremiumFeatures.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-border bg-background/40 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-foreground">{feature.title}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[12px] font-medium text-primary">{feature.price}</div>
                    <Link
                      href={`/trade-syncer/integrations?premium=${encodeURIComponent(feature.title)}`}
                      className="rounded-xl border border-border bg-panel px-3 py-1.5 text-[12px] text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      More
                    </Link>
                  </div>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted">{feature.summary}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {activeFeature ? (
        <TradeSyncerModal
          title={activeFeature}
          description="This mirrors the extra integration detail flow from Traders Connect instead of leaving these cards as dead-end marketing tiles."
          onClose={() => router.push("/trade-syncer/integrations")}
        >
          {result ? (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[13px] leading-6 text-primary">
              {result === "enabled"
                ? `${activeFeature} is marked ready. The next build should wire real entitlement and connection state here.`
                : `${activeFeature} request captured. This keeps the info flow alive while we wire the actual backend.`}
            </div>
          ) : null}
          <div className="rounded-2xl border border-border bg-background/40 p-4 text-[13px] leading-6 text-muted">
            Enable, purchase, or configure this integration rail here. The next real version should wire actual entitlement and notification settings into this modal.
          </div>
          <div className="mt-5 flex gap-3">
            <Link href="/trade-syncer/integrations" className="flex-1 rounded-xl border border-border bg-background/40 py-3 text-center text-[13px] text-foreground">
              Close
            </Link>
            <Link
              href={`/trade-syncer/integrations?${integration ? `integration=${encodeURIComponent(integration)}` : `premium=${encodeURIComponent(premium ?? "")}`}&result=enabled`}
              className="flex-1 rounded-xl bg-primary py-3 text-center text-[13px] font-semibold text-on-primary"
            >
              Continue
            </Link>
          </div>
        </TradeSyncerModal>
      ) : null}
    </div>
  );
}

export default function TradeSyncerIntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <TradeSyncerIntegrationsPageContent />
    </Suspense>
  );
}
