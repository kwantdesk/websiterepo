"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type WorkspaceSubnavItem<T extends string> = {
  id: T;
  label: string;
  description?: string;
  icon: LucideIcon;
  badge?: ReactNode;
};

type WorkspaceSubnavProps<T extends string> = {
  items: readonly WorkspaceSubnavItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  trailing?: ReactNode;
  className?: string;
};

export default function WorkspaceSubnav<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  trailing,
  className = "",
}: WorkspaceSubnavProps<T>) {
  return (
    <nav
      className={`h-14 shrink-0 border-b border-border bg-panel px-3 lg:px-4 ${className}`}
      aria-label={ariaLabel}
    >
      <div className="flex h-full items-center gap-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-current={active ? "page" : undefined}
              className={`group relative flex h-10 shrink-0 items-center gap-2.5 rounded-xl border px-3 text-left transition-colors ${
                active
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent text-muted hover:border-border hover:bg-surface/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.1em]">{item.label}</span>
                {item.description ? (
                  <span className={`hidden whitespace-nowrap text-[7px] normal-case tracking-normal sm:block ${active ? "text-primary/70" : "text-muted"}`}>
                    {item.description}
                  </span>
                ) : null}
              </span>
              {item.badge ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[7px] font-semibold text-white">{item.badge}</span> : null}
              {active ? <span className="absolute -bottom-[7px] left-3 right-3 h-px bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
            </button>
          );
        })}
        {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </div>
    </nav>
  );
}
