"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ComponentType, type MouseEvent, type PointerEvent } from "react";

export type MobileWorkspaceAction = { label: string; onClick: () => void; active?: boolean };
type Item = { key: string; href: string; label: string; icon: ComponentType<{ className?: string }> };

/** Phone presentation only. Uses the same routes/actions as the desktop shell. */
export default function MobileWorkspaceNavigation({ items, activeItem, onNavigate, onPointerNavigate, actions = [] }: {
  items: Item[];
  activeItem: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, key: string, href: string) => void;
  onPointerNavigate: (event: PointerEvent<HTMLAnchorElement>, key: string) => void;
  actions?: MobileWorkspaceAction[];
}) {
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [activeItem]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const launcher = trigger.current;
    drawer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const stops = Array.from(drawer.current?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled)") ?? []);
      const first = stops[0], last = stops.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const phone = window.matchMedia("(max-width: 767px), (max-height: 500px) and (pointer: coarse)");
    const resize = () => { if (!phone.matches) setOpen(false); };
    document.addEventListener("keydown", keyboard);
    phone.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", keyboard);
      phone.removeEventListener("change", resize);
      if (previous?.isConnected) previous.focus(); else launcher?.focus();
    };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="kwant-phone-menu-trigger" aria-label="Open workspace menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} /></button>
    {open && typeof document !== "undefined" ? createPortal(
      <div className="kwant-phone-menu-layer">
        <button className="kwant-phone-scrim" type="button" aria-label="Close workspace menu" tabIndex={-1} onClick={() => setOpen(false)} />
        <div ref={drawer} role="dialog" aria-modal="true" aria-label="Workspace menu" className="kwant-phone-navigation">
          <div className="kwant-phone-drawer-heading"><strong>kwant desk</strong><button type="button" aria-label="Close workspace menu" onClick={() => setOpen(false)}><X size={20} /></button></div>
          {actions.length ? <section aria-label="Current workspace controls" className="kwant-phone-menu-actions">
            <h2>Workspace controls</h2>
            {actions.map((action, index) => <button key={`${action.label}:${index}`} type="button" aria-pressed={action.active} onClick={() => { setOpen(false); action.onClick(); }}>{action.label}</button>)}
          </section> : null}
          <nav aria-label="Mobile primary workspace">
            {items.map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} prefetch={false} aria-current={activeItem === key ? "page" : undefined}
              onPointerDown={event => onPointerNavigate(event, key)}
              onClick={event => { onNavigate(event, key, href); setOpen(false); }}><Icon className="h-5 w-5" /><span>{label}</span></Link>)}
          </nav>
        </div>
      </div>, document.body) : null}
  </>;
}
