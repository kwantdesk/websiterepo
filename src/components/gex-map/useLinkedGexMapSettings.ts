"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_LINKED_GEX_MAP_SETTINGS, GEX_MAP_LINKED_SETTINGS_EVENT, GEX_MAP_LINKED_SETTINGS_KEY, hasLinkedGexMapSettings, normalizeLinkedGexMapSettings, publishLinkedGexMapSettings, readLinkedGexMapSettings, type LinkedGexMapSettings } from "@/lib/gexMapLinkedSettings";
import { mergeLinkedGexMapPanels } from "@/lib/gexMapLinkedSettings";

export function useLinkedGexMapSettingsState(enabled = true) {
  const [settings, setSettings] = useState(DEFAULT_LINKED_GEX_MAP_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!enabled) { setHydrated(false); return; }
    const sync = () => {
      const next = readLinkedGexMapSettings();
      setSettings((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const storage = (e: StorageEvent) => { if (e.key === GEX_MAP_LINKED_SETTINGS_KEY || e.key === null) sync(); };
    sync(); setHydrated(true); window.addEventListener(GEX_MAP_LINKED_SETTINGS_EVENT, sync); window.addEventListener("storage", storage);
    window.addEventListener("kwantdesk:preferences-hydrated", sync);
    return () => { window.removeEventListener(GEX_MAP_LINKED_SETTINGS_EVENT, sync); window.removeEventListener("storage", storage); window.removeEventListener("kwantdesk:preferences-hydrated", sync); };
  }, [enabled]);
  return { settings, hydrated: enabled && hydrated };
}
export function useLinkedGexMapSettings() { return useLinkedGexMapSettingsState().settings; }

/** One shared profile. Remote updates are acknowledged, never echoed as stale local changes. */
export function useGexMapSettingsBridge(local: LinkedGexMapSettings, apply: (settings: LinkedGexMapSettings) => void) {
  const shared = useLinkedGexMapSettings();
  const signature = JSON.stringify(normalizeLinkedGexMapSettings(local));
  const previous = useRef<string | null>(null), applied = useRef<string | null>(null), sharedSeen = useRef("");
  const [ready, setReady] = useState(false);
  const applyRef = useRef(apply); applyRef.current = apply;
  useEffect(() => {
    const next = normalizeLinkedGexMapSettings(local), sharedSignature = JSON.stringify(shared);
    const project = (value: LinkedGexMapSettings) => normalizeLinkedGexMapSettings({ ...value, panels: next.panels.map((p) => {
      const match = value.panels.find((v) => v.id === p.id && v.symbol === p.symbol);
      return match ? { ...p, greekMode: match.greekMode } : p;
    }) });
    if (previous.current === null) {
      previous.current = signature;
      sharedSeen.current = sharedSignature;
      if (hasLinkedGexMapSettings()) {
        const saved = project(readLinkedGexMapSettings()); applied.current = JSON.stringify(saved); applyRef.current(saved);
        if (applied.current === signature) setReady(true);
      } else { publishLinkedGexMapSettings(mergeLinkedGexMapPanels(next, readLinkedGexMapSettings())); setReady(true); }
      return;
    }
    if (signature !== previous.current) {
      previous.current = signature;
      if (signature === applied.current) { applied.current = null; sharedSeen.current = sharedSignature; setReady(true); return; }
      applied.current = null;
      const published = publishLinkedGexMapSettings(mergeLinkedGexMapPanels(next, readLinkedGexMapSettings()));
      sharedSeen.current = JSON.stringify(published);
      return;
    }
    if (sharedSignature !== sharedSeen.current) {
      sharedSeen.current = sharedSignature;
      const value = project(shared), valueSignature = JSON.stringify(value);
      applied.current = valueSignature === signature ? null : valueSignature;
      applyRef.current(value);
    }
    // The serialized signature represents all fields; stable refs avoid reapplying on ordinary renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, shared]);
  return ready;
}
