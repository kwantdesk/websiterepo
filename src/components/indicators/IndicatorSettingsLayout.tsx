"use client";

import { Children, Fragment, cloneElement, isValidElement, useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

type Placement = "visibility" | "colours" | "navigation";
type Entry = { section: string; placement?: Placement; node: ReactNode; children?: ReactNode };

/** One structure for every study: visibility, colours, one tab rail, settings. */
export default function IndicatorSettingsLayout({ children }: { children: ReactNode }) {
  const collect = (nodes: ReactNode, parent = "settings"): Entry[] =>
    Children.toArray(nodes).flatMap((child, index) => {
      if (!isValidElement(child)) return [];
      const key = `${parent}/${child.key ?? index}`;
      const props = child.props as {
        children?: ReactNode;
        "data-settings-section"?: string;
        "data-settings-header"?: Placement;
      };
      if (child.type === Fragment) return collect(props.children, key);
      return [{ section: props["data-settings-section"] ?? "General", placement: props["data-settings-header"],
        children: props.children, node: <Fragment key={key}>{child}</Fragment> }];
    });
  const entries = collect(children);
  const content = entries.filter(entry => !entry.placement);
  const sections = [...new Set(content.map(entry => entry.section))];
  if (sections.includes("General")) {
    sections.splice(sections.indexOf("General"), 1);
    sections.unshift("General");
  }
  const [active, setActive] = useState("General");
  const current = sections.includes(active) ? active : sections[0] ?? "General";
  const navigation = entries.find(entry => entry.placement === "navigation");
  const colours = entries.filter(entry => entry.placement === "colours");

  return <div className="kwant-indicator-settings-body min-h-0 flex-1 space-y-4 overflow-y-auto" data-indicator-settings-layout>
    <div data-indicator-settings-visibility>{entries.filter(entry => entry.placement === "visibility").map(entry => entry.node)}</div>
    <div data-indicator-settings-colours className="space-y-3">
      {colours.length ? colours.map(entry => entry.node) : <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-3 text-[11px] text-muted">No separate colour controls for this indicator.</div>}
    </div>
    <div data-indicator-settings-tabs={navigation ? "profile" : "sections"}
      className="kwant-indicator-settings-tabs sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-panel pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {navigation ? Children.map(navigation.children, child => {
        if (!isValidElement(child)) return child;
        const button = child as ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>;
        return cloneElement(button, {
          "aria-pressed": current === "General" && button.props["aria-pressed"],
          onClick: event => { setActive("General"); button.props.onClick?.(event); },
        });
      }) : null}
      {sections.filter(section => !navigation || section !== "General").map(section => <button key={section} type="button"
        aria-pressed={section === current} onClick={() => setActive(section)}
        className={`shrink-0 whitespace-nowrap border transition-colors ${section === current ? "border-primary/55 bg-primary/10 text-primary" : "border-transparent bg-background text-muted hover:border-border hover:text-foreground"}`}>
        {section}
      </button>)}
    </div>
    <div data-indicator-settings-content className="space-y-4">
      {content.filter(entry => entry.section === current).map(entry => entry.node)}
    </div>
  </div>;
}
