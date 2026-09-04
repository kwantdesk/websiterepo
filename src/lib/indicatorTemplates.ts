/**
 * Saved settings templates, for every indicator rather than a chosen few.
 *
 * The footprint had its own template store and nothing else did, so a trader
 * who spent ten minutes colouring a MACD had no way to keep it, reuse it on
 * another chart, or move it to another machine. This is the same idea, generic:
 * one store keyed by indicator id, holding whole settings objects.
 *
 * Templates live in browser storage, so every read is defensive. A corrupt or
 * hand-edited entry must never take the settings panel down with it — a
 * template that cannot be understood is skipped, not thrown.
 */

import { writeProtectedItem } from "@/lib/browserStorageQuota";

export const INDICATOR_TEMPLATES_STORAGE_KEY = "kwantdesk:indicator-templates:v1";
export const INDICATOR_TEMPLATES_EVENT = "kwantdesk:indicator-templates-changed";

/** Guards a single pathological template against filling the whole quota. */
const MAX_TEMPLATE_BYTES = 128 * 1024;
/** Per indicator. Enough to be useful, bounded so storage cannot run away. */
export const MAX_TEMPLATES_PER_INDICATOR = 50;

export type IndicatorTemplate = {
  id: string;
  /** Which indicator it belongs to. A template is never valid across studies. */
  indicatorId: string;
  name: string;
  settings: Record<string, unknown>;
  updatedAt: string;
};

type TemplateStore = Record<string, IndicatorTemplate[]>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A stored entry turned into a template, or null when it cannot be trusted.
 *
 * `indicatorId` is taken from the store's own key rather than the entry, so a
 * template filed under one study can never claim to belong to another.
 */
function readTemplate(indicatorId: string, value: unknown): IndicatorTemplate | null {
  if (!isPlainRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;
  if (!isPlainRecord(value.settings)) return null;
  const id = typeof value.id === "string" && value.id ? value.id : `${indicatorId}-${name}`;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  return { id, indicatorId, name, settings: value.settings, updatedAt };
}

function readStore(raw: string | null): TemplateStore {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isPlainRecord(parsed)) return {};
  const store: TemplateStore = {};
  for (const [indicatorId, entries] of Object.entries(parsed)) {
    if (!Array.isArray(entries)) continue;
    const templates = entries
      .map((entry) => readTemplate(indicatorId, entry))
      .filter((entry): entry is IndicatorTemplate => entry !== null);
    if (templates.length) store[indicatorId] = templates;
  }
  return store;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadIndicatorTemplateStore(): TemplateStore {
  const storage = browserStorage();
  if (!storage) return {};
  try {
    return readStore(storage.getItem(INDICATOR_TEMPLATES_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function loadIndicatorTemplates(indicatorId: string): IndicatorTemplate[] {
  return loadIndicatorTemplateStore()[indicatorId] ?? [];
}

function persist(store: TemplateStore): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    // Templates are work, so a full quota evicts re-fetchable caches rather
    // than losing the settings the trader just named.
    if (!writeProtectedItem(INDICATOR_TEMPLATES_STORAGE_KEY, JSON.stringify(store), storage).ok) {
      return false;
    }
    window.dispatchEvent(new CustomEvent(INDICATOR_TEMPLATES_EVENT));
    // This key is part of the signed-in preference snapshot. The account sync
    // is event-driven, so without this event a template could remain only in
    // this browser until an unrelated setting happened to change.
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
    return true;
  } catch {
    // A full quota must not lose the settings the trader is working on; the
    // caller reports the failure instead.
    return false;
  }
}

export type TemplateWriteResult =
  | { ok: true; template: IndicatorTemplate; templates: IndicatorTemplate[] }
  | { ok: false; error: string };

/**
 * Save, or overwrite when the name already exists.
 *
 * Overwriting by name is deliberate: a trader tweaking "Scalping" and saving
 * it again means update, not a second entry with the same label that they can
 * no longer tell apart.
 */
export function saveIndicatorTemplate(
  indicatorId: string,
  name: string,
  settings: Record<string, unknown>,
  now = new Date().toISOString(),
): TemplateWriteResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name the template before saving it." };
  if (!isPlainRecord(settings)) return { ok: false, error: "These settings cannot be saved." };

  let serialised: string;
  try {
    serialised = JSON.stringify(settings);
  } catch {
    return { ok: false, error: "These settings cannot be saved." };
  }
  if (serialised.length > MAX_TEMPLATE_BYTES) {
    return { ok: false, error: "These settings are too large to store as a template." };
  }

  const store = loadIndicatorTemplateStore();
  const existing = store[indicatorId] ?? [];
  const match = existing.find((entry) => entry.name.toLowerCase() === trimmed.toLowerCase());
  if (!match && existing.length >= MAX_TEMPLATES_PER_INDICATOR) {
    return { ok: false, error: `Only ${MAX_TEMPLATES_PER_INDICATOR} templates are kept per indicator.` };
  }

  const template: IndicatorTemplate = {
    id: match?.id ?? `${indicatorId}-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${existing.length}`,
    indicatorId,
    name: trimmed,
    settings: JSON.parse(serialised) as Record<string, unknown>,
    updatedAt: now,
  };
  const templates = match
    ? existing.map((entry) => (entry.id === match.id ? template : entry))
    : [...existing, template];
  if (!persist({ ...store, [indicatorId]: templates })) {
    return { ok: false, error: "Browser storage is full or unavailable." };
  }
  return { ok: true, template, templates };
}

export function deleteIndicatorTemplate(indicatorId: string, templateId: string): IndicatorTemplate[] {
  const store = loadIndicatorTemplateStore();
  const templates = (store[indicatorId] ?? []).filter((entry) => entry.id !== templateId);
  const next = { ...store };
  if (templates.length) next[indicatorId] = templates;
  else delete next[indicatorId];
  persist(next);
  return templates;
}

/** A template as a file's worth of text. */
export function exportIndicatorTemplate(template: IndicatorTemplate): string {
  return JSON.stringify(
    {
      kind: "kwantdesk.indicator-template",
      version: 1,
      indicatorId: template.indicatorId,
      name: template.name,
      settings: template.settings,
    },
    null,
    2,
  );
}

/** Stable, filesystem-safe name for a shareable KwantDesk template file. */
export function indicatorTemplateFileName(template: Pick<IndicatorTemplate, "indicatorId" | "name">): string {
  const clean = `${template.indicatorId}-${template.name}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${clean || "kwantdesk-indicator-template"}.kwantdesk.json`;
}

export type TemplateImportResult =
  | { ok: true; name: string; settings: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Read an exported template back.
 *
 * The indicator id must match. Loading a footprint's settings into a MACD
 * would not error — it would quietly produce an indicator configured with keys
 * it does not understand, which is far harder to notice than a refusal.
 */
export function importIndicatorTemplate(indicatorId: string, raw: string): TemplateImportResult {
  if (raw.length > MAX_TEMPLATE_BYTES * 2) {
    return { ok: false, error: "That template file is too large." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file is not a saved template." };
  }
  if (!isPlainRecord(parsed)) return { ok: false, error: "That file is not a saved template." };
  if (parsed.kind !== "kwantdesk.indicator-template") {
    return { ok: false, error: "That file is not a saved template." };
  }
  if (parsed.version !== 1) {
    return { ok: false, error: "That template version is not supported by this KwantDesk release." };
  }
  if (typeof parsed.indicatorId === "string" && parsed.indicatorId !== indicatorId) {
    return { ok: false, error: `That template belongs to ${parsed.indicatorId}, not this indicator.` };
  }
  if (!isPlainRecord(parsed.settings)) {
    return { ok: false, error: "That template has no settings in it." };
  }
  const name = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "Imported";
  return { ok: true, name, settings: parsed.settings };
}
